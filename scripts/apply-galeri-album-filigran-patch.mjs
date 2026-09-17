import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const galeriPath = 'portal-galeri.js';
const swPath = 'serviceworker.js';
let src = readFileSync(galeriPath, 'utf8');

function replaceOnce(oldText, newText, label) {
  const i = src.indexOf(oldText);
  if (i < 0) throw new Error(`Patch noktası bulunamadı: ${label}`);
  if (src.indexOf(oldText, i + oldText.length) >= 0) {
    throw new Error(`Patch noktası birden fazla eşleşti: ${label}`);
  }
  src = src.slice(0, i) + newText + src.slice(i + oldText.length);
}

function replaceAllChecked(oldText, newText, minCount, label) {
  const parts = src.split(oldText);
  const count = parts.length - 1;
  if (count < minCount) throw new Error(`${label}: beklenen en az ${minCount}, bulunan ${count}`);
  src = parts.join(newText);
}

const programFn = `function galeriProgramKodu(g) {
  const ham = String(g?.program || g?.kategori || g?.etkinlikBaslik || "");
  if (GALERI_EGITIM_PROGRAMLARI[ham]) return ham;
  const n = ham.toLocaleLowerCase("tr");
  if (n.includes("montessori")) return "montessori";
  if (n.includes("orman")) return "orman";
  if (n.includes("değerler+") || n.includes("degerler+")) return "degerlerPlus";
  if (n.includes("değer") || n.includes("deger")) return "degerler";
  if (n.includes("ingiliz") || n.includes("english")) return "ingilizce";
  return "";
}`;

const helper = `${programFn}

// Galeri hedeflerinde eski/yeni sınıf adlarını aynı resmi sınıfa indirger.
function galeriSinifEslesir(a, b) {
  const norm = (x) => String(sinifAdiResmiEsle(x) || x || "")
    .toLocaleLowerCase("tr").replace(/\\s+/g, "").trim();
  const aa = norm(a), bb = norm(b);
  return !!aa && aa === bb;
}

// Aynı albüme sonradan içerik eklendiğinde de aynı kimlik üretilsin.
function galeriAlbumIdUret(tarih, baslik, hedefTur, hedefDeger) {
  const ham = [tarih, baslik, hedefTur, hedefDeger].map(x => String(x || "").trim().toLocaleLowerCase("tr")).join("|");
  let h = 2166136261;
  for (let i = 0; i < ham.length; i++) {
    h ^= ham.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "alb_" + (h >>> 0).toString(36);
}

// Yüklemeden önce fotoğrafın fiziksel piksel verisine filigran işler.
// %60 saydamlık = %40 görünürlük (alpha 0.40).
async function galeriFiligranEkle(dosya, dosyaAdi = "foto.jpg") {
  if (!dosya || !(dosya instanceof Blob)) return dosya;
  return new Promise((resolve) => {
    let objectUrl = "";
    try {
      objectUrl = URL.createObjectURL(dosya);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx || !canvas.width || !canvas.height) throw new Error("Canvas hazırlanamadı");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const kisa = Math.min(canvas.width, canvas.height);
          const ustBoy = Math.max(14, Math.round(kisa * 0.055));
          const altBoy = Math.max(8, Math.round(ustBoy * 0.34));
          const pay = Math.max(10, Math.round(kisa * 0.035));
          const alpha = 0.40;
          const altMetin = "Bir Çiçek Koleji Anaokulu";

          ctx.textAlign = "right";
          ctx.textBaseline = "alphabetic";
          ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
          ctx.shadowColor = "rgba(0,0,0," + (alpha * 0.8) + ")";
          ctx.shadowBlur = Math.max(2, Math.round(ustBoy * 0.12));

          const sagX = canvas.width - pay;
          const altY = canvas.height - pay;
          ctx.font = "600 " + altBoy + "px -apple-system, Helvetica Neue, Arial, sans-serif";
          const altGen = ctx.measureText(altMetin).width;
          const altSon = altGen > canvas.width - pay * 2
            ? Math.max(7, Math.floor(altBoy * (canvas.width - pay * 2) / altGen))
            : altBoy;
          ctx.font = "600 " + altSon + "px -apple-system, Helvetica Neue, Arial, sans-serif";
          ctx.fillText(altMetin, sagX, altY);
          ctx.font = "800 " + ustBoy + "px -apple-system, Helvetica Neue, Arial, sans-serif";
          ctx.fillText("BÇKA", sagX, altY - altSon - Math.round(ustBoy * 0.18));

          canvas.toBlob((blob) => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            if (!blob) return resolve(dosya);
            const kok = String(dosyaAdi || "foto").replace(/\\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
            resolve(new File([blob], kok + ".jpg", { type: "image/jpeg", lastModified: Date.now() }));
          }, "image/jpeg", 0.90);
        } catch (e) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          console.warn("Galeri filigranı uygulanamadı; özgün dosya kullanılacak:", e);
          resolve(dosya);
        }
      };
      img.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(dosya);
      };
      img.src = objectUrl;
    } catch (e) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(dosya);
    }
  });
}`;
replaceOnce(programFn, helper, 'yardımcı fonksiyonlar');

replaceOnce(
`  if (hedefTur === "sinif") {
    hedefDeger = document.getElementById("galeriHedefSinif").value;
    if (!hedefDeger) return showToast("Sınıf seçin", "error");
    // Öğretmen yalnızca atandığı sınıfa yükleyebilir
    if (B.rol() === "ogretmen" && typeof sinifGorunur === "function" && !sinifGorunur(hedefDeger)) {
      return showToast("Yalnızca kendi sınıfınıza medya yükleyebilirsiniz", "error");
    }
  } else if (hedefTur === "ogrenci") {`,
`  if (hedefTur === "sinif") {
    const secilenSinif = document.getElementById("galeriHedefSinif").value;
    if (!secilenSinif) return showToast("Sınıf seçin", "error");
    // Yetki kontrolünü ekrandaki sınıf adıyla yap; kayıtta resmi adı sakla.
    if (B.rol() === "ogretmen" && typeof sinifGorunur === "function" && !sinifGorunur(secilenSinif)) {
      return showToast("Yalnızca kendi sınıfınıza medya yükleyebilirsiniz", "error");
    }
    hedefDeger = sinifAdiResmiEsle(secilenSinif) || secilenSinif;
  } else if (hedefTur === "ogrenci") {`,
'sınıf hedefi normalizasyonu');

replaceOnce(
`  const klasorPath = \`galeri/\${hedefPath}/\${etkinlikSlug}\`;

  let basarili = 0, hatali = 0;`,
`  const klasorPath = \`galeri/\${hedefPath}/\${etkinlikSlug}\`;

  const albumOlustur = Boolean(albumEkleMod) || galeriSecilenDosyalar.length > 1 || window._galeriYuklemeMod === "album";
  const albumId = albumOlustur ? galeriAlbumIdUret(etkinlikTarih, etkinlik, hedefTur, hedefDeger) : "";

  let basarili = 0, hatali = 0;`,
'albüm kimliği');

replaceOnce(
`        hedefOgrenciId: (hedefTur === "ogrenci" ? hedefDeger : ""),
        yukleyen: B.kullanici().email,`,
`        hedefOgrenciId: (hedefTur === "ogrenci" ? hedefDeger : ""),
        albumId,
        albumSira: i + 1,
        albumToplam: galeriSecilenDosyalar.length,
        albumMu: albumOlustur,
        yukleyen: B.kullanici().email,`,
'albüm metadata');

replaceOnce(
`        // FOTOĞRAF - sıkıştır ve GÜVENLİ proxy üzerinden yükle (medya.js)
        const sikistirilmis = await resimSikistir(f, 1920, 0.85);
        // medyaYukle proxy'ye gönderir, API key tarayıcıda görünmez
        const sonuc = await medyaYukle(sikistirilmis, klasorPath);
        oge.dosyaTipi = "foto";
        oge.bunnyUrl = sonuc.url;
        oge.kucukResim = sonuc.url; // fotoğraf için aynı (thumbnail Bunny ?width ile)
        oge.bunnyPath = sonuc.yol;
        oge.dosyaBoyutu = sikistirilmis.size;`,
`        // FOTOĞRAF - sıkıştır, filigranı fiziksel dosyaya işle ve güvenli proxy üzerinden yükle.
        const sikistirilmis = await resimSikistir(f, 1920, 0.85);
        const filigranli = await galeriFiligranEkle(sikistirilmis, f.name);
        const sonuc = await medyaYukle(filigranli, klasorPath);
        oge.dosyaTipi = "foto";
        oge.bunnyUrl = sonuc.url;
        oge.kucukResim = sonuc.url;
        oge.bunnyPath = sonuc.yol;
        oge.dosyaBoyutu = filigranli.size;
        oge.filigran = {
          uygulandi: true,
          ustMetin: "BÇKA",
          altMetin: "Bir Çiçek Koleji Anaokulu",
          saydamlik: 0.60,
          gorunurluk: 0.40
        };`,
'filigranlı yükleme');

replaceOnce(
`    const kendiS = B.rol() === "ogretmen" && hedefTur === "sinif" &&
                   (typeof sinifGorunur === "function" ? sinifGorunur(hedefDeger) : false);
    if (sonDurum && !(yonetimR || kendiS)) {`,
`    if (sonDurum && !yonetimR) {`,
'öğretmen onay durumu mesajı');

replaceAllChecked(
`else if (hedefTur === "sinif" && ogrSinif === hedefDeger) dahil = true;`,
`else if (hedefTur === "sinif" && galeriSinifEslesir(ogrSinif, hedefDeger)) dahil = true;`,
2,
'sınıf bildirim eşleşmesi');

replaceOnce(
`        if (g.hedefTur === "sinif" && g.hedefDeger === sinif) return true;`,
`        if (g.hedefTur === "sinif" && galeriSinifEslesir(g.hedefDeger, sinif)) return true;`,
'eski veli görünümü sınıf filtresi');

replaceOnce(
`    const anahtar = egitimAlbumu
      ? \`egitim|\${programKodu}\`
      : \`\${albumTarih}|\${albumBaslik}|\${g.hedefTur || ""}|\${g.hedefDeger || ""}\`;`,
`    const anahtar = egitimAlbumu
      ? \`egitim|\${programKodu}\`
      : (g.albumId
          ? \`album|\${g.albumId}\`
          : \`\${albumTarih}|\${albumBaslik}|\${g.hedefTur || ""}|\${g.hedefDeger || ""}\`);`,
'admin albüm gruplama');

replaceOnce(
`    const albumAdi = secilen.etkinlikBaslik || "Diğer";

    // Aynı albümdeki eski kapağı kaldır
    const eskiler = hepsi.filter(x => (x.etkinlikBaslik || "Diğer") === albumAdi && x.kapak && x.id !== medyaId);`,
`    const albumId = secilen.albumId || "";
    const albumAdi = secilen.etkinlikBaslik || "Diğer";

    // Yeni kayıtlarda albumId, eski kayıtlarda başlık geriye uyum anahtarıdır.
    const eskiler = hepsi.filter(x => x.kapak && x.id !== medyaId &&
      (albumId ? x.albumId === albumId : (x.etkinlikBaslik || "Diğer") === albumAdi));`,
'albüm kapak gruplama');

if (!src.includes('const alpha = 0.40;')) throw new Error('Filigran alpha doğrulanamadı');
if (!src.includes('albumId,')) throw new Error('Albüm metadata doğrulanamadı');
if (!src.includes('galeriSinifEslesir')) throw new Error('Sınıf eşleşmesi doğrulanamadı');

writeFileSync(galeriPath, src, 'utf8');
execFileSync(process.execPath, ['--check', galeriPath], { stdio: 'inherit' });

let sw = readFileSync(swPath, 'utf8');
if (!sw.includes('const CACHE_VERSION = "v110";') && !sw.includes('const CACHE_VERSION = "v111";')) {
  throw new Error('Service worker cache sürümü beklenmeyen değerde');
}
sw = sw.replace('const CACHE_VERSION = "v110";', 'const CACHE_VERSION = "v111";');
writeFileSync(swPath, sw, 'utf8');
console.log('Galeri albüm + filigran patch başarıyla uygulandı.');
