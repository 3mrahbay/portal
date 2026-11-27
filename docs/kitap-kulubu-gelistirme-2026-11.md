# Anneler Kitap Kulübü — 28 Kasım 2026

## Mevcut mimari ve teşhis

Portal `js/kitap-kulubu`, ZEKY `www/js/kitap-kulubu` ve `zeky-backend/prod-work/kitap-kulubu` incelendi. Aynı Firebase bcka-site, UID üyeliği ve mevcut anne/personel erişimi kullanılıyor. Yönetim kurucu müdür/müdür/PDR; aktif öğretmen erişimi korunuyor. Fotoğraf yanıtı ve emoji zaten mevcut; yeniden yazılmadı.

Canlı işlev listesinde kulüp tetikleyicileri yok. Ana daldaki etkileşim kodu yalnız uygulama içi bildirim oluşturuyor, FCM göndermiyor; yeni paylaşım tetikleyicisi de yok. Bu üç boşluk giderilmek üzere kod hazırlandı. Canlıya yayın yapılmadı.

## Hazırlanan değişiklik

- Bekleyen talepler başlangıçta filtrelenir; Üyeler sekmesi bütün durumları gösterir. Türkçe isim araması ve görünür/toplam sonuç sayısı eklendi. Filtreler ek sunucu yazımı yapmaz.
- Yeni metin/fotoğraf paylaşımı bildirimleri Portal ve ZEKY'de tanınır. Eski bir metin gönderisine doğrudan bağlantı kaydırması eklendi.
- Backend yanıt/emoji/yeni paylaşım için kişiye özel kayıt ve FCM üretir. Mevcut Duyurular tercihi, güncel UID/üyelik ve cihaz sahipliği kontrol edilir. Genel bildirim metni kullanılır.
- Yeni izin, üye taşıma, rıza değişimi, eski içeriği yeniden bildirme veya gerçek veliyle test yoktur.

## Araştırma ve seçim

| Örnek | İncelenen özellik | Bir Çiçek için karar |
|---|---|---|
| Bookclubs | Kitap/buluşma oylaması | İkinci aşama: yönetimin açtığı seçenekler, kişi başına tek oy ve sonuç özeti |
| Bookclubs | Kulüp bazlı iletişim bilgisi gizliliği | Telefon/e-posta üye listesine eklenmez; mevcut okul kimliği yeterli |
| Fable | Bölüm bazlı spoiler korumalı sohbet ve okuma durakları | Üçüncü aşama: kitap altında bölüm başlıkları, okumayan için içerik kapalı |

Kaynaklar (28 Kasım 2026):
- https://help.bookclubs.com/support/solutions/articles/39000026568-how-to-create-a-poll
- https://help.bookclubs.com/support/solutions/articles/39000033126-what-can-other-readers-see-on-my-profile-
- https://fable.co/club-features

## Aşamalı uyarlama

1. **Güvenilir temel — bu değişiklik:** bildirim, üye arama, bekleyen talep iş akışı; sunucu/istemci yayını ardından kontrollü cihaz testi. Kabul: onaylı üye görür, engelli/üyelik dışı alıcıya gönderilmez, bildirim tercihi kapalıysa push yok, aynı olay ikinci kez ses çıkarmaz.
2. **Buluşma ve ortak seçim:** kitap altında `anketler/{id}/oylar/{uid}` ve `katilimlar/{uid}`. Yönetim seçenekleri/süreyi belirler; onaylı üye kendi oy/katılımını değiştirir. Özet sayıları sunucu üretir; katılmayanların listesi toplulukta gösterilmez. Yeni kitap ve tarih değişikliği bildirimleri ayrı ve tekilleştirilmiş olaydır. Eski kitap belgeleri değişmeden çalışır. Kabul: kapanmış ankete oy yok, aynı UID ikinci oy oluşturamaz, yönetim yetkisi iptalinde işlem kesilir.
3. **Güvenli sohbet:** kitap altında `konular/{id}`; bölüm aralığı ve spoiler etiketi, haftalık PDR sorusu, metin yanıtları. İçerik şikâyeti yalnız yönetimin okuyabildiği ayrı koleksiyona gider; mevcut kurallar genişletilmeden önce emülatörde yetki matrisi test edilir. Özel mesaj, herkese açık profil ve çocuk verisi içeren eşleştirme eklenmez. Kabul: üyelik iptali erişimi keser, şikâyet eden kişi topluluğa ifşa olmaz, yönetim işlem kaydı tutulur.
4. **İsteğe bağlı katılım:** sessiz okuma buluşması, kitap öneri rafı, haftalık bildirim özeti. Ayrı kulüp bildirim tercihi ve sıklık seçimi eklenir; eski Duyurular kapalı ayarı açık hale getirilmez. Puan tablosu ve anneleri/çocukları kıyaslama yapılmaz. Önce küçük, gönüllü bir grupla kullanım geri bildirimi alınır.

Her aşama Portal ve ZEKY ortak veri sözleşmesiyle ayrı değişiklik olarak hazırlanmalı. Şema eklemeleri eski istemcilerle uyumlu olmalı; özellik bayrağıyla açılmalı. Fotoğraflar üyelik sınırında kalır; açık sosyal medya izni veya dış paylaşım varsayılmaz. KVKK metni, saklama süresi ve silme/şikâyet süreci yeni veri alanları uygulanmadan okulun mevcut politikasıyla eşleştirilir; bu rapor hukuki uygunluk onayı değildir.

## Kalan açıklar

Yayın, gerçek cihaz teslimi, yeni buluşma/tarih bildirimi, ayrı kulüp tercihi ve sonraki sosyal özellikler tamamlanmadı. Üyelik mail/push Apps Script işçilerinin canlı aktivasyonu bu çalışmada doğrulanmadı. Mevcut üyelerin cihaz tokenları taranmadı. Otomatik Chrome başlatma ortamda engellendi; yönetim DOM testine ek olarak uygulama içi tarayıcıda 390 px taşma, Türkçe arama ve sentetik onay akışı doğrulandı.
