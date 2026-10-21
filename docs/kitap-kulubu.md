# Kitap Kulübü

Onaylı anne hesapları ve aktif okul ekibi kitaplığı ve paylaşımları okuyabilir. Kulübe katılım başvurusu okul yönetimi/PDR tarafından onaylanan anneler ile aktif okul ekibi mesaj ve fotoğraf ekleyebilir. Yönetim/PDR yeni okuma ekler, geçmiş okumayı arşivler veya yeniden açar. Arşivde yeni paylaşım yapılmaz; mevcut içerik korunur.

## Veri ve yayın

- Ortak Firebase projesi: bcka-site. Kitaplar `kitapKulubu`, katılım kayıtları `kitapKulubuUyeler`; paylaşımlar kitap altındaki `paylasimlar` koleksiyonunda.
- Bir mesaj en fazla 2000 karakter ve bir fotoğraf içerir. Fotoğraf JPEG olarak küçültülür, EXIF temizlenir, en fazla 280000 karakterlik veri URI'si aynı korumalı belgede saklanır. Dışarı açık fotoğraf URL'si üretilmez.
- Her sorgu sınırlandırılır; paylaşımlar 20'şer yüklenir. Kitap ve üyelik ekranları en fazla 100 kayıt gösterir.
- Mevcut UID/profil eşlemesi ve `veliler.rol=anne`, `onaylandi=true` doğrulanır. Profil yetkileri sunucudan okunur. Arayüzü gizlemek tek güvenlik önlemi değildir.
- Portal deposundaki security/kitap-kulubu.rules.snippet mevcut canlı kurallara prepare-kitap-kulubu-rules.mjs ile eklenir. Geniş varsayılan kural yeni koleksiyonları dışlar. Önce emülatör testi, sonra sunucuda derleme; canlı ruleset değişmişse işlem durdurulup yeniden birleştirilir.
- İlk gerçek etkinlik kimliği: 2026-10-bes-sevgi-dili. Test anneleri, mesajları veya geçmiş kitapları canlıya aktarılmaz.
- Geri alma: ön yüz değişikliğini geri alın; gerekirse kaydedilmiş önceki Firestore ruleset sürümüne dönün. Kitap/paylaşım verilerini silmeyin. Mobil paketin üretimi ile mağaza üzerinden kullanıcılara dağıtım ayrı adımlardır.

## Kontrol

Portal: 1158 Node testi. ZEKY: 968 Node testi, 52 Python testi (yerelde 3 araç koşullu atlama). Ortak izinler: 62 Firestore emülatör senaryosu. Tarayıcı: anne/katılımcı/ekip/yönetici/baba görünümleri, mesaj/fotoğraf ekleme, katılım onayı, arşiv, 390px mobil taşma kontrolü.
