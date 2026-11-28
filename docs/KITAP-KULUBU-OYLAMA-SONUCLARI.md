# Oylama sonuç bildirimleri

`kitapKulubuOylamaSonucBildir` yalnız oylamanın `open` durumundan `closed` durumuna geçişinde çalışır. Yönetimin mevcut erken kapatma işlemi aynı olayı üretir. Kapalı kaydın sonraki güncellemeleri, oy güncellemeleri ve tekrarlanan kapatma yeni sonuç bildirimi üretmez.

`kitapKulubuOylamaSureleriniKapat` Cloud Scheduler ile beş dakikada bir açık oylamaları kontrol eder. Süresi dolanı bir Firestore transaction içinde kapatır; sayaçlar ve seçenekler değişmez. Oy kaydı aynı belgeyi kullandığından son oy/kapatma yarışı tutarlı sonuçla biter. Normal koşullarda süresi dolan oylama için birkaç dakikalık kontrol/geçiş gecikmesi olabilir. İstemci zaten bitiş anından itibaren oy veremez.

Zamanlanmış görev, `2026-11-28T07:45:41.000Z` öncesinde bitmiş tarihsel oylamaları değiştirmez ve bunlara toplu sonuç bildirimi göndermez. Yayın öncesinden açık olan ve ileride bitecek oylamalar kapsam içindedir. Tek alan durum sorgusu ve belge kimliğiyle 100'lük sayfalama kullanılır; yeni composite index veya güvenlik kuralı gerekmez. Görev tek instance/concurrency ile çalışır; başarısız çalıştırma için en fazla üç yeniden deneme ve 900 saniyelik retry sınırı yapılandırılmıştır. Sonraki periyodik çalışma kalan açık oylamaları tekrar kontrol eder.

Sonuç bildirimi `kitap_kulubu_oylama_sonuc` türü ve ayrı deterministik oylama/alıcı kimliği kullanır. Açılış bildirimini ezmez, okundu bilgisini sıfırlamaz, silinmiş bildirimi geri getirmez. Dağıtım, mevcut onaylı anne ve cihaz/tercih kontrollerini paylaşır. Telefon bildirimi Duyurular tercihi kapalıysa gönderilmez; uygulama içi kayıt mevcut davranışla korunur. Tercihler değiştirilmez. Eventarc tekrarlarında işleyici çalışabildiği sürece 24 saati geçmiş olaylar bırakılır; platform denemeleri bundan daha uzun sürebilir.

Portal ve ZEKY bildirimi mevcut `kitap-kulubu.html?poll=<id>` bağlantısıyla sonuçları açar. Beraberlikte en yüksek tüm seçenekler gösterilir; hiç oy yoksa kazanan üretilmez. Kişisel tercihler veya özel kitap başlığı kilit ekranına taşınmaz. Sonuç gerçek kitap/buluşma kaydını otomatik değiştirmez.

Yayın sırası: Portal hedef/tür desteği → yalnız sonuç event işlevi → yalnız zamanlanmış kapatma işlevi. Zamanlanmış kapatma işlevi sonuç tetikleyicisinden önce etkinleştirilmemelidir. Mevcut beş kulüp işlevinin tekrar yayımlanması gerekmez. ZEKY kodu birleştirilir; mağaza/TestFlight gönderimi bekler. Fiziksel cihaz teslim ve tıklama testi ayrı yapılmalıdır.

Doğrulama: gerçek yerel Firestore transaction testleri; eşzamanlı scheduler, yönetim kapatması ve oy yarışları; 100'den fazla oylama; tarihsel/future/bozuk kayıtların korunması; ayrı açılış/sonuç kayıtları; okundu/silindi durumları; tercih ve üyelik iptali. Portal/ZEKY DOM ve native bildirim hedefi testleri hem açılış hem sonuç türünü kapsar. Gerçek üyelere test bildirimi gönderilmez.
