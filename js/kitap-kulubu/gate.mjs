import { auth, db, fb, onAuthStateChanged } from "./adapter.mjs";
import { createStore } from "./store.mjs";
let allowed = false,
  manage = false,
  epoch = 0;


// Danışma hesabında Kitap Kulübü erişimi mevcut, fakat Portal kabuğunda
// özet kartı ve yan menü kısayolu yoktu. Tek kulübe bağlantı verir;
// öğretmen/veli akışına veya yönetim yetkilerine dokunmaz.
function danismaKisayollariKur() {
  const danisma = typeof window.danismaRolMu === "function" && window.danismaRolMu();
  if (!danisma) {
    document.querySelector("[data-bk-danisma-quick]")?.remove();
    document.querySelector("[data-bk-danisma-menu]")?.remove();
    return;
  }

  const hizli = document.querySelector(
    "#adminHomeRoot .danisma-operasyon-paneli .danisma-hizli-islemler"
  );
  if (hizli && !hizli.querySelector("[data-bk-danisma-quick]")) {
    const bag = document.createElement("a");
    bag.href = "kitap-kulubu.html";
    bag.className = "ca-qbtn";
    bag.setAttribute("data-bk-danisma-quick", "");
    bag.setAttribute("data-bk-host", "");
    bag.setAttribute("aria-label", "Kitap Kulübü'nü aç");
    bag.hidden = true;
    bag.style.cssText = "display:none;text-decoration:none";
    bag.innerHTML = '<span class="ca-qicon" style="background:#E6F1E8;color:#2D5E3E"><i data-lucide="book-open"></i></span><span class="ca-qlabel">Kitap Kulübü</span>';
    hizli.appendChild(bag);
    window.lucideYenile?.(bag);
  }

  const menu = document.getElementById("modulBar");
  if (menu && !menu.querySelector("[data-bk-danisma-menu]")) {
    const once = menu.querySelector('[data-modul="mesaj"]');
    if (once) {
      const bag = document.createElement("a");
      bag.href = "kitap-kulubu.html";
      bag.className = "side-item";
      bag.setAttribute("data-bk-danisma-menu", "");
      bag.setAttribute("data-bk-host", "");
      bag.setAttribute("aria-label", "Kitap Kulübü'nü aç");
      bag.hidden = true;
      bag.style.cssText = "display:none;text-decoration:none";
      bag.innerHTML = '<span class="side-ikon"><i data-lucide="book-open"></i></span><span class="side-ad">Kitap Kulübü</span>';
      once.insertAdjacentElement("afterend", bag);
      window.lucideYenile?.(bag);
    }
  }
}
function apply() {
  danismaKisayollariKur();
  document.querySelectorAll("[data-bk-manage]").forEach(e => { e.hidden = !manage; });
  document.querySelectorAll("[data-bk-host]").forEach((e) => {
    e.hidden = !allowed;
  });
  // Portal'ın .side-item ve .ca-qbtn CSS'leri display belirlediği için
  // hidden bayrağını danışma kısayollarında ayrıca display ile uygula.
  document.querySelectorAll("[data-bk-danisma-quick], [data-bk-danisma-menu]").forEach(e => {
    e.style.display = allowed ? "" : "none";
  });
}
new MutationObserver(apply).observe(document.body, {
  childList: true,
  subtree: true,
});
onAuthStateChanged(auth, async (user) => {
  const turn = ++epoch;
  window.KitapKulubu?.setViewer(user?.uid);
  allowed = false;
  manage = false;
  apply();
  if (!user) return;
  try {
    const access = await createStore(fb, db, auth).identity();
    if (turn === epoch) { allowed = access.read; manage = access.manage; }
  } catch {}
  apply();
});
