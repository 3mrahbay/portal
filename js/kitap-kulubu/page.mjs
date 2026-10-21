import { auth, db, fb, onAuthStateChanged } from "./adapter.mjs";
import { createStore } from "./store.mjs";
import { mountClub } from "./ui.mjs";
const host = document.getElementById("club");
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
      '<h1>Kitap Kulübü</h1><p>Kitaplığı görmek için okul hesabınızla giriş yapın.</p><a href="index.html">Giriş ekranına dön</a>';
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
