// ZEKY Portal · Eğitim gözlemi popup iyileştirmesi
// Çekirdek popup document.body altında açıldığı için .cicek-app kapsamındaki
// form stillerini alamıyordu. Bu katman yalnız gözlem popup'ını hedefler.

const STIL_ID = 'zeky-gozlem-modal-modern-stil';
const ASAMALAR = {
  S: { ikon: '🌱', ad: 'Sunuldu', aciklama: 'Çalışma ilk kez tanıtıldı.' },
  T: { ikon: '↻', ad: 'Tekrar Ediyor', aciklama: 'Pekiştirmek için çalışıyor.' },
  U: { ikon: '✓', ad: 'Ustalaştı', aciklama: 'Bağımsız ve güvenli uyguluyor.' }
};

function stilKur() {
  if (document.getElementById(STIL_ID)) return;
  const style = document.createElement('style');
  style.id = STIL_ID;
  style.textContent = `
    #caGozlemModalArka {
      background:rgba(20,34,27,.58)!important;
      backdrop-filter:blur(7px)!important;
      -webkit-backdrop-filter:blur(7px)!important;
      padding:24px!important;
      animation:zekyGozlemArka .18s ease-out;
    }
    #caGozlemModalRoot {
      --zg-yesil:#2D5E3E;
      --zg-yesil-acik:#EAF3EC;
      --zg-yazi:#24312A;
      --zg-soluk:#66756D;
      --zg-cizgi:#DCE5DF;
      box-sizing:border-box!important;
      width:min(760px,100%)!important;
      max-height:min(92vh,920px)!important;
      padding:26px 28px 24px!important;
      border:1px solid rgba(255,255,255,.72)!important;
      border-radius:28px!important;
      background:#FCFDFB!important;
      color:var(--zg-yazi)!important;
      box-shadow:0 30px 90px rgba(12,28,19,.30)!important;
      scrollbar-width:thin;
      scrollbar-color:#B9C9BF transparent;
      animation:zekyGozlemKart .22s cubic-bezier(.2,.8,.2,1);
    }
    #caGozlemModalRoot *, #caGozlemModalRoot *::before,
    #caGozlemModalRoot *::after { box-sizing:border-box; }
    #caGozlemModalRoot .ca-gozlem-baslik {
      padding-bottom:18px;
      margin-bottom:18px!important;
      border-bottom:1px solid #E8EEEA;
    }
    #caGozlemModalRoot .ca-gozlem-baslik > div > div:first-child {
      font-size:21px!important;
      line-height:1.25;
      letter-spacing:-.02em;
    }
    #caGozlemModalRoot .ca-gozlem-baslik > div > div:last-child {
      margin-top:6px!important;
      color:var(--zg-soluk)!important;
      font-size:13px!important;
    }
    #caGozlemModalRoot .ca-gozlem-kapat {
      flex:0 0 auto;
      width:42px!important;
      height:42px!important;
      display:grid;
      place-items:center;
      border:1px solid #E4EBE7!important;
      border-radius:14px!important;
      background:#F2F6F3!important;
      color:#435249!important;
      font-size:24px!important;
      line-height:1!important;
      transition:background .15s ease,transform .15s ease!important;
    }
    #caGozlemModalRoot .ca-gozlem-kapat:hover {
      background:#E8F0EB!important;
      transform:translateY(-1px);
    }
    #caGozlemModalRoot .ca-gozlem-programlar {
      display:grid!important;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:6px!important;
      padding:5px;
      margin-bottom:20px!important;
      border:1px solid #E2E9E4;
      border-radius:16px;
      background:#F1F5F2;
    }
    #caGozlemModalRoot .ca-gozlem-programlar button {
      min-height:42px;
      padding:8px 10px!important;
      border-radius:11px!important;
      border-color:transparent!important;
      font-size:12.5px!important;
      transition:transform .15s ease,box-shadow .15s ease,background .15s ease!important;
    }
    #caGozlemModalRoot .ca-gozlem-programlar button[aria-pressed="true"] {
      box-shadow:0 4px 12px rgba(45,94,62,.20);
      transform:translateY(-1px);
    }
    #caGozlemModalRoot label {
      color:#5E6E65!important;
      font-size:11px!important;
      letter-spacing:.035em;
    }
    #caGozlemModalRoot .ca-select {
      width:100%!important;
      min-height:46px;
      margin-top:7px!important;
      padding:10px 38px 10px 12px!important;
      border:1.5px solid var(--zg-cizgi)!important;
      border-radius:13px!important;
      background-color:#FFF!important;
      color:var(--zg-yazi)!important;
      font:600 13.5px/1.3 inherit!important;
      box-shadow:0 1px 2px rgba(26,44,33,.03);
      transition:border-color .15s ease,box-shadow .15s ease;
    }
    #caGozlemModalRoot .ca-select:focus,
    #caGozlemModalRoot textarea.ca-area:focus {
      outline:0!important;
      border-color:#4E8060!important;
      box-shadow:0 0 0 4px rgba(45,94,62,.10)!important;
    }
    #caGozlemModalRoot .ca-sevgrid {
      display:grid!important;
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
      gap:10px!important;
    }
    #caGozlemModalRoot .ca-sev {
      position:relative;
      min-width:0;
      min-height:116px;
      display:flex!important;
      flex-direction:column;
      align-items:flex-start;
      justify-content:flex-start;
      gap:9px;
      padding:15px!important;
      border:1.5px solid var(--zg-cizgi)!important;
      border-radius:16px!important;
      background:#FFF!important;
      color:#405047!important;
      text-align:left!important;
      font-family:inherit!important;
      cursor:pointer!important;
      user-select:none;
      pointer-events:auto!important;
      box-shadow:0 2px 8px rgba(27,48,35,.035);
      transition:border-color .16s ease,background .16s ease,box-shadow .16s ease,transform .16s ease!important;
    }
    #caGozlemModalRoot .ca-sev:hover {
      border-color:#AFC4B6!important;
      box-shadow:0 8px 20px rgba(36,70,48,.08);
      transform:translateY(-2px);
    }
    #caGozlemModalRoot .ca-sev:focus-visible {
      outline:3px solid rgba(45,94,62,.20)!important;
      outline-offset:2px;
    }
    #caGozlemModalRoot .ca-gozlem-asama-ikon {
      width:34px;
      height:34px;
      display:grid;
      place-items:center;
      border-radius:11px;
      background:#EEF3F0;
      font-size:18px;
      font-weight:900;
    }
    #caGozlemModalRoot .ca-gozlem-asama-metin strong {
      display:block;
      color:#2D3C33;
      font-size:14px;
      line-height:1.2;
    }
    #caGozlemModalRoot .ca-gozlem-asama-metin small {
      display:block;
      margin-top:5px;
      color:#748178;
      font-size:11px;
      font-weight:500;
      line-height:1.35;
    }
    #caGozlemModalRoot .ca-gozlem-secili {
      position:absolute;
      top:12px;
      right:12px;
      width:22px;
      height:22px;
      display:grid;
      place-items:center;
      border:1px solid #D8E3DC;
      border-radius:50%;
      background:#FFF;
      color:transparent;
      font-size:12px;
      font-weight:900;
    }
    #caGozlemModalRoot .ca-sev.on {
      border-color:var(--zg-yesil)!important;
      background:#F0F7F2!important;
      color:var(--zg-yesil)!important;
      box-shadow:0 0 0 3px rgba(45,94,62,.10),0 10px 24px rgba(45,94,62,.10)!important;
      transform:translateY(-1px);
    }
    #caGozlemModalRoot .ca-sev[data-s="T"].on {
      border-color:#B78325!important;
      background:#FFF8E8!important;
      box-shadow:0 0 0 3px rgba(183,131,37,.10),0 10px 24px rgba(121,83,17,.08)!important;
    }
    #caGozlemModalRoot .ca-sev.on .ca-gozlem-secili {
      border-color:var(--zg-yesil);
      background:var(--zg-yesil);
      color:#FFF;
    }
    #caGozlemModalRoot .ca-sev[data-s="T"].on .ca-gozlem-secili {
      border-color:#B78325;
      background:#B78325;
    }
    #caGozlemModalRoot textarea.ca-area {
      min-height:112px!important;
      padding:13px 14px!important;
      border:1.5px solid var(--zg-cizgi)!important;
      border-radius:14px!important;
      background:#FFF!important;
      color:var(--zg-yazi)!important;
      font:500 13.5px/1.55 inherit!important;
      resize:vertical;
    }
    #caGozlemModalRoot .ca-gozlem-foto {
      border-color:#B7CCBE!important;
      border-radius:16px!important;
      background:linear-gradient(145deg,#F7FBF8,#EEF5F0)!important;
      min-height:122px;
      transition:border-color .15s ease,transform .15s ease,box-shadow .15s ease!important;
    }
    #caGozlemModalRoot .ca-gozlem-foto:hover {
      border-color:#679174!important;
      transform:translateY(-1px);
      box-shadow:0 8px 22px rgba(45,94,62,.08);
    }
    #caGozlemModalRoot .ca-gozlem-notice {
      margin-top:14px!important;
      padding:12px 14px!important;
      border:1px solid #E4DCF2;
      border-radius:13px!important;
      background:#F6F2FB!important;
      color:#60468A!important;
      font-size:12px!important;
    }
    #caGozlemModalRoot .ca-gozlem-actions {
      padding-top:16px;
      margin-top:16px!important;
      border-top:1px solid #E8EEEA;
    }
    #caGozlemModalRoot .ca-gozlem-actions button {
      min-height:48px!important;
      border-radius:14px!important;
      font-family:inherit!important;
      transition:transform .15s ease,box-shadow .15s ease!important;
    }
    #caGozlemModalRoot .ca-gozlem-actions button:hover { transform:translateY(-1px); }
    #caGozlemModalRoot #caGozlemKaydetBtn {
      background:linear-gradient(135deg,#2D5E3E,#3D7650)!important;
      box-shadow:0 8px 18px rgba(45,94,62,.20);
    }
    #caGozlemModalRoot #caGozlemKaydetBtn:disabled {
      opacity:.58;
      cursor:wait!important;
      transform:none;
      box-shadow:none;
    }
    @keyframes zekyGozlemArka { from { opacity:0; } to { opacity:1; } }
    @keyframes zekyGozlemKart { from { opacity:0; transform:translateY(14px) scale(.985); } to { opacity:1; transform:none; } }
    @media (max-width:700px) {
      #caGozlemModalArka { align-items:flex-end!important; padding:0!important; }
      #caGozlemModalRoot {
        width:100%!important;
        max-height:96dvh!important;
        padding:20px 18px calc(18px + env(safe-area-inset-bottom))!important;
        border-width:1px 0 0!important;
        border-radius:24px 24px 0 0!important;
      }
      #caGozlemModalRoot .ca-gozlem-programlar { grid-template-columns:repeat(2,minmax(0,1fr)); }
      #caGozlemModalRoot .ca-sevgrid { grid-template-columns:1fr!important; }
      #caGozlemModalRoot .ca-sev {
        min-height:76px;
        display:grid!important;
        grid-template-columns:38px 1fr 22px;
        align-items:center;
        gap:11px;
      }
      #caGozlemModalRoot .ca-gozlem-secili { position:static; }
    }
    @media (prefers-reduced-motion:reduce) {
      #caGozlemModalArka,#caGozlemModalRoot { animation:none!important; }
      #caGozlemModalRoot * { transition:none!important; }
    }
  `;
  document.head.appendChild(style);
}

function butonMetniniKur(buton) {
  const kod = buton?.dataset?.s;
  const bilgi = ASAMALAR[kod];
  if (!bilgi) return;
  if (buton.dataset.zekyModern !== '1') {
    buton.innerHTML = `<span class="ca-gozlem-asama-ikon" aria-hidden="true">${bilgi.ikon}</span><span class="ca-gozlem-asama-metin"><strong>${bilgi.ad}</strong><small>${bilgi.aciklama}</small></span><span class="ca-gozlem-secili" aria-hidden="true">✓</span>`;
    buton.dataset.zekyModern = '1';
    buton.setAttribute('role', 'radio');
    buton.setAttribute('tabindex', '0');
    buton.setAttribute('aria-label', `${bilgi.ad}: ${bilgi.aciklama}`);
    buton.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (typeof window.caGozlemSeviye === 'function') window.caGozlemSeviye(kod);
      setTimeout(modaliDuzenle, 0);
    });
  }
  buton.setAttribute('aria-checked', buton.classList.contains('on') ? 'true' : 'false');
}

function modaliDuzenle() {
  const arka = document.getElementById('caGozlemModalArka');
  const root = document.getElementById('caGozlemModalRoot');
  if (!arka || !root) return;
  arka.setAttribute('role', 'presentation');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Eğitim gözlemi');

  const ust = root.firstElementChild;
  if (ust) {
    ust.classList.add('ca-gozlem-baslik');
    const kapat = ust.querySelector('button[onclick*="caGozlemKapat"]');
    if (kapat) {
      kapat.classList.add('ca-gozlem-kapat');
      kapat.setAttribute('aria-label', 'Gözlem penceresini kapat');
    }
  }

  const programButonlari = [...root.querySelectorAll('button[onclick*="caGozlemSet"][onclick*="disiplin"]')];
  if (programButonlari.length) {
    const kapsayici = programButonlari[0].parentElement;
    kapsayici?.classList.add('ca-gozlem-programlar');
    programButonlari.forEach((b) => {
      const secili = /background:\s*#2D5E3E/i.test(b.getAttribute('style') || '');
      b.setAttribute('aria-pressed', secili ? 'true' : 'false');
    });
  }

  root.querySelectorAll('.ca-sev[data-s]').forEach(butonMetniniKur);
  const foto = root.querySelector('button[onclick*="caGozlemFotoSec"]');
  foto?.classList.add('ca-gozlem-foto');
  const ilerleme = root.querySelector('#caGozlemProgress');
  ilerleme?.previousElementSibling?.classList.add('ca-gozlem-notice');
  const kaydet = root.querySelector('#caGozlemKaydetBtn');
  kaydet?.parentElement?.classList.add('ca-gozlem-actions');
}

let duzenlemeBekliyor = false;
function duzenlemeSirala() {
  if (duzenlemeBekliyor) return;
  duzenlemeBekliyor = true;
  requestAnimationFrame(() => {
    duzenlemeBekliyor = false;
    modaliDuzenle();
  });
}

stilKur();

// Popup içeriği program/alan/fotoğraf değişimlerinde yeniden çizildiği için
// sadece ilgili popup DOM'a geldiğinde tekrar iyileştirilir.
const gozlemci = new MutationObserver((degisiklikler) => {
  if (degisiklikler.some(d => [...d.addedNodes].some(n => n.nodeType === 1 && (n.id === 'caGozlemModalArka' || n.id === 'caGozlemModalRoot' || n.closest?.('#caGozlemModalRoot'))))) {
    duzenlemeSirala();
  }
});
gozlemci.observe(document.body, { childList:true, subtree:true });

// Seçim çekirdekte tutulur; burada görünür ve erişilebilir durum eşitlenir.
document.addEventListener('click', (e) => {
  const buton = e.target.closest?.('#caGozlemModalRoot .ca-sev[data-s]');
  if (!buton) return;
  if (typeof window.caGozlemSeviye === 'function') window.caGozlemSeviye(buton.dataset.s);
  duzenlemeSirala();
}, true);

document.addEventListener('change', (e) => {
  if (e.target.closest?.('#caGozlemModalRoot')) setTimeout(modaliDuzenle, 0);
}, true);

export { modaliDuzenle };
