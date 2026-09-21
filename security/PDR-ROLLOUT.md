# PDR çalışma alanı — yayın notu

Portal ve ZEKY aynı `js/pdr/{core,panel,store}.js` ve `panel.css` dosyalarını kullanır. Kaynaklardan biri değişirse diğer kopyası da güncellenmelidir.

## Davranış

- PDR ana sayfası: aktif dönem öğrencileri, alan bazında son gözlem, açık destek planları ve takip tarihi geçen işler.
- Öğrenci dosyası: mevcut gözlem/test verileri; görüşme, destek planı ve dönem değerlendirmesi; tarih aralığına göre kurum içi yazdırılabilir rapor.
- Yeni özel kayıtlar `pdrTakipKayitlari` koleksiyonuna yazılır. `veliylePaylas` daima `false`; bu ekranlar veli, öğretmen ve danışmaya kapalıdır. Mevcut açıkça paylaşılmış gözlem/test davranışı korunur.
- PDR tüm aktif velilerle ve kurum personeliyle bire bir sohbet başlatır. Personel seçimi özlük belgesinden değil `danismaPersonelRehberi` güvenli projeksiyonundan gelir. Bu projeksiyon yönetimde güncel olmalıdır.
- Kendi özlük/izin/fiş/ihtiyaç işlemleri mevcut modüllerdedir.
- Duyuru ve etkinlik ekler. Sunucu kuralı PDR'yi kendi oluşturduğu içerikleri değiştirmek/silmekle sınırlar.

## Yayın öncesi zorunlu doğrulama

Bu çalışma ortamında Firebase CLI hesabı bağlı değildi (`FIREBASE_CLI_LOGIN_REQUIRED`). Canlı kural dosyası alınamadı ve hiçbir kural yayımlanmadı. 19 Eylül tarihli yerel kopyada hazırlayıcının çalışması kontrol edildi; bu kopya güncel canlı kaynağın yerine geçmez.

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
