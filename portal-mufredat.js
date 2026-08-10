// ══════════════════════════════════════════════════════════════
// PORTAL · MÜFREDAT EDİTÖRÜ MODÜLÜ
// --------------------------------------------------------------
// index.html içindeki eski editörün (satır ~18316-18500) yerini alır.
// Modül çekirdekten SONRA yüklendiği için window.mufredatEditorAc'ı
// güvenle üzerine yazar; HTML'deki onclick'ler otomatik buraya düşer.
//
// EKLENENLER (eski editörde yoktu):
//   1. Yeniden adlandırma — alan / grup / ders adı değiştirilebilir
//   2. KAYIT TAŞIMA — ad değişince öğrenci kayıtları yeni anahtara taşınır
//   3. Sıralama — alan/grup/ders yukarı-aşağı taşınabilir
//   4. JSON dışa aktarma (yedek al) ve içe aktarma (toplu yükleme)
//   5. prompt() yerine doğrudan yazılabilir alanlar
//
// KRİTİK: kazanım anahtarı `alanId__grupAd__dersAd` biçimindedir.
// Bir ad değişince eski anahtara bağlı tüm öğrenci kayıtları öksüz
// kalır. Bu yüzden her yeniden adlandırma bir "taşıma" kaydı üretir
// ve Kaydet'e basıldığında ogrenciGelisim belgeleri güncellenir.
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { db, doc, getDoc, getDocs, collection, setDoc, updateDoc,
        serverTimestamp, escapeHtml } = B;

const bildir = (m, t) => (typeof showToast === "function" ? showToast(m, t) : console.log(m));

let aktifDisiplin  = "montessori";
let calismaKopyasi = {};   // { disiplin: [alan, ...] } — düzenlenen taslak
let bekleyenTasima = [];   // { disiplin, eski, yeni, etiket }
let degisiklikVar  = false;

// ── Yardımcılar ───────────────────────────────────────────────

function disiplinler() {
  try { const d = B.DISIPLINLER && B.DISIPLINLER(); if (Array.isArray(d) && d.length) return d; }
  catch (e) {}
  return [
    { id:"montessori", ad:"Montessori",      ikon:"🌱", renk:"#2d6a4f" },
    { id:"orman",      ad:"Orman Okulu",     ikon:"🍂", renk:"#b45309" },
    { id:"degerler",   ad:"Değerler Eğitimi",ikon:"💎", renk:"#7c3aed" },
    { id:"ingilizce",  ad:"İngilizce",       ikon:"🇬🇧", renk:"#1d4ed8" }
  ];
}

// Alan id'si — zeky-data.js'teki mufredatJsonDogrula ile BİREBİR aynı olmalı,
// yoksa app ve portal farklı anahtar üretir ve kayıtlar ikiye bölünür.
function alanIdUret(ad, sira) {
  const id = String(ad || "").toLocaleLowerCase("tr")
    .replace(/ç/g,"c").replace(/ğ/g,"g").replace(/ı/g,"i")
    .replace(/ö/g,"o").replace(/ş/g,"s").replace(/ü/g,"u")
    .replace(/[^a-z0-9]/g, "").slice(0, 24);
  return id || ("alan" + (sira + 1));
}

function kopyala(x) { return JSON.parse(JSON.stringify(x || [])); }

function diziTasi(dizi, i, yon) {
  const j = i + yon;
  if (j < 0 || j >= dizi.length) return false;
  const g = dizi[i]; dizi[i] = dizi[j]; dizi[j] = g;
  return true;
}

// Taşıma kuyruğuna ekle (aynı öğe tekrar adlandırılırsa zinciri kısaltır)
function tasimaEkle(disiplin, eski, yeni, etiket) {
  if (eski === yeni) return;
  const oncekiler = bekleyenTasima.filter(t => t.disiplin === disiplin && t.yeni === eski);
  if (oncekiler.length) { oncekiler.forEach(t => { t.yeni = yeni; t.etiket = etiket; }); return; }
  bekleyenTasima.push({ disiplin, eski, yeni, etiket });
}

// ── Firestore ─────────────────────────────────────────────────

async function mufredatOku(disiplin) {
  const cache = (B.mufredatCache && B.mufredatCache()) || {};
  if (Array.isArray(cache[disiplin]) && cache[disiplin].length) return kopyala(cache[disiplin]);
  try {
    const snap = await getDoc(doc(db, "mufredatlar", disiplin));
    if (snap.exists() && Array.isArray(snap.data().alanlar)) return kopyala(snap.data().alanlar);
  } catch (e) { console.error("Müfredat okunamadı:", e); }
  return [];
}

async function mufredatYaz(disiplin, alanlar) {
  await setDoc(doc(db, "mufredatlar", disiplin),
    { alanlar, sonGuncelleme: serverTimestamp() }, { merge: true });
  if (B.mufredatCacheAta) B.mufredatCacheAta(disiplin, kopyala(alanlar));
}

// Öğrenci kayıtlarını eski anahtardan yeni anahtara taşı.
// DİKKAT: setDoc({merge:true}) burada İŞE YARAMAZ — eski anahtarları silmez.
// Disiplin nesnesinin tamamı updateDoc ile değiştirilir.
async function kayitlariTasi(liste) {
  if (!liste.length) return { belge: 0, kayit: 0 };
  let belgeSayisi = 0, kayitSayisi = 0;
  const snap = await getDocs(collection(db, "ogrenciGelisim"));

  for (const d of snap.docs) {
    const veri = d.data() || {};
    let belgeDegisti = false;
    const yeniVeri = {};

    for (const t of liste) {
      const dis = veri[t.disiplin];
      if (!dis || !dis.kayitlar) continue;
      const kayitlar = Object.assign({}, dis.kayitlar);
      const tarihler = Object.assign({}, dis.tarihler || {});
      let bolumDegisti = false;

      for (const anahtar of Object.keys(dis.kayitlar)) {
        // Tam eşleşme (ders) veya önek eşleşmesi (alan / grup)
        const tamEsit = anahtar === t.eski;
        const onekEsit = anahtar.startsWith(t.eski + "__");
        if (!tamEsit && !onekEsit) continue;
        const yeniAnahtar = tamEsit ? t.yeni : t.yeni + anahtar.slice(t.eski.length);
        if (yeniAnahtar === anahtar) continue;
        kayitlar[yeniAnahtar] = kayitlar[anahtar];
        delete kayitlar[anahtar];
        if (tarihler[anahtar] !== undefined) {
          tarihler[yeniAnahtar] = tarihler[anahtar];
          delete tarihler[anahtar];
        }
        bolumDegisti = true; kayitSayisi++;
      }

      if (bolumDegisti) {
        yeniVeri[t.disiplin] = Object.assign({}, veri[t.disiplin], { kayitlar, tarihler });
        veri[t.disiplin] = yeniVeri[t.disiplin];   // aynı belgede sıradaki taşıma bunu görsün
        belgeDegisti = true;
      }
    }

    if (belgeDegisti) {
      await updateDoc(doc(db, "ogrenciGelisim", d.id), yeniVeri);
      belgeSayisi++;
    }
  }
  return { belge: belgeSayisi, kayit: kayitSayisi };
}

// ── Modal ─────────────────────────────────────────────────────

function modalKur() {
  let m = document.getElementById("mufredatEditorModal");
  if (m) return m;
  m = document.createElement("div");
  m.id = "mufredatEditorModal";
  m.className = "modal-overlay";
  m.innerHTML = `
    <div class="modal-box" style="max-width:860px; width:96%;">
      <div class="modal-header">
        <h3 style="margin:0;">⚙️ Müfredat Düzenle</h3>
        <button class="btn-close" onclick="mufredatEditorKapat()">×</button>
      </div>
      <div style="padding:14px 16px 0;">
        <div class="disiplin-sekme-bar" id="mfSekmeBar" style="margin-bottom:10px; flex-wrap:wrap;"></div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
          <button class="btn-mini" onclick="mufredatJsonDisaAktar()">⬇ JSON indir</button>
          <button class="btn-mini" onclick="mufredatJsonIceAktarAc()">⬆ JSON yükle</button>
          <span style="flex:1"></span>
          <span id="mfDurum" style="font-size:11px; color:#6b7280; align-self:center;"></span>
        </div>
        <div id="mfUyari"></div>
      </div>
      <div id="mfIcerik" style="padding:4px 16px 16px; max-height:58vh; overflow-y:auto;"></div>
      <div class="modal-footer" style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn-secondary" onclick="mufredatEditorKapat()">İptal</button>
        <button class="btn-primary" onclick="mufredatKaydetVeKapat()">Kaydet</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  return m;
}

function sekmeleriCiz() {
  const bar = document.getElementById("mfSekmeBar");
  if (!bar) return;
  bar.innerHTML = disiplinler().map(d => `
    <button type="button" class="disiplin-sekme-btn ${d.id === aktifDisiplin ? "aktif" : ""}"
            onclick="mufredatEditorDisiplinSec('${d.id}')">
      ${d.ikon || "📚"} ${escapeHtml(d.ad)}
    </button>`).join("");
}

function uyariCiz() {
  const el = document.getElementById("mfUyari");
  if (!el) return;
  if (!bekleyenTasima.length) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px 12px; margin-bottom:10px;">
      <div style="font-size:12px; font-weight:700; color:#92400e; margin-bottom:5px;">
        ${bekleyenTasima.length} isim değişikliği bekliyor — kayıtlar taşınacak
      </div>
      <div style="font-size:11px; color:#78350f; line-height:1.6;">
        ${bekleyenTasima.map(t => `• ${escapeHtml(t.etiket)}`).join("<br>")}
      </div>
      <div style="font-size:10.5px; color:#a16207; margin-top:6px;">
        Kaydet'e bastığında öğrencilerin bu kazanımlara ait işaretlemeleri yeni isme aktarılır.
      </div>
    </div>`;
}

function icerikCiz() {
  const el = document.getElementById("mfIcerik");
  if (!el) return;
  const alanlar = calismaKopyasi[aktifDisiplin];
  if (!alanlar) { el.innerHTML = `<div style="padding:30px; text-align:center; color:#9ca3af;">Yükleniyor…</div>`; return; }

  const durum = document.getElementById("mfDurum");
  if (durum) {
    const grup = alanlar.reduce((t, a) => t + (a.gruplar || []).length, 0);
    const ders = alanlar.reduce((t, a) => t + (a.gruplar || []).reduce((s, g) => s + (g.dersler || []).length, 0), 0);
    durum.textContent = `${alanlar.length} alan · ${grup} grup · ${ders} kazanım`;
  }

  if (!alanlar.length) {
    el.innerHTML = `
      <div style="padding:26px; text-align:center; color:#9ca3af; background:#f9fafb; border-radius:12px; margin-bottom:12px;">
        Bu programın henüz müfredatı yok.<br>Aşağıdan ilk alanı ekleyerek ya da JSON yükleyerek başlayın.
      </div>` + altButonlar();
    return;
  }

  el.innerHTML = alanlar.map((alan, ai) => `
    <div class="mufredat-alan-kart" style="border-left:4px solid ${alan.renk || "#7c3aed"};">
      <div class="mufredat-alan-baslik" style="gap:6px;">
        <span style="font-size:18px;">${alan.ikon || "📚"}</span>
        <input class="mf-ad" value="${escapeHtml(alan.ad)}"
               onchange="mufredatAdDegistir('alan',${ai},-1,-1,this.value)"
               style="flex:1; font-size:14px; font-weight:700; border:1px solid transparent; background:transparent;
                      border-radius:6px; padding:4px 6px; min-width:80px;"
               onfocus="this.style.borderColor='#c4b5fd'; this.style.background='#fff';"
               onblur="this.style.borderColor='transparent'; this.style.background='transparent';">
        <span style="font-size:11px; color:#6b7280; white-space:nowrap;">
          ${(alan.gruplar || []).reduce((t, g) => t + (g.dersler || []).length, 0)} kazanım
        </span>
        <button class="btn-mini" title="Yukarı" onclick="mufredatSirala('alan',${ai},-1,-1,-1)">↑</button>
        <button class="btn-mini" title="Aşağı"  onclick="mufredatSirala('alan',${ai},-1,-1,1)">↓</button>
        <button class="btn-mini" title="Alanı sil" onclick="mufredatSil('alan',${ai},-1,-1)"
                style="background:#fef2f2; color:#dc2626;">×</button>
      </div>

      ${(alan.gruplar || []).map((g, gi) => `
        <div class="mufredat-grup">
          <div class="mufredat-grup-ust">
            <span style="font-size:13px;">📁</span>
            <input class="mf-ad" value="${escapeHtml(g.ad)}"
                   onchange="mufredatAdDegistir('grup',${ai},${gi},-1,this.value)"
                   style="flex:1; font-size:12.5px; font-weight:600; border:1px solid transparent;
                          background:transparent; border-radius:6px; padding:3px 6px; min-width:70px;"
                   onfocus="this.style.borderColor='#c4b5fd'; this.style.background='#fff';"
                   onblur="this.style.borderColor='transparent'; this.style.background='transparent';">
            <button class="btn-mini" onclick="mufredatSirala('grup',${ai},${gi},-1,-1)" title="Yukarı">↑</button>
            <button class="btn-mini" onclick="mufredatSirala('grup',${ai},${gi},-1,1)"  title="Aşağı">↓</button>
            <button class="btn-mini" onclick="mufredatEkle('ders',${ai},${gi})">+ Kazanım</button>
            <button class="btn-mini" onclick="mufredatSil('grup',${ai},${gi},-1)"
                    style="background:#fef2f2; color:#dc2626;">Sil</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; padding:6px 0 2px;">
            ${(g.dersler || []).map((d, di) => `
              <div style="display:flex; align-items:center; gap:4px;">
                <input class="mf-ad" value="${escapeHtml(d)}"
                       onchange="mufredatAdDegistir('ders',${ai},${gi},${di},this.value)"
                       style="flex:1; font-size:12px; border:1px solid #e5e7eb; background:#fff;
                              border-radius:6px; padding:5px 8px;">
                <button class="btn-mini" onclick="mufredatSirala('ders',${ai},${gi},${di},-1)" title="Yukarı">↑</button>
                <button class="btn-mini" onclick="mufredatSirala('ders',${ai},${gi},${di},1)"  title="Aşağı">↓</button>
                <button class="btn-mini" onclick="mufredatSil('ders',${ai},${gi},${di})"
                        style="background:#fef2f2; color:#dc2626;">×</button>
              </div>`).join("")}
          </div>
        </div>`).join("")}

      <div style="margin-top:8px;">
        <button class="btn-mini" onclick="mufredatEkle('grup',${ai},-1)"
                style="background:#f0fdf4; color:#166534;">+ Yeni Grup</button>
      </div>
    </div>`).join("") + altButonlar();
}

function altButonlar() {
  return `<button class="btn-mini" onclick="mufredatEkle('alan',-1,-1)"
            style="width:100%; margin-top:8px; padding:12px; font-size:13px; background:#f5f3ff;
                   color:#6d28d9; border:1px dashed #c4b5fd; font-weight:700;">
            + Yeni Gelişim Alanı Ekle
          </button>`;
}

// ── Dışa açılan işlemler ──────────────────────────────────────

window.mufredatEditorAc = async function() {
  modalKur().style.display = "flex";
  bekleyenTasima = []; degisiklikVar = false;
  const liste = disiplinler();
  if (!liste.find(d => d.id === aktifDisiplin)) aktifDisiplin = liste[0].id;
  sekmeleriCiz(); uyariCiz();
  document.getElementById("mfIcerik").innerHTML =
    `<div style="padding:30px; text-align:center; color:#9ca3af;">Yükleniyor…</div>`;
  calismaKopyasi[aktifDisiplin] = await mufredatOku(aktifDisiplin);
  icerikCiz();
};

window.mufredatEditorKapat = function() {
  if (degisiklikVar && !confirm("Kaydedilmemiş değişiklikler var. Kapatılsın mı?")) return;
  const m = document.getElementById("mufredatEditorModal");
  if (m) m.style.display = "none";
  calismaKopyasi = {}; bekleyenTasima = []; degisiklikVar = false;
};

window.mufredatEditorDisiplinSec = async function(disiplin) {
  aktifDisiplin = disiplin;
  sekmeleriCiz();
  if (!calismaKopyasi[disiplin]) {
    document.getElementById("mfIcerik").innerHTML =
      `<div style="padding:30px; text-align:center; color:#9ca3af;">Yükleniyor…</div>`;
    calismaKopyasi[disiplin] = await mufredatOku(disiplin);
  }
  icerikCiz();
};

// Ad değiştirme — taşıma kaydı üretir
window.mufredatAdDegistir = function(tip, ai, gi, di, yeniAd) {
  yeniAd = String(yeniAd || "").trim();
  if (!yeniAd) { bildir("İsim boş olamaz", "error"); icerikCiz(); return; }
  const alanlar = calismaKopyasi[aktifDisiplin];
  const alan = alanlar[ai];

  if (tip === "alan") {
    const eskiId = alan.id || alanIdUret(alan.ad, ai);
    const yeniId = alanIdUret(yeniAd, ai);
    if (eskiId !== yeniId) tasimaEkle(aktifDisiplin, eskiId, yeniId, `Alan: ${alan.ad} → ${yeniAd}`);
    alan.ad = yeniAd; alan.id = yeniId;
  } else if (tip === "grup") {
    const alanId = alan.id || alanIdUret(alan.ad, ai);
    const g = alan.gruplar[gi];
    tasimaEkle(aktifDisiplin, `${alanId}__${g.ad}`, `${alanId}__${yeniAd}`, `Grup: ${g.ad} → ${yeniAd}`);
    g.ad = yeniAd;
  } else {
    const alanId = alan.id || alanIdUret(alan.ad, ai);
    const g = alan.gruplar[gi];
    const eski = g.dersler[di];
    tasimaEkle(aktifDisiplin, `${alanId}__${g.ad}__${eski}`,
               `${alanId}__${g.ad}__${yeniAd}`, `Kazanım: ${eski} → ${yeniAd}`);
    g.dersler[di] = yeniAd;
  }
  degisiklikVar = true;
  uyariCiz(); icerikCiz();
};

window.mufredatEkle = function(tip, ai, gi) {
  const alanlar = calismaKopyasi[aktifDisiplin];
  if (tip === "alan") {
    const d = disiplinler().find(x => x.id === aktifDisiplin);
    alanlar.push({ ad: "Yeni Alan", id: alanIdUret("Yeni Alan", alanlar.length),
                   ikon: d?.ikon || "📚", renk: d?.renk || "#7c3aed", gruplar: [] });
  } else if (tip === "grup") {
    (alanlar[ai].gruplar = alanlar[ai].gruplar || []).push({ ad: "Yeni Grup", dersler: [] });
  } else {
    (alanlar[ai].gruplar[gi].dersler = alanlar[ai].gruplar[gi].dersler || []).push("Yeni Kazanım");
  }
  degisiklikVar = true;
  icerikCiz();
};

window.mufredatSil = function(tip, ai, gi, di) {
  const alanlar = calismaKopyasi[aktifDisiplin];
  const not = "\n\n(Öğrencilerin geçmiş kayıtları silinmez ama bu satır artık görünmez.)";
  if (tip === "alan") {
    if (!confirm(`"${alanlar[ai].ad}" alanı tüm grup ve kazanımlarıyla silinsin mi?${not}`)) return;
    alanlar.splice(ai, 1);
  } else if (tip === "grup") {
    const g = alanlar[ai].gruplar[gi];
    if (!confirm(`"${g.ad}" grubu ${(g.dersler || []).length} kazanımıyla silinsin mi?${not}`)) return;
    alanlar[ai].gruplar.splice(gi, 1);
  } else {
    if (!confirm(`"${alanlar[ai].gruplar[gi].dersler[di]}" kazanımı silinsin mi?${not}`)) return;
    alanlar[ai].gruplar[gi].dersler.splice(di, 1);
  }
  degisiklikVar = true;
  icerikCiz();
};

window.mufredatSirala = function(tip, ai, gi, di, yon) {
  const alanlar = calismaKopyasi[aktifDisiplin];
  let ok = false;
  if (tip === "alan")      ok = diziTasi(alanlar, ai, yon);
  else if (tip === "grup") ok = diziTasi(alanlar[ai].gruplar, gi, yon);
  else                     ok = diziTasi(alanlar[ai].gruplar[gi].dersler, di, yon);
  if (ok) { degisiklikVar = true; icerikCiz(); }
};

window.mufredatJsonDisaAktar = function() {
  const veri = { disiplin: aktifDisiplin, alanlar: calismaKopyasi[aktifDisiplin] || [] };
  const kan = new Blob([JSON.stringify(veri, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(kan);
  a.download = `mufredat-${aktifDisiplin}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

window.mufredatJsonIceAktarAc = function() {
  const gir = document.createElement("input");
  gir.type = "file"; gir.accept = ".json,application/json";
  gir.onchange = () => {
    const dosya = gir.files && gir.files[0];
    if (!dosya) return;
    const oku = new FileReader();
    oku.onload = () => {
      let ham;
      try { ham = JSON.parse(oku.result); }
      catch (e) { bildir("Geçersiz JSON: " + e.message, "error"); return; }
      const alanlar = Array.isArray(ham) ? ham : ham.alanlar;
      if (!Array.isArray(alanlar) || !alanlar.length) {
        bildir('JSON içinde "alanlar" dizisi bulunamadı', "error"); return;
      }
      const temiz = [];
      for (let i = 0; i < alanlar.length; i++) {
        const a = alanlar[i] || {};
        if (!a.ad) { bildir(`${i+1}. alanın "ad" değeri yok`, "error"); return; }
        const gruplar = (a.gruplar || []).map(g => ({
          ad: String(g.ad || "").trim(),
          dersler: (g.dersler || []).map(d => String(d).trim()).filter(Boolean)
        })).filter(g => g.ad && g.dersler.length);
        temiz.push({ id: alanIdUret(a.id || a.ad, i), ad: String(a.ad).trim(),
                     ikon: a.ikon || "📚", renk: a.renk || "#4A7C59", gruplar });
      }
      const ders = temiz.reduce((t,a) => t + a.gruplar.reduce((s,g) => s + g.dersler.length, 0), 0);
      if (!confirm(`${temiz.length} alan · ${ders} kazanım yüklenecek.\n\n` +
                   `"${aktifDisiplin}" müfredatının MEVCUT içeriğinin yerine geçecek. Devam edilsin mi?`)) return;
      calismaKopyasi[aktifDisiplin] = temiz;
      degisiklikVar = true;
      bildir(`✓ ${ders} kazanım okundu — Kaydet'e basmayı unutmayın`);
      icerikCiz();
    };
    oku.readAsText(dosya, "UTF-8");
  };
  gir.click();
};

window.mufredatKaydetVeKapat = async function() {
  const btn = event && event.target;
  if (btn) { btn.disabled = true; btn.textContent = "Kaydediliyor…"; }
  try {
    for (const d of Object.keys(calismaKopyasi)) {
      // Alan id'leri her kayıtta yeniden üretilir (ad değişmişse tutarlı kalsın)
      calismaKopyasi[d].forEach((a, i) => { a.id = a.id || alanIdUret(a.ad, i); });
      await mufredatYaz(d, calismaKopyasi[d]);
    }
    let ozet = "";
    if (bekleyenTasima.length) {
      if (btn) btn.textContent = "Kayıtlar taşınıyor…";
      const s = await kayitlariTasi(bekleyenTasima);
      ozet = ` · ${s.kayit} kayıt ${s.belge} öğrencide taşındı`;
    }
    bildir(`✓ Müfredat kaydedildi${ozet}`);
    degisiklikVar = false; bekleyenTasima = [];
    window.mufredatEditorKapat();
    if (typeof renderGelisimSekmesi === "function" &&
        document.querySelector('[data-modal-tab="gelisim"]')?.classList.contains("active")) {
      renderGelisimSekmesi();
    }
  } catch (e) {
    console.error(e);
    bildir("Kaydedilemedi: " + e.message, "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Kaydet"; }
  }
};

console.log("Müfredat modülü yüklendi.");
