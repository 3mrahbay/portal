import { membershipEffects } from "./membership-effects.mjs";
import { accessFor, profileEmail, validatePost } from "./core.mjs";
export function createStore(fb, db, auth, effects = membershipEffects) {
  const {
    doc,
    collection,
    getDoc,
    getDocFromServer,
    getDocs,
    getDocsFromServer,
    documentId,
    setDoc,
    updateDoc,
    onSnapshot,
    query,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    runTransaction,
  } = fb;
  const current = () => {
    if (!auth.currentUser) throw Error("Lütfen yeniden giriş yapın.");
    return auth.currentUser;
  };
  const memberRef = (uid) => doc(db, "kitapKulubuUyeler", uid);
  async function identity() {
    const user = current(),
      snap = await getDocFromServer(doc(db, "kullaniciKimlikleri", user.uid));
    const id = snap.exists() ? snap.data() : null;
    const parentEmail = profileEmail(id, "veli", user.email),
      staffEmail = profileEmail(id, "personel", user.email);
    const read = async (col, email) => {
      if (!email) return null;
      try {
        const d = await getDocFromServer(doc(db, col, email));
        return d.exists() ? d.data() : null;
      } catch (e) {
        if (e.code === "permission-denied") return null;
        throw e;
      }
    };
    const [parent, staff] = await Promise.all([
      read("veliler", parentEmail),
      read("personeller", staffEmail),
    ]);
    if (auth.currentUser?.uid !== user.uid) throw Error("Oturum değişti.");
    return {
      ...accessFor({ email: user.email, parent, staff }),
      uid: user.uid,
      name: String(user.displayName || "Kulüp üyesi").slice(0, 100),
    };
  }
  async function managementData({ signal, progress = () => {} } = {}) {
    const uid = current().uid;
    const check = () => {
      if (signal?.aborted || auth.currentUser?.uid !== uid) throw Error("Yükleme iptal edildi.");
    };
    if (!(await identity()).manage) throw Error("Bu alan yalnız okul yönetimi ve PDR için açıktır.");
    check();
    // Stable document-ID cursors avoid losing rows when moderation changes updatedAt.
    // Every request respects the existing rules; no collection-group query or new index.
    async function all(path, size) {
      const rows = [];
      let cursor;
      while (true) {
        check();
        const constraints = [orderBy(documentId()), limit(size)];
        if (cursor) constraints.push(startAfter(cursor));
        const page = await getDocsFromServer(query(collection(db, ...path), ...constraints));
        check();
        rows.push(...page.docs.map(d => ({ ...d.data(), id: d.id })));
        progress();
        if (page.docs.length < size) return rows;
        cursor = page.docs.at(-1);
      }
    }
    const books = await all(["kitapKulubu"], 100);
    const members = await all(["kitapKulubuUyeler"], 100);
    const posts = [];
    for (const book of books) {
      const rows = await all(["kitapKulubu", book.id, "paylasimlar"], 20);
      posts.push(...rows.map(p => ({ ...p, bookId: book.id })));
    }
    books.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    members.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
    posts.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    return { books, members, posts };
  }
  return {
    identity,
    managementData,
    books: (next, error) =>
      onSnapshot(
        query(
          collection(db, "kitapKulubu"),
          orderBy("date", "desc"),
          limit(100),
        ),
        (s) => next(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        error,
      ),
    member: (next, error) =>
      onSnapshot(
        memberRef(current().uid),
        (s) => next(s.exists() ? s.data() : null),
        error,
      ),
    members: (next, error) =>
      onSnapshot(
        query(
          collection(db, "kitapKulubuUyeler"),
          orderBy("updatedAt", "desc"),
          limit(100),
        ),
        (s) => next(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        error,
      ),
    join: async () => {
      const u = current();
      await runTransaction(db, async tx => {
        const ref = memberRef(u.uid), existing = await tx.get(ref);
        if (existing.exists()) {
          if (existing.data().status !== "pending") throw Error("Üyelik durumunuz değişti. Sayfayı yenileyin.");
          return;
        }
        tx.set(ref, {uid:u.uid,name:String(u.displayName || "Kulüp üyesi").slice(0,100),status:"pending",updatedAt:serverTimestamp()});
      });
      if (current().uid !== u.uid) throw Error("Oturum değişti.");
      return effects(u,u.uid,"pending");
    },
    setMember: async (uid, status) => {
      const u = current();
      if (!(await identity()).manage) throw Error("Yönetim yetkisi gerekli.");
      if (status === "approved") await effects(u,uid,"prepare");
      await runTransaction(db, async tx => {
        const ref = memberRef(uid), existing = await tx.get(ref);
        if (!existing.exists()) throw Error("Üyelik bulunamadı.");
        if (existing.data().status === status) return;
        tx.update(ref,{status,updatedAt:serverTimestamp()});
      });
      if (current().uid !== u.uid) throw Error("Oturum değişti.");
      if (status === "approved") return effects(u,uid,"approved");
    },
    posts: (id, next, error) =>
      onSnapshot(
        query(
          collection(db, "kitapKulubu", id, "paylasimlar"),
          orderBy("createdAt", "desc"),
          limit(20),
        ),
        (s) => next(s.docs.map((d) => ({ id: d.id, ...d.data(), cursor: d }))),
        error,
      ),
    older: async (id, cursor) => {
      const s = await getDocs(
        query(
          collection(db, "kitapKulubu", id, "paylasimlar"),
          orderBy("createdAt", "desc"),
          startAfter(cursor),
          limit(20),
        ),
      );
      return s.docs.map((d) => ({ id: d.id, ...d.data(), cursor: d }));
    },
    post: async (bookId, postId, text, image) => {
      const u = current(),
        content = validatePost(text, image);
      const ref = doc(db, "kitapKulubu", bookId, "paylasimlar", postId);
      try {
        await setDoc(ref, {
          ...content,
          authorUid: u.uid,
          authorName: String(u.displayName || "Kulüp üyesi").slice(0, 100),
          createdAt: serverTimestamp(),
          deleted: false,
        });
      } catch (error) {
        const existing = await getDoc(ref).catch(() => null);
        if (
          !existing?.exists() ||
          existing.data().authorUid !== u.uid ||
          existing.data().text !== content.text ||
          existing.data().image !== content.image
        )
          throw error;
      }
    },
    remove: (bookId, postId) =>
      updateDoc(doc(db, "kitapKulubu", bookId, "paylasimlar", postId), {
        text: "",
        image: "",
        deleted: true,
      }),
    saveBook: (id, data) =>
      setDoc(doc(db, "kitapKulubu", id), {
        ...data,
        updatedAt: serverTimestamp(),
      }),
    archive: (id, status) =>
      updateDoc(doc(db, "kitapKulubu", id), {
        status,
        updatedAt: serverTimestamp(),
      }),
  };
}
