// ══════════════════════════════════════════════════════════════
// PORTAL · FİNANSAL GRAFİKLER MODÜLÜ (Chart.js)
// Faz 9 · index.html'den ayrıştırıldı (2026-08-07)
// Kâr/zarar trendi, tahsilat vs hedef, gelir/gider donut,
// yıl sonu projeksiyonu, sınıf dağılımı, ödeme yöntemleri.
// Gelir/gider verileri köprüden CANLI okunur (B.gelirler/B.giderler).
// ══════════════════════════════════════════════════════════════

const B = window.BCK;
const { db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
        escapeHtml, getOgrenciDurum, isoTarih,
        haftaBaslangic, haftaKodu, haftaEtiketi,
        AY_ISIMLERI, YEMEK_GUNLER, YEMEK_OGUNLER } = B;

// ============ FİNANSAL GRAFİKLER (Chart.js) ============
let finansKarZararChartInst = null;
let finansTahsilatChartInst = null;
let finansGelirDonutInst = null;
let finansGiderDonutInst = null;

// 1. YILLIK KAR/ZARAR TRENDİ
function cizKarZararTrendi() {
  const canvas = document.getElementById("finansKarZararChart");
  if (!canvas || typeof Chart === "undefined") return;

  const bugun = new Date();
  const donemBasYil = bugun.getMonth() >= 8 ? bugun.getFullYear() : bugun.getFullYear() - 1;
  const aylar = [];
  for (let i = 0; i < 12; i++) {
    const ay = 9 + i;
    const hedefYil = ay > 12 ? donemBasYil + 1 : donemBasYil;
    const hedefAy = ay > 12 ? ay - 12 : ay;
    aylar.push(`${hedefYil}-${String(hedefAy).padStart(2, "0")}`);
  }

  const aylikGelir = aylar.map(ayKod => {
    return B.gelirler()
      .filter(g => (g.odemeTarihi || "").startsWith(ayKod))
      .reduce((s, g) => s + (parseFloat(g.odenen) || 0), 0);
  });
  const aylikGider = aylar.map(ayKod => {
    return B.giderler()
      .filter(g => (g.tarih || "").startsWith(ayKod))
      .reduce((s, g) => s + (parseFloat(g.tutar) || 0), 0);
  });
  const netKar = aylar.map((_, i) => aylikGelir[i] - aylikGider[i]);
  const etiketler = aylar.map(ayKod => {
    const [y, a] = ayKod.split("-");
    return `${AY_ISIMLERI[parseInt(a) - 1].substring(0, 3)} ${y.substring(2)}`;
  });

  if (finansKarZararChartInst) { finansKarZararChartInst.destroy(); }

  finansKarZararChartInst = new Chart(canvas, {
    type: "line",
    data: {
      labels: etiketler,
      datasets: [
        { label: "Gelir", data: aylikGelir, borderColor: "#2d6a4f", backgroundColor: "rgba(45,106,79,0.1)", borderWidth: 2, tension: 0.3, fill: true, pointRadius: 3 },
        { label: "Gider", data: aylikGider, borderColor: "#dc2626", backgroundColor: "rgba(220,38,38,0.1)", borderWidth: 2, tension: 0.3, fill: true, pointRadius: 3 },
        { label: "Net Kar/Zarar", data: netKar, borderColor: "#facc15", backgroundColor: "transparent", borderWidth: 2.5, borderDash: [5, 3], tension: 0.3, pointRadius: 4, pointBackgroundColor: netKar.map(v => v >= 0 ? "#16a34a" : "#dc2626") }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ₺${ctx.parsed.y.toLocaleString("tr-TR")}` } }
      },
      scales: {
        y: { ticks: { font: { size: 10 }, callback: (v) => "₺" + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + "K" : v) } },
        x: { ticks: { font: { size: 10 } } }
      }
    }
  });
}

// 2. AYLIK TAHSİLAT vs HEDEF
function cizAylikTahsilatVsHedef() {
  const canvas = document.getElementById("finansTahsilatChart");
  if (!canvas || typeof Chart === "undefined") return;

  const bugun = new Date();
  const donemBasYil = bugun.getMonth() >= 8 ? bugun.getFullYear() : bugun.getFullYear() - 1;
  const aylar = [];
  for (let i = 0; i < 12; i++) {
    const ay = 9 + i;
    const hedefYil = ay > 12 ? donemBasYil + 1 : donemBasYil;
    const hedefAy = ay > 12 ? ay - 12 : ay;
    aylar.push(`${hedefYil}-${String(hedefAy).padStart(2, "0")}`);
  }

  const hedefAylik = aylar.map(ayKod => {
    let toplam = 0;
    const ayNum = parseInt(ayKod.split("-")[1], 10);
    for (const o of B.ogrenciler()) {
      const ayar = B.ayarlar()[o.id];
      if (!ayar) continue;
      if (getOgrenciDurum(o, ayar) !== "aktif") continue;
      const a = ayar.aidatAyarlari || {};
      const iDonemAylik = a.iDonemAylik || a.aylikAidat || 0;
      const iiDonemAylik = a.iiDonemAylik || a.aylikAidat || 0;
      toplam += (ayNum >= 9 || ayNum <= 1) ? iDonemAylik : iiDonemAylik;
    }
    return toplam;
  });

  const gercekAylik = aylar.map(ayKod => {
    return B.gelirler()
      .filter(g => g.tur === "aylik" && g.ayKod === ayKod)
      .reduce((s, g) => s + (parseFloat(g.odenen) || 0), 0);
  });

  const etiketler = aylar.map(ayKod => AY_ISIMLERI[parseInt(ayKod.split("-")[1]) - 1].substring(0, 3));

  if (finansTahsilatChartInst) { finansTahsilatChartInst.destroy(); }

  finansTahsilatChartInst = new Chart(canvas, {
    type: "bar",
    data: {
      labels: etiketler,
      datasets: [
        { label: "Hedef", data: hedefAylik, backgroundColor: "rgba(250,204,21,0.6)", borderColor: "#facc15", borderWidth: 1, borderRadius: 4 },
        { label: "Gerçekleşen", data: gercekAylik, backgroundColor: "rgba(45,106,79,0.85)", borderColor: "#2d6a4f", borderWidth: 1, borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ₺${ctx.parsed.y.toLocaleString("tr-TR")}` } }
      },
      scales: {
        y: { ticks: { font: { size: 10 }, callback: (v) => "₺" + (v >= 1000 ? (v / 1000).toFixed(0) + "K" : v) } },
        x: { ticks: { font: { size: 10 } } }
      }
    }
  });
}

// 3. GELİR HALKA (DOUGHNUT)
function cizGelirDonut(kategoriler, toplam) {
  const canvas = document.getElementById("finansGelirDonutChart");
  if (!canvas || typeof Chart === "undefined") return;

  const data = [
    { label: "🎫 Ön Ödeme", value: kategoriler.onOdeme || 0, color: "#f59e0b" },
    { label: "🏦 Aylık Aidat", value: kategoriler.aylik || 0, color: "#2d6a4f" },
    { label: "📦 Diğer", value: kategoriler.diger || 0, color: "#8b5cf6" }
  ].filter(d => d.value > 0);

  if (finansGelirDonutInst) { finansGelirDonutInst.destroy(); }

  if (data.length === 0) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "center";
    ctx.fillText("Veri yok", canvas.width / 2, canvas.height / 2);
    return;
  }

  finansGelirDonutInst = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: data.map(d => d.label),
      datasets: [{ data: data.map(d => d.value), backgroundColor: data.map(d => d.color), borderWidth: 2, borderColor: "#ffffff" }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "65%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 }, padding: 8 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = toplam > 0 ? Math.round((ctx.parsed / toplam) * 100) : 0;
              return `${ctx.label}: ₺${ctx.parsed.toLocaleString("tr-TR")} (%${pct})`;
            }
          }
        }
      }
    }
  });
}

// 4. GİDER HALKA (DOUGHNUT)
function cizGiderDonut(gruplar, toplam) {
  const canvas = document.getElementById("finansGiderDonutChart");
  if (!canvas || typeof Chart === "undefined") return;

  const data = [
    { label: "👥 Personel", value: gruplar.personel || 0, color: "#2d6a4f" },
    { label: "🏠 Sabit", value: gruplar.sabit || 0, color: "#f59e0b" },
    { label: "🍽️ İşletme", value: gruplar.isletme || 0, color: "#3b82f6" },
    { label: "📝 Diğer", value: gruplar.diger || 0, color: "#8b5cf6" }
  ].filter(d => d.value > 0);

  if (finansGiderDonutInst) { finansGiderDonutInst.destroy(); }

  if (data.length === 0) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "center";
    ctx.fillText("Gider ekleyin", canvas.width / 2, canvas.height / 2);
    return;
  }

  finansGiderDonutInst = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: data.map(d => d.label),
      datasets: [{ data: data.map(d => d.value), backgroundColor: data.map(d => d.color), borderWidth: 2, borderColor: "#ffffff" }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "65%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 }, padding: 8 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = toplam > 0 ? Math.round((ctx.parsed / toplam) * 100) : 0;
              return `${ctx.label}: ₺${ctx.parsed.toLocaleString("tr-TR")} (%${pct})`;
            }
          }
        }
      }
    }
  });
}

// 5. YIL SONU PROJEKSİYON
function renderYilSonuProjeksiyon(toplamGelir, toplamGider, tahsilatOrani) {
  const el = document.getElementById("finansProjeksiyon");
  if (!el) return;

  let yillikBeklenenGelir = 0;
  for (const o of B.ogrenciler()) {
    const ayar = B.ayarlar()[o.id];
    if (!ayar) continue;
    if (getOgrenciDurum(o, ayar) !== "aktif") continue;
    const a = ayar.aidatAyarlari || {};
    const yillik = a.yillikToplam || ((a.aylikAidat || 0) * 10);
    yillikBeklenenGelir += yillik;
  }

  const tahminiYillikGelir = Math.round(yillikBeklenenGelir * ((tahsilatOrani || 100) / 100));

  const tekrarlayanAylikGider = B.giderler().filter(g => g.tekrarlayan).reduce((s, g) => s + (parseFloat(g.tutar) || 0), 0);
  const tekSeferlikGider = B.giderler().filter(g => !g.tekrarlayan).reduce((s, g) => s + (parseFloat(g.tutar) || 0), 0);
  const tahminiYillikGider = (tekrarlayanAylikGider * 12) + tekSeferlikGider;

  const tahminiKar = tahminiYillikGelir - tahminiYillikGider;
  const tahminiKarOrani = tahminiYillikGelir > 0 ? Math.round((tahminiKar / tahminiYillikGelir) * 100) : 0;

  el.innerHTML = `
    <div style="display:flex; align-items:start; gap:10px; margin-bottom:12px;">
      <div style="font-size:24px;">🔮</div>
      <div>
        <div style="font-family:var(--font-display); font-size:16px; font-weight:700; color:#78350f;">Yıl Sonu Projeksiyon</div>
        <div style="font-size:11px; color:#92400e; margin-top:2px;">Mevcut trendle tahmin</div>
      </div>
    </div>
    <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
      <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(146,64,14,0.15);">
        <span style="color:#78350f;">Yıllık Beklenen Gelir</span>
        <strong style="color:#422006;">₺${yillikBeklenenGelir.toLocaleString("tr-TR")}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(146,64,14,0.15);">
        <span style="color:#78350f;">Tahmini Tahsilat (%${tahsilatOrani})</span>
        <strong style="color:#14532d;">₺${tahminiYillikGelir.toLocaleString("tr-TR")}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(146,64,14,0.15);">
        <span style="color:#78350f;">Tahmini Yıllık Gider</span>
        <strong style="color:#7f1d1d;">₺${tahminiYillikGider.toLocaleString("tr-TR")}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:10px 0 4px; margin-top:4px; border-top:2px solid rgba(146,64,14,0.2);">
        <span style="color:#78350f; font-weight:600;">Tahmini Yıl Sonu ${tahminiKar >= 0 ? 'Kar' : 'Zarar'}</span>
        <strong style="color:${tahminiKar >= 0 ? '#14532d' : '#7f1d1d'}; font-size:15px;">${tahminiKar >= 0 ? '+' : ''}₺${tahminiKar.toLocaleString("tr-TR")}</strong>
      </div>
      <div style="text-align:center; font-size:11px; color:#92400e; margin-top:6px;">
        %${Math.abs(tahminiKarOrani)} ${tahminiKar >= 0 ? 'kar marjı' : 'zarar'}
      </div>
    </div>
  `;
}

// 6. AYLIK TAHSİLAT TRENDİ (Ödenen vs Beklenen - Fotoğraftaki stil)
let finansTahsilatTrendInst = null;
function cizTahsilatTrendi() {
  const canvas = document.getElementById("finansTahsilatTrendChart");
  if (!canvas || typeof Chart === "undefined") return;

  const bugun = new Date();
  const donemBasYil = bugun.getMonth() >= 8 ? bugun.getFullYear() : bugun.getFullYear() - 1;
  const aylar = [];
  for (let i = 0; i < 12; i++) {
    const ay = 9 + i;
    const hedefYil = ay > 12 ? donemBasYil + 1 : donemBasYil;
    const hedefAy = ay > 12 ? ay - 12 : ay;
    aylar.push(`${hedefYil}-${String(hedefAy).padStart(2, "0")}`);
  }

  // Beklenen: Aktif öğrencilerin o ayki aidat toplamı (KÜMÜLATİF yıllık)
  let kumulatifBeklenen = 0;
  const beklenenSeri = [];
  for (const ayKod of aylar) {
    const ayNum = parseInt(ayKod.split("-")[1], 10);
    for (const o of B.ogrenciler()) {
      const ayar = B.ayarlar()[o.id];
      if (!ayar) continue;
      if (getOgrenciDurum(o, ayar) !== "aktif") continue;
      const a = ayar.aidatAyarlari || {};
      const iDonemAylik = a.iDonemAylik || a.aylikAidat || 0;
      const iiDonemAylik = a.iiDonemAylik || a.aylikAidat || 0;
      kumulatifBeklenen += (ayNum >= 9 || ayNum <= 1) ? iDonemAylik : iiDonemAylik;
    }
    beklenenSeri.push(kumulatifBeklenen);
  }

  // Ödenen: aylık aidat kaleminde o ay ödenen (KÜMÜLATİF)
  let kumulatifOdenen = 0;
  const odenenSeri = aylar.map(ayKod => {
    const ayOdenen = B.gelirler()
      .filter(g => g.tur === "aylik" && g.ayKod === ayKod)
      .reduce((s, g) => s + (parseFloat(g.odenen) || 0), 0);
    kumulatifOdenen += ayOdenen;
    return kumulatifOdenen;
  });

  const etiketler = aylar.map(ayKod => {
    const [y, a] = ayKod.split("-");
    return `${AY_ISIMLERI[parseInt(a) - 1].substring(0, 3)} ${y.substring(2)}`;
  });

  // Trend yüzdesi (son/ilk gerçek ay)
  const sonOdenen = odenenSeri[odenenSeri.length - 1];
  const sonBeklenen = beklenenSeri[beklenenSeri.length - 1];
  const trendYuzde = sonBeklenen > 0 ? Math.round((sonOdenen / sonBeklenen) * 100) : 0;
  const trendEl = document.getElementById("tahsilatTrendYuzde");
  if (trendEl) trendEl.textContent = `%${trendYuzde}`;

  if (finansTahsilatTrendInst) finansTahsilatTrendInst.destroy();

  finansTahsilatTrendInst = new Chart(canvas, {
    type: "line",
    data: {
      labels: etiketler,
      datasets: [
        {
          label: "Ödenen",
          data: odenenSeri,
          borderColor: "#2d6a4f",
          backgroundColor: "rgba(45,106,79,0.15)",
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: "#2d6a4f",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2
        },
        {
          label: "Beklenen",
          data: beklenenSeri,
          borderColor: "#facc15",
          backgroundColor: "transparent",
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: "#facc15",
          pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, font: { size: 11 }, usePointStyle: true, pointStyle: "circle" }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ₺${ctx.parsed.y.toLocaleString("tr-TR")}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 10 },
            callback: (v) => "₺" + (v >= 1000 ? (v / 1000).toFixed(0) + "K" : v)
          }
        },
        x: { ticks: { font: { size: 10 } } }
      }
    }
  });
}

// 7. SINIF DAĞILIMI DONUT (ortada sayı ile)
let finansSinifDonutInst = null;
function cizSinifDonut() {
  const canvas = document.getElementById("finansSinifDonutChart");
  if (!canvas || typeof Chart === "undefined") return;

  const aktifOgrenciler = B.ogrenciler().filter(o => getOgrenciDurum(o, B.ayarlar()[o.id]) === "aktif");
  const m2 = aktifOgrenciler.filter(o => {
    const ayar = B.ayarlar()[o.id] || {};
    const sinif = ((ayar.kayit && ayar.kayit.sinif) || o.sinif || "").toLowerCase();
    return sinif.includes("2");
  }).length;
  const m3 = aktifOgrenciler.length - m2;

  // Ortadaki sayıyı güncelle
  const sayiEl = document.getElementById("sinifDonutSayi");
  if (sayiEl) sayiEl.textContent = aktifOgrenciler.length;

  if (finansSinifDonutInst) finansSinifDonutInst.destroy();

  if (m2 + m3 === 0) {
    // Veri yok
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  finansSinifDonutInst = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: [`M. 2 (${m2})`, `M. 3 (${m3})`],
      datasets: [{
        data: [m2, m3],
        backgroundColor: ["#2d6a4f", "#facc15"],
        borderWidth: 3,
        borderColor: "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 10, font: { size: 11 }, padding: 10,
            usePointStyle: true, pointStyle: "circle"
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const toplam = m2 + m3;
              const pct = toplam > 0 ? Math.round((ctx.parsed / toplam) * 100) : 0;
              return `${ctx.label}: %${pct}`;
            }
          }
        }
      }
    }
  });
}

// 8. ÖDEME YÖNTEMLERİ (yatay çubuklar)
function renderOdemeYontemleri() {
  const el = document.getElementById("odemeYontemleriList");
  if (!el) return;

  // Gelirlerden ödeme yöntemlerini topla
  const yontemler = {
    "Havale/EFT": 0,
    "Kredi Kartı": 0,
    "Nakit": 0,
    "Çek/Senet": 0
  };
  let toplam = 0;
  for (const g of B.gelirler()) {
    const yontem = g.odemeYontemi || "Havale/EFT";
    const mapped = yontemler.hasOwnProperty(yontem) ? yontem : "Havale/EFT";
    yontemler[mapped] += parseFloat(g.odenen) || 0;
    toplam += parseFloat(g.odenen) || 0;
  }

  const renkler = {
    "Havale/EFT": "#2d6a4f",
    "Kredi Kartı": "#facc15",
    "Nakit": "#3b82f6",
    "Çek/Senet": "#8b5cf6"
  };
  const ikonlar = {
    "Havale/EFT": "🏦",
    "Kredi Kartı": "💳",
    "Nakit": "💵",
    "Çek/Senet": "📝"
  };

  let html = "";
  for (const yontem in yontemler) {
    const tutar = yontemler[yontem];
    const yuzde = toplam > 0 ? Math.round((tutar / toplam) * 100) : 0;
    const barYuzde = toplam > 0 ? (tutar / toplam) * 100 : 0;
    html += `
      <div style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div style="font-size:13px; font-weight:500; color:var(--gray-800);">${ikonlar[yontem]} ${yontem}</div>
          <div style="font-size:13px; font-weight:700; color:var(--gray-800); font-family:var(--font-display);">₺${tutar.toLocaleString("tr-TR")}</div>
        </div>
        <div style="background:var(--gray-100); height:6px; border-radius:4px; overflow:hidden;">
          <div style="background:${renkler[yontem]}; height:100%; width:${barYuzde}%; border-radius:4px; transition:width 0.5s;"></div>
        </div>
        <div style="text-align:right; font-size:10px; color:var(--gray-500); margin-top:2px;">%${yuzde}</div>
      </div>
    `;
  }
  el.innerHTML = html;
}

// ── Çekirdeğin erişimi için ──
window.cizKarZararTrendi        = cizKarZararTrendi;
window.cizAylikTahsilatVsHedef  = cizAylikTahsilatVsHedef;
window.cizGelirDonut            = cizGelirDonut;
window.cizGiderDonut            = cizGiderDonut;
window.renderYilSonuProjeksiyon = renderYilSonuProjeksiyon;
window.cizTahsilatTrendi        = cizTahsilatTrendi;
window.cizSinifDonut            = cizSinifDonut;
window.renderOdemeYontemleri    = renderOdemeYontemleri;
console.log("Finansal Grafikler modülü yüklendi.");
