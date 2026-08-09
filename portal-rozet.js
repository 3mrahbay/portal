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
const { db, doc, getDoc, getDocs, setDoc, collection, addDoc, escapeHtml } = B;

// ══════════════════════════════════════════════════════════════
// ROZET TANIMLARI
// kod    : Firestore anahtarı (asla değiştirme — geçmiş bozulur)
// ad     : Veliye görünen isim
// ikon   : Lucide ikon adı
// renk   : Rozet arka plan rengi (okul paletinden)
// kosul  : (istatistik) => true/false
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// ÖLÇÜTLER — rozet koşullarının bakabileceği sayılar
// Koşullar artık FONKSİYON DEĞİL, VERİ. Firestore'da saklanabilsin
// ve ZEKY de aynı tanımları okuyabilsin diye.
// ══════════════════════════════════════════════════════════════
const OLCUTLER = {
  toplamCalisilan:   { ad: "Toplam çalışılan kazanım", birim: "adet",
                       aciklama: "S, T veya U işaretlenmiş kazanım sayısı" },
  toplamUzman:       { ad: "Uzmanlaşılan kazanım", birim: "adet",
                       aciklama: "U işaretlenmiş kazanım sayısı" },
  disiplinYuzde:     { ad: "Bir programdaki uzmanlık yüzdesi", birim: "%",
                       aciklama: "Seçilen programda U oranı", disiplinGerekir: true },
  disiplinCalisilan: { ad: "Çalışılan program sayısı", birim: "adet",
                       aciklama: "En az bir işaret bulunan program sayısı" },
  tamamlananAlan:    { ad: "Tamamlanan alan", birim: "adet",
                       aciklama: "Tüm kazanımları U olan alan (en az 3 kazanımlı)" }
};

// ══════════════════════════════════════════════════════════════
// VARSAYILAN TANIMLAR
// Firestore'daki rozetTanimlari koleksiyonu BOŞSA bunlar kullanılır.
// Yani taşıma yapılmadan da sistem eskisi gibi çalışır.
// kod : Firestore anahtarı — ASLA DEĞİŞTİRME, kazanılmış rozetler bozulur
// ══════════════════════════════════════════════════════════════
const VARSAYILAN_ROZETLER = [
  { kod: "ilk_adim", ad: "İlk Adım", aciklama: "Eğitim yolculuğu başladı",
    ikon: "footprints", renk: "#7CB97C", olcut: "toplamCalisilan", esik: 1, sira: 1 },

  { kod: "ilk_uzmanlik", ad: "İlk Uzmanlık", aciklama: "İlk kazanım içselleştirildi",
    ikon: "sparkles", renk: "#F9E9B8", olcut: "toplamUzman", esik: 1, sira: 2 },

  { kod: "uzman_5", ad: "5 Kazanım", aciklama: "5 kazanımda uzmanlaştı",
    ikon: "star", renk: "#F6D5DC", olcut: "toplamUzman", esik: 5, sira: 3 },

  { kod: "uzman_15", ad: "15 Kazanım", aciklama: "15 kazanımda uzmanlaştı",
    ikon: "award", renk: "#D6E6F2", olcut: "toplamUzman", esik: 15, sira: 4 },

  { kod: "uzman_30", ad: "30 Kazanım", aciklama: "30 kazanımda uzmanlaştı",
    ikon: "medal", renk: "#E0D7F0", olcut: "toplamUzman", esik: 30, sira: 5 },

  { kod: "uzman_50", ad: "50 Kazanım", aciklama: "50 kazanımda uzmanlaştı",
    ikon: "trophy", renk: "#F9E9B8", olcut: "toplamUzman", esik: 50, sira: 6 },

  { kod: "montessori_yolda", ad: "Montessori Yolunda", aciklama: "Montessori'de %25 uzmanlık",
    ikon: "trees", renk: "#7CB97C", olcut: "disiplinYuzde", disiplin: "montessori", esik: 25, sira: 7 },

  { kod: "montessori_usta", ad: "Montessori Ustası", aciklama: "Montessori'de %60 uzmanlık",
    ikon: "tree-pine", renk: "#4A7C59", olcut: "disiplinYuzde", disiplin: "montessori", esik: 60, sira: 8 },

  { kod: "ingilizce_yolda", ad: "İngilizce Yolunda", aciklama: "İngilizce'de %25 uzmanlık",
    ikon: "languages", renk: "#D6E6F2", olcut: "disiplinYuzde", disiplin: "ingilizce", esik: 25, sira: 9 },

  { kod: "ingilizce_usta", ad: "İngilizce Ustası", aciklama: "İngilizce'de %60 uzmanlık",
    ikon: "globe", renk: "#B8D4E8", olcut: "disiplinYuzde", disiplin: "ingilizce", esik: 60, sira: 10 },

  { kod: "degerler_yolda", ad: "Değerler Yolunda", aciklama: "Değerler'de %25 uzmanlık",
    ikon: "heart", renk: "#F6D5DC", olcut: "disiplinYuzde", disiplin: "degerler", esik: 25, sira: 11 },

  { kod: "degerler_usta", ad: "Değerler Ustası", aciklama: "Değerler'de %60 uzmanlık",
    ikon: "heart-handshake", renk: "#E8B4C4", olcut: "disiplinYuzde", disiplin: "degerler", esik: 60, sira: 12 },

  { kod: "uc_disiplin", ad: "Üç Yolda Birden", aciklama: "Her üç disiplinde de çalışma var",
    ikon: "layers", renk: "#E0D7F0", olcut: "disiplinCalisilan", esik: 3, sira: 13 },

  { kod: "alan_tamam", ad: "Alan Tamamlandı", aciklama: "Bir gelişim alanının tamamında uzmanlaştı",
    ikon: "circle-check-big", renk: "#7CB97C", olcut: "tamamlananAlan", esik: 1, sira: 14 },

  { kod: "alan_tamam_3", ad: "Üç Alan Tamam", aciklama: "Üç gelişim alanı tamamlandı",
    ikon: "shield-check", renk: "#4A7C59", olcut: "tamamlananAlan", esik: 3, sira: 15 }
].map(r => ({ ...r, aktif: true, disiplin: r.disiplin || "" }));

// Yürürlükteki tanımlar. Firestore okunana kadar varsayılanlar geçerli —
// böylece görüntüleme fonksiyonları senkron kalır (await gerekmez).
let ROZET_TANIMLARI = VARSAYILAN_ROZETLER.slice();
let _tanimKaynagi = "varsayilan";   // "varsayilan" | "firestore"

// ══════════════════════════════════════════════════════════════
// TANIMLARI FIRESTORE'DAN OKU / YAZ
// ══════════════════════════════════════════════════════════════
async function rozetTanimlariniOku({ zorla = false } = {}) {
  if (_tanimKaynagi === "firestore" && !zorla) return ROZET_TANIMLARI;
  try {
    const snap = await getDocs(collection(db, "rozetTanimlari"));
    const liste = [];
    snap.forEach(d => liste.push({ kod: d.id, ...d.data() }));
    if (liste.length) {
      liste.sort((a, b) => (a.sira || 999) - (b.sira || 999));
      ROZET_TANIMLARI = liste;
      _tanimKaynagi = "firestore";
    } else {
      ROZET_TANIMLARI = VARSAYILAN_ROZETLER.slice();
      _tanimKaynagi = "varsayilan";
    }
  } catch (e) {
    console.warn("[Rozet] tanımlar okunamadı, varsayılanlar kullanılıyor:", e?.message);
    ROZET_TANIMLARI = VARSAYILAN_ROZETLER.slice();
    _tanimKaynagi = "varsayilan";
  }
  return ROZET_TANIMLARI;
}

// Varsayılan 15 rozeti Firestore'a yaz (tek seferlik taşıma)
async function rozetTanimlariniTasi() {
  await Promise.all(VARSAYILAN_ROZETLER.map(r => {
    const { kod, ...veri } = r;
    return setDoc(doc(db, "rozetTanimlari", kod), veri, { merge: true });
  }));
  await rozetTanimlariniOku({ zorla: true });
  return VARSAYILAN_ROZETLER.length;
}

// Tek bir tanımı kaydet
async function rozetTanimiKaydet(kod, veri) {
  if (!kod) throw new Error("Rozet kodu boş olamaz");
  const { kod: _atla, ...temiz } = veri || {};
  await setDoc(doc(db, "rozetTanimlari", kod), temiz, { merge: true });
  await rozetTanimlariniOku({ zorla: true });
}

// ══════════════════════════════════════════════════════════════
// KOŞUL DEĞERLENDİRME (fonksiyon değil, veri okunur)
// ══════════════════════════════════════════════════════════════
function kosulSagladi(tanim, istat) {
  if (!tanim || tanim.aktif === false) return false;
  const esik = Number(tanim.esik);
  if (isNaN(esik)) return false;
  switch (tanim.olcut) {
    case "toplamCalisilan":   return istat.toplamCalisilan >= esik;
    case "toplamUzman":       return istat.toplamUzman >= esik;
    case "disiplinCalisilan": return istat.disiplinCalisilan >= esik;
    case "tamamlananAlan":    return istat.tamamlananAlan >= esik;
    case "disiplinYuzde": {
      if (!tanim.disiplin) return false;
      return (istat.disiplin[tanim.disiplin] || 0) >= esik;
    }
    default: return false;
  }
}

// Koşulu insan diline çevir (yönetim ekranı için)
function kosulMetni(tanim) {
  const o = OLCUTLER[tanim.olcut];
  if (!o) return "—";
  if (tanim.olcut === "disiplinYuzde") {
    const ad = window.PortalData?.disiplinBilgisi
      ? window.PortalData.disiplinBilgisi(tanim.disiplin).ad : (tanim.disiplin || "?");
    return `${ad} programında %${tanim.esik} uzmanlık`;
  }
  return `${o.ad} ≥ ${tanim.esik}`;
}

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
    // Tanımlar henüz Firestore'dan okunmadıysa oku (ilk çağrıda bir kez)
    if (_tanimKaynagi !== "firestore") await rozetTanimlariniOku();

    const ref = doc(db, "ogrenciGelisim", ogrenciId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];
    const veri = snap.data() || {};

    const istat = rozetIstatistigiCikar(veri, mufredatlar || window.aktifMufredatlar);
    const mevcut = veri.rozetler || {};
    const yeniler = [];
    const damga = new Date().toISOString();

    for (const r of ROZET_TANIMLARI) {
      if (mevcut[r.kod]) continue;          // zaten kazanılmış — tarihi korunur
      let hakEtti = false;
      try { hakEtti = kosulSagladi(r, istat); } catch (e) { hakEtti = false; }
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
  return ROZET_TANIMLARI
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
  const kilitli = ROZET_TANIMLARI.filter(r => !kazanilanKodlar.has(r.kod) && r.aktif !== false);

  const kart = (r, acik) => `
    <div class="ca-rozet-kart${acik ? "" : " kilitli"}">
      <div class="ca-rozet-ikon" style="background:${acik ? r.renk : "#E8E8E8"};">
        <i data-lucide="${acik ? r.ikon : "lock"}" style="width:17px;height:17px;"></i>
      </div>
      <div class="ca-rozet-bilgi">
        <div class="ca-rozet-ad">${escapeHtml(r.ad)}</div>
        <div class="ca-rozet-aciklama">${escapeHtml(r.aciklama || "")}</div>
      </div>
      ${acik ? `<div class="ca-rozet-tarih">${rozetTarihMetni(r.tarih)}</div>` : ""}
    </div>`;

  return `
    <div class="ca-sectionhead" style="margin-top:18px;">
      <h3 class="ca-head" style="font-size:15px;">Rozetler</h3>
      <span class="ca-tile-sub">${liste.length}/${ROZET_TANIMLARI.filter(r => r.aktif !== false).length} kazanıldı</span>
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
  get tanimlar()  { return ROZET_TANIMLARI; },
  get kaynak()    { return _tanimKaynagi; },   // "firestore" | "varsayilan"
  varsayilanlar:  VARSAYILAN_ROZETLER,
  OLCUTLER,
  oku:            rozetTanimlariniOku,
  tasi:           rozetTanimlariniTasi,
  tanimKaydet:    rozetTanimiKaydet,
  kosulMetni,
  kosulSagladi,
  degerlendir:    rozetleriDegerlendir,
  sirala:         rozetleriSirala,
  seritHTML:      rozetSeridiHTML,
  tamListeHTML:   rozetTamListeHTML,
  istatistik:     rozetIstatistigiCikar
};

// Açılışta tanımları arka planda oku. Varsayılanlar zaten yürürlükte olduğu
// için hiçbir ekran beklemez; okuma bitince yerini alır.
rozetTanimlariniOku().then(() => {
  console.log(`Rozet modülü yüklendi · ${ROZET_TANIMLARI.length} tanım (${_tanimKaynagi === "firestore" ? "Firestore" : "koddan/varsayılan"}).`);
});
