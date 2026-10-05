// One user gesture owns one Google popup. No automatic retries or redirects.
// Admission stays in the caller; this only protects asynchronous results from
// an older attempt or an identity that has already signed out/switched.
export function createGooglePopupFlow({ auth, openPopup, createProvider, admit, busy, notify, warn }) {
  let pending = null;
  let generation = 0;
  const sameAccount = (a, b) => !!a?.uid && a.uid === b?.uid &&
    String(a.email || '').toLowerCase() === String(b.email || '').toLowerCase();

  function invalidate() {
    generation++;
    pending = null;
    busy(false);
  }

  function start() {
    if (pending) return pending;
    const attempt = ++generation;
    busy(true);
    // Call synchronously, before any await: Safari must retain the click gesture.
    let popup;
    try { popup = openPopup(auth, createProvider()); }
    catch (error) { popup = Promise.reject(error); }
    const work = Promise.resolve(popup).then(async result => {
      const actor = auth.currentUser;
      const current = () => attempt === generation && auth.currentUser === actor && sameAccount(actor, result?.user);
      if (!current()) return false;
      await admit(result.user, current);
      return current();
    }).catch(error => {
      if (attempt !== generation) return false;
      const code = String(error?.code || '');
      // Closing or replacing the account picker is a normal interrupted flow.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return false;
      const safeCodes = new Set(['auth/popup-blocked', 'auth/network-request-failed', 'auth/unauthorized-domain', 'auth/operation-not-allowed', 'auth/internal-error', 'auth/invalid-credential', 'auth/account-exists-with-different-credential']);
      warn?.(safeCodes.has(code) ? code : 'unknown');
      const message = code === 'auth/popup-blocked'
        ? 'Google giriş penceresi açılamadı. Bu site için açılır pencereye izin verip yeniden deneyin.'
        : code === 'auth/network-request-failed'
          ? 'Google girişine bağlanılamadı. İnternet bağlantınızı kontrol edip yeniden deneyin.'
          : 'Google girişi tamamlanamadı. Giriş penceresini kapatıp yeniden deneyin. Google uygulamasında 400 hatası görüyorsanız Portalı Safari veya Chrome’da açın.';
      notify(message, 'error');
      return false;
    }).finally(() => {
      if (attempt !== generation) return;
      pending = null;
      busy(false);
    });
    pending = work;
    return work;
  }
  return { start, invalidate, isPending: () => pending !== null };
}
