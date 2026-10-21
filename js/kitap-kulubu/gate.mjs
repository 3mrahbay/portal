import { auth, db, fb, onAuthStateChanged } from "./adapter.mjs";
import { createStore } from "./store.mjs";
let allowed = false,
  manage = false,
  epoch = 0;
function apply() {
  document.querySelectorAll("[data-bk-manage]").forEach(e => { e.hidden = !manage; });
  document.querySelectorAll("[data-bk-host]").forEach((e) => {
    e.hidden = !allowed;
  });
}
new MutationObserver(apply).observe(document.body, {
  childList: true,
  subtree: true,
});
onAuthStateChanged(auth, async (user) => {
  const turn = ++epoch;
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
