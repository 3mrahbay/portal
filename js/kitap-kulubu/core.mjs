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
  const admin = email?.toLowerCase() === "emrahby@gmail.com";
  const team = staff?.durum === "aktif";
  return {
    read:
      admin || team || (parent?.onaylandi === true && parent?.rol === "anne"),
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
