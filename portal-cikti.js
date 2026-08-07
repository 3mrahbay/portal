// ══════════════════════════════════════════════════════════════
// PORTAL · ÇIKTI MODÜLÜ  (Sözleşme PDF + Word + Önizleme)
// --------------------------------------------------------------
// Faz 7 · index.html'den ayrıştırıldı (2026-08-07)
// Kaynak: "ÇIKTI SEKMESİ" → PDF ÜRETİM → WORD ÜRETİM → ÖNİZLEME
//
// Bu modül Firestore'a hiç dokunmaz — sadece ekrandaki verilerden
// belge üretir. Logolar (MEB + okul) köprüden base64 olarak gelir.
//
// NOT: pdfHeaderLogolu / pdfHeaderBasit bilerek window'a AÇILMADI.
// pdf-estetik-duzeltme.js bunları arıyor ve bulamayınca uyarı veriyor;
// bu davranış ayırma öncesinde de aynıydı, değiştirmedik.
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { escapeHtml, escapeHtmlGelisim,
        LOGO_MEB_BASE64, LOGO_OKUL_BASE64,
        getIlanToplam, getIlanUcretleri, getOzelMaddelerFromUI } = B;

// ============ ÇIKTI SEKMESİ — VERİ TOPLAMA ============
function toplaSozlesmeVerisi() {
  const o = B.ogrenci();
  if (!o) return null;

  const getVal = (id) => (document.getElementById(id)?.value || "").trim();
  const getChk = (id) => document.getElementById(id)?.checked || false;

  const okulBilgileri = {
    adi: "ÖZEL BİR ÇİÇEK KOLEJİ ANAOKULU",
    donem: B.donem()
  };

  const ogrenci = {
    tcKimlik: getVal("ogrAyarTC"),
    adSoyad: getVal("ogrAyarAdSoyad"),
    cinsiyet: getVal("ogrAyarCinsiyet"),
    dogumTarihi: getVal("ogrAyarDogumTarihi"),
    dogumYeri: getVal("ogrAyarDogumYeri"),
    uyruk: getVal("ogrAyarUyruk") || "T.C.",
    evAdresi: getVal("ogrAyarEvAdresi"),
    kanGrubu: getVal("ogrAyarKanGrubu"),
    sinif: getVal("kayitAyarSinif"),
    program: getVal("kayitAyarProgram"),
    okulaKayitTarihi: getVal("kayitAyarIlkKayitTarihi"),
    gidaAlerji: getVal("ogrAyarGidaAlerji"),
    ilacAlerji: getVal("ogrAyarIlacAlerji"),
    kronikHastalik: getVal("ogrAyarKronikHastalik"),
    ozelBeslenme: getVal("ogrAyarOzelBeslenme"),
    saglikNot: getVal("ogrAyarSaglikNot"),
    boy: getVal("ogrAyarBoy"),
    kilo: getVal("ogrAyarKilo")
  };

  const anne = {
    tcKimlik: getVal("anneAyarTC"),
    adSoyad: getVal("anneAyarAdSoyad"),
    cepTel: getVal("anneAyarCepTel"),
    eposta: getVal("anneAyarEposta"),
    meslek: getVal("anneAyarMeslek"),
    isTel: getVal("anneAyarIsTel"),
    evAdresi: getVal("anneAyarEvAdresi"),
    isAdresi: getVal("anneAyarIsAdresi")
  };

  const baba = {
    tcKimlik: getVal("babaAyarTC"),
    adSoyad: getVal("babaAyarAdSoyad"),
    cepTel: getVal("babaAyarCepTel"),
    eposta: getVal("babaAyarEposta"),
    meslek: getVal("babaAyarMeslek"),
    isTel: getVal("babaAyarIsTel"),
    evAdresi: getVal("babaAyarEvAdresi"),
    isAdresi: getVal("babaAyarIsAdresi")
  };

  const vasi = {
    tcKimlik: getVal("vasiAyarTC"),
    adSoyad: getVal("vasiAyarAdSoyad"),
    meslek: getVal("vasiAyarMeslek"),
    cepTel: getVal("vasiAyarCepTel"),
    evTel: getVal("vasiAyarEvTel"),
    isTel: getVal("vasiAyarIsTel"),
    evAdresi: getVal("vasiAyarEvAdresi"),
    isAdresi: getVal("vasiAyarIsAdresi"),
    eposta: getVal("vasiAyarEposta")
  };

  const acil = {
    yakin1: {
      adSoyad: getVal("ogrAyarYakin1Ad"),
      yakinlik: getVal("ogrAyarYakin1Yakinlik"),
      telefon: getVal("ogrAyarYakin1Tel")
    },
    yakin2: {
      adSoyad: getVal("ogrAyarYakin2Ad"),
      yakinlik: getVal("ogrAyarYakin2Yakinlik"),
      telefon: getVal("ogrAyarYakin2Tel")
    }
  };

  const aylikAidat = parseFloat(getVal("ayarAidat")) || 0;
  const taksit = parseInt(getVal("ayarTaksit")) || 12;
  const indirimOrani = parseFloat(getVal("ayarIndirim")) || 0;
  const indirimNedeni = getVal("ayarIndirimNedeni");
  const pesinOdeme = getChk("ayarPesin");

  const digerUcretler = {
    egitimMateryali: parseFloat(getVal("ayarDigerEgitimMateryali")) || 0,
    okulKiyafeti: parseFloat(getVal("ayarDigerOkulKiyafeti")) || 0,
    ormanKiyafeti: parseFloat(getVal("ayarDigerOrmanKiyafeti")) || 0,
    servis1: parseFloat(getVal("ayarDigerServis1")) || 0,
    servis2: parseFloat(getVal("ayarDigerServis2")) || 0
  };

  // ══════════════════════════════════════════════════════════
  // GERÇEK ÖDEME PLANI
  // Sözleşme artık "aylık × taksit" çarpımı yapmaz; kayıt
  // ekranında kaydedilmiş planı olduğu gibi okur:
  //   1) aylık kartta elle girilen tutar varsa o geçerlidir
  //   2) yoksa I. dönem (Eylül–Ocak) / II. dönem (Şubat–Haziran) aylığı
  //   3) hiçbiri yoksa düz aylık aidat (eski kayıtlar için)
  // Peşinat (ön ödeme) ayrı satır olarak plana girer.
  // ══════════════════════════════════════════════════════════
  const odemePlani = hesaplaOdemePlani(o, aylikAidat, taksit);

  const toplamAidat = odemePlani.toplam;
  const toplamDiger = Object.values(digerUcretler).reduce((a, b) => a + b, 0);

  const odeme = {
    aylikAidat: aylikAidat,
    taksit: taksit,
    yillikAidat: toplamAidat,
    indirimOrani: indirimOrani,
    indirimNedeni: indirimNedeni,
    pesinOdeme: pesinOdeme,
    digerUcretler: digerUcretler,
    digerToplam: toplamDiger,
    genelToplam: toplamAidat + toplamDiger,
    // ── gerçek plan ──
    onOdeme: odemePlani.onOdeme,
    taksitler: odemePlani.taksitler,     // [{ayKod, tam, tutar}]
    gruplar: odemePlani.gruplar,         // [{adet, tutar, ilkAy, sonAy}]
    planOzet: odemePlani.ozet,           // "5 × 32.500 TL (Eylül–Ocak) + ..."
    planSatirlari: odemePlani.satirlar,  // çok satırlı döküm
    taksitAdedi: odemePlani.taksitler.length,
    yariDonemUcret: parseFloat(getVal("sozlesmeYariDonemUcret")) || 0,
    tamDonemUcret: parseFloat(getVal("sozlesmeTamDonemUcret")) || 0,
    burs: getChk("ayarBurs"),
    bursYuzde: parseFloat(getVal("ayarBursYuzde")) || 0,
    taksitBaslangicTarihi: getVal("ayarTaksitBaslangicTarihi") || "",
    ilanUcretleri: getIlanUcretleri(),
    ilanToplam: getIlanToplam()
  };

  const imza = {
    tarih: getVal("sozlesmeImzaTarihi") || new Date().toISOString().substring(0, 10),
    imzalayan: getVal("sozlesmeImzalayan") || "Anne"
  };

  const ozelMaddeler = getOzelMaddelerFromUI();

  const goster = {
    ekkisisel: getChk("sozShow_ekkisisel"),
    saglik: getChk("sozShow_saglik"),
    acildurum: getChk("sozShow_acildurum"),
    kardes: getChk("sozShow_kardes"),
    ogrnot: getChk("sozShow_ogrnot"),
    anne: getChk("sozShow_anne"),
    baba: getChk("sozShow_baba"),
    vasi: getChk("sozShow_vasi"),
    servis: getChk("sozShow_servis"),
    referans: getChk("sozShow_referans")
  };

  const izinler = {
    medya: getChk("kayitAyarMedyaIzni"),
    gezi: getChk("kayitAyarGeziIzni"),
    acilMudahale: getChk("kayitAyarAcilMudahaleIzni"),
    saglikTarama: getChk("kayitAyarSaglikTaramaIzni")
  };

  return {
    okul: okulBilgileri,
    ogrenci: ogrenci,
    anne: anne,
    baba: baba,
    vasi: vasi,
    acil: acil,
    odeme: odeme,
    imza: imza,
    ozelMaddeler: ozelMaddeler,
    goster: goster,
    izinler: izinler,
    sablon: B.sozlesmeSablon()
  };
}

// ══════════════════════════════════════════════════════════════
// ÖDEME PLANI HESAPLAYICI
// Kaynak önceliği (kayıt ekranıyla birebir aynı mantık):
//   1. aylikOdemeler[ayKod].beklenenTutar  → elle düzeltilmiş tutar
//   2. aidatAyarlari.iDonemAylik / iiDonemAylik → dönem aylığı
//   3. aylikAidat → düz aylık (eski kayıtlar)
// Peşinat aidatAyarlari.onOdeme veya ekrandaki alandan okunur.
// ══════════════════════════════════════════════════════════════
function hesaplaOdemePlani(ogrenci, aylikAidat, taksit) {
  const bos = { onOdeme: 0, taksitler: [], gruplar: [], toplam: 0, ozet: "", satirlar: [] };
  if (!ogrenci) return bos;

  const ayar = (B.ayarlar() || {})[ogrenci.id] || {};
  const a = ayar.aidatAyarlari || {};
  const aylikOdemeler = ayar.aylikOdemeler || {};

  const gv = (id) => (document.getElementById(id)?.value || "").trim();

  // Peşinat: ekrandaki alan önce, yoksa kayıtlı değer
  const onOdeme = parseFloat(gv("ayarOnOdeme")) || Number(a.onOdeme) || 0;

  const iDonemAylik  = Number(a.iDonemAylik)  || aylikAidat;
  const iiDonemAylik = Number(a.iiDonemAylik) || aylikAidat;

  const baslangic = gv("ayarBaslangic") || a.baslangicAyi || "";
  const aylar = baslangic ? B.getAyListesi(baslangic, taksit) : [];

  // Ay listesi kurulamıyorsa dönem aylıklarıyla kaba plan üret
  if (!aylar.length) {
    const yari = Math.round(taksit / 2);
    const taksitler = [];
    for (let i = 0; i < taksit; i++) {
      taksitler.push({ ayKod: "", tam: "", tutar: i < yari ? iDonemAylik : iiDonemAylik });
    }
    return paketle(onOdeme, taksitler);
  }

  const taksitler = aylar.map(ay => {
    const od = aylikOdemeler[ay.ayKod] || {};
    let tutar;
    if (od.beklenenTutar !== undefined && od.beklenenTutar !== null && od.beklenenTutar !== "") {
      tutar = parseFloat(od.beklenenTutar) || 0;          // elle düzeltilmiş
    } else {
      tutar = (ay.ay >= 9 || ay.ay <= 1) ? iDonemAylik : iiDonemAylik;
    }
    return { ayKod: ay.ayKod, tam: ay.tam, isim: ay.isim, tutar: tutar };
  });

  return paketle(onOdeme, taksitler);
}

// Ardışık aynı tutarlı ayları gruplayıp özet metin üretir
function paketle(onOdeme, taksitler) {
  const gruplar = [];
  for (const t of taksitler) {
    const son = gruplar[gruplar.length - 1];
    if (son && son.tutar === t.tutar) {
      son.adet++;
      son.sonAy = t.isim || "";
    } else {
      gruplar.push({ adet: 1, tutar: t.tutar, ilkAy: t.isim || "", sonAy: t.isim || "" });
    }
  }

  const toplamTaksit = taksitler.reduce((s, t) => s + t.tutar, 0);
  const toplam = onOdeme + toplamTaksit;

  // NOT: Peşinat bilerek bu özete EKLENMEZ. Sözleşmede zaten ayrı
  // "Peşinat" satırı var; iki yerde birden yazılırsa tekrar oluyor.
  const parcalar = [];
  const satirlar = [];
  if (onOdeme > 0) {
    satirlar.push({ etiket: "Peşinat / Ön Ödeme", deger: formatTL(onOdeme) });
  }
  for (const g of gruplar) {
    const aralik = g.adet > 1 && g.ilkAy && g.sonAy && g.ilkAy !== g.sonAy
      ? ` (${g.ilkAy}–${g.sonAy})` : (g.ilkAy ? ` (${g.ilkAy})` : "");
    parcalar.push(`${g.adet} × ${formatTL(g.tutar)}${aralik}`);
    satirlar.push({
      etiket: `${g.adet} taksit${aralik}`,
      deger: `${g.adet} × ${formatTL(g.tutar)} = ${formatTL(g.adet * g.tutar)}`
    });
  }

  return {
    onOdeme: onOdeme,
    taksitler: taksitler,
    gruplar: gruplar,
    toplam: toplam,
    ozet: parcalar.join(" + "),
    satirlar: satirlar
  };
}

function formatTL(n) {
  if (!n && n !== 0) return "—";
  return new Intl.NumberFormat("tr-TR").format(Math.round(n)) + " TL";
}

function formatTarih(yyyymmdd) {
  if (!yyyymmdd) return "";
  const [y, m, d] = yyyymmdd.split("-");
  if (!y || !m || !d) return yyyymmdd;
  return `${d}.${m}.${y}`;
}

// ============ ÇIKTI — ÖZET RENDER ============
function renderCiktiOzet() {
  const veri = toplaSozlesmeVerisi();
  const div = document.getElementById("ciktiOzet");
  if (!div || !veri) return;

  const eksikler = [];
  if (!veri.ogrenci.adSoyad) eksikler.push("Öğrenci Ad Soyad");
  if (!veri.ogrenci.tcKimlik) eksikler.push("Öğrenci TC Kimlik");
  if (!veri.ogrenci.evAdresi) eksikler.push("Ev Adresi");
  if (!veri.ogrenci.sinif) eksikler.push("Sınıf");
  if (!veri.anne.adSoyad && !veri.baba.adSoyad) eksikler.push("En az bir veli (Anne veya Baba)");
  if (veri.odeme.aylikAidat === 0) eksikler.push("Aylık Aidat");

  const uyari = document.getElementById("ciktiEksikUyari");
  const uyariList = document.getElementById("ciktiEksikList");
  if (uyari && uyariList) {
    if (eksikler.length > 0) {
      uyariList.innerHTML = eksikler.map(e => `<li>${e}</li>`).join("");
      uyari.style.display = "block";
    } else {
      uyari.style.display = "none";
    }
  }

  const val = (v) => v ? escapeHtml(v) : '<span class="eksik">(boş)</span>';
  let html = "";

  html += `<div class="cikti-ozet-baslik">Öğrenci</div>`;
  html += `<div class="cikti-ozet-row"><strong>TC:</strong><span>${val(veri.ogrenci.tcKimlik)}</span></div>`;
  html += `<div class="cikti-ozet-row"><strong>Ad Soyad:</strong><span>${val(veri.ogrenci.adSoyad)}</span></div>`;
  html += `<div class="cikti-ozet-row"><strong>Doğum:</strong><span>${formatTarih(veri.ogrenci.dogumTarihi) || '<span class="eksik">(boş)</span>'}</span></div>`;
  html += `<div class="cikti-ozet-row"><strong>Sınıf / Program:</strong><span>${val(veri.ogrenci.sinif)} / ${val(veri.ogrenci.program)}</span></div>`;
  html += `<div class="cikti-ozet-row"><strong>Ev Adresi:</strong><span>${val(veri.ogrenci.evAdresi)}</span></div>`;

  if (veri.goster.anne) {
    html += `<div class="cikti-ozet-baslik">Anne ${veri.goster.anne ? "" : '<small style="opacity:0.5;">(kapalı)</small>'}</div>`;
    html += `<div class="cikti-ozet-row"><strong>Ad Soyad:</strong><span>${val(veri.anne.adSoyad)}</span></div>`;
    html += `<div class="cikti-ozet-row"><strong>Cep Tel:</strong><span>${val(veri.anne.cepTel)}</span></div>`;
    html += `<div class="cikti-ozet-row"><strong>E-Posta:</strong><span>${val(veri.anne.eposta)}</span></div>`;
  }

  if (veri.goster.baba) {
    html += `<div class="cikti-ozet-baslik">Baba</div>`;
    html += `<div class="cikti-ozet-row"><strong>Ad Soyad:</strong><span>${val(veri.baba.adSoyad)}</span></div>`;
    html += `<div class="cikti-ozet-row"><strong>Cep Tel:</strong><span>${val(veri.baba.cepTel)}</span></div>`;
    html += `<div class="cikti-ozet-row"><strong>E-Posta:</strong><span>${val(veri.baba.eposta)}</span></div>`;
  }

  if (veri.goster.vasi && (veri.vasi.adSoyad || veri.vasi.tcKimlik)) {
    html += `<div class="cikti-ozet-baslik">Vasi</div>`;
    html += `<div class="cikti-ozet-row"><strong>Ad Soyad:</strong><span>${val(veri.vasi.adSoyad)}</span></div>`;
    html += `<div class="cikti-ozet-row"><strong>Cep Tel:</strong><span>${val(veri.vasi.cepTel)}</span></div>`;
  }

  html += `<div class="cikti-ozet-baslik">Ödeme</div>`;
  html += `<div class="cikti-ozet-row"><strong>Aylık Aidat (referans):</strong><span>${formatTL(veri.odeme.aylikAidat)}</span></div>`;
  if (veri.odeme.onOdeme > 0) {
    html += `<div class="cikti-ozet-row"><strong>Peşinat / Ön Ödeme:</strong><span>${formatTL(veri.odeme.onOdeme)}</span></div>`;
  }
  // Gerçek plan: her tutar grubu ayrı satırda (peşin ödemede taksit yok)
  if (!veri.odeme.pesinOdeme) {
    (veri.odeme.planSatirlari || []).forEach(sat => {
      if (sat.etiket === "Peşinat / Ön Ödeme") return;   // yukarıda gösterildi
      html += `<div class="cikti-ozet-row"><strong>${escapeHtml(sat.etiket)}:</strong><span>${escapeHtml(sat.deger)}</span></div>`;
    });
  }
  html += `<div class="cikti-ozet-row"><strong>Yıllık (Aidat):</strong><span>${formatTL(veri.odeme.yillikAidat)} (${veri.odeme.taksitAdedi || veri.odeme.taksit} ay${veri.odeme.onOdeme > 0 ? " + peşinat" : ""})</span></div>`;
  html += `<div class="cikti-ozet-row"><strong>Diğer Ücretler:</strong><span>${formatTL(veri.odeme.digerToplam)}</span></div>`;
  html += `<div class="cikti-ozet-row"><strong>GENEL TOPLAM:</strong><span style="color:var(--green-deep);font-weight:700;">${formatTL(veri.odeme.genelToplam)}</span></div>`;
  if (veri.odeme.pesinOdeme) {
    html += `<div class="cikti-ozet-row"><strong>Ödeme Şekli:</strong><span>✓ Peşin — eğitim + yemek ${formatTL(veri.odeme.yillikAidat)} (%10 indirim)</span></div>`;
    html += `<div class="cikti-ozet-row"><strong>Not:</strong><span style="color:#78716c;">Kırtasiye, kıyafet vb. kalemler peşine dahil değildir.</span></div>`;
  }
  else html += `<div class="cikti-ozet-row"><strong>Ödeme Şekli:</strong><span>${escapeHtml(veri.odeme.planOzet || (veri.odeme.taksit + " Taksit"))}</span></div>`;

  if (veri.ozelMaddeler.length > 0) {
    html += `<div class="cikti-ozet-baslik">Özel Maddeler (${veri.ozelMaddeler.length})</div>`;
    veri.ozelMaddeler.forEach((m, i) => {
      const tipIcon = m.tip === "istisna" ? "× İstisna" : "+ Ek";
      html += `<div class="cikti-ozet-row"><strong>${tipIcon}:</strong><span>${escapeHtml(m.metin)}</span></div>`;
    });
  }

  html += `<div class="cikti-ozet-baslik">Sözleşme</div>`;
  html += `<div class="cikti-ozet-row"><strong>Tarih:</strong><span>${formatTarih(veri.imza.tarih)}</span></div>`;
  html += `<div class="cikti-ozet-row"><strong>İmzalayan:</strong><span>${veri.imza.imzalayan}</span></div>`;
  html += `<div class="cikti-ozet-row"><strong>Sözleşme v:</strong><span>${veri.sablon?.versiyon || "—"} / ${B.donem()}</span></div>`;

  div.innerHTML = html;
}

// ============ ÇIKTI — ORTAK SÖZLEŞME METNİ ÜRETİMİ ============
function olusturSozlesmeMetni(veri) {
  const bolumler = [];

  bolumler.push({ tip: "header-logolu" });

  const ogrRows = [
    ["T.C. Kimlik No", veri.ogrenci.tcKimlik],
    ["Adı ve Soyadı", veri.ogrenci.adSoyad],
    ["Doğum Tarihi", formatTarih(veri.ogrenci.dogumTarihi)],
    ["Veli/Vasi Adı ve Soyadı", veri.anne.adSoyad || veri.baba.adSoyad || veri.vasi.adSoyad],
    ["Sınıfı", veri.ogrenci.sinif],
    ["Okula kayıt/nakil tarihi", formatTarih(veri.ogrenci.okulaKayitTarihi)],
    ["Ev adresi", veri.ogrenci.evAdresi]
  ];
  bolumler.push({ tip: "tablo-tam", baslik: "ÖĞRENCİNİN BİLGİLERİ", satirlar: ogrRows });

  const anneRows = veri.goster.anne ? [
    ["T.C. Kimlik No", veri.anne.tcKimlik],
    ["Adı ve Soyadı", veri.anne.adSoyad],
    ["Mesleği", veri.anne.meslek],
    ["Cep telefonu", veri.anne.cepTel],
    ["İş telefonu", veri.anne.isTel],
    ["Ev adresi", veri.anne.evAdresi || veri.ogrenci.evAdresi],
    ["İş adresi", veri.anne.isAdresi],
    ["e-Posta", veri.anne.eposta]
  ] : null;

  const babaRows = veri.goster.baba ? [
    ["T.C. Kimlik No", veri.baba.tcKimlik],
    ["Adı ve Soyadı", veri.baba.adSoyad],
    ["Mesleği", veri.baba.meslek],
    ["Cep telefonu", veri.baba.cepTel],
    ["İş telefonu", veri.baba.isTel],
    ["Ev adresi", veri.baba.evAdresi || veri.ogrenci.evAdresi],
    ["İş adresi", veri.baba.isAdresi],
    ["e-Posta", veri.baba.eposta]
  ] : null;

  if (anneRows && babaRows) {
    bolumler.push({ tip: "tablo-yanyana",
      solBaslik: "ÖĞRENCİNİN ANNE BİLGİLERİ", solSatirlar: anneRows,
      sagBaslik: "ÖĞRENCİNİN BABA BİLGİLERİ", sagSatirlar: babaRows });
  } else if (anneRows) {
    bolumler.push({ tip: "tablo-tam", baslik: "ÖĞRENCİNİN ANNE BİLGİLERİ", satirlar: anneRows });
  } else if (babaRows) {
    bolumler.push({ tip: "tablo-tam", baslik: "ÖĞRENCİNİN BABA BİLGİLERİ", satirlar: babaRows });
  }

  const vasiRows = [
    ["T.C. Kimlik No", veri.vasi.tcKimlik],
    ["Adı ve Soyadı", veri.vasi.adSoyad],
    ["Mesleği", veri.vasi.meslek],
    ["Cep telefonu", veri.vasi.cepTel],
    ["Ev telefonu", veri.vasi.evTel],
    ["İş telefonu", veri.vasi.isTel],
    ["Ev adresi", veri.vasi.evAdresi],
    ["İş adresi", veri.vasi.isAdresi],
    ["e-Posta", veri.vasi.eposta]
  ];
  bolumler.push({ tip: "tablo-tam", baslik: "ÖĞRENCİNİN VASİ BİLGİLERİ (VARSA)", satirlar: vasiRows });

  if (veri.goster.saglik && (veri.ogrenci.kanGrubu || veri.ogrenci.gidaAlerji || veri.ogrenci.ilacAlerji || veri.ogrenci.kronikHastalik)) {
    const saglikRows = [
      ["Kan Grubu", veri.ogrenci.kanGrubu],
      ["Gıda Alerjileri", veri.ogrenci.gidaAlerji],
      ["İlaç/Diğer Alerjiler", veri.ogrenci.ilacAlerji],
      ["Kronik Hastalık", veri.ogrenci.kronikHastalik],
      ["Özel Beslenme", veri.ogrenci.ozelBeslenme],
      ["Sağlık Notu", veri.ogrenci.saglikNot]
    ].filter(r => r[1]);
    if (saglikRows.length > 0) {
      bolumler.push({ tip: "tablo-tam", baslik: "ÖĞRENCİNİN SAĞLIK BİLGİLERİ", satirlar: saglikRows });
    }
  }

  if (veri.goster.acildurum && (veri.acil.yakin1.adSoyad || veri.acil.yakin2.adSoyad)) {
    const acilRows = [];
    if (veri.acil.yakin1.adSoyad) {
      acilRows.push(["1. Yakın Ad Soyad", veri.acil.yakin1.adSoyad]);
      acilRows.push(["1. Yakın Yakınlık", veri.acil.yakin1.yakinlik]);
      acilRows.push(["1. Yakın Telefon", veri.acil.yakin1.telefon]);
    }
    if (veri.acil.yakin2.adSoyad) {
      acilRows.push(["2. Yakın Ad Soyad", veri.acil.yakin2.adSoyad]);
      acilRows.push(["2. Yakın Yakınlık", veri.acil.yakin2.yakinlik]);
      acilRows.push(["2. Yakın Telefon", veri.acil.yakin2.telefon]);
    }
    bolumler.push({ tip: "tablo-tam", baslik: "ACİL DURUM YAKINLARI", satirlar: acilRows });
  }

  bolumler.push({ tip: "sayfa-baslat" });

  bolumler.push({ tip: "odeme-tablosu", odeme: veri.odeme });

  // İzinler ve Taahhütler — ödeme sayfasının altında (velinin imzalı onayı için)
  if (veri.izinler) {
    bolumler.push({ tip: "izinler", izinler: veri.izinler });
  }

  if (veri.sablon?.genelHususlar?.length) {
    bolumler.push({ tip: "madde-baslik", metin: "GENEL HUSUSLAR" });
    veri.sablon.genelHususlar.forEach((m, i) => {
      bolumler.push({ tip: "madde", no: i + 1, metin: m });
    });
  }

  if (veri.sablon?.ozelHususlar?.length) {
    bolumler.push({ tip: "madde-baslik", metin: "ÖZEL HUSUSLAR" });
    let donemStr = veri.okul.donem.replace("-", " - ");
    veri.sablon.ozelHususlar.forEach((m, i) => {
      let metin = m.replace(/\[DÖNEM_BASLANGIC\]/g, donemStr.split(" - ")[0])
                   .replace(/\[DÖNEM_BITIS\]/g, donemStr.split(" - ")[1]);
      bolumler.push({ tip: "madde", no: i + 1, metin: metin });
    });
  }

  if (veri.ozelMaddeler?.length) {
    bolumler.push({ tip: "madde-baslik", metin: "BU ÖĞRENCİYE ÖZEL MADDELER" });
    veri.ozelMaddeler.forEach((m, i) => {
      const prefix = m.tip === "istisna" ? "[İstisna] " : "[Ek Madde] ";
      bolumler.push({ tip: "madde", no: i + 1, metin: prefix + m.metin });
    });
  }

  if (veri.sablon?.genelIhtiyacMetin) {
    let metin = veri.sablon.genelIhtiyacMetin.replace(/\[YARI_DONEM_UCRET\]/g, formatTL(veri.odeme.yariDonemUcret).replace(" TL", ""));
    bolumler.push({ tip: "madde-baslik", metin: "GENEL İHTİYAÇ LİSTESİ" });
    bolumler.push({ tip: "paragraf", metin: metin });
  }

  bolumler.push({
    tip: "imza",
    tarih: formatTarih(veri.imza.tarih),
    imzalayan: veri.imza.imzalayan
  });

  return bolumler;
}

// ============ PDF ÜRETİM ============
function pdfHeaderLogolu(pdf, veri, margin, pageW) {
  const logoH = 22;
  const okulLogoW = 16;
  const mebLogoW = 22;

  try {
    pdf.addImage(LOGO_OKUL_BASE64, "PNG", margin, margin - 3, okulLogoW, logoH);
  } catch(e) { console.warn("Okul logo hata:", e); }

  try {
    pdf.addImage(LOGO_MEB_BASE64, "PNG", pageW - margin - mebLogoW, margin - 1, mebLogoW, logoH - 4);
  } catch(e) { console.warn("MEB logo hata:", e); }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("T.C.", pageW / 2, margin, { align: "center" });
  pdf.setFontSize(10);
  pdf.text("MILLI EGITIM BAKANLIGI", pageW / 2, margin + 4, { align: "center" });
  pdf.text("OZEL OGRETIM KURUMLARI GENEL MUDURLUGU", pageW / 2, margin + 8, { align: "center" });
  pdf.text("OGRENCI KAYIT SOZLESMESI", pageW / 2, margin + 12, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("(OZEL OKULLAR)", pageW / 2, margin + 16, { align: "center" });

  const y = margin + 25;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(`Ozel Okul Adi: ${tr(veri.okul.adi)}`, margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`| ${veri.okul.donem} EGITIM VE OGRETIM YILI`, margin + 80, y);

  return y + 6;
}

function pdfHeaderBasit(pdf, veri, margin, pageW) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(`${tr(veri.okul.adi)} | ${veri.okul.donem} EGITIM VE OGRETIM YILI`, pageW / 2, margin, { align: "center" });
  return margin + 8;
}

function tr(s) {
  if (!s) return "";
  return String(s)
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ç/g, "C").replace(/ç/g, "c");
}

function trObj(o) {
  if (!o) return o;
  if (typeof o === "string") return tr(o);
  if (Array.isArray(o)) return o.map(trObj);
  return o;
}

window.sozlesmeCiktiPDF = async function() {
  try {
    showToast("PDF hazirlaniyor...");
    const veri = toplaSozlesmeVerisi();
    if (!veri) { showToast("Veri alinamadi", "error"); return; }
    if (!veri.sablon) { showToast("Once sozlesme sablonunu yukleyin", "error"); return; }

    const bolumler = olusturSozlesmeMetni(veri);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = pageW - (margin * 2);
    let y = margin;
    let headerDrawn = false;
    let ilkSayfa = true;

    const ensureHeader = () => {
      if (!headerDrawn) {
        if (ilkSayfa) {
          y = pdfHeaderLogolu(pdf, veri, margin, pageW);
          ilkSayfa = false;
        } else {
          y = pdfHeaderBasit(pdf, veri, margin, pageW);
        }
        headerDrawn = true;
      }
    };

    const newPageIfNeeded = (needed) => {
      if (y + needed > pageH - margin - 10) {
        pdf.addPage();
        y = margin;
        headerDrawn = false;
        ensureHeader();
      }
    };

    ensureHeader();

    for (const b of bolumler) {
      if (b.tip === "header-logolu") {
        continue;
      } else if (b.tip === "sayfa-baslat") {
        pdf.addPage();
        y = margin;
        headerDrawn = false;
        ensureHeader();
      } else if (b.tip === "tablo-tam") {
        newPageIfNeeded(20);
        pdf.autoTable({
          startY: y,
          head: [[{ content: tr(b.baslik), colSpan: 2, styles: { halign: "center", fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold", fontSize: 10 } }]],
          body: b.satirlar.map(r => [tr(r[0]), tr(r[1] || "")]),
          theme: "grid",
          styles: { font: "helvetica", fontSize: 9, cellPadding: 2, overflow: "linebreak" },
          columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" }, 1: { cellWidth: contentW - 55 } },
          margin: { left: margin, right: margin }
        });
        y = pdf.lastAutoTable.finalY + 4;
      } else if (b.tip === "tablo-yanyana") {
        newPageIfNeeded(50);
        const halfW = (contentW - 4) / 2;
        const startY = y;

        pdf.autoTable({
          startY: startY,
          head: [[{ content: tr(b.solBaslik), colSpan: 2, styles: { halign: "center", fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold", fontSize: 9 } }]],
          body: b.solSatirlar.map(r => [tr(r[0]), tr(r[1] || "")]),
          theme: "grid",
          styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
          columnStyles: { 0: { cellWidth: 30, fontStyle: "bold" }, 1: { cellWidth: halfW - 30 } },
          margin: { left: margin, right: margin + halfW + 4 },
          tableWidth: halfW
        });
        const solFinal = pdf.lastAutoTable.finalY;

        pdf.autoTable({
          startY: startY,
          head: [[{ content: tr(b.sagBaslik), colSpan: 2, styles: { halign: "center", fillColor: [230, 230, 230], textColor: 20, fontStyle: "bold", fontSize: 9 } }]],
          body: b.sagSatirlar.map(r => [tr(r[0]), tr(r[1] || "")]),
          theme: "grid",
          styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
          columnStyles: { 0: { cellWidth: 30, fontStyle: "bold" }, 1: { cellWidth: halfW - 30 } },
          margin: { left: margin + halfW + 4, right: margin },
          tableWidth: halfW
        });
        const sagFinal = pdf.lastAutoTable.finalY;

        y = Math.max(solFinal, sagFinal) + 4;
      } else if (b.tip === "odeme-tablosu") {
        const o = b.odeme;
        const ilan = o.ilanUcretleri;

        newPageIfNeeded(100);

        // Öğrenim ücretinin %60'ı eğitim, %40'ı yemek olarak ayrılır
        const egitimKismi = Math.round(o.yillikAidat * 0.60);
        const yemekKismi = Math.round(o.yillikAidat * 0.40);

        const odemeRows = [
          ["Ogrenim Ucreti", formatTL(ilan.ogrenim), formatTL(egitimKismi)],
          ["Okul-Aile Birliginin Almis Oldugu Karar Dogrultusunda\nOgrenci Kiyafeti ve Kiyafet Ucreti", formatTL(ilan.kiyafet), formatTL(o.digerUcretler.okulKiyafeti||0)]
        ];

        const veliIstekRows = [
          ["Yemek Ucreti", formatTL(ilan.yemek), formatTL(yemekKismi)],
          ["Kahvalti Ucreti", formatTL(ilan.kahvalti), ""],
          ["Takviye Kursu Ucreti", formatTL(ilan.takviye), ""],
          ["Yatakhane Ucreti", formatTL(ilan.yatakhane), ""],
          ["Kitap Ucreti", "", ""],
          ["Kirtasiye Ucreti", formatTL(ilan.kitapKirtasiye), formatTL(o.digerUcretler.egitimMateryali||0)],
          ["Etut Ucreti", formatTL(ilan.etut), ""]
        ];

        // MEB'de gösterilen kalemler için toplam (orman kıyafeti ve servisler MEB'e gösterilmiyor)
        const mebGenelToplam = o.yillikAidat + (o.digerUcretler.okulKiyafeti||0) + (o.digerUcretler.egitimMateryali||0);

        pdf.autoTable({
          startY: y,
          head: [
            [{ content: `ODEME BILGILERI (${veri.okul.donem} Ogretim Yili Icin)`, colSpan: 3, styles: { halign: "center", fillColor: [230, 230, 230], fontStyle: "bold", fontSize: 10 } }],
            [{ content: "", styles: { fillColor: [245, 245, 245] } },
             { content: "Kurumun Ilan Ettigi\nUcretler (KDV Dahil)", styles: { halign: "center", fillColor: [255, 250, 205], fontStyle: "bold", fontSize: 8 } },
             { content: "Ogrenci Icin\nBelirlenen Ucretler (KDV Dahil)", styles: { halign: "center", fillColor: [255, 250, 205], fontStyle: "bold", fontSize: 8 } }]
          ],
          body: [
            ...odemeRows.map(r => [tr(r[0]), r[1], r[2]]),
            ...veliIstekRows.map((r, i) => {
              if (i === 0) {
                return [{ content: `${tr(r[0])}`, styles: { fontStyle: "normal" } }, r[1], r[2]];
              }
              return [tr(r[0]), r[1], r[2]];
            }),
            [{ content: "UCRETLER TOPLAMI", styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
             { content: formatTL(o.ilanToplam), styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
             { content: formatTL(mebGenelToplam), styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }]
          ],
          theme: "grid",
          styles: { font: "helvetica", fontSize: 8, cellPadding: 2, overflow: "linebreak" },
          columnStyles: { 0: { cellWidth: contentW * 0.46 }, 1: { cellWidth: contentW * 0.27, halign: "right" }, 2: { cellWidth: contentW * 0.27, halign: "right" } },
          margin: { left: margin, right: margin }
        });
        y = pdf.lastAutoTable.finalY + 2;

        const pesinCheck = o.pesinOdeme ? "( x ) Pesin    (   ) Taksit" : "(   ) Pesin    ( x ) Taksit";
        const bursCheck = o.burs ? `( x ) Evet    (   ) Hayir` : "(   ) Evet    ( x ) Hayir";
        const indirimCheck = (o.indirimOrani > 0) ? "( x ) Evet    (   ) Hayir" : "(   ) Evet    ( x ) Hayir";

        const odemeSekilRows = [
          ["Odeme Sekli", pesinCheck],
          ["Taksit Baslangic Tarihi", o.pesinOdeme ? "—" : (formatTarih(o.taksitBaslangicTarihi) || "")],
          ["Pesinat", o.pesinOdeme ? formatTL(o.yillikAidat) : (o.onOdeme > 0 ? formatTL(o.onOdeme) : "")],
          ["Taksit Sayisi ve Tutari", o.pesinOdeme ? "—"
            : ((o.planOzet || "").replace(/×/g, "x").replace(/–/g, "-") || `${o.taksit} taksit x ${formatTL(o.aylikAidat)}`)],
          ["Egitim Bursu Aliyor Mu?", bursCheck],
          ["Egitim Bursu Aliyorsa Yuzdesi", o.burs ? `% ${o.bursYuzde}` : "% ..."],
          ["Indirim Yapildi Mi?", indirimCheck]
        ];

        pdf.autoTable({
          startY: y,
          body: odemeSekilRows.map(r => [tr(r[0]), r[1]]),
          theme: "grid",
          styles: { font: "helvetica", fontSize: 8, cellPadding: 2, overflow: "linebreak" },
          columnStyles: { 0: { cellWidth: contentW * 0.46, fontStyle: "bold" }, 1: { cellWidth: contentW * 0.54 } },
          margin: { left: margin, right: margin }
        });
        y = pdf.lastAutoTable.finalY + 2;

        const nedenList = [
          ["%5 Kardes Indirimi", "Ogretmen Cocugu Indirimi"],
          ["Personel Cocugu Indirimi", "Basari Indirimi"],
          ["Kurumsal Indirim", "Kayitli Ogrenci Indirimi"],
          ["Sehit/Gazi Cocugu Indirimi", "Korucu Cocugu Indirimi"]
        ];
        const chk = (label) => {
          const secildi = (o.indirimNedeni || "").toLowerCase().includes(label.toLowerCase().substring(0, 5));
          return `${secildi ? "( x )" : "(   )"} ${label}`;
        };

        const nedenRows = nedenList.map(pair => [chk(pair[0]), chk(pair[1])]);
        nedenRows.push([`${(o.indirimNedeni && !nedenList.flat().some(l => (o.indirimNedeni||"").toLowerCase().includes(l.toLowerCase().substring(0,5)))) ? "( x )" : "(   )"} Diger Indirimler (${tr(o.indirimNedeni || "...........................")})`, ""]);

        pdf.autoTable({
          startY: y,
          head: [[{ content: "Indirim Yapilmissa Nedeni?", colSpan: 2, styles: { halign: "left", fillColor: [245, 245, 245], fontStyle: "bold", fontSize: 8 } }]],
          body: nedenRows.map(r => [tr(r[0]), tr(r[1] || "")]),
          theme: "grid",
          styles: { font: "helvetica", fontSize: 8, cellPadding: 2, overflow: "linebreak" },
          columnStyles: { 0: { cellWidth: contentW * 0.5 }, 1: { cellWidth: contentW * 0.5 } },
          margin: { left: margin, right: margin }
        });
        y = pdf.lastAutoTable.finalY + 6;
      } else if (b.tip === "izinler") {
        const iz = b.izinler;
        newPageIfNeeded(60);

        // Başlık
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(tr("IZINLER VE TAAHHUTLER"), pageW / 2, y + 4, { align: "center" });
        y += 8;

        const onay = () => "(   ) Evet    (   ) Hayir";
        const izinRows = [
          ["Medya Kullanim Izni\n(Fotograf/video okul iletisiminde kullanilabilir)", onay()],
          ["Gezi ve Etkinlik Izni\n(Okul gezileri, ziyaretler, etkinliklere katilim)", onay()],
          ["Acil Mudahale Izni\n(Acil durumda hastaneye goturme ve mudahale)", onay()],
          ["Saglik Taramasi Izni\n(Okulca organize saglik taramalarina katilim)", onay()]
        ];

        pdf.autoTable({
          startY: y,
          body: izinRows.map(r => [tr(r[0]), tr(r[1])]),
          theme: "grid",
          styles: { font: "helvetica", fontSize: 8, cellPadding: 2, overflow: "linebreak" },
          columnStyles: { 0: { cellWidth: contentW * 0.65, fontStyle: "bold" }, 1: { cellWidth: contentW * 0.35, halign: "center" } },
          margin: { left: margin, right: margin }
        });
        y = pdf.lastAutoTable.finalY + 4;

        // Veli imzası açıklama
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(8);
        const note = tr("Lutfen her bir izin icin Evet veya Hayir kutusunu elle isaretleyiniz.");
        pdf.text(note, margin, y);
        y += 6;
      } else if (b.tip === "madde-baslik") {
        newPageIfNeeded(12);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(tr(b.metin), pageW / 2, y + 4, { align: "center" });
        y += 8;
      } else if (b.tip === "madde") {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        const prefix = `${b.no}. `;
        const wrapped = pdf.splitTextToSize(prefix + tr(b.metin), contentW);
        newPageIfNeeded(wrapped.length * 4 + 2);
        pdf.text(wrapped, margin, y);
        y += wrapped.length * 4 + 2;
      } else if (b.tip === "paragraf") {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        const wrapped = pdf.splitTextToSize(tr(b.metin), contentW);
        newPageIfNeeded(wrapped.length * 4 + 4);
        pdf.text(wrapped, margin, y);
        y += wrapped.length * 4 + 4;
      } else if (b.tip === "imza") {
        newPageIfNeeded(45);
        y += 6;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        const imzaMetin = `Isbu sozlesme ${b.tarih || "..../..../........"} tarihinde iki nusha olarak duzenlenmis ve imza altina alinmistir.`;
        const wrapped = pdf.splitTextToSize(imzaMetin, contentW);
        pdf.text(wrapped, margin, y);
        y += wrapped.length * 4 + 15;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text("Ogrenci velisi/vasisinin", margin + 20, y);
        pdf.text("Kurumun", pageW - margin - 50, y);
        y += 5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(`(${tr(b.imzalayan)})`, margin + 20, y);
        pdf.text("(Kase, Muhur ve Yetkilinin Imzasi)", pageW - margin - 60, y);
        y += 20;
        pdf.text("Adi Soyadi ve Imzasi: __________________", margin, y);
      }
    }

    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`Sayfa ${i} / ${totalPages}`, pageW / 2, pageH - 8, { align: "center" });
      pdf.text(`${tr(veri.okul.adi)} | ${veri.okul.donem} | Sozlesme v${veri.sablon?.versiyon || "1"}`, margin, pageH - 8);
    }

    const dosyaAdi = `Sozlesme_${tr(veri.ogrenci.adSoyad || "ogrenci").replace(/[^a-zA-Z0-9]/g, "_")}_${veri.okul.donem}.pdf`;
    pdf.save(dosyaAdi);

    showToast("PDF indirildi");
  } catch (e) {
    console.error(e);
    showToast("PDF hatasi: " + e.message, "error");
  }
};

// ============ WORD ÜRETİM ============
function docxParaCenter(docx, text, bold, size) {
  return new docx.Paragraph({
    alignment: docx.AlignmentType.CENTER,
    children: [new docx.TextRun({ text: text, bold: !!bold, size: size || 20 })]
  });
}

function docxPara(docx, text, bold, size) {
  return new docx.Paragraph({
    children: [new docx.TextRun({ text: text, bold: !!bold, size: size || 20 })]
  });
}

function docxTablo(docx, satirlar, baslik, width) {
  const { Table, TableRow, TableCell, Paragraph, TextRun, AlignmentType, WidthType } = docx;
  const rows = [];
  if (baslik) {
    rows.push(new TableRow({
      children: [new TableCell({
        columnSpan: 2,
        shading: { fill: "E5E5E5" },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: baslik, bold: true, size: 20 })] })]
      })]
    }));
  }
  satirlar.forEach(r => {
    rows.push(new TableRow({
      children: [
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          shading: { fill: "F8F8F8" },
          children: [new Paragraph({ children: [new TextRun({ text: r[0] || "", bold: true, size: 18 })] })]
        }),
        new TableCell({
          width: { size: 65, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: r[1] || "", size: 18 })] })]
        })
      ]
    }));
  });
  return new Table({
    width: { size: width || 100, type: WidthType.PERCENTAGE },
    rows: rows
  });
}

window.sozlesmeCiktiWord = async function() {
  try {
    showToast("Word dosyası hazırlanıyor...");
    const veri = toplaSozlesmeVerisi();
    if (!veri) { showToast("Veri alınamadı", "error"); return; }
    if (!veri.sablon) { showToast("Önce sözleşme şablonunu yükleyin", "error"); return; }

    const bolumler = olusturSozlesmeMetni(veri);
    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, Packer, PageBreak, ImageRun } = window.docx;

    const children = [];

    const base64ToBuffer = (base64Uri) => {
      const base64 = base64Uri.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    };

    const headerBlok = async () => {
      try {
        const okulBuf = base64ToBuffer(LOGO_OKUL_BASE64);
        const mebBuf = base64ToBuffer(LOGO_MEB_BASE64);

        const headerRow = new TableRow({
          children: [
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({ data: okulBuf, transformation: { width: 55, height: 70 } })]
              })]
            }),
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "T.C.", bold: true, size: 22 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MİLLÎ EĞİTİM BAKANLIĞI", bold: true, size: 20 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ÖZEL ÖĞRETİM KURUMLARI GENEL MÜDÜRLÜĞÜ", bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ÖĞRENCİ KAYIT SÖZLEŞMESİ", bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(ÖZEL OKULLAR)", size: 16 })] })
              ]
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({ data: mebBuf, transformation: { width: 60, height: 50 } })]
              })]
            })
          ]
        });

        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
          },
          rows: [headerRow]
        });
      } catch (e) {
        console.warn("Logo yüklenemedi, basit başlık kullanılıyor:", e);
        return null;
      }
    };

    const headerTable = await headerBlok();
    if (headerTable) {
      children.push(headerTable);
    } else {
      children.push(docxParaCenter(docx, "T.C.", true, 24));
      children.push(docxParaCenter(docx, "MİLLÎ EĞİTİM BAKANLIĞI", true, 22));
      children.push(docxParaCenter(docx, "ÖZEL ÖĞRETİM KURUMLARI GENEL MÜDÜRLÜĞÜ", true, 20));
      children.push(docxParaCenter(docx, "ÖĞRENCİ KAYIT SÖZLEŞMESİ", true, 20));
      children.push(docxParaCenter(docx, "(ÖZEL OKULLAR)", false, 18));
    }

    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({
      children: [
        new TextRun({ text: "Özel Okul Adı: ", bold: true, size: 20 }),
        new TextRun({ text: veri.okul.adi, size: 20 }),
        new TextRun({ text: "  |  ", size: 20 }),
        new TextRun({ text: `${veri.okul.donem} EĞİTİM VE ÖĞRETİM YILI`, bold: true, size: 20 })
      ]
    }));
    children.push(new Paragraph({ text: "" }));

    for (const b of bolumler) {
      if (b.tip === "header-logolu") {
        continue;
      } else if (b.tip === "sayfa-baslat") {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: `${veri.okul.adi}`, bold: true, size: 20 }),
            new TextRun({ text: `  |  `, size: 20 }),
            new TextRun({ text: `${veri.okul.donem} EĞİTİM VE ÖĞRETİM YILI`, bold: true, size: 20 })
          ]
        }));
        children.push(new Paragraph({ text: "" }));
      } else if (b.tip === "tablo-tam") {
        children.push(docxTablo(docx, b.satirlar, b.baslik));
        children.push(new Paragraph({ text: "" }));
      } else if (b.tip === "tablo-yanyana") {
        const solT = docxTablo(docx, b.solSatirlar, b.solBaslik);
        const sagT = docxTablo(docx, b.sagSatirlar, b.sagBaslik);
        const wrapRow = new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [solT, new Paragraph({ text: "" })]
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [sagT, new Paragraph({ text: "" })]
            })
          ]
        });
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
          },
          rows: [wrapRow]
        }));
        children.push(new Paragraph({ text: "" }));
      } else if (b.tip === "odeme-tablosu") {
        const o = b.odeme;
        const ilan = o.ilanUcretleri;

        // Öğrenim ücretinin %60'ı eğitim, %40'ı yemek olarak ayrılır
        const egitimKismi = Math.round(o.yillikAidat * 0.60);
        const yemekKismi = Math.round(o.yillikAidat * 0.40);

        // MEB'de gösterilen kalemler için toplam (orman kıyafeti ve servisler MEB'e gösterilmiyor)
        const mebGenelToplam = o.yillikAidat + (o.digerUcretler.okulKiyafeti||0) + (o.digerUcretler.egitimMateryali||0);

        const uc = (label, a, b2) => new TableRow({
          children: [
            new TableCell({ width: { size: 46, type: WidthType.PERCENTAGE }, shading: { fill: "F8F8F8" }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 16 })] })] }),
            new TableCell({ width: { size: 27, type: WidthType.PERCENTAGE }, shading: { fill: "FEF9C3" }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: a, size: 16 })] })] }),
            new TableCell({ width: { size: 27, type: WidthType.PERCENTAGE }, shading: { fill: "FEF9C3" }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: b2, size: 16 })] })] })
          ]
        });

        const odemeTablosu = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [new TableCell({
                columnSpan: 3, shading: { fill: "E5E5E5" },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `ÖDEME BİLGİLERİ (${veri.okul.donem} Öğretim Yılı İçin)`, bold: true, size: 20 })] })]
              })]
            }),
            new TableRow({
              children: [
                new TableCell({ shading: { fill: "F5F5F5" }, children: [new Paragraph({ text: "" })] }),
                new TableCell({ shading: { fill: "FDE68A" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Kurumun İlan Ettiği Ücretler (KDV Dahil)", bold: true, size: 16 })] })] }),
                new TableCell({ shading: { fill: "FDE68A" }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Öğrenci İçin Belirlenen Ücretler (KDV Dahil)", bold: true, size: 16 })] })] })
              ]
            }),
            uc("Öğrenim Ücreti", formatTL(ilan.ogrenim), formatTL(egitimKismi)),
            uc("Okul-Aile Birliğinin Almış Olduğu Karar Doğrultusunda Öğrenci Kıyafeti ve Kıyafet Ücreti", formatTL(ilan.kiyafet), formatTL(o.digerUcretler.okulKiyafeti||0)),
            uc("   ↳ Yemek Ücreti", formatTL(ilan.yemek), formatTL(yemekKismi)),
            uc("   ↳ Kahvaltı Ücreti", formatTL(ilan.kahvalti), ""),
            uc("   ↳ Takviye Kursu Ücreti", formatTL(ilan.takviye), ""),
            uc("   ↳ Yatakhane Ücreti", formatTL(ilan.yatakhane), ""),
            uc("   ↳ Kitap Ücreti", "", ""),
            uc("   ↳ Kırtasiye Ücreti", formatTL(ilan.kitapKirtasiye), formatTL(o.digerUcretler.egitimMateryali||0)),
            uc("   ↳ Etüt Ücreti", formatTL(ilan.etut), ""),
            new TableRow({
              children: [
                new TableCell({ shading: { fill: "D1FAE5" }, children: [new Paragraph({ children: [new TextRun({ text: "ÜCRETLER TOPLAMI", bold: true, size: 20 })] })] }),
                new TableCell({ shading: { fill: "D1FAE5" }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatTL(o.ilanToplam), bold: true, size: 20 })] })] }),
                new TableCell({ shading: { fill: "D1FAE5" }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatTL(mebGenelToplam), bold: true, size: 20 })] })] })
              ]
            })
          ]
        });
        children.push(odemeTablosu);
        children.push(new Paragraph({ text: "" }));

        const pesinCheck = o.pesinOdeme ? "( x ) Peşin   (   ) Taksit" : "(   ) Peşin   ( x ) Taksit";
        const bursCheck = o.burs ? "( x ) Evet   (   ) Hayır" : "(   ) Evet   ( x ) Hayır";
        const indirimCheck = (o.indirimOrani > 0) ? "( x ) Evet   (   ) Hayır" : "(   ) Evet   ( x ) Hayır";

        const odemeDetay = [
          ["Ödeme Şekli", pesinCheck],
          ["Taksit Başlangıç Tarihi", o.pesinOdeme ? "—" : (formatTarih(o.taksitBaslangicTarihi) || "")],
          ["Peşinat", o.pesinOdeme ? formatTL(o.yillikAidat) : (o.onOdeme > 0 ? formatTL(o.onOdeme) : "")],
          ["Taksit Sayısı ve Tutarı", o.pesinOdeme ? "—"
            : (o.planOzet || `${o.taksit} taksit × ${formatTL(o.aylikAidat)}`)],
          ["Eğitim Bursu Alıyor Mu?", bursCheck],
          ["Eğitim Bursu Alıyorsa Yüzdesi", o.burs ? `% ${o.bursYuzde}` : "% ..."],
          ["İndirim Yapıldı Mı?", indirimCheck]
        ];
        children.push(docxTablo(docx, odemeDetay));
        children.push(new Paragraph({ text: "" }));

        const nedenList = [
          ["%5 Kardeş İndirimi", "Öğretmen Çocuğu İndirimi"],
          ["Personel Çocuğu İndirimi", "Başarı İndirimi"],
          ["Kurumsal İndirim", "Kayıtlı Öğrenci İndirimi"],
          ["Şehit/Gazi Çocuğu İndirimi", "Korucu Çocuğu İndirimi"]
        ];
        const chk = (label) => {
          const secildi = (o.indirimNedeni || "").toLowerCase().includes(label.toLowerCase().substring(0, 5));
          return `${secildi ? "( x )" : "(   )"} ${label}`;
        };

        const nedenRows = [[{
          type: "header", content: "İndirim Yapılmışsa Nedeni?"
        }]];
        const nedenTableRows = [
          new TableRow({
            children: [new TableCell({
              columnSpan: 2, shading: { fill: "F0F0F0" },
              children: [new Paragraph({ children: [new TextRun({ text: "İndirim Yapılmışsa Nedeni?", bold: true, size: 18 })] })]
            })]
          }),
          ...nedenList.map(pair => new TableRow({
            children: [
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: chk(pair[0]), size: 16 })] })] }),
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: chk(pair[1]), size: 16 })] })] })
            ]
          }))
        ];
        const digerSec = o.indirimNedeni && !nedenList.flat().some(l => (o.indirimNedeni||"").toLowerCase().includes(l.toLowerCase().substring(0,5)));
        nedenTableRows.push(new TableRow({
          children: [new TableCell({
            columnSpan: 2,
            children: [new Paragraph({ children: [new TextRun({ text: `${digerSec ? "( x )" : "(   )"} Diğer İndirimler (${o.indirimNedeni || "..........................."})`, size: 16 })] })]
          })]
        }));

        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: nedenTableRows
        }));
        children.push(new Paragraph({ text: "" }));
      } else if (b.tip === "izinler") {
        const iz = b.izinler;
        const onay = () => "(   ) Evet   (   ) Hayır";

        children.push(new Paragraph({ text: "" }));
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "İZİNLER VE TAAHHÜTLER", bold: true, size: 22 })]
        }));
        children.push(new Paragraph({ text: "" }));

        const izinList = [
          ["Medya Kullanım İzni (Fotoğraf/video okul iletişiminde kullanılabilir)", onay()],
          ["Gezi ve Etkinlik İzni (Okul gezileri, ziyaretler, etkinliklere katılım)", onay()],
          ["Acil Müdahale İzni (Acil durumda hastaneye götürme ve müdahale)", onay()],
          ["Sağlık Taraması İzni (Okulca organize sağlık taramalarına katılım)", onay()]
        ];

        const izinTableRows = izinList.map(pair => new TableRow({
          children: [
            new TableCell({ width: { size: 65, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: pair[0], bold: true, size: 16 })] })] }),
            new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: pair[1], size: 16 })] })] })
          ]
        }));

        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: izinTableRows
        }));
        children.push(new Paragraph({
          children: [new TextRun({ text: "Lütfen her bir izin için Evet veya Hayır kutusunu elle işaretleyiniz.", italics: true, size: 16 })]
        }));
        children.push(new Paragraph({ text: "" }));
      } else if (b.tip === "madde-baslik") {
        children.push(new Paragraph({ text: "" }));
        children.push(docxParaCenter(docx, b.metin, true, 22));
      } else if (b.tip === "madde") {
        children.push(new Paragraph({
          children: [new TextRun({ text: `${b.no}. ${b.metin}`, size: 18 })]
        }));
      } else if (b.tip === "paragraf") {
        children.push(new Paragraph({
          children: [new TextRun({ text: b.metin, size: 18 })]
        }));
      } else if (b.tip === "imza") {
        children.push(new Paragraph({ text: "" }));
        children.push(new Paragraph({
          children: [new TextRun({ text: `İşbu sözleşme ${b.tarih || "..../..../........"} tarihinde iki nüsha olarak düzenlenmiş ve imza altına alınmıştır.`, size: 20 })]
        }));
        children.push(new Paragraph({ text: "" }));
        children.push(new Paragraph({ text: "" }));
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  children: [
                    new Paragraph({ children: [new TextRun({ text: "Öğrenci velisi/vasisinin", bold: true, size: 18 })] }),
                    new Paragraph({ children: [new TextRun({ text: `(${b.imzalayan})`, size: 18 })] }),
                    new Paragraph({ text: "" }), new Paragraph({ text: "" }),
                    new Paragraph({ children: [new TextRun({ text: "Adı Soyadı ve İmzası:", size: 18 })] }),
                    new Paragraph({ children: [new TextRun({ text: "_______________________", size: 18 })] })
                  ]
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                  children: [
                    new Paragraph({ children: [new TextRun({ text: "Kurumun", bold: true, size: 18 })] }),
                    new Paragraph({ children: [new TextRun({ text: "(Kaşe, Mühür ve Yetkilinin İmzası)", size: 18 })] }),
                    new Paragraph({ text: "" }), new Paragraph({ text: "" }),
                    new Paragraph({ children: [new TextRun({ text: "_______________________", size: 18 })] })
                  ]
                })
              ]
            })
          ]
        }));
      }
    }

    const doc = new Document({ sections: [{ children: children }] });
    const blob = await Packer.toBlob(doc);
    const dosyaAdi = `Sozlesme_${(veri.ogrenci.adSoyad || "ogrenci").replace(/[^a-zA-Z0-9]/g, "_")}_${veri.okul.donem}.docx`;
    saveAs(blob, dosyaAdi);

    showToast("✓ Word dosyası indirildi");
  } catch (e) {
    console.error(e);
    showToast("Word hatası: " + e.message, "error");
  }
};

// ============ ÖNİZLEME ============
window.sozlesmeCiktiOnizleme = function() {
  try {
    const veri = toplaSozlesmeVerisi();
    if (!veri) { showToast("Veri alınamadı", "error"); return; }
    if (!veri.sablon) { showToast("Önce sözleşme şablonunu yükleyin", "error"); return; }

    const bolumler = olusturSozlesmeMetni(veri);

    let html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
<title>Sözleşme Önizleme - ${escapeHtml(veri.ogrenci.adSoyad || "")}</title>
<style>
* { box-sizing: border-box; }
body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 30px; background: white; color: #222; line-height: 1.5; }
.header-logolu { display: grid; grid-template-columns: 90px 1fr 90px; align-items: center; gap: 16px; margin-bottom: 16px; }
.header-logolu img { max-width: 85px; max-height: 85px; object-fit: contain; display: block; margin: 0 auto; }
.header-logolu .baslik-orta { text-align: center; font-weight: bold; }
.header-logolu .baslik-orta .tc { font-size: 14px; }
.header-logolu .baslik-orta .meb { font-size: 13px; }
.header-logolu .baslik-orta .kurum { font-size: 12px; }
.header-logolu .baslik-orta .alt { font-size: 11px; font-weight: normal; }
.okul-bilgi { padding: 6px 0; margin-bottom: 16px; font-size: 13px; border-bottom: 1px solid #999; }
.okul-bilgi strong { font-size: 14px; }
.tablo-baslik { text-align: center; font-weight: bold; background: #e5e5e5; padding: 6px; font-size: 13px; border: 1px solid #999; margin-top: 12px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12px; }
td { border: 1px solid #999; padding: 5px 8px; vertical-align: top; }
td.label { width: 35%; font-weight: bold; background: #f8f8f8; }
.yanyana { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.yanyana > div { display: flex; flex-direction: column; }
.yanyana table { font-size: 11px; }
.yanyana td { padding: 3px 6px; }
.yanyana td.label { width: 40%; }
.sayfa-break { page-break-before: always; margin-top: 24px; border-top: 2px dashed #ccc; padding-top: 16px; }
.odeme-tablo td.odeme-label { background: #f8f8f8; font-weight: bold; }
.odeme-tablo td.ilan { background: #fef9c3; text-align: right; font-weight: bold; }
.odeme-tablo td.ogr { background: #fef9c3; text-align: right; font-weight: bold; }
.odeme-tablo .header-row td { background: #e5e5e5; text-align: center; font-weight: bold; padding: 8px; }
.odeme-tablo .col-header td { background: #fde68a; text-align: center; font-weight: bold; font-size: 11px; padding: 6px; }
.odeme-tablo .toplam-row td { background: #d1fae5; font-weight: bold; font-size: 13px; }
.veli-istek-tr td:first-child { position: relative; padding-left: 22px; }
.veli-istek-tr td:first-child::before { content: "↳"; position: absolute; left: 6px; color: #666; }
.madde-baslik { text-align: center; font-weight: bold; font-size: 13px; margin: 18px 0 10px; }
.madde { font-size: 12px; margin-bottom: 6px; text-align: justify; }
.paragraf { font-size: 12px; margin: 6px 0; text-align: justify; }
.imza { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; font-size: 12px; }
.imza div { padding: 10px; }
.imza strong { display: block; margin-bottom: 4px; }
.imza .alt { font-size: 11px; color: #666; margin-bottom: 30px; }
.yazdir-btn { position: fixed; top: 20px; right: 20px; padding: 12px 24px; background: #2d6a4f; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; z-index: 999; }
@media print { .yazdir-btn { display: none; } .sayfa-break { border-top: none; padding-top: 0; } }
</style></head><body>
<button class="yazdir-btn" onclick="window.print()"><i data-lucide="printer" style="width:14px;height:14px;vertical-align:-2px;"></i> Yazdır</button>`;

    const headerHTML = `<div class="header-logolu">
      <img src="${LOGO_OKUL_BASE64}" alt="Okul Logosu"/>
      <div class="baslik-orta">
        <div class="tc">T.C.</div>
        <div class="meb">MİLLÎ EĞİTİM BAKANLIĞI</div>
        <div class="kurum">ÖZEL ÖĞRETİM KURUMLARI GENEL MÜDÜRLÜĞÜ</div>
        <div class="kurum">ÖĞRENCİ KAYIT SÖZLEŞMESİ</div>
        <div class="alt">(ÖZEL OKULLAR)</div>
      </div>
      <img src="${LOGO_MEB_BASE64}" alt="MEB Logosu"/>
    </div>
    <div class="okul-bilgi"><strong>Özel Okul Adı:</strong> ${escapeHtml(veri.okul.adi)} &nbsp;|&nbsp; <strong>${veri.okul.donem} EĞİTİM VE ÖĞRETİM YILI</strong></div>`;

    const headerBasitHTML = `<div class="okul-bilgi" style="text-align:center;margin-bottom:12px;"><strong>${escapeHtml(veri.okul.adi)}</strong> &nbsp;|&nbsp; <strong>${veri.okul.donem} EĞİTİM VE ÖĞRETİM YILI</strong></div>`;

    for (const b of bolumler) {
      if (b.tip === "header-logolu") {
        html += headerHTML;
      } else if (b.tip === "sayfa-baslat") {
        html += `<div class="sayfa-break">${headerBasitHTML}</div>`;
      } else if (b.tip === "tablo-tam") {
        html += `<div class="tablo-baslik">${escapeHtml(b.baslik)}</div>`;
        html += `<table>`;
        b.satirlar.forEach(r => {
          html += `<tr><td class="label">${escapeHtml(r[0] || "")}</td><td>${escapeHtml(r[1] || "")}</td></tr>`;
        });
        html += `</table>`;
      } else if (b.tip === "tablo-yanyana") {
        html += `<div class="yanyana"><div>`;
        html += `<div class="tablo-baslik">${escapeHtml(b.solBaslik)}</div>`;
        html += `<table>`;
        b.solSatirlar.forEach(r => {
          html += `<tr><td class="label">${escapeHtml(r[0] || "")}</td><td>${escapeHtml(r[1] || "")}</td></tr>`;
        });
        html += `</table></div><div>`;
        html += `<div class="tablo-baslik">${escapeHtml(b.sagBaslik)}</div>`;
        html += `<table>`;
        b.sagSatirlar.forEach(r => {
          html += `<tr><td class="label">${escapeHtml(r[0] || "")}</td><td>${escapeHtml(r[1] || "")}</td></tr>`;
        });
        html += `</table></div></div>`;
      } else if (b.tip === "odeme-tablosu") {
        const o = b.odeme;
        const ilan = o.ilanUcretleri;

        // Öğrenim ücretinin %60'ı eğitim, %40'ı yemek olarak ayrılır
        const egitimKismi = Math.round(o.yillikAidat * 0.60);
        const yemekKismi = Math.round(o.yillikAidat * 0.40);

        // MEB'de gösterilen kalemler için toplam (orman kıyafeti ve servisler MEB'e gösterilmiyor)
        const mebGenelToplam = o.yillikAidat + (o.digerUcretler.okulKiyafeti||0) + (o.digerUcretler.egitimMateryali||0);

        html += `<table class="odeme-tablo">`;
        html += `<tr class="header-row"><td colspan="3">ÖDEME BİLGİLERİ (${veri.okul.donem} Öğretim Yılı İçin)</td></tr>`;
        html += `<tr class="col-header"><td></td><td>Kurumun İlan Ettiği<br>Ücretler (KDV Dahil)</td><td>Öğrenci İçin<br>Belirlenen Ücretler (KDV Dahil)</td></tr>`;

        html += `<tr><td class="odeme-label">Öğrenim Ücreti</td><td class="ilan">${formatTL(ilan.ogrenim)}</td><td class="ogr">${formatTL(egitimKismi)}</td></tr>`;
        html += `<tr><td class="odeme-label">Okul-Aile Birliğinin Almış Olduğu Karar Doğrultusunda<br>Öğrenci Kıyafeti ve Kıyafet Ücreti</td><td class="ilan">${formatTL(ilan.kiyafet)}</td><td class="ogr">${formatTL(o.digerUcretler.okulKiyafeti||0)}</td></tr>`;
        html += `<tr class="veli-istek-tr"><td class="odeme-label">Yemek Ücreti</td><td class="ilan">${formatTL(ilan.yemek)}</td><td class="ogr">${formatTL(yemekKismi)}</td></tr>`;
        html += `<tr class="veli-istek-tr"><td class="odeme-label">Kahvaltı Ücreti</td><td class="ilan">${formatTL(ilan.kahvalti)}</td><td class="ogr"></td></tr>`;
        html += `<tr class="veli-istek-tr"><td class="odeme-label">Takviye Kursu Ücreti</td><td class="ilan">${formatTL(ilan.takviye)}</td><td class="ogr"></td></tr>`;
        html += `<tr class="veli-istek-tr"><td class="odeme-label">Yatakhane Ücreti</td><td class="ilan">${formatTL(ilan.yatakhane)}</td><td class="ogr"></td></tr>`;
        html += `<tr class="veli-istek-tr"><td class="odeme-label">Kitap Ücreti</td><td class="ilan"></td><td class="ogr"></td></tr>`;
        html += `<tr class="veli-istek-tr"><td class="odeme-label">Kırtasiye Ücreti</td><td class="ilan">${formatTL(ilan.kitapKirtasiye)}</td><td class="ogr">${formatTL(o.digerUcretler.egitimMateryali||0)}</td></tr>`;
        html += `<tr class="veli-istek-tr"><td class="odeme-label">Etüt Ücreti</td><td class="ilan">${formatTL(ilan.etut)}</td><td class="ogr"></td></tr>`;
        html += `<tr class="toplam-row"><td>ÜCRETLER TOPLAMI</td><td style="text-align:right;">${formatTL(o.ilanToplam)}</td><td style="text-align:right;">${formatTL(mebGenelToplam)}</td></tr>`;
        html += `</table>`;

        const pesinCheck = o.pesinOdeme ? "( x ) Peşin &nbsp;&nbsp; (&nbsp;&nbsp;) Taksit" : "(&nbsp;&nbsp;) Peşin &nbsp;&nbsp; ( x ) Taksit";
        const bursCheck = o.burs ? "( x ) Evet &nbsp;&nbsp; (&nbsp;&nbsp;) Hayır" : "(&nbsp;&nbsp;) Evet &nbsp;&nbsp; ( x ) Hayır";
        const indirimCheck = (o.indirimOrani > 0) ? "( x ) Evet &nbsp;&nbsp; (&nbsp;&nbsp;) Hayır" : "(&nbsp;&nbsp;) Evet &nbsp;&nbsp; ( x ) Hayır";

        html += `<table style="margin-top:4px;">`;
        html += `<tr><td class="label" style="width:46%;">Ödeme Şekli</td><td>${pesinCheck}</td></tr>`;
        html += `<tr><td class="label">Taksit Başlangıç Tarihi</td><td>${o.pesinOdeme ? "—" : escapeHtml(formatTarih(o.taksitBaslangicTarihi) || "")}</td></tr>`;
        html += `<tr><td class="label">Peşinat</td><td>${o.pesinOdeme ? escapeHtml(formatTL(o.yillikAidat)) : (o.onOdeme > 0 ? escapeHtml(formatTL(o.onOdeme)) : "")}</td></tr>`;
        html += `<tr><td class="label">Taksit Sayısı ve Tutarı</td><td>${o.pesinOdeme ? "—" : escapeHtml(o.planOzet || `${o.taksit} taksit × ${formatTL(o.aylikAidat)}`)}</td></tr>`;
        html += `<tr><td class="label">Eğitim Bursu Alıyor Mu?</td><td>${bursCheck}</td></tr>`;
        html += `<tr><td class="label">Eğitim Bursu Alıyorsa Yüzdesi</td><td>${o.burs ? `% ${o.bursYuzde}` : "% ..."}</td></tr>`;
        html += `<tr><td class="label">İndirim Yapıldı Mı?</td><td>${indirimCheck}</td></tr>`;
        html += `</table>`;

        const nedenList = [
          ["%5 Kardeş İndirimi", "Öğretmen Çocuğu İndirimi"],
          ["Personel Çocuğu İndirimi", "Başarı İndirimi"],
          ["Kurumsal İndirim", "Kayıtlı Öğrenci İndirimi"],
          ["Şehit/Gazi Çocuğu İndirimi", "Korucu Çocuğu İndirimi"]
        ];
        const chk = (label) => {
          const secildi = (o.indirimNedeni || "").toLowerCase().includes(label.toLowerCase().substring(0, 5));
          return `${secildi ? "( x )" : "(&nbsp;&nbsp;)"} ${escapeHtml(label)}`;
        };

        html += `<table style="margin-top:4px;">`;
        html += `<tr><td colspan="2" style="background:#f0f0f0;font-weight:bold;">İndirim Yapılmışsa Nedeni?</td></tr>`;
        nedenList.forEach(pair => {
          html += `<tr><td>${chk(pair[0])}</td><td>${chk(pair[1])}</td></tr>`;
        });
        const digerSec = o.indirimNedeni && !nedenList.flat().some(l => (o.indirimNedeni||"").toLowerCase().includes(l.toLowerCase().substring(0,5)));
        html += `<tr><td colspan="2">${digerSec ? "( x )" : "(&nbsp;&nbsp;)"} Diğer İndirimler (${escapeHtml(o.indirimNedeni || "...........................")})</td></tr>`;
        html += `</table>`;
      } else if (b.tip === "izinler") {
        const iz = b.izinler;
        const onay = () => "(&nbsp;&nbsp;) Evet &nbsp;&nbsp; (&nbsp;&nbsp;) Hayır";

        html += `<div class="madde-baslik" style="margin-top:12px;">İZİNLER VE TAAHHÜTLER</div>`;
        html += `<table style="margin-top:4px;">`;
        html += `<tr><td class="label" style="width:65%;">Medya Kullanım İzni<br><small style="color:#666;">(Fotoğraf/video okul iletişiminde kullanılabilir)</small></td><td style="text-align:center;">${onay()}</td></tr>`;
        html += `<tr><td class="label">Gezi ve Etkinlik İzni<br><small style="color:#666;">(Okul gezileri, ziyaretler, etkinliklere katılım)</small></td><td style="text-align:center;">${onay()}</td></tr>`;
        html += `<tr><td class="label">Acil Müdahale İzni<br><small style="color:#666;">(Acil durumda hastaneye götürme ve müdahale)</small></td><td style="text-align:center;">${onay()}</td></tr>`;
        html += `<tr><td class="label">Sağlık Taraması İzni<br><small style="color:#666;">(Okulca organize sağlık taramalarına katılım)</small></td><td style="text-align:center;">${onay()}</td></tr>`;
        html += `</table>`;
        html += `<div style="font-style:italic;font-size:11px;color:#666;margin-top:4px;">Lütfen her bir izin için Evet veya Hayır kutusunu elle işaretleyiniz.</div>`;
      } else if (b.tip === "madde-baslik") {
        html += `<div class="madde-baslik">${escapeHtml(b.metin)}</div>`;
      } else if (b.tip === "madde") {
        html += `<div class="madde"><strong>${b.no}.</strong> ${escapeHtml(b.metin)}</div>`;
      } else if (b.tip === "paragraf") {
        html += `<div class="paragraf">${escapeHtml(b.metin)}</div>`;
      } else if (b.tip === "imza") {
        html += `<div class="madde" style="margin-top:20px;">İşbu sözleşme <strong>${escapeHtml(b.tarih || "..../..../........")}</strong> tarihinde iki nüsha olarak düzenlenmiş ve imza altına alınmıştır.</div>`;
        html += `<div class="imza">
          <div><strong>Öğrenci velisi/vasisinin</strong><div class="alt">(${escapeHtml(b.imzalayan)})</div>Adı Soyadı ve İmzası:<br>_______________________</div>
          <div><strong>Kurumun</strong><div class="alt">(Kaşe, Mühür ve Yetkilinin İmzası)</div><br>_______________________</div>
        </div>`;
      }
    }

    html += `</body></html>`;

    const yeniPencere = window.open("", "_blank");
    if (yeniPencere) {
      yeniPencere.document.write(html);
      yeniPencere.document.close();
    } else {
      showToast("Tarayıcı pop-up'ı engelledi. Lütfen izin verin.", "error");
    }
  } catch (e) {
    console.error(e);
    showToast("Önizleme hatası: " + e.message, "error");
  }
};

// ── Çekirdeğin erişimi için ──
window.renderCiktiOzet      = renderCiktiOzet;
window.toplaSozlesmeVerisi  = toplaSozlesmeVerisi;
window.olusturSozlesmeMetni = olusturSozlesmeMetni;
window.formatTL             = formatTL;
window.formatTarih          = formatTarih;   // çekirdeğin 6 yerinde kullanılıyor
console.log("Çıktı (sözleşme/PDF/Word) modülü yüklendi.");
