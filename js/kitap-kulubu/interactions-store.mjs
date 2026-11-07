export const REACTIONS = Object.freeze(['❤️', '👏', '🌸', '😍']);
export function validateReply(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 500) throw Error('Yanıtınız 1–500 karakter olmalı.');
  return text;
}
export function createInteractionsStore(fb, db, auth) {
  const {doc, collection, query, orderBy, limit, startAfter, onSnapshot,
    getDocsFromServer, runTransaction, serverTimestamp, deleteDoc} = fb;
  const user = () => {
    if (!auth.currentUser) throw Error('Lütfen yeniden giriş yapın.');
    return auth.currentUser;
  };
  const path = (book, post, kind) => ['kitapKulubu', book, 'paylasimlar', post, kind];
  const rows = s => s.docs.map(d => ({...d.data(), id:d.id, cursor:d}));
  return {
    replies(book, post, next, error) {
      return onSnapshot(query(collection(db, ...path(book, post, 'yanitlar')),
        orderBy('createdAt', 'desc'), limit(20)), s => next(rows(s)), error);
    },
    async olderReplies(book, post, cursor) {
      return rows(await getDocsFromServer(query(collection(db, ...path(book, post, 'yanitlar')),
        orderBy('createdAt', 'desc'), startAfter(cursor), limit(20))));
    },
    reactions(book, post, next, error) {
      return onSnapshot(query(collection(db, ...path(book, post, 'tepkiler')),
        orderBy('updatedAt', 'desc'), limit(1000)), s => next(rows(s)), error);
    },
    ownReaction(book, post, next, error) {
      return onSnapshot(doc(db, ...path(book, post, 'tepkiler'), user().uid),
        s => next(s.exists() ? s.data().emoji : ''), error);
    },
    async reply(book, post, id, value) {
      const u = user(), text = validateReply(value);
      const ref = doc(db, ...path(book, post, 'yanitlar'), id);
      await runTransaction(db, async tx => {
        const existing = await tx.get(ref);
        if (user().uid !== u.uid) throw Error('Oturum değişti.');
        if (existing.exists()) {
          if (existing.data().authorUid === u.uid && existing.data().text === text) return;
          throw Error('Yanıt değişti. Lütfen yeniden deneyin.');
        }
        tx.set(ref, {text, authorUid:u.uid,
          authorName:String(u.displayName || 'Kulüp üyesi').slice(0,100), createdAt:serverTimestamp()});
      });
    },
    async react(book, post, emoji) {
      if (emoji !== '' && !REACTIONS.includes(emoji)) throw Error('Geçersiz tepki.');
      const u = user(), ref = doc(db, ...path(book, post, 'tepkiler'), u.uid);
      await runTransaction(db, async tx => {
        await tx.get(ref);
        if (user().uid !== u.uid) throw Error('Oturum değişti.');
        if (emoji) tx.set(ref, {emoji, updatedAt:serverTimestamp()});
        else tx.delete(ref);
      });
    },
    removeReply: (book, post, id) => deleteDoc(doc(db, ...path(book, post, 'yanitlar'), id)),
  };
}
