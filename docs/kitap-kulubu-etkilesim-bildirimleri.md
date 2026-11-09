# Kitap Kulübü etkileşim duyuruları

Yeni fotoğraf yanıtı ve ilk emoji kaydı, tüm onaylı ve erişimi devam eden kulüp üyelerinin kişiye özel `bildirimler` kutusuna yazılır. İşlemi yapan üye de dahildir. Portal ve ZEKY Duyurular sayfaları bu kayıtları gösterir. Bildirim gerçek yorum metni, kişi adı veya fotoğraf içermez. Gönderi bağlantısı mevcut kulüp erişim kurallarından geçer.

Sunucu Auth hesabını (silinmiş/kapalı hesap hariç), UID kimlik eşlemesini, güncel anne/personel profilini ve onaylı üyeliği doğrular. Alıcı adresi kullanıcı girdisinden değil Auth kaydından gelir. Kişi bazlı işlem, üyelik ve fotoğraf erişimini tekrar okur. Üye taraması 100'lük sayfalarla sonuna kadar ilerler. Ek istemci yazma izni veya genel duyuru kaydı yoktur.

Her yanıt kimliği başına tek bildirim; aynı kişinin aynı fotoğraftaki ilk emoji kaydı başına tek bildirim. Emoji değiştirme, kaldırma ve yeniden ekleme yeni bildirim üretmez. Tekrarlanan/kısmen tamamlanan tetikleyiciler aynı kayıt kimlikleriyle devam eder; okundu durumu sıfırlanmaz. Eski içerik taranıp bildirilmez. Silinmiş fotoğraf/yanıt veya arşivlenmiş kitap için bekleyen olay atlanır. Gönderimden sonra üyelik kaldırılırsa eski genel bildirim kalabilir; fotoğrafa erişim mevcut kurallarla korunur.

Bu sürüm uygulama içi bildirimdir; e-posta veya FCM göndermez. Mağaza gönderimi beklemede.

Test: `cd functions && npm ci && npm test`.
Yayın: bu dizinden `firebase deploy --only functions:kitap-kulubu --project bcka-site`.
Kaynak: https://firebase.google.com/docs/functions/firestore-events (en az bir teslimat; tekrar güvenli işlem gerekir).
