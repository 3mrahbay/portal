# Kalıcı taslak yayını — 28 Kasım 2026

Muhasebe → Fatura hazırlığı açılır. faturaHazirlik koleksiyonu yönetim/muhasebeye özeldir; her sürüm atomik history kaydı oluşturur. Taslak yalnız öğrenci kaydına bağlıdır; ad/TCKN kopyası saklanmaz, ekranda maskelidir. Kaydetmede öğrenci/tahsilat yeniden okunur; sürüm çakışması reddedilir. Kaynak değişikliği kontrolü geçersiz kılar. Kaynağı bulunamayan taslak silinmez.

Kontrol edildi, gönderim onayı değildir. Gerçek gönderim yolu yoktur. Resmî fatura numarası ve gönderim durumu şemada reddedilir. API/cari/GİB/geçmiş belge mutabakatı bekler. Eski kimliksiz hareketler kaydedilemez. Aktif dönem kaynakları listelenir; kısmi/toplu tahsis API aşamasındadır.

Baskı/numara: Portal bağımsız resmî sayaç üretmez. Taslak sıra tüketmez. İşbaşı belge ID/ETTN/numara ve PDF esas alınacaktır. DocumentDatawithuuid PDF ucu belgelerde doğrulandı. Mevcut özel şablonun API’de uygulanması ve web/API ortak seri sırası henüz test edilmedi; canlı gönderimi açmadan önce dönüşümlü/eşzamanlı düzenleme, yıl/seri değişimi ve timeout senaryoları doğrulanacak.

Aşağıdaki ilk aşama notundaki kapalı/RAM mock kapsamı bu kalıcı taslak yayınıyla genişletilmiştir.

---

# Logo İşbaşı entegrasyonu — aşama 1, 28 Kasım 2026

Durum: inceleme ve yerel mock/test hazır. Kullanıcı onayıyla başvuru formu gönderildi; form kapandı, başvuru numarası veya kalıcı başarı mesajı gösterilmedi. Sağlayıcı teyidi bekleniyor. Üretime yayın, API oturumu veya gerçek belge düzenleme yapılmadı. Başlangıç commit'i fdfdd1c; dal feat/isbasi-invoice-preview.

## Doğrulanmış kaynaklar

Oturum açık Chrome developer portalı https://developers.isbasi.com/ (v1; indirme linki swagger.json?v=1.0.9), app.isbasi.com satış/gelen/giden ekranları, Portal'ın güncel main kodu ve ödeme otomasyonunun 27 Kasım tarihli yerel günlüğü incelendi. Girişsiz doküman indirme giriş ekranına yönlendi; şema indirildi/doğrulandı denmiyor. Başvuru ve dokümantasyon tarayıcıdaki yetkili oturumdan okundu. API çağrısı yapılmadı.

REA binary_session canlı çağrısı başarılı: rea-agents 6.5.0. Chrome için CDP dinleyicisi bulunmadı; REA ile İşbaşı runtime incelemesi yapılmış sayılmıyor. Oturumu yeniden başlatmadan CUA ile görünür arayüz incelendi. Tam Portal kaynak kodunda normal kod araçları kullanıldı.

## Başvuru

Formda görülen alanlar: Adınız Soyadınız, E-posta, Telefon Numaranız, Konu ve Bilgi Talebi Formu Aydınlatma Metni onayı. Üç konu seçeneği: müşterilere sunulan çözümü entegre etme, kendi hesabını entegre etme, API hakkında bilgi alma. Bizim seçenek kendi hesabını entegre etme. Kullanıcının açık onayından sonra aydınlatma kutusu işaretlendi ve Bilgileri Gönder tıklandı. Gönderiliyor durumu ardından form kapandı. Mükerrer başvuru gönderilmedi; e-posta teyidi henüz doğrulanmadı. Kişisel iletişim bilgileri kaynak koduna konulmadı.

## API bulguları ve sınırları

| Alan | Dokümanda görülen | Henüz doğrulanmayan |
|---|---|---|
| Lisans/kota | Ücretli İşbaşı aboneliği; aylık 3000 okuma, 7000 yazma; ek bedelle 6000 okuma | Hesaba özel haklar, anlık hız sınırı, kota yanıtları |
| Auth | Tek hesap: apiKey + yönetici kullanıcı/parola ile POST /api/v1.0/user/integrationLogin; Bearer token, tenantId ve bazı uçlarda kullanıcı başlıkları | Açıklamada slash eksik userintegrationLogin de yazıyor; ilk login host'u, token yenileme, en az yetkili servis kullanıcısı |
| SSO | ssorequesturl → appUserKey → getuserappkey → Login | Okulun tek hesap kullanımı için gerekli değil; akış test edilmedi |
| Platform | POST /api/v1.0/user/getplatform; baseUrl, IsTestUser, isCanary | Dönen host için güvenli allowlist; test tenantının gerçek GİB'e kapalı olduğu |
| Test | Kurye bölümünde https://soho-isbasi-mwv3-stg.logo-paas.com/; özel API key/admin/kurye kullanıcısı | Bu modelin okulun tek hesap entegrasyonuna uygunluğu; ücretsiz/ücretli test kontörü |
| Cari | POST /api/v1.0/firms/firms; GET /api/v1.0/firms/{id}; oluşturma/güncelleme | Veli/öğrenci ve belge alıcısı eşleştirmesi; TCKN/VKN kontrolü |
| Belge oluşturma | POST /api/v1.0/invoices/integrationInvoices; invoiceId=0 yeni; customer.code ile eşleştirme, bulunamazsa cari oluşturma; response data.invoiceId | Sadece taslak kaydetme/gönderme ayrımı, kesin payload şeması ve yan etkiler |
| e-Fatura/e-Arşiv | Alıcı TCKN/VKN durumuna göre otomatik; API üzerinden kağıt faturaya zorlama yok | GİB test sonuçları, belge tipi/istisna kodları; Portal üzerinden yapılması internet satışı olduğunu tek başına göstermez |
| GİB mükellefiyet | GET /api/v1.0/user/gibUser?tcknVkn=...; alias listeleri | PK/GB açıklamalarında ters ifadeler var; gerçek yanıtla teyit gerekli. Kimlik içeren URL loglanmamalı |
| Satış/gelen/giden | POST invoices/invoices, einvoices/myInvoicesList, einvoices/GetOutgoingInvoiceDataList; filtre/sayfalama | e-Arşiv dahil eksiksiz geçmiş tarama ve status/iptal alanlarının anlamları |
| PDF/UBL | DocumentDatawithuuid, DocumentData, DocumentUblData, DocumentUblDatawithuuid | Gerçek MIME türü, yetki ve imza/ETTN bağlama testi |
| GİB durum | IntegrationInvoiceReport; ETTN, invoiceNumber, status, eStatus; kurye kısmında 1/4/8 devam, 10 başarılı | Aynı bölüm açıklaması POST, teknik uç GET + body: çelişki. Genel e-Fatura/e-Arşiv hesabı için uygulanabilirlik ve terminal hata kodları |
| Tekrarlı istek | Açık dokümanda Idempotency-Key garantisi bulunamadı | Benzersiz dış referans, ETTN istemci ataması, retry saklama süresi, idempotency desteği |
| Bildirim | Webhook sözleşmesi bulunamadı | İmza, tekrar gönderim ve sıralama garantileri |
| Tahsilat | PUT /api/v2.0/payment/transaction; invoiceList ile paylaştırma | Tahsilatı yeniden yazmadan mevcut hareketi eşleme; ödeme yazımı bu aşamada kapalı |

Dokümanda “Authorizations: None” görünmesi yetkisiz kullanım anlamına gelmez; header gereklilikleri açıkça yazıyor. Parolayı base64 yapmak güvenlik sağlamaz; belge örneklerindeki öneri güvenlik tasarımı olarak benimsenmedi. Sırlar istemciye, repoya, URL'ye veya loglara konulmayacak. Üretim adaptörü için Secret Manager, sunucu tarafı kimlik kontrolü, tenant bağlama, HTTPS host allowlist ve log maskeleme şart.

## İşbaşı arayüzü bulguları

Satış listesinde hem e-Arşiv hem e-Fatura, imzalandı / başarıyla tamamlandı ve ayrıca uygulama yanıtı / muhasebe durumu var. Giden e-Faturalar ekranı e-Arşiv satışlarının tamamı değildir; yalnız bu ekranla mükerrer kontrolü yapılamaz. 29.09–28.11 filtresinde giden e-Faturada bir kayıt görüldü, tüm tarihlerin toplamı olarak yorumlanmadı. Satışlarda aynı öğrenci ve aynı tutarlı birden çok belge görüldü: hizmet ayı ve içerik incelenmeden mükerrer ilan edilmedi. Bazı imzalı satışlarda kalan tutar fatura toplamıyla aynı görünüyordu; bu, yeni tahsilat yazma izni veya gerçek borç kanıtı olarak kabul edilmedi.

## Mevcut Portal ve e-posta akışı

- js/finans/core.js: öğrenci dönem belgesi, aylıkOdemeler/digerOdemeler ve hareketler; bildirimOnayla transaction içinde dönem, odemeBildirimleri ve odemeler kayıtlarını güncelliyor.
- js/finans/data.js: okulVerisi bu kayıtları gelirler listesine çeviriyor; eski toplamdan türetilen satırların tekil hareket kimliği yok. Yalnız aktif dönem öğrencileri listeleniyor. Bu liste tüm muhasebe arşivinin yerine geçmez.
- js/finans/reconciliation.js: banka hesap/referans ve öğrenci/dönem/kalem/hareket kilitleri, brüt eksi komisyon = banka neti kontrolü var.
- E-posta otomasyonu Portal deposunda sunucu webhook'u olarak bulunmadı. Yerel kuveyt-portal-state.json iki posta kutusu, message_id/message_key, bank_time, allocation ve processed_verified kayıtları içeriyor. 27 Kasım günlüğü iki hesap için başarılı kontrol raporluyor; bu incelemede e-postalar yeniden taranmadı veya yeni ödeme işlenmedi.
- Bazı günlük kayıtlarında bank_reference ve Portal hareket ID'si yok. Sadece mesaj ID'siyle ikinci posta kutusundaki aynı banka transferi engellenemez. İsim+tutar eşleşmesiyle otomatik fatura yapılmayacak.

## Hedef üretim tasarımı (bu aşamada bağlanmadı)

Doğrulanmış tahsilat → taslak adayı → gereklilik/alıcı/hizmet dönemi/vergi kararı → mevcut belgelerle mutabakat → ayrı yetkili manuel onay → tek gönderim işi → belge ve GİB durum sorgusu → mutabık.

İstisna bir vergi muafiyeti değildir. “Mevcut faturaya bağlı tahsilat”, iade, avans veya kapsam dışı kararlar gerekçeli ve yetkili incelemesine bağlıdır; yazılım hukuki faturalama yükümlülüğü çıkarmaz. KDV oranı ve fatura tarihi banka tarihinden otomatik belirlenmez; mali müşavir kararı gerekir. Kısmi/toplu/kardeş ödemeleri ve yıllık faturaya taksit tahsilatı için ödeme-fatura tahsis tablosu gerekir. İlk sürüm bunları toplu veya kısmi şekilde kesmez; incelemeye bırakır.

Sunucu verileri: invoiceDrafts, invoiceSourceLocks, invoiceAllocations, invoiceJobs, invoiceAudit, customerMappings, providerDocuments. Her kayıt tenant, dönem, sürüm, kaynak hareket, tahsis tutarı (tam sayı kuruş), oluşturucu, zaman ve karar taşır. E-posta kaynağı mailbox+messageId; mükerrer transfer anahtarı hesap+banka referansı. Güvenilir banka referansı yoksa insan kontrolü. TCKN/VKN anahtarda veya audit içinde açık tutulmaz.

Onay: sunucuda gerçek kimlik/rol ve tenant; hazırlayan ile onaylayan ayrı. Onay yalnız ilgili payload hash ve sürümü için geçerli; kaynak tutarı, alıcı, vergi, kalem/dönem değişirse onay bozulur. İzleyici salt okunur; muhasebe hazırlar; yönetici gönderimi onaylar; arka plan görevlisi sadece onaylı işi yürütür. Rol seçici yalnız sentetik test içindir.

Gönderim: transaction ile kaynak/tahsis tutarı rezervasyonu ve outbox işi; tek worker claim. Tekil iş anahtarı ve payload hash kalıcı saklanır. Provider idempotency garanti etmiyorsa timeout/5xx sonrası kör retry yok. Yanıt alınamayan iş unknown durumuna kilitlenir, kalıcı operasyon referansı/ETTN/belge ID üzerinden sorgulanır; doğrulanamazsa insan incelemesi. HTTP 200 veya invoiceId alınması GİB başarısı değildir. Terminal belge durumu, tutar, para birimi ve cari doğrulanınca tamamlanır. Gönderilmiş belgeyi düzenleme/silme yolu bulunmaz.

Mutabakat: banka neti+komisyon → Portal brüt tahsilatı → tahsis → fatura. Fatura vergisi satır bazında kuruşlarla hesaplanır; API toplamı ve yerel toplam karşılaştırılır. Toplam tahsis tahsilatı veya fatura bakiyesini aşamaz. İade/iptal ters kayıt ve belge süreciyle yönetilir, geçmiş silinmez. API kotalarına uygun sınırlı artan bekleme ve günlük reconciliation; webhook gelirse imzalı ve dedup kontrollü işlenir.

Denetim: sunucu zamanlı eklemeli olaylar, aktör, karar nedeni, sürüm/hash, operasyon ve belge kimliği; sır ve tam müşteri payload'ı yok. Değiştirilemez log ve yedekleme üretim gereksinimidir; bu aşamadaki RAM mock denetim izi değildir.

## Öğrenci adına fatura kuralı

Alıcı yalnız öğrencinin adı ve T.C. kimlik numarasıdır. Dönem öğrenci kaydı ve ana öğrenci kimliği kullanılır; anne/baba/vasi bilgilerine geri dönüş yoktur. Kimlik eksik veya çelişkiliyse onay engellenir. Cari eşleşmesi öğrenci kimliği, adı ve öğrenci kayıt ID’siyle tekil doğrulanmalıdır. Alıcı ve cari karar formundan değiştirilemez; kimlik değişince önceki onay geçersiz olur. Ekranda T.C. maskelenir, olay geçmişine tam T.C. yazılmaz. Kimlik kontrolü biçim/eşleşme kontrolüdür; resmî kimlik doğrulama değildir.

Tasarım Portal’ın indigo başlığı, açık zemini, yuvarlak kartları ve mobil kart düzeniyle uyumludur.

## Uygulanan kapsam

- js/finans/invoices/config.js: önizleme varsayılan kapalı; liveIssue koşulsuz hata verir.
- dashboard.js: özellik açıldığında mevcut Muhasebe içinde salt okunur aday önizlemesi. Firestore yazımı veya yeni izin yok.
- invoices/core.js: aday doğrulama, banka mutabakatı, eski/tekrarlı/iade hareketi blokları; RAM tabanlı mock durum makinesi, sürüm kontrolü, rol ayrımı, gerekçeli istisna, kaynak değişikliği bloklama, manuel onay, eşzamanlı çift gönderim engeli, belirsizlik sonrası sorgu, olay izi.
- invoices/ui.js ve qa/invoice-demo.html: tamamen sentetik demo, rol simülasyonu, karar formu, filtre, durum sorgusu. Ağ bağlantısı CSP connect-src none ile kapalı. Sayfa kapanınca test kararları kaybolur.
- Gerçek İşbaşı adaptörü, kalıcı taslak/iş kuyruğu, Firestore kuralları, cross-worker kilidi, geçmiş belge import'u, gerçek auth ve API payload hesaplayıcısı bu aşamada uygulanmadı. Test ortamı ve API sözleşmesi doğrulanmadan bunlar açılmayacak.

## Uluslararası örnekler

- Stripe: draft → finalize ayrımı, son halin korunması; Portal taslağı ile e-belge gönderimini ayırma yaklaşımına örnek. https://docs.stripe.com/invoicing/integration/workflow-transitions
- Stripe: aynı anahtar için yanıtın korunması, değişen parametrelerin reddi; yerel operasyon/sürüm kilidi tasarımına örnek. https://docs.stripe.com/api/idempotent_requests
- Xero: DRAFT → SUBMITTED → AUTHORISED; hazırlama ve onay ayrımı. https://developer.xero.com/documentation/best-practices/user-experience/invoice-status
- Xero idempotent requests: https://developer.xero.com/documentation/guides/idempotent-requests/idempotency/

Bu ürünlerin davranışı İşbaşı'nın desteklediğine kanıt değildir; sadece tasarım örneğidir.

## Doğrulama

node --test tests/finans-*.test.mjs tests/invoice-workflow.test.mjs: 151/151 geçti (20 fatura testi). Chrome'da form açma/kaydetme, farklı rol ile onay, timeout sonrası tekrar gönderim düğmesinin olmaması, durum sorgusuyla tek test belgesine bağlanma ve gerekçeli istisna doğrulandı. Yeni tasarımda öğrenci alıcısı kilidi, test taslağının onaya hazırlanması, 390 px mobil görünümde yatay taşma olmaması ve T.C. maskelemesi ayrıca doğrulandı. Gerçek tenant, canlı rol güvenliği, GİB veya İşbaşı API entegrasyon testi değildir.

## Bir sonraki adım

Başvuru gönderildi; sağlayıcının yanıtını bekle. İşbaşı'ndan okul için test tenant/key, kesin login/baseURL, servis kullanıcı yetkileri, taslak/gönderim ayrımı, e-Arşiv dahil tüm belge sorguları, durum sözlüğü, IntegrationInvoiceReport GET/POST çelişkisi, dış referans/idempotency ve webhook/kota sözleşmesini yazılı teyit et. Anahtar/parola sohbet mesajına yazılmamalı; güvenli sunucu secret deposuna kurulmalı. Ardından test ortamında sözleşme testleri ve kalıcı sunucu katmanı hazırlanmalı. Canlı yayın ve ilk gerçek belge ayrıca kullanıcı onayı gerektirir.
