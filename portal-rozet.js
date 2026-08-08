// ══════════════════════════════════════════════════════════════
// PORTAL · GELİŞİM ROZETLERİ MODÜLÜ
// --------------------------------------------------------------
// Faz 9+ · 2026-08-08
//
// Rozetler OTOMATİK türetilir — öğretmene ek veri girişi yoktur.
// Kaynak: ogrenciGelisim/{ogrenciId} içindeki S/T/U kayıtları.
//
// ÇALIŞMA MANTIĞI
//   1. Öğretmen eğitim matrisinde bir kazanımı işaretler
//   2. gelisimDersGuncelle() kaydeder, ardından rozetleriDegerlendir()
//      çağrılır
//   3. Yeni hak edilen rozet varsa Firestore'a TARİHİYLE damgalanır:
//        ogrenciGelisim/{id}.rozetler = { rozetKodu: "2026-08-08T..." }
//   4. Veliye bildirim düşer
//
// Tarih damgası bir kez atılır, bir daha değişmez. Bu sayede
// "en yeni rozet en üstte" sıralaması mümkün olur.
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { db, doc, getDoc, setDoc, collection, addDoc, escapeHtml } = B;

// ══════════════════════════════════════════════════════════════
// ROZET TANIMLARI
// kod    : Firestore anahtarı (asla değiştirme — geçmiş bozulur)
// ad     : Veliye görünen isim
// ikon   : Lucide ikon adı
// renk   : Rozet arka plan rengi (okul paletinden)
// kosul  : (istatistik) => true/false
// ══════════════════════════════════════════════════════════════
const ROZETLER = [
  // ── Başlangıç ──
  { kod: "ilk_adim", ad: "İlk Adım", aciklama: "Eğitim yolculuğu başladı",
    ikon: "footprints", renk: "#7CB97C",
    kosul: (i) => i.toplamCalisilan >= 1 },

  { kod: "ilk_uzmanlik", ad: "İlk Uzmanlık", aciklama: "İlk kazanım içselleştirildi",
    ikon: "sparkles", renk: "#F9E9B8",
    kosul: (i) => i.toplamUzman >= 1 },

  // ── Uzmanlık sayısı kilometre taşları ──
  { kod: "uzman_5", ad: "5 Kazanım", aciklama: "5 kazanımda uzmanlaştı",
    ikon: "star", renk: "#F6D5DC",
    kosul: (i) => i.toplamUzman >= 5 },

  { kod: "uzman_15", ad: "15 Kazanım", aciklama: "15 kazanımda uzmanlaştı",
    ikon: "award", renk: "#D6E6F2",
    kosul: (i) => i.toplamUzman >= 15 },

  { kod: "uzman_30", ad: "30 Kazanım", aciklama: "30 kazanımda uzmanlaştı",
    ikon: "medal", renk: "#E0D7F0",
    kosul: (i) => i.toplamUzman >= 30 },

  { kod: "uzman_50", ad: "50 Kazanım", aciklama: "50 kazanımda uzmanlaştı",
    ikon: "trophy", renk: "#F9E9B8",
    kosul: (i) => i.toplamUzman >= 50 },

  // ── Disiplin bazlı ilerleme ──
  { kod: "montessori_yolda", ad: "Montessori Yolunda", aciklama: "Montessori'de %25 uzmanlık",
    ikon: "trees", renk: "#7CB97C",
    kosul: (i) => i.disiplin.montessori >= 25 },

  { kod: "montessori_usta", ad: "Montessori Ustası", aciklama: "Montessori'de %60 uzmanlık",
    ikon: "tree-pine", renk: "#4A7C59",
    kosul: (i) => i.disiplin.montessori >= 60 },

  { kod: "ingilizce_yolda", ad: "İngilizce Yolunda", aciklama: "İngilizce'de %25 uzmanlık",
    ikon: "languages", renk: "#D6E6F2",
    kosul: (i) => i.disiplin.ingilizce >= 25 },

  { kod: "ingilizce_usta", ad: "İngilizce Ustası", aciklama: "İngilizce'de %60 uzmanlık",
    ikon: "globe", renk: "#B8D4E8",
    kosul: (i) => i.disiplin.ingilizce >= 60 },

  { kod: "degerler_yolda", ad: "Değerler Yolunda", aciklama: "Değerler'de %25 uzmanlık",
    ikon: "heart", renk: "#F6D5DC",
    kosul: (i) => i.disiplin.degerler >= 25 },

  { kod: "degerler_usta", ad: "Değerler Ustası", aciklama: "Değerler'de %60 uzmanlık",
    ikon: "heart-handshake", renk: "#E8B4C4",
    kosul: (i) => i.disiplin.degerler >= 60 },

  // ── Bütünlük ──
  { kod: "uc_disiplin", ad: "Üç Yolda Birden", aciklama: "Her üç disiplinde de çalışma var",
    ikon: "layers", renk: "#E0D7F0",
    kosul: (i) => i.disiplinCalisilan >= 3 },

  { kod: "alan_tamam", ad: "Alan Tamamlandı", aciklama: "Bir gelişim alanının tamamında uzmanlaştı",
    ikon: "circle-check-big", renk: "#7CB97C",
    kosul: (i) => i.tamamlananAlan >= 1 },

  { kod: "alan_tamam_3", ad: "Üç Alan Tamam", aciklama: "Üç gelişim alanı tamamlandı",
    ikon: "shield-check", renk: "#4A7C59",
    kosul: (i) => i.tamamlananAlan >= 3 }
];

// ══════════════════════════════════════════════════════════════
// İSTATİSTİK ÇIKARIMI
// Gelişim verisinden rozet koşullarının baktığı sayıları üretir.
// ══════════════════════════════════════════════════════════════
function rozetIstatistigiCikar(gelisimVerisi, mufredatlar) {
  const sonuc = {
    toplamCalisilan: 0,      // S + T + U toplamı
    toplamUzman: 0,          // yalnızca U
    disiplin: { montessori: 0, ingilizce: 0, degerler: 0 },  // uzmanlık yüzdesi
    disiplinCalisilan: 0,    // kaç disiplinde en az 1 işaret var
    tamamlananAlan: 0        // tüm kazanımları U olan alan sayısı
  };
  if (!gelisimVerisi) return sonuc;

  for (const disiplinId of ["montessori", "ingilizce", "degerler"]) {
    const veri = gelisimVerisi[disiplinId];
    const kayitlar = (veri && veri.kayitlar) || {};
    const mufredat = (mufredatlar && mufredatlar[disiplinId]) || null;

    const degerler = Object.values(kayitlar);
    const calisilan = degerler.filter(v => v === "S" || v === "T" || v === "U").length;
    const uzman = degerler.filter(v => v === "U").length;

    sonuc.toplamCalisilan += calisilan;
    sonuc.toplamUzman += uzman;
    if (calisilan > 0) sonuc.disiplinCalisilan++;

    if (mufredat && mufredat.length) {
      let toplamKazanim = 0;
      mufredat.forEach(alan => {
        let alanToplam = 0, alanUzman = 0;
        (alan.gruplar || []).forEach(g => {
          (g.dersler || []).forEach(d => {
            alanToplam++;
            toplamKazanim++;
            if (kayitlar[`${alan.id}__${g.ad}__${d}`] === "U") alanUzman++;
          });
        });
        // Alan tamamlandı: en az 3 kazanımı olan ve hepsi U olan alan
        if (alanToplam >= 3 && alanUzman === alanToplam) sonuc.tamamlananAlan++;
      });
      sonuc.disiplin[disiplinId] = toplamKazanim
        ? Math.round((uzman / toplamKazanim) * 100) : 0;
    }
  }
  return sonuc;
}

// ══════════════════════════════════════════════════════════════
// DEĞERLENDİRME + DAMGALAMA
// Öğretmen kayıt yaptıktan sonra çağrılır.
// Yeni hak edilen rozetleri Firestore'a tarihiyle yazar,
// veliye bildirim düşer. Kazanılmış rozet asla geri alınmaz.
// ══════════════════════════════════════════════════════════════
async function rozetleriDegerlendir(ogrenciId, mufredatlar) {
  if (!ogrenciId) return [];
  try {
    const ref = doc(db, "ogrenciGelisim", ogrenciId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];
    const veri = snap.data() || {};

    const istat = rozetIstatistigiCikar(veri, mufredatlar || window.aktifMufredatlar);
    const mevcut = veri.rozetler || {};
    const yeniler = [];
    const damga = new Date().toISOString();

    for (const r of ROZETLER) {
      if (mevcut[r.kod]) continue;          // zaten kazanılmış — tarihi korunur
      let hakEtti = false;
      try { hakEtti = !!r.kosul(istat); } catch (e) { hakEtti = false; }
      if (hakEtti) {
        mevcut[r.kod] = damga;
        yeniler.push(r);
      }
    }

    if (!yeniler.length) return [];

    await setDoc(ref, { rozetler: mevcut }, { merge: true });
    console.log("[Rozet] Yeni kazanılan:", yeniler.map(r => r.ad).join(", "));

    // Veliye bildirim
    try { await rozetBildirimGonder(ogrenciId, yeniler); }
    catch (e) { console.warn("[Rozet] bildirim", e?.message); }

    return yeniler;
  } catch (e) {
    console.warn("[Rozet] değerlendirme hatası:", e?.message);
    return [];
  }
}

// Velilere bildirim düş
async function rozetBildirimGonder(ogrenciId, yeniRozetler) {
  const ogrenci = (B.ogrenciler() || []).find(o => o.id === ogrenciId);
  if (!ogrenci) return;

  // Öğrencinin veli e-postaları
  const ayar = (B.ayarlar() || {})[ogrenciId] || {};
  const adaylar = [
    ogrenci.veliEposta, ogrenci.veliEmail,
    ayar.anne && ayar.anne.eposta,
    ayar.baba && ayar.baba.eposta,
    ayar.vasi && ayar.vasi.eposta
  ].filter(Boolean).map(e => String(e).trim().toLowerCase());
  const aliciListe = [...new Set(adaylar)];
  if (!aliciListe.length) return;

  const ogrAd = ogrenci.ogrenciAdSoyad || ogrenci.adSoyad || "Çocuğunuz";
  const metin = yeniRozetler.length === 1
    ? `${ogrAd} "${yeniRozetler[0].ad}" rozetini kazandı 🎉`
    : `${ogrAd} ${yeniRozetler.length} yeni rozet kazandı: ${yeniRozetler.map(r => r.ad).join(", ")} 🎉`;

  await Promise.all(aliciListe.map(em => addDoc(collection(db, "bildirimler"), {
    aliciEmail: em,
    tip: "rozet",
    baslik: "Yeni gelişim rozeti",
    metin: metin,
    hedefSayfa: "gelisim",
    ogrenciId: ogrenciId,
    okundu: false,
    olusturuldu: new Date().toISOString()
  })));
}

// ══════════════════════════════════════════════════════════════
// GÖRÜNTÜLEME
// ══════════════════════════════════════════════════════════════

// Kazanılmış rozetleri EN YENİ İLK SIRADA döndürür
function rozetleriSirala(gelisimVerisi) {
  const kazanilan = (gelisimVerisi && gelisimVerisi.rozetler) || {};
  return ROZETLER
    .filter(r => kazanilan[r.kod])
    .map(r => ({ ...r, tarih: kazanilan[r.kod] }))
    .sort((a, b) => String(b.tarih).localeCompare(String(a.tarih)));  // yeni → eski
}

function rozetTarihMetni(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const bugun = new Date();
  const farkGun = Math.floor((bugun - d) / 86400000);
  if (farkGun <= 0) return "bugün";
  if (farkGun === 1) return "dün";
  if (farkGun < 7) return farkGun + " gün önce";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

// ── ÇOCUK KARTI ALTI: kompakt şerit (en fazla 4 + kalanı sayı) ──
function rozetSeridiHTML(gelisimVerisi, limit = 4) {
  const liste = rozetleriSirala(gelisimVerisi);
  if (!liste.length) {
    return `<div class="ca-rozet-serit ca-rozet-bos">
      <i data-lucide="sparkles" style="width:13px;height:13px;"></i>
      <span>İlk rozetler eğitim gözlemleri işlendikçe burada belirecek.</span>
    </div>`;
  }
  const gosterilen = liste.slice(0, limit);
  const kalan = liste.length - gosterilen.length;
  return `<div class="ca-rozet-serit" onclick="event.stopPropagation(); caGo('gelisim');" title="Tüm rozetleri gör">
    ${gosterilen.map((r, i) => `
      <span class="ca-rozet-cip${i === 0 ? " yeni" : ""}" style="background:${r.renk};" title="${escapeHtml(r.aciklama)} · ${rozetTarihMetni(r.tarih)}">
        <i data-lucide="${r.ikon}" style="width:12px;height:12px;"></i>
        <span>${escapeHtml(r.ad)}</span>
      </span>`).join("")}
    ${kalan > 0 ? `<span class="ca-rozet-cip ca-rozet-daha">+${kalan}</span>` : ""}
  </div>`;
}

// ── GELİŞİM EKRANI: tam liste (kart görünümü) ──
function rozetTamListeHTML(gelisimVerisi) {
  const liste = rozetleriSirala(gelisimVerisi);
  const kazanilanKodlar = new Set(liste.map(r => r.kod));
  const kilitli = ROZETLER.filter(r => !kazanilanKodlar.has(r.kod));

  const kart = (r, acik) => `
    <div class="ca-rozet-kart${acik ? "" : " kilitli"}">
      <div class="ca-rozet-ikon" style="background:${acik ? r.renk : "#E8E8E8"};">
        <i data-lucide="${acik ? r.ikon : "lock"}" style="width:17px;height:17px;"></i>
      </div>
      <div class="ca-rozet-bilgi">
        <div class="ca-rozet-ad">${escapeHtml(r.ad)}</div>
        <div class="ca-rozet-aciklama">${escapeHtml(r.aciklama)}</div>
      </div>
      ${acik ? `<div class="ca-rozet-tarih">${rozetTarihMetni(r.tarih)}</div>` : ""}
    </div>`;

  return `
    <div class="ca-sectionhead" style="margin-top:18px;">
      <h3 class="ca-head" style="font-size:15px;">Rozetler</h3>
      <span class="ca-tile-sub">${liste.length}/${ROZETLER.length} kazanıldı</span>
    </div>
    ${liste.length
      ? `<div class="ca-rozet-liste">${liste.map(r => kart(r, true)).join("")}</div>`
      : `<div class="ca-card" style="padding:16px; font-size:13px; color:var(--c-muted);">
           Henüz rozet kazanılmadı. Öğretmen eğitim gözlemlerini işledikçe rozetler otomatik açılır.
         </div>`}
    ${kilitli.length
      ? `<div class="ca-rozet-kilitli-baslik">Sıradaki hedefler</div>
         <div class="ca-rozet-liste">${kilitli.slice(0, 4).map(r => kart(r, false)).join("")}</div>`
      : ""}
  `;
}

// ── Dışa aç ──
window.BCK_ROZET = {
  tanimlar: ROZETLER,
  degerlendir: rozetleriDegerlendir,
  sirala: rozetleriSirala,
  seritHTML: rozetSeridiHTML,
  tamListeHTML: rozetTamListeHTML,
  istatistik: rozetIstatistigiCikar
};
console.log("Rozet modülü yüklendi ·", ROZETLER.length, "rozet tanımlı.");
