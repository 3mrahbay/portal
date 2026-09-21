# PDR çalışma alanı — yayın notu

Portal ve ZEKY aynı `js/pdr/{core,panel,store}.js` ve `panel.css` dosyalarını kullanır. Kaynaklardan biri değişirse diğer kopyası da güncellenmelidir.

## Davranış

- PDR ana sayfası: aktif dönem öğrencileri, alan bazında son gözlem, açık destek planları ve takip tarihi geçen işler.
- Öğrenci dosyası: mevcut gözlem/test verileri; görüşme, destek planı ve dönem değerlendirmesi; tarih aralığına göre kurum içi yazdırılabilir rapor.
- Yeni özel kayıtlar `pdrTakipKayitlari` koleksiyonuna yazılır. `veliylePaylas` daima `false`; bu ekranlar veli, öğretmen ve danışmaya kapalıdır. Mevcut açıkça paylaşılmış gözlem/test davranışı korunur.
- PDR tüm aktif velilerle ve kurum personeliyle bire bir sohbet başlatır. Personel seçimi özlük belgesinden değil `danismaPersonelRehberi` güvenli projeksiyonundan gelir. Bu projeksiyon yönetimde güncel olmalıdır.
- Kendi özlük/izin/fiş/ihtiyaç işlemleri mevcut modüllerdedir.
- Duyuru ve etkinlik ekler. Sunucu kuralı PDR'yi kendi oluşturduğu içerikleri değiştirmek/silmekle sınırlar.

## Yayın prosedürü

CLI hesabı bağlı değildi; güncel canlı kurallar Firebase Console üzerinden okundu. Aşağıdaki prosedür yeniden yayın yapılırken uygulanır. 21 Eylül yayın durumu aşağıdadır.

1. Canlı Firestore kurallarını ve ruleset kimliğini dışarı alın.
2. `node security/prepare-pdr-rules.mjs LIVE.rules REVIEW.rules` ile yalnız yeni koleksiyon ve üç PDR yazma iznini birleştirin. Araç yayımlamaz; beklediği blokları bulamazsa durur.
3. Güncel tam kuralları Emulator'da doğrulayın: PDR ve yönetim özel kayıt okuyup yazabilmeli; veli/öğretmen/danışma/koordinatör reddedilmeli; PDR başka kişinin duyuru/etkinliğini değiştirememeli; kullanıcı/öğrenci/dönem/oluşturan alanları değiştirilmemeli; özel kayda `veliylePaylas:true` yazılamamalı.
4. PDR hesabıyla iki platformda oluştur → yenile → karşı platformda oku → sonuç ekle akışını doğrulayın. Personel ve veli sohbetleri birbirinden ayrılmalı; yalnız katılımcının sohbetleri görünmeli.
5. Kurallar doğrulandıktan sonra portalı ve ZEKY web varlıklarını yayımlayın. Android için yeni AAB ve cihaz testi gerekir. Bu değişiklik Google Play'e otomatik sürüm göndermez.

Canlıya geçmeden eski ruleset kimliğini ve uygulama commitlerini kaydedin. Sorun halinde önce istemci sürümünü geri alın; yeni takip kayıtlarını silmeyin.

## Yerel doğrulama

`node --test tests/*.test.mjs` mevcut portal regresyonlarını ve PDR doğrulama/rapor/kayıt testlerini çalıştırır. Bu testler Firestore Emulator ve gerçek cihaz testlerinin yerine geçmez.

Tarayıcıda ortak panelin masaüstü ve 390 px mobil görünümü; oluşturma, sonuçla güncelleme, hata sonrası form korunması, öğrenci arama, rapor ve yetkisiz kullanıcı reddi sentetik verilerle doğrulandı. `node tests/pdr-ui-smoke.cjs` Playwright ile bu senaryoyu tekrarlar. Gerekirse `PLAYWRIGHT_CHROMIUM_EXECUTABLE` kurulu Chromium yolunu belirtir.

Android WebView'de rapor görüntülenebilir; sistem yazdırması desteklenmediğinden PDF/yazdırma için portal yönlendirmesi gösterilir. Native paylaşım/yazdırma eklentisi bu değişiklikte eklenmedi.


## 21 Eylül devam çalışması — güncel durum

Firebase Console açık oturumu üzerinden güncel yıldızlı kurallar okundu (15 Eylül 22:07 sürümü). CLI oturumu hâlâ bağlı değil. Güncel tam kurallara yeni PDR koleksiyonu, PDR'nin kendi duyuru/etkinliklerini yazması ve güvenli personel rehberini okuması işlendi. Genel yönetici jokeri yeni takip koleksiyonunda veri doğrulamasını aşamaz.

Kural hazırlayıcıdaki `String.replace` dolar işareti sorunu callback kullanılarak düzeltildi; tam kaynakla Firestore Emulator derlemesi ve 50 yetki/veri değişmezliği kontrolü geçti. Portal 80/80 test geçti. Kurallar kullanıcı onayıyla 21 Eylül 2026 12:54 (Türkiye) yayımlandı. Yayımlanan içerik test edilen dosyayla birebir eşleşti.

ZEKY öğrenci paneli finans içeren dönem alt belgelerini okumaz. Portal ile aynı aktif dönem özetini kullanır. PDR mesaj alıcıları da aktif döneme göre filtrelenir.

Güncel kuralların önceki/test edilmiş sürümleri ve SHA-256 değerleri özel ZEKY deposundaki `security/pdr-20260921/` altında saklıdır. Bunlar halka açık portal deposuna eklenmez.

Portal PR #31 ana dala birleştirildi. Pages dağıtımı 35585901540 başarılı; canlıdaki dört ortak PDR modülü test edilen dosyalarla aynı. ZEKY PR #12 kendi taban dalına birleştirildi. Android SDK kurulumundaki kaldırılmış tools paketi hatası düzeltildi; İmzalı ZEKY 1.0.6 (versionCode 10) AAB, 35586695422 numaralı çalıştırmada başarıyla üretildi.

Kalan: gerçek PDR hesabıyla iki platform arası kayıt/iletişim doğrulaması, Android cihaz kontrolü. Play Store dağıtımı yapılmadı. Sunucu simülasyonu bu son kontrollerin yerine geçmez.
