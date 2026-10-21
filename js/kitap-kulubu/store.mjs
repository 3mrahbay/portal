import { accessFor, profileEmail, validatePost } from "./core.mjs";
export function createStore(fb, db, auth) {
  const {
    doc,
    collection,
    getDoc,
    getDocFromServer,
    getDocs,
    setDoc,
    updateDoc,
    onSnapshot,
    query,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
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
  return {
    identity,
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
    join: () => {
      const u = current();
      return setDoc(memberRef(u.uid), {
        uid: u.uid,
        name: String(u.displayName || "Kulüp üyesi").slice(0, 100),
        status: "pending",
        updatedAt: serverTimestamp(),
      });
    },
    setMember: (uid, status) =>
      updateDoc(memberRef(uid), { status, updatedAt: serverTimestamp() }),
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
