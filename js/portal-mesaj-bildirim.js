// Portal açıkken gelen mesajlar için yalnız yerel uyarı; Firestore'a yazmaz.
// İlk sunucu görüntüsü geçmiş sayılır. Rozet/okundu işlemleri çağıranın sorumluluğunda.
const normalizeEmail = value => String(value || "").trim().toLowerCase();

function messageTime(value) {
  if (!value) return null;
  // toMillis() nanosaniyeleri yuvarlayabilir: aynı milisaniyedeki iki mesajı ayır.
  if (Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds)) {
    if (value.nanoseconds < 0 || value.nanoseconds >= 1e9) return null;
    return [value.seconds, value.nanoseconds];
  }
  try {
    const ms = typeof value.toMillis === "function" ? value.toMillis()
      : value instanceof Date ? value.getTime() : Number.NaN;
    if (!Number.isFinite(ms)) return null;
    const seconds = Math.floor(ms / 1000);
    return [seconds, Math.round((ms - seconds * 1000) * 1e6)];
  } catch (_) { return null; }
}

const newerThan = (a, b) => a && (!b || a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]));

export function createMessageNoticeTracker() {
  let account = "";
  let ready = false;
  const seen = new Map();
  const reset = () => { account = ""; ready = false; seen.clear(); };

  return {
    reset,
    update({ threads = [], email = "", fromCache = false, viewedThreadId = "" } = {}) {
      const user = normalizeEmail(email);
      if (user !== account) { reset(); account = user; }
      if (!user || !Array.isArray(threads)) return [];
      // Bağlantı kesilince yerel önbellek eski/spekülatif veri getirebilir.
      // İlk sunucu görüntüsünden sonra yalnız sunucu onaylı değişiklikler uyarır.
      if (ready && fromCache) return [];
      const incoming = [];
      for (const thread of threads) {
        const id = String(thread?.id || "");
        if (!id) continue;
        const time = messageTime(thread.sonMesajTarihi);
        const previous = seen.get(id);
        const fresh = newerThan(time, previous);
        if (fresh) seen.set(id, time);
        if (!ready || !fresh) continue;
        const sender = normalizeEmail(thread.sonMesajGonderen);
        const unread = Number(thread.okunmamis?.[user] || 0);
        // Görünen veya kendimizden gelen mesaj da yukarıda tüketilir: sohbetten
        // çıkmak veya sayaç değişmesi aynı mesajı yeniden bildirmemelidir.
        if (sender && sender !== user && Number.isFinite(unread) && unread > 0
            && id !== String(viewedThreadId || "")) incoming.push(thread);
      }
      if (!fromCache) ready = true;
      return incoming;
    }
  };
}

let audioContext = null;
let soundSetup = false;

// Tarayıcı otomatik oynatma kuralları geçerlidir; ses için kullanıcı etkileşimi
// gerekir. Ses açılamasa da görsel uyarı çalışır, eski sesler kuyruklanmaz.
export function setupMessageSound() {
  if (typeof window === "undefined" || soundSetup) return;
  soundSetup = true;
  const unlock = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext = audioContext || new AudioContext();
      if (audioContext.state === "suspended") audioContext.resume()?.catch?.(() => {});
    } catch (_) { /* Ses izni veya destek yoksa görsel bildirim yeterli. */ }
  };
  // Tekrarlı kurulum dinleyici eklemez. Bağlam mobilde askıya alınırsa sonraki
  // etkileşim yeniden uyandırır; herhangi bir hesap/veri burada saklanmaz.
  window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  window.addEventListener("touchstart", unlock, { capture: true, passive: true });
  window.addEventListener("keydown", unlock, true);
  // Modül ilk tıklamadan sonra yüklendiyse tarayıcının izin verdiği ölçüde dene.
  if (window.navigator?.userActivation?.hasBeenActive) unlock();
}

let lastSoundAt = -Infinity;
function playMessageSound() {
  try {
    if (!audioContext || audioContext.state !== "running") return;
    const now = audioContext.currentTime;
    if (now - lastSoundAt < 0.8) return; // Aynı görüntüdeki çoklu sohbetler tek ses.
    lastSoundAt = now;
    const start = now + 0.02;
    [880, 1175].forEach((frequency, i) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const at = start + i * 0.18;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(at);
      oscillator.stop(at + 0.4);
    });
  } catch (_) { /* Ses hatası bildirim akışını durdurmaz. */ }
}

const notices = new Map();
const MAX_NOTICES = 3;
const NOTICE_MS = 10000;

function ensureNoticeStyles() {
  if (document.getElementById("portalMesajBildirimStil")) return;
  const style = document.createElement("style");
  style.id = "portalMesajBildirimStil";
  style.textContent = `
.pmb-yigin { position:fixed; top:84px; right:18px; z-index:10050; display:flex; flex-direction:column; gap:10px; width:min(380px,calc(100vw - 24px)); pointer-events:none; }
.pmb-kart { pointer-events:auto; position:relative; display:flex; gap:12px; padding:14px 42px 14px 14px; background:#fff; border:1px solid #E9EBF4; border-left:5px solid #2B3674; border-radius:18px; box-shadow:0 18px 44px rgba(15,23,42,.22); font-family:inherit; box-sizing:border-box; animation:pmbGir .2s ease-out; }
.pmb-ikon { width:42px; height:42px; flex-shrink:0; border-radius:13px; display:grid; place-items:center; color:#2B3674; background:#E8ECFB; font-size:23px; }
.pmb-govde { flex:1; min-width:0; color:#4A5169; font-size:13px; line-height:1.4; }
.pmb-govde strong { display:block; color:#1F2544; font-size:15px; overflow-wrap:anywhere; }
.pmb-govde p { margin:4px 0 8px; }
.pmb-ac { min-height:40px; padding:8px 14px; border:0; border-radius:12px; background:#2B3674; color:#fff; font:inherit; font-weight:700; cursor:pointer; }
.pmb-kapat { position:absolute; top:6px; right:6px; width:34px; height:34px; border:0; border-radius:50%; background:transparent; color:#4A5169; font-size:24px; cursor:pointer; }
.pmb-kapat:hover { background:#F1F5F9; }
.pmb-kart button:focus-visible { outline:3px solid #5A6ACF; outline-offset:3px; }
@keyframes pmbGir { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:none; } }
@media(max-width:700px) { .pmb-yigin { top:auto; bottom:max(14px,env(safe-area-inset-bottom)); right:12px; left:12px; width:auto; } }
@media(prefers-reduced-motion:reduce) { .pmb-kart { animation:none; } }`;
  document.head.appendChild(style);
}

function showNotice(thread, { titleText, previewText, iconText, actionLabel, closeLabel, onOpen, noticeId } = {}) {
  if (typeof document === "undefined" || !document.body || !thread?.id) return null;
  ensureNoticeStyles();
  setupMessageSound();
  const id = String(noticeId || thread.id);
  notices.get(id)?.dismiss();
  // Diğer Portal uyarılarının DOM/CSS'ine dokunma; pencere/odak çalma yok.
  let stack = document.getElementById("portalMesajBildirimYigin");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "portalMesajBildirimYigin";
    stack.className = "pmb-yigin";
    document.body.appendChild(stack);
  } else stack.classList.add("pmb-yigin");

  const card = document.createElement("div");
  card.className = "pmb-kart";
  const icon = document.createElement("span");
  icon.className = "pmb-ikon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = iconText;
  const body = document.createElement("div");
  body.className = "pmb-govde";
  const status = document.createElement("div");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  const title = document.createElement("strong");
  title.textContent = String(titleText || "Bildirim").slice(0, 100);
  const preview = document.createElement("p");
  // Mesaj gövdesi, ek adı, öğrenci bilgisi ve e-posta geniş arayüze taşınmaz.
  preview.textContent = String(previewText || "Yeni bir bildiriminiz var.").slice(0, 180);
  status.append(title, preview);
  body.appendChild(status);

  let timer = null;
  let hovered = false;
  const dismiss = () => {
    clearTimeout(timer);
    card.remove();
    notices.delete(id);
  };
  const pause = () => { clearTimeout(timer); };
  const resume = () => {
    pause();
    if (!hovered && !card.contains(document.activeElement)) timer = setTimeout(dismiss, NOTICE_MS);
  };
  if (typeof onOpen === "function") {
    const open = document.createElement("button");
    open.type = "button";
    open.className = "pmb-ac";
    open.textContent = actionLabel;
    open.addEventListener("click", () => { dismiss(); onOpen(thread); });
    body.appendChild(open);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.className = "pmb-kapat";
  close.setAttribute("aria-label", closeLabel);
  close.textContent = "×";
  close.addEventListener("click", dismiss);
  card.addEventListener("keydown", event => { if (event.key === "Escape") dismiss(); });
  card.addEventListener("pointerenter", () => { hovered = true; pause(); });
  card.addEventListener("pointerleave", () => { hovered = false; resume(); });
  card.addEventListener("focusin", pause);
  card.addEventListener("focusout", event => {
    if (!hovered && !card.contains(event.relatedTarget)) {
      pause(); timer = setTimeout(dismiss, NOTICE_MS);
    }
  });
  card.append(icon, body, close);
  stack.prepend(card);
  notices.set(id, { dismiss, generic: !!noticeId });
  while (notices.size > MAX_NOTICES) notices.values().next().value.dismiss();
  resume();
  playMessageSound();
  return card;
}

// Eski mesaj API'si ve gizlilik metni değişmez. Tüm Portal türleri aynı ses
// kilidini, kısa süreli ses birleştirmesini ve sınırlı kart yığınını paylaşır.
export function showMessageNotice(thread, { senderName = "", onOpen } = {}) {
  const name = String(senderName || "").trim().slice(0, 70);
  return showNotice(thread, {
    titleText: name ? `${name} · Yeni mesaj` : "Yeni mesaj",
    previewText: "Okunmamış yeni bir mesajınız var.", iconText: "✉",
    actionLabel: "Sohbeti aç", closeLabel: "Mesaj uyarısını kapat", onOpen
  });
}

// Başlık/metin yalnız çağıranın ürettiği genel tür etiketleri olmalıdır;
// bildirim belgesinin gövdesini, öğrenci adını veya e-postasını aktarmayın.
export function showPortalNotice(notice, { onOpen, actionLabel = "Bildirimleri aç" } = {}) {
  return showNotice(notice, {
    titleText: notice?.title || "Bildirim", previewText: notice?.message || "Yeni bir bildiriminiz var.",
    iconText: "🔔", actionLabel, closeLabel: "Bildirim uyarısını kapat", onOpen,
    noticeId: `portal:${String(notice?.id || "")}`
  });
}

export function dismissPortalNotice(id) {
  notices.get(`portal:${String(id || "")}`)?.dismiss();
}

export function playPortalNotificationSound() { setupMessageSound(); playMessageSound(); }

export function clearMessageNotices() {
  for (const notice of [...notices.values()]) if (!notice.generic) notice.dismiss();
  lastSoundAt = -Infinity;
}

export function clearPortalNotices() {
  for (const notice of [...notices.values()]) if (notice.generic) notice.dismiss();
  lastSoundAt = -Infinity;
}
