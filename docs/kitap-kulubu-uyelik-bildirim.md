# Kitap Kulübü: kalıcı sunucu kuyruğu ve salt okunur durum kontrolü

## Doğrulanan canlı hata (22 Ekim 2026)

Portal #103, 17:17:31 UTC'de `54d6c6b`; ZEKY #85, 17:17:54 UTC'de `2026e2c` ile başka bir işlem tarafından merge edilmiş. Bu çalışma merge/deploy yapmadı. Canlı Portal'dan salt okunur alınan `admin-ui.mjs`, `store.mjs?v=214`, `membership-effects.mjs` dosyaları remote main ile SHA-256 düzeyinde aynıydı.

Hatalı düğme `data-member + data-status=approved` kullanarak `setMember` → `prepare` → onay → mail yoluna giriyordu. Onaylı üyede de bu yüzden “Onay öncesi…” hatası görünüyordu. Bu hata sağlayıcı kabulü veya teslim kanıtı değildir; Apps Script canlı sürümü/ayarları okunmadığı için hangi sunucu reddinin oluştuğu bilinmiyor. Kullanıcının ekran metni parent tarafından doğrulandı; gerçek veli verisine, oturumuna veya Library görsellerine bu çalışmada erişilmedi.

Yeni düğme ayrı `data-mail-status` → `store.mailStatus` → `action: kitapKulubuDurum` kullanır. Eski sunucu bu yeni işlemi tanımıyorsa güvenli “durum servisi kullanılamıyor” açıklaması verir. İşlem yalnız yetki, üyelik ve kuyruk kaydı okur; belge güncellemez, kuyruk yaratmaz ve mail/push göndermez. Hata olduğunda önceki kabul bilgisi ekranda bırakılmaz.

Eski kayıtlarda ayrı talep zamanı yoktur. Son güncelleme talep tarihi gibi gösterilmez. Durum servisi Firestore'un `createTime` metadatasını “Sunucu kayıt oluşturma zamanı” olarak ayrıca gösterebilir; bu veri kullanıcı tıklama zamanıymış gibi yeniden yazılmaz. Gerçek üyelerin kayıtları değiştirilmedi.

## Uygulama kapanınca gönderim nasıl kurtarılır?

İstemciler artık bildirim/mail çağrısı yapmaz. Kayıt ve onay transaction'ı yalnız mevcut üyelik belgesini yazar. Bu belge, **kurtarılabilir gönderim niyetidir**: mevcut kurallarda kullanıcılar üyelik silemez, yalnız yönetim/PDR durum değiştirebilir. Sunucu kaydı periyodik olarak yeniden okuyabilir. Tarayıcı tam yazımdan sonra kapansa da sunucu taraması kaydı bulur; öğrenci/veli istemcisinin yeniden açılması gerekmez.

İki mevcut Apps Script projesi kullanılır:

- **ZEKY Push:** mevcut dakika tabanlı `sabahKapiTara` planlayıcısı okul saati/hafta sonu kontrollerinden önce kulüp tarayıcısını çağırır. Kulüp taraması kendi 5 dakika sınırını ve kilidini uygular. Kulüp hatası mevcut sabah işini durdurmaz. 25 kayıtlık sayfalar dolaşılır; kaynak durum gönderim öncesi yeniden okunur. Kalıcı `bildirimler` kayıtları create-only, alıcılar aktif kurucu müdür/müdür/PDR ve mevcut admin istisnasıdır. İletişim e-postası yerine yetki taşıyan personel belge kimliği kullanılır.
- **BCK_MailProxy:** onaylanmış üyelikleri sayfalayarak tarayan `kkMailTara`, mevcut proje Script Properties alanında kalıcı kuyruk tutar. Kuyruğa yazımlar tamamlanmadan sayfa imleci ilerlemez. Her tam tarama yeniden başlar; başarısız veya kesilmiş keşif sonraki taramada kurtarılır. En fazla 10 kuyruk işi/çalıştırma ve 4 dakika işlem bütçesi vardır. Tarayıcı hatası, daha önce kuyruğa alınmış işlerin çalışmasını engellemez.

Yeni üye sınırı **Firestore sunucu createTime** bilgisidir; değiştirilebilir `updatedAt` kullanılmaz. Başlangıçtan önce oluşturulmuş pending kayıt daha sonra onaylansa bile otomatik mail almaz. Eski üyelere toplu geri gönderim yoktur. Başlangıç ilk çalışmada sabitlenir; sonradan geriye alınırsa işlem hata verir.

## Gönderim, tekrar ve belirsizlik

Mail alıcısı OAuth yetkili Firebase Auth UID sorgusundan gelen doğrulanmış, devre dışı olmayan hesaptır. Güncel veli profili/onay/anne erişimi ayrıca kontrol edilir. İstemci alıcı, metin, sender veya HTML seçemez. Mevcut Brevo anahtarı, onaylı `eposta@bircicekkoleji.com` göndericisi ve aynı şablon kullanılır.

Kuyruk ve sağlayıcı işlemleri proje kilidiyle seri çalışır. Gönderim gövdesi ve UUID idempotency anahtarı sağlayıcı çağrısından **önce** kalıcı kaydedilir. Aynı e-posta adresiyle ikinci UID için adres rezervasyonu ikinci gönderimi önler. Gönderim başlamadan iptal edilen rezervasyon güvenle bırakılabilir. Başlayan/belirsiz girişim sıfırlanmaz. Hesap e-postası sonradan değişirse bekleyen deneme yeni adrese yönlendirilmez.

Brevo'nun belgelenmiş UUID/idempotency sözleşmesi 30 dakikalık tekrar koruması sağlar; kod daha kısa **20 dakika** güvenli tekrar penceresi kullanır. Zaman aşımından sonra aynı gövde/UUID tekrar edilir; belgelenmiş `duplicate_parameter` kabul edilmiş aynı isteği ifade eder. Süre dolduktan sonra kör yeniden gönderim yoktur: iş `needs_review` olarak kuyrukta kalır, sağlık kaydında görünür ve mail worker kontrol gerektiren hata üretir. Böylece kayıp iş sessizce başarı sayılmaz. Bu, sınırsız süreli “exactly once” veya gelen kutusuna teslim garantisi değildir.

Provider öncesi geçici okuma/config hataları tekrar denenir. Sağlayıcı kabulü sonrası durum yazımı kesilirse aynı UUID tekrar koruması kullanılır. `accepted` sağlayıcı kabulünü, `queued/retry` kuyruk durumunu, `needs_review` belirsizliği gösterir; **teslim bilgisi henüz yoktur**.

FCM'nin bu akışta sağlayıcı idempotency anahtarı yoktur. Kalıcı bildirim daima önce yazılır ve tarama tekrarları eksik alıcıları tamamlar. FCM denemesi belirsizse ikinci sesli push gönderilmez; durum işaretinde inceleme için saklanır. Kalıcı bildirim kaybolmaz. Popup mevcut Portal tercih/ilk snapshot kurallarına tabidir; telefon gösterimi ayrıca kanıtlanmalıdır.

Kaynaklar (22 Ekim kontrolü):
- [Brevo idempotency](https://developers.brevo.com/docs/heterogenous-versions-batch-emails)
- [Firebase Auth admin lookup ve izin](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/lookup)
- [Apps Script OAuth token](https://developers.google.com/apps-script/reference/script/script-app#getOAuthToken())

## Ayrı onay gerektiren canlı bileşenler

**Bu değişiklikler yalnız kod/tasarım; trigger kurulmadı, izin verilmedi, aktivasyon yapılmadı.** Önceki taslak bayrağı bu worker'ı açamaz. Yeni `KK_KUYRUK_AKTIF` varsayılan kapalıdır; `KK_KUYRUK_BASLANGIC` onaylanmış yeni aktivasyon anı olmalıdır. Önceki `KK_UYELIK_*` bayrakları yeni worker için yetki sayılmaz.

1. Mevcut iki Apps Script kaynak/sürümünü ve proje ayarlarını yedekleyip karşılaştır. Ortak `KitapKulubu_Queue.gs` iki projeye de; `KitapKulubu_Mail.gs` yalnız BCK_MailProxy'ye, `KitapKulubu_Push.gs` yalnız ZEKY Push'a eklenir. Her projenin ana dosyası da birlikte güncellenir.
2. **Mail worker için yeni OAuth kapsam onayı gerekiyor:** mevcut çalıştıran hesabın `datastore` ve `identitytoolkit` kapsamları ile `script.external_request`. `ScriptApp.getOAuthToken()` kullanılır; yeni key, servis hesabı veya push private key kopyası yoktur. bcka-site üzerinde gereken mevcut IAM izinleri: `datastore.entities.get`, `datastore.entities.list`, `firebaseauth.users.get`. Mevcut hesapta var mı **doğrulanmadı**. Yoksa en az yetkili grant ayrıca onaylanmalıdır; kod grant yapmaz. Kesin taslak sözleşme: `server/apps-script/kitap-kulubu-mail-scopes.example.json`.
3. **Mail projesinde `kkMailTara` için 5 dakikalık zaman tetikleyicisinin kurulması ayrıca onay gerekir.** Kod otomatik trigger kurmaz. Push mevcut `sabahKapiTara` tetikleyicisini kullanır; canlıda gerçekten kurulu olduğu doğrulanmalı, yoksa onun kurulumu da ayrıca onay ister. Mevcut push servis hesabının kapsamları değiştirilmedi.
4. Firestore canlı kuralları: üyelik create/status/delete sınırları, yalnız alıcının bildirim okuması ve dedup işaretlerinin yetkisiz silinememesi doğrulanmalı. Kuyruk Script Properties içindedir, istemci erişimi veya yeni Firestore yazma izni gerekmez. Script editörleri güvenilir yönetici sınırındadır.
5. Ayrı merge/deploy onayından sonra istemci dosyaları/PWA cache sürümleri dağıtılır; salt okunur durum endpoint'i worker kapalıyken test edilebilir. Sonra ayrı aktivasyon onayıyla iki projede aynı yeni başlangıç ve `KK_KUYRUK_AKTIF=evet` ayarlanır. Gerçek veli test alıcısı değildir.

Yeni ücretli servis kurulmaz. Mevcut Firestore okuma, Apps Script kota ve Brevo gönderim kullanımı artar: her tarama en fazla 25 üyelik belgesi, mail çalıştırması ayrıca en fazla 10 işin profil/üyelik kontrolleri. Kuyruk kapasitesi izlenmelidir; Script Properties kotası dolarsa iş keşfi durur ve kaynak kayıtlardan sonra kurtarılabilir; dedup kayıtları otomatik silinmez. `kkKuyrukDurumu()` yalnız editörden, ağ çağrısı veya yazım yapmadan sayaç/sağlık durumu verir.

## İstemci sürümleri ve kanıtlar

- **Sunucu otomasyonu:** mevcut `kitapKulubuUyeler/{uid}` şemasını yazan eski ve yeni Portal/ZEKY istemcilerinde çalışır. Kayıttan/onaydan sonra açık istemci veya mail enrollment çağrısı gerekmez. Farklı şema kullanan istemciler kapsam dışıdır.
- **Durum ekranı düzeltmesi:** bu devam commitlerini içeren Portal dosyalarının dağıtılması ve güncel modüllerin alınması gerekir. Eski cache'teki yanlış düğme, yeni sayfa yüklenene kadar eski davranışı gösterebilir. Salt okunur endpoint eski sunucuda yoksa yeni UI güvenli durum açıklaması gösterir.
- **Mobil yönlendirme:** ilk ZEKY #85 kaynak değişikliği zaten merge edilmiş; native mağaza paketine dağıtıldığı doğrulanmadı. Eski paket bildirim kaydını okuyabilir, yeni hedef yönlendirme garantisi yalnız ilgili modülü içeren paket içindir.
- İlk **204 odak testi** ilk taslağa aitti; bütün sistem veya canlı teslim testi değildi. İstemci gönderimiyle ilgili eski testler yeni salt okunur/server-worker sözleşmesine uyarlandı.
- Güncel odak koşusu: **Portal 64 + ZEKY 184 = 248 test**. Bunların içinde **22 yeni kuyruk testi + 5 yeni durum testi** var; ayrıca mevcut sabah/operasyon planlayıcılarından **20 regresyon testi** eklendi. Kalanlar kulüp izinleri, mevcut mail/push auth ve yönlendirme regresyonlarıdır.
- Gerçek yönetim UI kodu bağımsız başsız tarayıcıda 390 px, sentetik üye ile 4 durumdan geçirildi: kapalı servis, kuyruk, sağlayıcı kabulü, erişilemeyen servis. **4 durum sorgusu, 0 üyelik yazımı, 0 dış ağ isteği**; “Onay öncesi” hatası ve eski kabul bilgisinin kalması yok. `qa/kitap-kulubu-uyelik/durum-kontrolu-390.png` Portal deposundadır.
- Mail HTML/390/1280 PNG önizlemeleri korunur; gerçek kulüp URL'si ilk çalışmada HTTP 200 idi. Outlook/Gmail render, canlı Apps Script izin/trigger, gerçek FCM/APNs, Firestore emulator ve canlı Rules testleri yapılmadı. Finans tarayıcısı/Cloud Shell kullanılmadı.
