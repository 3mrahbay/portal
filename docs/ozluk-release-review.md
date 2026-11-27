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
