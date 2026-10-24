import {
  escapeHTML as esc,
  dateLabel,
  canPost,
  groupBooks,
  eventDetails,
} from "./core.mjs";
import { preparePhoto } from "./photo.mjs";
export async function mountClub(root, store) {
  let alive = true,
    access,
    books = [],
    selected = null,
    member = null,
    posts = new Map(),
    unsubs = [],
    postStop = null,
    image = "",
    draftId = null,
    busy = false,
    photoBusy = false,
    generation = 0,
    oldCursor = null,
    hasOlder = false,
    olderLoaded = false;
  const listeners = [];
  const listen = (event, fn) => {
    root.addEventListener(event, fn);
    listeners.push([event, fn]);
  };
  const stop = () => {
    listeners.forEach(([event, fn]) => root.removeEventListener(event, fn));
    alive = false;
    generation++;
    postStop?.();
    unsubs.forEach((f) => f());
    root.replaceChildren();
    image = "";
    posts.clear();
  };
  const error = (e) => {
    if (!alive) return;
    const el = root.querySelector("[data-error]");
    if (el)
      el.textContent =
        e.code === "permission-denied"
          ? "Bu işlem için yetkiniz yok veya erişiminiz değişti."
          : e.message || "İşlem tamamlanamadı. Lütfen yeniden deneyin.";
  };
  try {
    access = await store.identity();
  } catch (e) {
    root.textContent =
      "Kulüp yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin.";
    return stop;
  }
  if (!alive) return stop;
  if (!access.read) {
    root.innerHTML =
      '<section class="kc-state"><div class="kc-state-icon">☕</div><h1>Kitap Kulübü</h1><p>Bu alan onaylı anne hesapları ve okul ekibine açıktır. Hesabınız anne olarak kayıtlı olduğu halde bu ekranı görüyorsanız okul ekibine bilgi verin.</p><button type="button" class="kc-state-action" data-kc-page-back>Ana sayfaya dön</button></section>';
    root.querySelector("[data-kc-page-back]")?.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.href = "index.html";
    });
    return stop;
  }
  root.innerHTML = `<header class="kc-heading kc-heading-illustrated"><a class="kc-hero-poster" href="assets/kitap-kulubu/annelerle-kitap-kulubu.jpeg" target="_blank" rel="noopener" aria-label="Annelerle Kitap Kulübü afişini büyük aç"><img src="assets/kitap-kulubu/annelerle-kitap-kulubu.jpeg" width="1024" height="1536" alt="Annelerle Kitap Kulübü: Bir kitap, birçok duygu, güzel bir buluşma. Ebeveynliği Hissetmek buluşması, 26 Kasım Perşembe saat 19.00, Bir Çiçek’te." fetchpriority="high" decoding="async"></a><div class="kc-hero-copy"><p class="bk-eyebrow">ANNELER İLE · KİTAP & ÇAY</p><h1>Kitap Kulübü</h1><p class="kc-hero-tagline">Bir kitap, birçok duygu,<br>güzel bir buluşma.</p><p>Birlikte okuyalım, deneyimlerimizi paylaşalım.</p><span class="kc-hero-note">Okuduklarımızdan hayatımıza, içten bir sohbet molası.</span></div></header><p role="alert" data-error class="kc-error"></p><nav class="kc-tabs" aria-label="Kitaplık"><button data-tab="active" aria-pressed="true">Buluşmalar</button><button data-tab="archive" aria-pressed="false">Geçmiş okumalar</button>${access.manage ? "<a class=\"kc-admin-link\" href=\"kitap-kulubu-yonetim.html\">Kitap Kulübü Yönetimi</a>" : ""}</nav><div data-library class="kc-library" aria-live="polite">Kitaplar yükleniyor…</div><section data-book hidden></section>`;
  let tab = "active";
  function library() {
    if (!alive) return;
    const list = groupBooks(books)[tab];
    root.querySelector("[data-library]").innerHTML = list.length
      ? list
          .map(
            (b) =>
              `<button class="kc-book-choice" data-book-id="${esc(b.id)}" aria-pressed="${selected?.id === b.id}"><span>${esc(dateLabel(b.date))}</span><strong>${esc(b.title)}</strong><small>${esc(b.authors)}</small></button>`,
          )
          .join("")
      : `<p class="kc-empty">${tab === "archive" ? "Geçmiş okumalarımız burada birikecek." : "Yeni buluşma duyurulduğunda burada görebilirsiniz."}</p>`;
  }
  function composer() {
    if (!selected || !alive) return;
    const form = root.querySelector("[data-compose]");
    if (!form) return;
    const writable = canPost(access, member, selected);
    form.hidden = !writable;
    form
      .querySelectorAll("textarea,button,input")
      .forEach((e) => (e.disabled = busy || photoBusy || !writable));
    const notice = root.querySelector("[data-member-note]");
    notice.innerHTML =
      selected.status === "archived"
        ? "Bu okuma arşivde. Fotoğrafları ve sohbeti yeniden keşfedebilirsiniz."
        : writable
          ? "Paylaşımlar tüm onaylı anne hesapları ve okul ekibi tarafından görülebilir."
          : member?.status === "pending"
            ? "Katılım talebiniz okul ekibinin onayını bekliyor."
            : member?.status === "blocked"
              ? "Paylaşım yetkiniz kapalı. Bilgi için okul ekibiyle görüşebilirsiniz."
              : "Sohbeti okuyabilirsiniz. Mesaj ve fotoğraf eklemek için kulübe katılın. <button data-join>Kulübe katılmak istiyorum</button>";
  }
  function renderPosts() {
    if (!alive || !selected) return;
    const target = root.querySelector("[data-posts]");
    if (!target) return;
    const list = [...posts.values()].sort(
      (a, b) =>
        (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0) ||
        b.id.localeCompare(a.id),
    );
    target.innerHTML = list.length
      ? list
          .map(
            (p) =>
              `<article class="kc-post"><div class="kc-post-head"><strong>${esc(p.authorName)}</strong><time>${p.createdAt?.toDate ? esc(dateLabel(p.createdAt.toDate())) : "Gönderiliyor…"}</time></div>${p.deleted ? '<p class="kc-muted">Bu paylaşım kaldırıldı.</p>' : `<p class="kc-text">${esc(p.text)}</p>${p.image && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.image) ? `<img src="${p.image}" alt="${esc(p.authorName)} tarafından paylaşılan kitap kulübü fotoğrafı" loading="lazy">` : ""}${access.manage || p.authorUid === access.uid ? `<button class="kc-text-button" data-remove="${esc(p.id)}">Paylaşımı kaldır</button>` : ""}`}</article>`,
          )
          .join("")
      : '<p class="kc-empty">Bu okumaya ait henüz paylaşım yok. Katılımcıların mesajları ve fotoğrafları burada birikecek.</p>';
    root.querySelector("[data-older]").hidden = !hasOlder;
  }
  function selectBook(id) {
    const book = books.find((b) => b.id === id);
    if (!book) return;
    generation++;
    const gen = generation;
    postStop?.();
    selected = book;
    posts.clear();
    image = "";
    draftId = null;
    busy = false;
    photoBusy = false;
    oldCursor = null;
    hasOlder = false;
    olderLoaded = false;
    const details = eventDetails(book.id);
    const el = root.querySelector("[data-book]");
    el.hidden = false;
    el.innerHTML = `<div class="kc-event"><p class="bk-eyebrow">${book.status === "archived" ? "GEÇMİŞ OKUMAMIZ" : "BİRLİKTE OKUYORUZ"}</p><h2>${esc(book.title)}</h2><p>${esc(book.authors)}</p><p class="kc-date">${esc(dateLabel(book.date))}</p><p>${esc(book.leader)} liderliğinde</p><p>${esc(book.place)}</p><details><summary>Buluşmayı keşfet</summary><h3>Neden buluşuyoruz?</h3><p>${esc(book.purpose)}</p><h3>Neden katılmalı?</h3><p>${esc(details.why)}</p><h3>Neler konuşacağız?</h3><ul>${details.topics.map(topic => `<li>${esc(topic)}</li>`).join("")}</ul><h3>Yanınızda ne getirmeli?</h3><p>${esc(details.preparation)}</p></details></div><h2 class="kc-feed-title">Paylaşım köşemiz</h2><div data-member-note class="kc-member-note"></div><form data-compose class="kc-compose" hidden><label for="kc-message">Sohbete bir not bırakın</label><textarea id="kc-message" maxlength="2000" rows="3" placeholder="Bu bölüm bana şunu düşündürdü…"></textarea><label class="kc-file">Fotoğraf ekle <input type="file" data-photo accept="image/jpeg,image/png,image/webp"></label><div data-photo-preview></div><p class="kc-muted">Yalnızca paylaşma izniniz olan fotoğrafları ekleyin.</p><button type="submit" class="bk-button">Paylaş</button><p data-save-status role="status"></p></form><div data-posts aria-live="polite">Paylaşımlar yükleniyor…</div><button data-older hidden>Daha eski paylaşımlar</button>`;
    composer();
    library();
    postStop = store.posts(
      id,
      (rows) => {
        if (!alive || gen !== generation) return;
        if (posts.size && rows.length && !rows.some((p) => posts.has(p.id))) {
          posts.clear();
          olderLoaded = false;
        }
        rows.forEach((p) => posts.set(p.id, p));
        if (!olderLoaded) {
          oldCursor = rows.at(-1)?.cursor;
          hasOlder = rows.length === 20;
        }
        renderPosts();
      },
      (e) => {
        if (gen !== generation) return;
        posts.clear();
        root.querySelector("[data-posts]").textContent =
          "Paylaşımlar yüklenemedi. Sayfayı yenileyerek tekrar deneyin.";
        error(e);
      },
    );
  }
  listen("click", async (event) => {
    const button = event.target.closest("button");
    if (!button || busy) return;
    try {
      if (button.dataset.tab) {
        tab = button.dataset.tab;
        root
          .querySelectorAll("[data-tab]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        const list = groupBooks(books)[tab];
        if (list.length) selectBook(list[0].id);
        else {
          generation++;
          postStop?.();
          selected = null;
          root.querySelector("[data-book]").hidden = true;
        }
        library();
      }
      if (button.dataset.bookId) selectBook(button.dataset.bookId);
      if (button.hasAttribute("data-join")) {
        button.disabled = true;
        await store.join();
      }
      if (button.hasAttribute("data-clear-photo")) {
        image = "";
        root.querySelector("[data-photo-preview]").replaceChildren();
        root.querySelector("[data-photo]").value = "";
        draftId = null;
      }
      if (
        button.dataset.remove &&
        confirm("Bu paylaşımın metni ve fotoğrafı kaldırılsın mı?")
      ) {
        button.disabled = true;
        await store.remove(selected.id, button.dataset.remove);
      }
      if (button.hasAttribute("data-older")) {
        button.disabled = true;
        const gen = generation;
        const rows = await store.older(selected.id, oldCursor);
        if (gen !== generation) return;
        olderLoaded = true;
        rows.forEach((p) => posts.set(p.id, p));
        oldCursor = rows.at(-1)?.cursor || oldCursor;
        hasOlder = rows.length === 20;
        renderPosts();
        button.disabled = false;
      }
    } catch (e) {
      button.disabled = false;
      error(e);
    }
  });
  listen("change", async (event) => {
    if (!event.target.matches("[data-photo]")) return;
    const file = event.target.files[0];
    if (!file) return;
    const gen = generation;
    photoBusy = true;
    composer();
    try {
      const prepared = await preparePhoto(file);
      if (!alive || gen !== generation) return;
      image = prepared;
      draftId = null;
      root.querySelector("[data-photo-preview]").innerHTML =
        `<img src="${image}" alt="Seçtiğiniz fotoğrafın önizlemesi"><button type="button" data-clear-photo>Fotoğrafı kaldır</button>`;
    } catch (e) {
      error(e);
    } finally {
      if (alive && gen === generation) {
        photoBusy = false;
        composer();
      }
    }
  });
  listen("input", (e) => {
    if (e.target.id === "kc-message") draftId = null;
  });
  listen("submit", async (event) => {
    event.preventDefault();
    if (busy || photoBusy) return;
    const form = event.target;
    if (!form.matches("[data-compose]") || !canPost(access, member, selected))
      return;
    const gen = generation,
      bookId = selected.id;
    busy = true;
    draftId ||= crypto.randomUUID();
    composer();
    try {
      await store.post(
        bookId,
        draftId,
        form.querySelector("textarea").value,
        image,
      );
      if (!alive || gen !== generation) return;
      form.reset();
      image = "";
      draftId = null;
      form.querySelector("[data-photo-preview]").replaceChildren();
      form.querySelector("[data-save-status]").textContent =
        "Paylaşımınız eklendi.";
    } catch (e) {
      error(e);
    } finally {
      if (alive && gen === generation) {
        busy = false;
        composer();
      }
    }
  });
  unsubs.push(
    store.member((m) => {
      member = m;
      composer();
    }, error),
  );
  unsubs.push(
    store.books((rows) => {
      books = rows;
      library();
      if (!selected && rows.length) {
        const first = groupBooks(rows)[tab][0];
        if (first) selectBook(first.id);
      } else if (selected) {
        const updated = rows.find((b) => b.id === selected.id);
        if (updated) {
          if (updated.status !== selected.status) selectBook(updated.id);
          else {
            selected = updated;
            composer();
          }
        } else {
          generation++;
          postStop?.();
          selected = null;
          root.querySelector("[data-book]").hidden = true;
        }
      }
    }, error),
  );
  return stop;
}
