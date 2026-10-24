export const INITIAL_BOOK = Object.freeze({
  title: "Çocuklar İçin Beş Sevgi Dili",
  authors: "Gary Chapman & Ross Campbell",
  leader: "Psikolog Şeyma Baydaroğlu",
  date: "2026-10-22T19:00:00+03:00",
  status: "active",
  purpose:
    "Çocuğumuzla bağımızı küçük, sevgi dolu anlarla beslemek için buluşuyoruz.",
  place: "Buluşma yeri için okul ekibinden bilgi alabilirsiniz.",
});
export const INITIAL_ID = "2026-10-bes-sevgi-dili";

export const SECOND_ID = "2026-11-ebeveynligi-hissetmek";
export const SECOND_BOOK = Object.freeze({
  title: "Ebeveynliği Hissetmek",
  authors: "Jennifer Day",
  leader: "Psikolog Şeyma Baydaroğlu",
  date: "2026-11-26T19:00:00+03:00",
  status: "active",
  purpose: "Annelere özel ikinci buluşmamızda, günlük telaşın içinde hem kendimizi hem çocuğumuzu duymaya alan açıyoruz. Ebeveynliği Hissetmek eşliğinde, çocuğumuzun yanında tüm dikkatimizi vererek bulunmayı ve kendi iç sesimize kulak vermeyi birlikte keşfedeceğiz.",
  place: "Buluşma yeri için okul ekibinden bilgi alabilirsiniz.",
});
export function eventDetails(id) {
  if (id === SECOND_ID) return {
    why: "Her şeyi doğru yapmaya çalışırken kendimizi nasıl hissediyoruz? Bir fincan çay eşliğinde durup soluklanmak, başka annelerle ortak duygularımızı keşfetmek ve çocuğumuzla bağ kurduğumuz küçük anları çoğaltmak için buluşalım. Dilerseniz paylaşın, dilerseniz yalnızca dinleyin.",
    topics: [
      "Çocuğumuzun yanında olmakla bütün dikkatimizle onunla olmak arasında neler değişiyor?",
      "Kendi duygularımızı fark etmek, çocuğumuzu dinleyişimizi nasıl etkiliyor?",
      "Tavsiyeler arasında kendi iç sesimize nasıl alan açabiliriz?",
      "Günlük telaşta bağ kurmak için hangi küçük molaları deneyebiliriz?",
    ],
    preparation: "Okurken sizi durup düşündüren bir cümleyi işaretleyin. Çocuğunuzla yakınlık hissettiğiniz küçük bir anı ve aklınıza takılan bir soruyu düşünün; dilerseniz not alın. Kitabınızı ve merakınızı getirmeniz yeterli. Kitabı bitiremediyseniz de aramıza katılabilirsiniz.",
  };
  return {
    why: "Kendinize bir sohbet molası verin. Diğer annelerin deneyimlerinden ilham alın; evde deneyebileceğiniz küçük fikirlerle ayrılın. Dilerseniz paylaşın, dilerseniz yalnızca dinleyin.",
    topics: id === INITIAL_ID ? [
      "Kitaptaki beş sevgi dili günlük yaşamda nasıl karşılık buluyor?",
      "Çocuğumuz hangi anlarda sevildiğini hissediyor?",
      "Yoğun günlerde bağ kurmak için hangi küçük adımları atabiliriz?",
    ] : ["Kitabın bize düşündürdükleri", "Kendi yaşamımızdan örnekler ve sorularımız", "Birlikte deneyebileceğimiz küçük adımlar"],
    preparation: "Kitabınızı, aklınızda kalan bir cümleyi ve paylaşmak istediğiniz bir soruyu getirebilirsiniz. Kitabı bitiremediyseniz de sohbetimize katılabilirsiniz.",
  };
}

export const MAX_IMAGE = 280000;
export function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
export function profileEmail(identity, profile, email) {
  if (identity === null) return String(email || "").toLowerCase();
  if (identity.aktif === false || identity.primaryProfile !== profile)
    return "";
  const flat = String(identity.refEmail || "").toLowerCase(),
    nested = identity.profiles?.[profile];
  const old =
    nested?.aktif !== false ? String(nested?.refEmail || "").toLowerCase() : "";
  return flat && old && flat !== old ? "" : flat || old;
}
export function accessFor({ email, parent, staff }) {
  const admin = String(email || "").toLowerCase().trim() === "emrahby@gmail.com";
  const team = staff?.durum === "aktif";
  const yakinlik = String(parent?.yakinlik || parent?.rol || "")
    .toLocaleLowerCase("tr-TR")
    .trim();
  const mother = parent?.onaylandi === true && yakinlik === "anne";
  return {
    read: admin || team || mother,
    staff: admin || team,
    manage:
      admin || (team && ["kurucu_mudur", "mudur", "pdr"].includes(staff.rol)),
  };
}
export function validatePost(text, image = "") {
  const clean = String(text || "").trim();
  if (clean.length > 2000)
    throw Error("Mesajınız en fazla 2000 karakter olabilir.");
  if (!clean && !image) throw Error("Bir mesaj yazın veya fotoğraf seçin.");
  if (
    image &&
    (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) ||
      image.length > MAX_IMAGE)
  )
    throw Error("Fotoğraf hazırlanamadı. Daha küçük bir fotoğraf seçin.");
  return { text: clean, image };
}
export function dateLabel(date) {
  const d = new Date(date);
  return Number.isNaN(+d)
    ? "Tarih belirlenecek"
    : d.toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
export function canPost(access, member, book) {
  return (
    access.read &&
    book?.status === "active" &&
    (access.staff || member?.status === "approved")
  );
}
export function groupBooks(books) {
  return {
    active: books.filter((b) => b.status === "active"),
    archive: books.filter((b) => b.status === "archived"),
  };
}
