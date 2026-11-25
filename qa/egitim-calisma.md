# Eğitim çalışma alanı doğrulaması

Tam sayfa çalışma modu, sabit öğrenci/kazanım başlıkları ve tek tablo kaydırma alanı. Masaüstü kompakt/normal/büyük tercihleri; mobilde en az 44 px hücre düğmeleri. Hücre modern gözlem modalını açar. Hızlı mod açıklama/fotoğrafı isteğe bağlı açar. Kaydetme mevcut transaction/fotoğraf/onay zincirini kullanır. Kaydın ardından tablo konumu korunur.

Geçmiş görünümü mevcut `detay.asamalar` içeriğini gösterir; veritabanında bulunmayan eski sürümleri üretmez. Geri alma yalnız taslak aşama seçimini geri alır. Kalıcı kayıt silme veya geçmiş kayda otomatik dönüş yoktur.

## Çalıştırma

- `node --test tests/galeri-gozlem-approval-integration.test.mjs tests/galeri-onay-bildirimi.test.mjs tests/zeky-operasyon-push.test.mjs tests/egitim-onay-sonucu.test.mjs tests/zeky-veli-egitim-gelisim.test.mjs`
- `JSDOM_MODULE=/absolute/path/to/jsdom node --test qa/egitim-calisma-runtime.cjs`
- `PLAYWRIGHT_MODULE=/absolute/path/to/playwright node qa/egitim-calisma-ui.cjs` (Chromium ve WebKit kurulu olmalı).
- `EDUCATION_QA_PREPARE_ONLY=1 EDUCATION_QA_OUTPUT=/tmp/education-fixture node qa/egitim-calisma-ui.cjs` ağsız örnek tablo oluşturur. Fotoğraf/kayıt testleri gerçek öğrenci veya bildirim üretmez.

## Bildirim incelemesi

Gözlem transaction'ının tamamlanması ve yönetici bildirim teslimi ayrı sonuçlardır. Alıcı sorgusu, bildirim belgesi yazımı ve FCM kabulü ayrı raporlanır. Başarılı gözlemi tekrar kaydetme önerilmez. Yeniden deneme yalnız aynı galeri kimliğiyle bildirim fonksiyonunu çağırır; mevcut oturumdaki kaydedilmiş alıcılar atlanır. Belirsiz push otomatik yeniden gönderilmez.

25 Kasım canlı kuralların salt okunur incelemesi: personel alıcı listesini okuyabilir; oturum açan kullanıcı bildirim oluşturabilir; başka alıcıya ait bildirimi öğretmen sonraki oturumda güncelleyemez. Deterministik bildirim kimliği aynı olayın ikinci belgesini engeller, fakat oturumlar arası merge reddi başarı kabul edilmemelidir. Alıcılar mevcut aktif kurucu/müdürler ve mevcut sahip yedeğidir; rol/alıcı politikası değiştirilmedi.

Kullanıcının tekil uyarısına ait ham hata/olay kimliği alınmadı. Dolayısıyla yukarıdaki olası ret, o uyarının kesin kök nedeni diye sunulamaz. Kayıt/push hatası görünür kalır; kurallar genişletilmez. Ayrı P0 öğretmen koleksiyon okuma regresyonu bu uyarıyla karıştırılmamalıdır.

## Sınırlar

Safari masaüstünde sentetik gözlem kaydetme ve tabloya dönüş, 320 px iframe görünümü kontrol edildi. Chrome 320 px iframe görünümü ve hücreden doğru kazanım önseçimi kontrol edildi. Chrome son kayıt dönüşü başka oturumun tarayıcı kullanımı nedeniyle doğrulanamadı. Headless Chromium/WebKit bu makinenin işlem izinlerinde başlatılamadı. Gerçek iPhone/Android kamera, klavye, yön değiştirme ve canlı FCM teslim testi yapılmadı. Yayın öncesi bu kontroller gerekli.

## P0 entegrasyonu

PR #138 (3bccbfe) kapsamlı okuma düzeltmesi bu dala alındı. Hazır/hata/scope/epoch ve rol/program kontrolleri modal öncesinde ve kaydetme öncesinde korunur. Modal, tablo açılırken sunucudan doğrulanan müfredatı kullanır; geçmiş belgesini sunucudan okur. Kayıt sonrası okuma hatası başarıyla yazılan gözlemi geri almaz, tabloyu hata/yeniden dene durumuna getirir. Entegrasyon sonrası 87 odaklı test ve 7 DOM akış testi geçti. Taslak v238 önbellek zinciri hazırdır; yayın yapılmadı.
