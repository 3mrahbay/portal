# Kitap Kulübü üyelik bildirimleri — taslak, yayınlanmadı

## Doğru kaynak ve kapsam

Portal PR100–102 sonrasındaki `main` ve ZEKY mobil `main` incelendi. Aynı işi yapan açık PR/dal bulunmadı. `zeky-backend` de incelendi; mevcut mail/push sunucusu orada değil, bu deponun `server/apps-script` klasöründe. Güncel checkoutlarda `.agents/skills` veya `AGENTS.md`/`SKILL.md` bulunmadı. Yerel memory_summary yalnız geçmiş bağlam için okundu.

Yeni talep Firestore'a kaydedildikten sonra mevcut BCK_MailProxy doğrulanmış hesap adresini özel, kalıcı gönderim kaydına alır; ZEKY Push mevcut `bildirimler` koleksiyonuna yönetici bildirimi oluşturur ve mevcut FCM hattını kullanır. Alıcılar izin taşıyan personel belge kimliklerinden çözülür: aktif kurucu müdür, müdür, PDR ve mevcut admin istisnası. Veliye personel adres listesi dönmez. İstemci alıcı/metin/HTML seçemez.

Portal bildirimi mevcut zil/popup akışını kullanır; bildirim tercihlerine ve ilk snapshot için geçmiş bildirimi çalmama davranışına uyar. Mobil push ve bildirim tıklaması mevcut kulüp sayfasına gider; yönetim görünümü kendi yetkisini tekrar denetler. Site içi bildirim ve FCM kabulü, cihazda gösterim kanıtı değildir.

Onay öncesi yeni talebin mail hazırlığı doğrulanır. Onaydan sonra otomatik hoş geldiniz gönderimi denenir. Aynı üyeye yeniden onay belge zamanını değiştirmez. Mevcut genel okul mail işlevi, mevcut Brevo anahtarı ve `eposta@bircicekkoleji.com` göndericisi kullanılır. Yeni credential/IAM/Firestore izin değişikliği yoktur.

## Tekillik ve hata davranışı

- Üyelik oluşturma/onay transaction kullanır. Var olan pending talep tekrar yazılmaz; approved/blocked üye tekrar kayıtla pending yapılamaz.
- Kalıcı bildirim: UID + alıcı için create-only. Tekrar/kısmi hata okunmuş bilgisini sıfırlamaz.
- Push: Firestore create-only işareti sağlayıcı çağrısından önce; belirsiz sonuçta yeniden gönderim yok.
- Mail: Apps Script genel kilidi + kalıcı Script Properties kaydı; sağlayıcı çağrısından önce `uncertain`. UID ve doğrulanmış e-posta adresi temelinde tek gönderim; aynı adresle yeni UID de ikinci mail alamaz.
- `sent` yalnız sağlayıcı kabulü; teslim/gelen kutusu kanıtı değil. `uncertain` kaydı otomatik silinmez veya yeniden denenmez. Özel sunucu kayıtları ve Brevo sonucu mutabık olmadan kayıt silinmemeli.
- Başlangıç tarihinden önceki pending üyeler kayda alınmaz; kayıtlı mail hazırlığı olmayan eski approved üyeler atlanır. Toplu geriye dönük mail betiği yoktur.
- Script Properties dolarsa işlem hata verir; dedup kayıtlarını otomatik silerek kapasite açmaz. Kapasite izlenmeli, daha büyük hacim için ayrı kalıcı outbox tasarımı gerekir.

## Yayın sınırı ve bilinen eksikler

Bu sürüm **kalıcı sunucu tetikleyicisi/outbox değildir**. İşlemden sonra istemci sunucuya çağrı yapar. Uygulama üyelik yazımı ile çağrı arasında kapanırsa, pending üyenin “Bildirimleri yeniden dene” veya yönetimin “Hoş geldiniz durumunu kontrol et” düğmesi gerekir. Eski mobil sürümler bu çağrıyı yapmaz. Kesintiden sonra kullanıcı müdahalesi olmadan kesin gönderim beklentisi için sunucu tetikleyicisi ayrıca tasarlanmalı; bu draft bu garantiyi vermez.

Yeni talepte e-posta hazırlığı başarısızsa güncel istemci onayı durdurur, üyelik değişmediğini açıklar; önce hazırlık yeniden denenmelidir. Eski istemciden onay bu korumayı atlayabilir ve mail atlanabilir. Mevcut erişim/paylaşım kuralları değişmez; kayıt/onay hatalarının etkileri ayrı raporlanır.

Canlı Apps Script sürümü/özellikleri, Firestore `bildirimler` ve `pushOlayKayitlari` kurallarının yetkisiz yazma/silme engeli, gerçek FCM/APNs, gerçek mail istemcileri ve cihazda popup gösterimi **doğrulanmadı**. Dedup işaretlerinin yetkisiz kişilerce silinemediği yayın öncesi doğrulanmalıdır. Bu görevde gerçek veliye mail/push veya canlı veri yazımı yapılmadı. Finans tarayıcı oturumları kullanılmadı.

## Ayrı onay sonrası yayın planı

1. Mevcut iki Apps Script projesinin sürümünü/ayarlarını yedekle ve kaynakla karşılaştır. Mail projesine `KitapKulubu_Mail.gs`, push projesine `KitapKulubu_Push.gs` eklenir; her projenin mevcut ana dosyası da güncellenir. Helper dosyaları birbirinin projesine konmaz.
2. İki projede `KK_UYELIK_AKTIF` varsayılan kapalıdır. `KK_UYELIK_BASLANGIC` aynı, onaylanmış yayın anının ISO zaman damgası olmalıdır; geçmişe alınmaz. Mevcut gönderici ve secretlar değiştirilmez.
3. Ayrı onayla mevcut dağıtımlar güncellenir (adres değişmez), Portal/Mobil sürüm/cache numaraları yayın sırasında artırılır, ilgili yeni istemciler dağıtılır. Kademeli dağıtım ve eski mobil sürüm sınırı hesaba katılır.
4. Yalnız ayrıca onaylanmış sentetik/test hesaplarıyla izin, kayıt, onay ve alıcı kontrolü yapılır. Gerçek veliler test alıcısı değildir.
5. Ayrı aktivasyon onayıyla iki projede `KK_UYELIK_AKTIF=evet`. Kapatmak için bayrak kaldırılır; gönderim kayıtları korunur.

## Önizleme ve yerel kontroller

`qa/kitap-kulubu-uyelik/hos-geldiniz.html` ve 390/1280 px PNG'ler sentetik isimle üretildi, görsel incelendi; yatay taşma yok. Link `https://portal.bircicekkoleji.com/kitap-kulubu.html` salt okunur HTTP HEAD ile 200 döndü; bu kontrol oturum sonrası içeriğe erişim kanıtı değildir. Gerçek Outlook/Gmail render testi yapılmadı.

Testler sentetik Node/VM testleridir; gerçek Apps Script veya Firestore emulator concurrency/rules testi değildir. Mevcut mail ve push yetki regresyon testleri de çalıştırıldı. Ayrıntılı test komutları PR açıklamasındadır. Tüm sistemin geçtiği iddia edilmez.
