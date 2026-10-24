/* Shared Portal / ZEKY component. No account data or registration writes. */
(function () {
  "use strict";
  const promotionUntil = Date.parse("2026-11-27T00:00:00+03:00");
  const icon = `<svg class="bk-icon" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <circle cx="60" cy="60" r="58" fill="#F9E5A0"/>
    <path d="M51 14c-5 5 5 7 0 12m15-12c-5 5 5 7 0 12" fill="none" stroke="#9A694A" stroke-width="2" stroke-linecap="round"/>
    <path d="M43 31h32c0 13-9 17-8 25 1 7 8 11 7 18-1 11-30 11-31 0-1-7 6-11 7-18 1-8-7-12-7-25Z" fill="#B74327" stroke="#FFF8EA" stroke-width="3"/>
    <rect x="33" y="85" width="57" height="13" rx="4" fill="#B74327"/><rect x="37" y="88" width="17" height="6" rx="2" fill="#FFF8EA"/>
    <rect x="25" y="98" width="73" height="13" rx="4" fill="#2D5E3E"/><rect x="72" y="101" width="21" height="6" rx="2" fill="#FFF8EA"/>
  </svg>`;
  function content(platform, now = Date.now()) {
    const poster = platform === "portal" ? `<a class="bk-hero-poster" href="kitap-kulubu.html" aria-label="Annelerle Kitap Kulübü alanını aç"><img src="assets/kitap-kulubu/annelerle-kitap-kulubu.jpeg" width="1024" height="1536" alt="Annelerle Kitap Kulübü · Bir kitap, birçok duygu, güzel bir buluşma" decoding="async"></a>` : "";
    if (now >= promotionUntil)
      return `<div data-bk-host hidden><article class="bk-card bk-${platform === "portal" ? "portal" : "zeky"}">${poster}<div class="bk-top">${icon}<div><p class="bk-eyebrow">ANNELER İLE · KİTAP & ÇAY</p><h2>Kitap Kulübü</h2><p>Kitaplığımız, sohbetlerimiz ve buluşmalardan anılarımız burada.</p></div></div><button class="bk-button" data-bk-open="library">Kulüp alanını aç ↗</button></article></div>`;
    const surface = platform === "portal" ? "portal" : "zeky";
    return `<div data-bk-host hidden><article class="bk-card bk-${surface}" aria-label="Annelere özel Kitap Kulübü">${poster}
      <div class="bk-top">${icon}<div><p class="bk-eyebrow">ANNELERE ÖZEL · KİTAP & ÇAY</p>
      <h2>Kitap Kulübü</h2><p class="bk-spot">Günlük telaşın içinde kendimizi ve çocuğumuzu gerçekten duyabiliyor muyuz?</p></div></div>
      <div class="bk-book"><span>İKİNCİ BULUŞMAMIZDA OKUYORUZ</span><strong>Ebeveynliği Hissetmek</strong><p>Jennifer Day</p></div>
      <p class="bk-date"><time datetime="2026-11-26T19:00:00+03:00">26 Kasım 2026 Perşembe · 19.00</time></p>
      <p class="bk-leader">Psikolog <strong>Şeyma Baydaroğlu</strong> liderliğinde</p>
      <button type="button" class="bk-button" data-bk-open="${surface}">Kulüp alanını aç <span aria-hidden="true">↗</span></button>
    </article></div>`;
  }
  let viewer = "", collapsed = false;
  const preferenceKey = () => `kitapKulubu:collapsed:${viewer}`;
  function refresh() {
    document.querySelectorAll("[data-bk-host]").forEach(host => {
      const panel = host.querySelector("[data-bk-panel]");
      const restore = host.querySelector("[data-bk-restore]");
      if (panel) panel.hidden = collapsed;
      if (restore) restore.hidden = !collapsed;
    });
  }
  function setViewer(uid) {
    viewer = uid || "";
    collapsed = false;
    try { collapsed = !!viewer && localStorage.getItem(preferenceKey()) === "1"; } catch {}
    refresh();
  }
  function card(platform, now = Date.now()) {
    return content(platform, now)
      .replace('<article ', `<button type="button" class="bk-restore" data-bk-restore aria-label="Kitap Kulübü görselini yeniden göster" ${collapsed ? "" : "hidden"}>${icon}<span>Kitap Kulübü</span></button><section data-bk-panel ${collapsed ? "hidden" : ""}><button type="button" class="bk-dismiss" data-bk-dismiss aria-label="Kitap Kulübü görselini gizle">×</button><article `)
      .replace('</article></div>', '</article></section></div>')
      .replace('<h2>Kitap Kulübü</h2>', '<h2>Kitap Kulübü</h2><p class="bk-tagline">Bir kitap, birçok duygu,<br>güzel bir buluşma.</p>');
  }
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-bk-dismiss], [data-bk-restore]");
    if (toggle) {
      const host = toggle.closest("[data-bk-host]");
      if (!host || host.hidden) return;
      collapsed = toggle.hasAttribute("data-bk-dismiss");
      try { if (viewer) localStorage.setItem(preferenceKey(), collapsed ? "1" : "0"); } catch {}
      refresh();
      host.querySelector(collapsed ? "[data-bk-restore]" : "[data-bk-dismiss]")?.focus();
      return;
    }

    if (event.target.closest("[data-bk-open]"))
      location.href = "kitap-kulubu.html";
  });
  function mount() {
    document.querySelectorAll("[data-bk-mount]").forEach((host) => {
      host.innerHTML = card(host.dataset.bkMount);
    });
  }
  window.KitapKulubu = Object.freeze({ card, setViewer });
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
