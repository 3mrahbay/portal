import { auth, db, fb, onAuthStateChanged } from "./adapter.mjs";
import { createStore } from "./store.mjs";
import { mountClub } from "./ui.mjs";
const host = document.getElementById("club");
const geri = document.querySelector("[data-kc-back]");
geri?.addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.href = "index.html";
});
let cleanup = null,
  epoch = 0;
onAuthStateChanged(auth, async (user) => {
  const turn = ++epoch;
  cleanup?.();
  cleanup = null;
  const root = document.createElement("div");
  host.replaceChildren(root);
  if (!user) {
    root.innerHTML =
      '<section class="kc-state"><div class="kc-state-icon">📚</div><h1>Kitap Kulübü</h1><p>Kitaplığı görmek için okul hesabınızla giriş yapın.</p><a class="kc-state-action" href="index.html">Giriş ekranına dön</a></section>';
    return;
  }
  root.textContent = "Kitaplığınız hazırlanıyor…";
  const done = await mountClub(root, createStore(fb, db, auth));
  if (turn !== epoch) done();
  else cleanup = done;
});
window.addEventListener("pagehide", () => {
  epoch++;
  cleanup?.();
});

window.addEventListener("pageshow", event => { if (event.persisted) window.location.reload(); });
