# Özlük / Puantaj son inceleme — 28 Kasım 2026

Durum: yayın onayı değildir. Yeni değişiklikler taslak incelemededir; canlı veri değiştirilmedi.

## Dağıtım durumu

- Portal #147, bu son incelemeden önce 27 Kasım 2026 21:51:17 UTC'de ana dala birleştirilmiş. GitHub Pages `43db609f5709f05773cc2dec82e21ab86bee46c8` için başarılı yayın kaydı gösteriyor. Ana dala birleştirme Portal'da yayın tetikleyebilir.
- Bu incelemede alınan canlı Firestore kurallarında `ozlukYetkili` paketi bulunmuyor. Arayüz ve kural dağıtımı şu anda aynı seviyede değil. Gerçek müdür oturumunda audit yazımının çalıştığı varsayılmamalı.
- Bu incelemede merge, Firebase deploy veya mağaza yayını yapılmadı. Portal düzeltmesi ayrı taslak dalda; ZEKY #114 taslak kalır.

## Düzeltilen sorunlar

1. Portal izin formunun gönderdiği `guncellendi`, yeni kuralların alan listesinde eksikti; gerçek form talepleri reddedilecekti. Alan/tip/sınır eklendi.
2. ZEKY'nin üç yönetim ekranındaki ret akışına gerekçe ve hatada tekrar deneme eklendi. Genel onay kutusu izin kararlarını ortak atomik karar + audit hizmetine yönlendirir.
3. Portal hata yakalaması yanlışlıkla randevu reddinde bulunuyordu. İzin kararına taşındı; başarısızlıkta gerekçe korunur, düğmeler yeniden açılır. Boş/kesirli/onay aralığı dışındaki günler engellenir, sıfır korunur.
4. Eski `onaylananGun: null` kayıtları karar verebilir durumda tutuldu. Ret gerekçesi iki istemci ve kurallarda en az 5 karakter.
5. Çıkış düzeltmesinin hareket/işlem izi aynı gün ve aynı aktöre bağlandı. Mevcut hareketin arkasına sonradan iz ekleyerek eşleşme kurulması engellendi.
6. ZEKY günlük yuvarlaması kaldırıldı; ham dakika toplamı Portal ile eşleşir, görüntüleme sonunda yuvarlanır. Girişi olmayan gün çalışılan gün sayılmaz. Aylık izin sayısı gün değil talep olarak etiketlenir; tüm ayı kapsayan izinler dahil edilir. İzin okuma hatası sıfır talep gibi gösterilmez.
7. ZEKY mazeret kısayolu sunucunun koruduğu `personelDurum` belgesine yazmak yerine gerçek izin talebine yönlendirilir. Eski kararları geri alma düğmesi kaldırılır; geçmiş korunur. Eski durum onayları yeni talep akışına yönlendirilir; eski kayıtlar silinmez.
8. Portal belge bağlantılarında HTTPS kontrolü, ZEKY onay penceresinde kişi/etki metinlerinde HTML kaçışı eklendi. Personel listesi okunamadığında rapor üretimi durur.

## Doğrulama

- 43 Portal/iki depo uyumluluk testi; 27 ZEKY personel testi: hepsi geçti, atlanan test yok.
- 45 yerel Firestore emulator kontrolü: gerçek iki formun payload'ı, iki yönlü karar, kimlik/durum sahteciliği, sahiplik, muhasebe/koordinatör/doğrulanmamış yönetici, silme/değiştirme yasakları, audit atomikliği, eşzamanlı karar, eşleşmeyen/sonradan eklenen düzeltme izi. Üretim kaydı kullanılmadı.
- Ortak süre ve karar dosyalarının birebir eşitliği doğrulandı. Üç güne yayılan saniyeli hareketlerde günlük yuvarlama farkı için regresyon var.
- 19 inline script ve ZEKY veri dosyası sözdizimi kontrolünden geçti; diff whitespace kontrolü temiz.
- Chrome'da gerçek paylaşılan ret modülüyle yerel örnek: 320 px viewport / 320 px sayfa, 288 px dialog. İlk yazma hatasında gerekçe korunur, ikinci deneme başarılı, odak açan düğmeye döner. Bu, fiziksel iOS/Android WebView testi değildir.

Testlerin yeniden çalıştırılması (Portal checkout içinde, jsdom ve Firebase test araçları yerel test bağımlılıkları olarak kurulu olmalı):

```sh
ZEKY_REPO_PATH=/path/to/zeky-app node --test tests/personel*.test.mjs
node security/prepare-ozluk-rules.mjs /path/to/fresh-live.rules /path/to/candidate.rules
# Yalnız demo-ozluk projesi / yerel emulator içinde:
ZEKY_REPO_PATH=/path/to/zeky-app OZLUK_RULES_FILE=/path/to/candidate.rules node tests/ozluk-rules-emulator.cjs
```

ZEKY checkout içinde: `node --test tests/personel*.test.mjs`.
İki depo yolu verilmezse çapraz depo testleri atlanır; yayın kanıtı için atlanmadan çalıştırılmalıdır.

## Yayından önce kapanması gerekenler

- Gerçek cihazlarda iOS/Android build, App Check, QR giriş/çıkış, mola, çevrimdışı hata ve yeniden giriş. Çağrılabilir devam fonksiyonunun üretim kaynağı bu iki depoda doğrulanamadı; Admin SDK yazımı ve idempotency ayrıca incelenmeli.
- Staging'de öğretmen, müdür, koordinatör, muhasebe, veli, arşiv personeli ve e-posta eşleme hesabı matrisi. Yönetici `email_verified` şartını sağlamalı. Kendi kaydı/başkasının kaydı sorguları, belge yükleme/okuma ve audit görünümü denenmeli.
- Sağlık belgesinin gerçek barındırma yolunu kontrol edin: ZEKY formu Bunny yüklemesine işaret ediyor; Portal/Storage ve CDN bağlantıları ayrı doğrulanmalı. HTTPS olması erişim yetkisi veya KVKK uyumu kanıtı değildir. Saklama süresi, erişim iptali ve kişisel veri içermeyen log politikası belirlenmeli.
- Eski ZEKY yönetici sürümleri zorunlu audit ile uyumsuz. Yönetici cihazları güncellenmeden kuralları etkinleştirmeyin veya yönetim kararlarını yalnız güncel Portal'a yönlendiren kontrollü geçiş uygulayın. Eski mazeret durum kayıtları yeni izin talebine otomatik dönüştürülmedi.
- Portal ve ZEKY izin bakiyesi/ücret etkisi alanları bütünüyle birleştirilmedi. Çalışma süresi ve karar/audit uyumluluğu test edildi; bordro veya tüm izin bakiyelerinin eşitliği iddia edilmiyor. Sabit günlük saat/ücret varsayımları, kıdem, resmî tatil, sözleşme ve izin devri için İK/muhasebe onayı ve ayrıca test gerekir.
- Yetkili düzeltmelerde tarih/saatin hukuki ve operasyonel doğruluğu henüz sunucu fonksiyonuyla bütünüyle doğrulanmıyor. Kurallar atomik eşleşme/rol kontrolünü sağlar. Tam otomatik bordro veya güvenlik/uyum sertifikasyonu yapılmadı.

## Güvenli yayın sırası — yalnız ayrı yayın onayından sonra

1. Yukarıdaki açık maddeleri tamamlayın. Veritabanı/kuralların erişimi kısıtlı yedeğini, uygulama sürümlerini ve geri dönüş paketini alın; kişisel veri veya canlı rules snapshot'ını herkese açık PR'ye eklemeyin. Bu paket veri göçü gerektirmiyor.
2. En güncel canlı rules üzerinden aday dosyayı yeniden üretin; diğer paralel değişikliklerin korunduğunu karşılaştırın. Tam rol matrisi ve emulator testlerini adayın son haliyle yeniden çalıştırın.
3. ZEKY adayını iç test kanalında gerçek cihazlarda doğrulayın; yönetici cihazları için güncelleme/yalnız Portal geçişini hazırlayın. Bu adım da şu an yetkilendirilmiş bir yayın değildir.
4. Kısa, duyurulmuş bir yönetim karar bakım aralığı açın. Portal düzeltmesini kontrollü yayınlayın (main merge Pages'i tetikler); önbellekte eski istemci kalmadığını doğrulayın. Güncel yönetici istemcileri hazır olmadan bakım aralığını kapatmayın.
5. Yeni Firestore kurallarını ayrı, gözden geçirilmiş işlemle etkinleştirin. Onay/ret/audit, düzeltme eşleşmesi ve normal sunucu QR yazımını kontrollü hesaplarla doğrulayın. Başarısızsa karar akışını kapalı tutun; eski gevşek kurallara otomatik dönmeyin.
6. Bakımı kapatın; izin/audit hatalarını, çift kararları ve QR hatalarını izleyin. Mağaza dağıtımını ayrı onayla kademeli yapın. Eski uygulama karar yollarının artık reddedileceğini açıkça belirtin.
7. Geri dönüş: veri/audit silmeyin; test edilmiş güvenli istemciye dönün veya yönetim kararlarını geçici durdurun. Güvenliği gevşeten kural geri dönüşü bağımsız değerlendirme gerektirir.

## Ek yayın öncesi kontrol — 28 Kasım 2026

Bu bölüm önceki durum bilgisini günceller. Canlıya/mağazaya yayın, gerçek personel kaydına test yazımı veya canlı kural değişikliği yapılmadı.

### Yeni düzeltmeler

- Aktif olmayan yönetici/muhasebe rolü artık özlük yetkisi üretmez; yalnız aktif personel kabul edilir. Hassas kayıtların sahip ve muhasebe okumalarında da doğrulanmış e-posta gerekir. Yayından önce kullanıcıların e-posta doğrulaması tamamlanmalı.
- E-posta eşlemeli hesaplarda tekrarlı profil çözümlemesi Firestore'un 1000 ifade sınırını aşıyordu. Profil/rol tek sefer çözülerek azaltıldı; bu senaryo emulator testinden geçti.
- ZEKY izin formu bitişin başlangıçtan önce olmasını, 366 günü aşan aralığı, sayısal olmayan/24 saati aşan saat süresini yükleme başlamadan reddeder. Dosya adı HTML olarak eklenmez.
- Capacitor core/android/ios/cli 8.6.3'e sabitlendi. Kilit dosyasının uyumlu bağımlılık güncellemeleri yapıldı; Firebase alt bağımlılığı grpc-js, güvenlik düzeltmesi içeren 1.13.6'ya sabitlendi. `npm audit` sonucu 17 bulgudan sıfıra indi. Bu sonuç npm kilit dosyası kapsamındadır; tüm uygulamanın güvenli olduğu garantisi değildir.
- Android eklenti bağlantıları `cap sync android` ile güncellendi. macOS /var → /private/var eşlemesinden kaynaklanan test karşılaştırması gerçek yolu kullanacak şekilde düzeltildi.

Kaynaklar: https://github.com/advisories/GHSA-rvm3-566m-v7fv ve https://github.com/advisories/GHSA-m9gg-hp2v-232j .

### Son kanıtlar

- 46 Portal/çapraz depo/dağıtılmış QR çekirdeği testi: tamamı geçti, atlanan yok.
- 63 aday Firestore kuralı kontrolü: tamamı geçti. Pasif yönetici/muhasebe/öğretmen, veli profili, UID eşleme, doğrulanmamış e-posta ve rol yükseltme girişimi dahil.
- 1.194 ZEKY JavaScript testi ve gerekli test bağımlılığı sağlandıktan sonra 62 Python testi: tamamı geçti, atlanan yok. Python imza testleri sentetik sertifika/profil kullanır; gerçek imza veya mağaza işlemi değildir.
- 21 inline script ve ZEKY veri dosyası sözdizimi kontrolü geçti.
- Android debug APK yerelde başarıyla derlendi. Bir cihaza kurulmadı; bağlı Android cihaz yoktu. Debug imzası yerel geçici klasörde üretildi; mağaza imzası/kaydına dokunulmadı.
- Xcode 27.2 mevcut. iOS simulator derlemesi tamamlanamadı: CocoaPods komutu yok, Pods tarafından üretilen çalışma alanı hazır değil; CoreSimulator servisi de bu oturumda kullanılabilir değildi. `Podfile.lock` hâlâ eski native Capacitor çözümünü içerir. iOS'ta `pod install`/gerekli yerel pod güncellemesiyle kilit dosyası yeniden üretilip 8.6.3 doğrulanmadan release yapılmamalı. Kilit dosyası elle değiştirilmedi.

### QR sunucusu artık bulundu ve yerelde test edildi

Bağlı Firebase projesinde devam-production kod tabanındaki personelDevamKomutV1 listelendi. Dağıtılmış kaynak paketi yetkili okuma ile alındı; paket veya ortama ait değişkenler herkese açık depoya eklenmedi. Kaynakta App Check zorunluluğu ve tüketilmiş jetonun reddi, sunucu saati, aktif personel kontrolü ve hareket/durumun tek transaction içinde yazımı görüldü.

Dağıtılmış transaction kodu demo-ozluk emulator'ünde sentetik personel, QR ve konumla çalıştırıldı. 7 kontrol geçti: eşzamanlı girişlerden yalnız biri, moladayken çıkış yasağı, 4 hareket, 510 dakika ortak hesap, dışarıda son durum, sunucu toplamı ve tam koordinatın kayda taşınmaması. Üretim callable çağrılmadı. Gerçek App Check sağlayıcısı, GPS/kamera ve fiziksel cihaz çalışması bununla kanıtlanmış sayılmaz.

Yeniden test için açıkça `DEVAM_SOURCE_PATH` ile yerel kaynak paketi verilmelidir. `tests/personel-devam-deployment.test.mjs` kaynak verilmezse atlanır. `tests/personel-devam-server-emulator.cjs` firebase-admin 14.4.0 test bağımlılığıyla yalnız localhost emulator içinde çalışır. Kaynak entry point'i import edilmez ve üretim projesine yazmaz.

### Açık yayın engelleri ve sorumluluk

1. Ayrı test projesi/ortamı henüz doğrulanmadı. Staging ortamı ve sentetik hesaplar hazırlanıp gerçek cihazı oraya bağlayan test paketi üretilmeli. Üretime bağlı debug APK üzerinden deneme giriş/izin/sağlık belgesi oluşturulmamalı.
2. iOS bağımlılık çözümü ve imzasız derleme, ardından kullanıcı cihazında imzalı yerel test tamamlanmalı. Yeni Capacitor sürümü için gerçek cihaz regresyonu zorunlu.
3. BCKA-Medya servisinin tam sunucu kaynağı ve özel belge erişim kontrolü henüz bulunamadı. İki uygulama izin belgelerini bu servis üzerinden yükler; Firebase Storage kuralları bu yolun korunduğunu kanıtlamaz. Gerçek sağlık belgesi indirilmedi/yüklenmedi. Sentetik belgeyle yetkisiz kullanıcı ve oturumsuz erişim, erişim iptali, URL ömrü ve saklama/silme işlemleri doğrulanmadan belge akışı yayına hazır değildir.
4. Eski yönetici uygulamasıyla yeni zorunlu audit kuralının birlikte çalışması desteklenmez. Yönetici cihazlarının sürümü ve doğrulanmış e-posta durumu kontrol edilmeli; kontrollü geçiş önceki sırayla uygulanmalı.
5. İzin bakiyesi, ücret etkisi, kıdem/sözleşme ve çalışma takvimi eşitliği ayrı iş kuralı doğrulamasını gerektiriyor. Mevcut rapor otomatik bordro onayı değildir.

### Kullanıcının cihazında yapacakları

Şimdi yalnız hazırlık:
- Kullanacağınız telefonun iPhone mu Android mi olduğunu belirtin; mümkünse iki platformdan birer cihaz seçin.
- Telefonu bu Mac'e kabloyla bağlayın, kilidini açık tutun. “Bu bilgisayara güven” veya USB hata ayıklama yetkilendirme ekranı gelirse yalnız kendi Mac'iniz için siz onaylayın. Android'de USB hata ayıklama, iPhone'da istenirse Geliştirici Modu gerekir; adımlar cihaz modeline göre birlikte uygulanabilir.
- Mevcut mağaza uygulamasını silmeyin. Henüz gerçek personelle deneme kaydı veya sağlık belgesi yüklemesi yapmayın. Şifre, doğrulama kodu veya sağlık belgesini bu sohbete göndermeyin.

Test ortamına bağlı paket hazır olduktan sonra birlikte:
1. Test öğretmeni ve test yöneticisiyle ayrı ayrı giriş; çıkış ve yeniden giriş.
2. Kamera/konum izni ilk kez reddedildiğinde anlaşılır hata ve sıfır kayıt; izin verildiğinde okul içi geçerli QR ile tek giriş.
3. Aynı QR'ı art arda okutma, mola başlatma/bitirme ve çıkış: çift kayıt olmaması; Portal ve ZEKY toplamlarının eşleşmesi.
4. Uçak modunda işlem: sahte başarı olmaması. Bağlantı döndüğünde tek işlem ve açık hata/başarı mesajı.
5. Sentetik izin talebi → diğer uygulamada gerekçeli ret/onay; bir karar ve bir audit kaydı. İkinci kararın engellenmesi.
6. Küçük ekran/yatay yön, klavye açıkken kaydet/iptal ve metin okunabilirliği. Fotoğraf gerektiren testlerde yalnız “TEST” yazılı yapay görsel kullanın.
7. App Check fiziksel cihaz sonuçları ile iOS/Android sürümünü, başarılı/başarısız adımı kaydedin. Gerçek okul kayıtlarının ekran görüntüsünü paylaşmak gerekmez.

Bu testler bitene kadar iki PR taslak kalır; merge, Firebase deploy, TestFlight, Play iç test veya mağaza yayını yapılmaz.


### Son doğrulama güncellemesi

GitHub'daki imzasız iOS Release derlemesi başarılı: https://github.com/3mrahbay/zeky-app/actions/runs/46076322353 . Bu kontrol 1a0461b kaynak revizyonunda Node 22 / Xcode 26 ile npm ci, CocoaPods/Capacitor sync ve CODE_SIGNING_ALLOWED=NO derlemesini tamamladı. Sahte Firebase dosyası kullanıldı; Apple hesabı, mağaza imzası veya yayın yapılmadı. Yerel Mac'teki CocoaPods/Simulator engeli devam etse de iOS derlenebilirliği CI'da doğrulandı. Fiziksel iPhone/App Check ve gerçek release paketinin native kilit dosyasını kaydetme adımları açık.

Medya servisine ilişkin ek inceleme yapıldı. Etkin dağıtım ve özel belge erişiminin güvenlik doğrulaması tamamlanmadığından bu alan yayın engeli olarak kalır. Ayrıntılı bulgular özel yerel raporda tutulur; gerçek belge erişimi, canlı ayar değişikliği veya dağıtım yapılmadı.


## 2026-11-28: isolated private-document staging

A shared authenticated document client replaces medical upload and direct-link rendering in the draft. Production activation is intentionally disabled pending the reviewed backend and migration. Existing records are preserved. The separate synthetic test environment verifies owner/reviewer access, other-user/accountant/disabled denial, immediate role revocation and private storage. This is a focused browser document harness, not proof of a full native iPhone build or App Check flow. Keep this PR draft; do not merge or publish.
