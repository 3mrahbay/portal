// ══════════════════════════════════════════════════════════════
// PORTAL · SINIF ADI DENETİM VE ONARIM ARACI
// --------------------------------------------------------------
// 2026-08-08
//
// NEDEN GEREKLİ
// Öğrencinin sınıfı İKİ yerde tutuluyor:
//   1) ogrenciler/{id}.sinif                       ← Firestore kuralları buna bakar
//   2) ogrenciler/{id}/donemler/{donem}.kayit.sinif ← ekranlar buna bakar
// Bu ikisi zamanla birbirinden ayrışmış, ayrıca yazım varyantları
// oluşmuş ("kardelenler" / "Kardelenler Sınıfı" / "Montessori 2").
//
// Firestore'un ogretmenOgrencisi() kuralı BİREBİR karşılaştırma
// yapar — normalizasyon yoktur. Yazımı farklı olan öğrenci
// öğretmene hiç görünmez, verisi okunamaz, kaydedilemez.
//
// Bu araç:
//   • Tüm öğrencileri tarar, iki kaynağı ve resmi adı karşılaştırır
//   • Ne değişeceğini ÖNCE gösterir (tek tuşla yazmaz)
//   • Onaydan sonra her iki yeri de resmi ada hizalar
//   • Personel sınıf atamalarını da denetler
//
// YALNIZCA yönetim rolleri kullanabilir (Firestore da öyle izin verir).
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { db, doc, getDoc, setDoc, updateDoc, getDocs, collection,
        escapeHtml, sinifAdiResmiEsle } = B;

let onarimBulgular = null;   // son tarama sonucu

// ── Sınıf adlarını karşılaştırmak için normalize et ──
function sadelestir(x) {
  return String(x || "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/\s+/g, "")
    .trim();
}

// ══════════════════════════════════════════════════════════════
// 1) TARAMA — hiçbir şey yazmaz, sadece durumu çıkarır
// ══════════════════════════════════════════════════════════════
async function sinifAdlariniTara() {
  const ogrenciler = B.ogrenciler() || [];
  const ayarlar = B.ayarlar() || {};

  // Resmi sınıf listesi: siniflar koleksiyonu (tek kaynak)
  let resmiAdlar = [];
  try {
    const snap = await getDocs(collection(db, "siniflar"));
    snap.forEach(d => {
      const v = d.data() || {};
      if ((v.durum || "aktif") === "aktif" && v.ad) resmiAdlar.push(v.ad);
    });
  } catch (e) {
    console.warn("[Sınıf Onarım] siniflar okunamadı:", e?.message);
  }

  const resmiHarita = {};                       // sade → resmi
  resmiAdlar.forEach(ad => { resmiHarita[sadelestir(ad)] = ad; });

  const duzeltilecek = [];   // hedefi bulunanlar
  const belirsiz = [];       // hangi sınıfa ait olduğu anlaşılamayanlar
  const temiz = [];          // sorunu olmayanlar

  for (const o of ogrenciler) {
    const kok = o.sinif || "";
    const donem = (ayarlar[o.id] && ayarlar[o.id].kayit && ayarlar[o.id].kayit.sinif) || "";

    // Hedef resmi ad: önce dönem kaydı, yoksa kök belge
    const kaynak = donem || kok;
    if (!kaynak) { belirsiz.push({ o, kok, donem, sebep: "Sınıf hiç atanmamış" }); continue; }

    // Eşleşme: doğrudan resmi listede mi?
    let hedef = resmiHarita[sadelestir(kaynak)];

    // Değilse portalın eşleme tablosunu dene ("Kardelenler" → "Kardelenler Sınıfı")
    if (!hedef && typeof sinifAdiResmiEsle === "function") {
      const esle = sinifAdiResmiEsle(kaynak);
      if (esle && resmiHarita[sadelestir(esle)]) hedef = resmiHarita[sadelestir(esle)];
    }

    if (!hedef) {
      belirsiz.push({ o, kok, donem, sebep: `"${kaynak}" hiçbir aktif sınıfla eşleşmiyor` });
      continue;
    }

    const kokBozuk = kok !== hedef;
    const donemBozuk = donem !== hedef && donem !== "";
    const donemBos = donem === "";

    if (kokBozuk || donemBozuk || donemBos) {
      duzeltilecek.push({ o, kok, donem, hedef, kokBozuk, donemBozuk: donemBozuk || donemBos });
    } else {
      temiz.push(o);
    }
  }

  // Personel sınıf atamaları da resmi adlarla aynı mı?
  const personelSorunlu = [];
  try {
    const pSnap = await getDocs(collection(db, "personeller"));
    pSnap.forEach(d => {
      const v = d.data() || {};
      if ((v.durum || "aktif") !== "aktif") return;
      const siniflar = v.siniflar || [];
      const hatali = siniflar.filter(sn => !resmiAdlar.includes(sn));
      if (hatali.length) {
        personelSorunlu.push({
          email: d.id, ad: v.adSoyad || d.id, rol: v.rol || "",
          hatali, tumu: siniflar,
          onerilen: siniflar.map(sn => resmiHarita[sadelestir(sn)] || sn)
        });
      }
    });
  } catch (e) {
    console.warn("[Sınıf Onarım] personeller okunamadı:", e?.message);
  }

  onarimBulgular = { resmiAdlar, duzeltilecek, belirsiz, temiz, personelSorunlu };
  return onarimBulgular;
}

// ══════════════════════════════════════════════════════════════
// 2) PANELİ ÇİZ
// ══════════════════════════════════════════════════════════════
function panelCiz(b) {
  const el = document.getElementById("sinifOnarimPanel");
  if (!el) return;
  el.style.display = "block";

  const kutu = (renk, baslik, icerik) => `
    <div style="border:1px solid ${renk}33; background:${renk}0D; border-radius:12px; padding:13px 15px; margin-bottom:10px;">
      <div style="font-weight:700; font-size:13.5px; color:${renk}; margin-bottom:8px;">${baslik}</div>
      ${icerik}
    </div>`;

  let html = `
    <div style="border:1px solid var(--c-line,#E2E8F0); border-radius:14px; padding:16px; background:#fff;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px;">
        <div>
          <div style="font-weight:700; font-size:15px;">Sınıf Adı Denetimi</div>
          <div style="font-size:12px; color:var(--c-muted,#64748B); margin-top:2px;">
            Resmi sınıflar: ${b.resmiAdlar.map(a => escapeHtml(a)).join(" · ") || "(tanımlı sınıf yok)"}
          </div>
        </div>
        <button onclick="sinifAdiOnarimKapat()" style="border:none; background:none; cursor:pointer; font-size:20px; color:#94A3B8;">×</button>
      </div>

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
        <span style="background:#DCFCE7; color:#166534; padding:4px 11px; border-radius:100px; font-size:12px; font-weight:700;">${b.temiz.length} kayıt düzgün</span>
        <span style="background:#FEF3C7; color:#92400E; padding:4px 11px; border-radius:100px; font-size:12px; font-weight:700;">${b.duzeltilecek.length} kayıt düzeltilecek</span>
        ${b.belirsiz.length ? `<span style="background:#FEE2E2; color:#991B1B; padding:4px 11px; border-radius:100px; font-size:12px; font-weight:700;">${b.belirsiz.length} kayıt elle bakılmalı</span>` : ""}
        ${b.personelSorunlu.length ? `<span style="background:#FEE2E2; color:#991B1B; padding:4px 11px; border-radius:100px; font-size:12px; font-weight:700;">${b.personelSorunlu.length} personel ataması hatalı</span>` : ""}
      </div>`;

  // ── Düzeltilecekler ──
  if (b.duzeltilecek.length) {
    const satirlar = b.duzeltilecek.slice(0, 60).map(d => `
      <tr>
        <td style="padding:5px 8px; border-bottom:1px solid #F1F5F9;">${escapeHtml(d.o.ogrenciAdSoyad || d.o.id)}</td>
        <td style="padding:5px 8px; border-bottom:1px solid #F1F5F9; color:${d.kokBozuk ? "#B45309" : "#64748B"};">${escapeHtml(d.kok || "(boş)")}</td>
        <td style="padding:5px 8px; border-bottom:1px solid #F1F5F9; color:${d.donemBozuk ? "#B45309" : "#64748B"};">${escapeHtml(d.donem || "(boş)")}</td>
        <td style="padding:5px 8px; border-bottom:1px solid #F1F5F9; font-weight:700; color:#166534;">${escapeHtml(d.hedef)}</td>
      </tr>`).join("");

    html += kutu("#B45309", `Düzeltilecek kayıtlar (${b.duzeltilecek.length})`, `
      <div style="max-height:280px; overflow:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:12.5px;">
          <thead><tr style="text-align:left; color:#64748B; font-size:11.5px;">
            <th style="padding:4px 8px;">Öğrenci</th>
            <th style="padding:4px 8px;">Kök belge</th>
            <th style="padding:4px 8px;">Dönem kaydı</th>
            <th style="padding:4px 8px;">→ Olacak</th>
          </tr></thead>
          <tbody>${satirlar}</tbody>
        </table>
        ${b.duzeltilecek.length > 60 ? `<div style="padding:6px 8px; font-size:12px; color:#64748B;">…ve ${b.duzeltilecek.length - 60} kayıt daha</div>` : ""}
      </div>
      <button onclick="sinifAdiOnarimUygula()" id="sinifOnarimUygulaBtn"
        style="margin-top:11px; padding:9px 16px; border:none; background:#B45309; color:#fff; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:700;">
        ${b.duzeltilecek.length} kaydı düzelt
      </button>
      <div style="font-size:11.5px; color:#78716C; margin-top:7px;">
        Hem kök belge hem dönem kaydı resmi ada hizalanır. Başka hiçbir alana dokunulmaz.
      </div>`);
  } else {
    html += kutu("#166534", "Öğrenci kayıtları temiz", `
      <div style="font-size:12.5px;">Tüm öğrencilerin sınıf adları resmi adlarla birebir aynı.</div>`);
  }

  // ── Belirsizler ──
  if (b.belirsiz.length) {
    html += kutu("#991B1B", `Elle bakılması gerekenler (${b.belirsiz.length})`, `
      <div style="font-size:12.5px; margin-bottom:6px;">Bu kayıtlar otomatik eşleştirilemedi; öğrenci kartından sınıfını seç.</div>
      <ul style="margin:0; padding-left:18px; font-size:12.5px; line-height:1.7;">
        ${b.belirsiz.slice(0, 20).map(x => `<li><strong>${escapeHtml(x.o.ogrenciAdSoyad || x.o.id)}</strong> — ${escapeHtml(x.sebep)}</li>`).join("")}
      </ul>`);
  }

  // ── Personel atamaları ──
  if (b.personelSorunlu.length) {
    html += kutu("#991B1B", `Personel sınıf atamaları (${b.personelSorunlu.length})`, `
      <div style="font-size:12.5px; margin-bottom:6px;">Bu personellere atanan sınıf adları resmi listeyle eşleşmiyor:</div>
      <ul style="margin:0 0 10px; padding-left:18px; font-size:12.5px; line-height:1.7;">
        ${b.personelSorunlu.map(p => `<li><strong>${escapeHtml(p.ad)}</strong> (${escapeHtml(p.rol)}) — ${p.hatali.map(h => escapeHtml(h)).join(", ")} → ${p.onerilen.map(h => escapeHtml(h)).join(", ")}</li>`).join("")}
      </ul>
      <button onclick="sinifAdiOnarimPersonel()" id="sinifOnarimPersonelBtn"
        style="padding:9px 16px; border:none; background:#991B1B; color:#fff; border-radius:9px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:700;">
        Personel atamalarını düzelt
      </button>`);
  }

  html += `</div>`;
  el.innerHTML = html;
  if (window.lucideYenile) setTimeout(window.lucideYenile, 40);
}

// ══════════════════════════════════════════════════════════════
// 3) UYGULA — öğrenci kayıtları
// ══════════════════════════════════════════════════════════════
window.sinifAdiOnarimUygula = async function() {
  if (!onarimBulgular || !onarimBulgular.duzeltilecek.length) return;
  const adet = onarimBulgular.duzeltilecek.length;
  if (!confirm(`${adet} öğrencinin sınıf adı resmi adla değiştirilecek.\n\nHem kök belge hem dönem kaydı güncellenir. Devam edilsin mi?`)) return;

  const btn = document.getElementById("sinifOnarimUygulaBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Düzeltiliyor…"; }

  const donem = B.donem();
  let basarili = 0, hatali = 0;
  const hatalar = [];

  for (const d of onarimBulgular.duzeltilecek) {
    try {
      if (d.kokBozuk) {
        await updateDoc(doc(db, "ogrenciler", d.o.id), { sinif: d.hedef });
      }
      if (d.donemBozuk) {
        const ref = doc(db, "ogrenciler", d.o.id, "donemler", donem);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const mevcut = snap.data().kayit || {};
          await setDoc(ref, { kayit: { ...mevcut, sinif: d.hedef } }, { merge: true });
        }
      }
      basarili++;
      if (btn) btn.textContent = `Düzeltiliyor… ${basarili}/${adet}`;
    } catch (e) {
      hatali++;
      hatalar.push(`${d.o.ogrenciAdSoyad || d.o.id}: ${e?.message}`);
    }
  }

  console.info(`[Sınıf Onarım] ${basarili} kayıt düzeltildi, ${hatali} hata.`);
  if (hatalar.length) console.warn("[Sınıf Onarım] Hatalar:", hatalar);

  if (typeof showToast === "function") {
    showToast(hatali
      ? `${basarili} kayıt düzeltildi, ${hatali} hata (konsola bak)`
      : `✓ ${basarili} kaydın sınıf adı düzeltildi`, hatali ? "error" : undefined);
  }

  // Verileri tazele ve yeniden tara
  try {
    if (B.ogrencileriYenile) await B.ogrencileriYenile();
    if (B.ayarlariYenile) await B.ayarlariYenile();
  } catch (e) { console.warn("[Sınıf Onarım] tazeleme:", e?.message); }
  panelCiz(await sinifAdlariniTara());
};

// ══════════════════════════════════════════════════════════════
// 4) UYGULA — personel atamaları
// ══════════════════════════════════════════════════════════════
window.sinifAdiOnarimPersonel = async function() {
  if (!onarimBulgular || !onarimBulgular.personelSorunlu.length) return;
  const liste = onarimBulgular.personelSorunlu;
  if (!confirm(`${liste.length} personelin sınıf ataması resmi adlarla güncellenecek. Devam edilsin mi?`)) return;

  const btn = document.getElementById("sinifOnarimPersonelBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Düzeltiliyor…"; }

  let ok = 0, hata = 0;
  for (const p of liste) {
    try {
      await updateDoc(doc(db, "personeller", p.email), { siniflar: p.onerilen });
      ok++;
    } catch (e) {
      hata++;
      console.warn(`[Sınıf Onarım] ${p.email}:`, e?.message);
    }
  }
  if (typeof showToast === "function") {
    showToast(hata ? `${ok} personel düzeltildi, ${hata} hata` : `✓ ${ok} personel ataması düzeltildi`, hata ? "error" : undefined);
  }
  panelCiz(await sinifAdlariniTara());
};

// ══════════════════════════════════════════════════════════════
// 5) AÇ / KAPAT
// ══════════════════════════════════════════════════════════════
window.sinifAdiOnarimAc = async function() {
  const el = document.getElementById("sinifOnarimPanel");
  if (!el) return;
  el.style.display = "block";
  el.innerHTML = `<div style="border:1px solid var(--c-line,#E2E8F0); border-radius:14px; padding:24px; background:#fff; text-align:center; color:var(--c-muted,#64748B); font-size:13px;">Kayıtlar taranıyor…</div>`;
  try {
    panelCiz(await sinifAdlariniTara());
  } catch (e) {
    el.innerHTML = `<div style="border:1px solid #FCA5A5; border-radius:14px; padding:18px; background:#FEF2F2; color:#991B1B; font-size:13px;">Tarama başarısız: ${escapeHtml(e?.message || "bilinmeyen hata")}</div>`;
  }
};

window.sinifAdiOnarimKapat = function() {
  const el = document.getElementById("sinifOnarimPanel");
  if (el) { el.style.display = "none"; el.innerHTML = ""; }
};

console.log("Sınıf Adı Onarım aracı yüklendi.");
