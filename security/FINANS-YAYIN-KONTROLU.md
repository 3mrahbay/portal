# Muhasebe bütünlüğü — yayın öncesi kontrol

Bu paket taslaktır; canlı kayıtları değiştirmez. Portal ve ZEKY aynı core/data/dashboard/parent modüllerini kullanır.

## Hazır olanlar
- Aylık/dönemlik ücret, ön ödeme ve ek kalemlerde ortak kalan hesabı; kuruş hassasiyeti.
- Kısmi tahsilat gelir listesine dahil; tahsilat tarihi ile ilgili ay ayrı.
- Veli ekranında çocuk/dönem seçimi, eski dönem borcu, kalem bazlı durum, bildirim geçmişi ve kısmi tutar girişi.
- Ödeme bildirimi onayı: dönem ve bildirim atomik güncellenir; personel kimliği yalnız personele açık odemeler kaydına yazılır.
- İşlenmiş bildirim, fazla tutar, eksik tarih ve uyumsuz hareket bakiyesi onayı engeller.
- Dashboard, alacak ve gider dağılımı, tahsilat grafiği, başabaş senaryosu, sıralama/arama/filtreleme ve CSV/yazdırma.
- İşlenmiş bildirimlerde arama ve tarih/ad/tutar sıralaması; veli kalemlerinde sıralama ve hareket geçmişi.
- Tam iade / hatalı onay düzeltmesi atomik ters kayıtla işler. Özgün hareket silinmez; borç yeniden açılır. Personel açıklaması yalnız özel muhasebe kaydındadır. Gerçek para transferi yapmaz; kısmi iade, her işlem için ayrı kimlik ve kalan tahsilat sınırıyla desteklenir.
- Bildirim reddi ve ters kayıtlar veli ekranına canlı yansır; negatif net tahsilat grafikte gösterilir.
- ZEKY finans sayfalarındaki sabit finansal örnekler kaldırıldı. Gider kayıt düzenleme ve personel raporuna bağlantılar korunuyor.

## Yayın engelleri / kalan doğrulamalar
1. Canlı Firebase kuralları 21 Eylül ekranından salt okunur incelendi. Veli ödeme bildirimi sorgusu hem ogrenciId hem veliEmail içerir; kurallar mevcut e-posta filtresini zorunlu tutar.
2. `prepare-finance-rules.mjs` yalnız ödeme bildirim bloğunu değiştirir. Güncel kurallar yeniden dışa aktarılarak aday üretilmeli; diğer beş uygulamanın kuralları değiştirilmemeli.
3. Aday kural: veli başka öğrenci adına veya doğrudan onaylı bildirim oluşturamaz. Yerel Firestore Emulator ile 41 kontrol geçti: sahip veli, başka veli, muhasebe, öğretmen, danışma, PDR ve oturumsuz erişim; kısmi tahsilat, eşzamanlı mükerrer onay, fazla ödeme, ret, eşzamanlı ters kayıt ve veliye özel personel verisinin sızmaması doğrulandı. Kural henüz yayınlanmadı. Dekont kuralları da aynı aday içindedir.
4. Gerçek hesaplarla uçtan uca onay ve bağımsız tahsilat tetikleyicilerinin varlığı kontrol edilmeli. Otomatik sunucu muhasebeleştirmesi varsa aynı olayın ikinci kez işlenmediği doğrulanmalı.
5. Tarayıcı görsel/etkileşim QA henüz tamamlanmadı: yerel Chromium indirmesi zaman aşımına uğradı; cloud browser yerel file URL'sini güvenlik politikasıyla reddetti. Engelin etrafından dolaşılmadı.
6. Android derlemesi ve cihaz testi yapılmadı. Bu paket Play Store'a gönderilmedi.
7. Gerçek kasa/banka/POS bakiyeleri ve dış okul gelirleri için mevcut kaynak/hesap eşlemeleri incelenmeli. Bu paket yalnız öğrenci planlarından türetilen tahsilatı gösterir; banka mutabakatı veya ödeme entegrasyonu iddiası taşımaz.
8. Yeni sözleşme yönetimi, dekont dosyası yükleme, XLSX çıktı, kısmi iade ve banka/POS hesabına göre muhasebeleştirme bu pakette tamamlanmadı. Portalın mevcut sözleşme/ücret düzenleme alanları korunur.
9. Tarihsiz eski tahsilatlar aylık nakit grafiğine yazılmaz; kullanıcıya adet gösterilir. `odendi` ve hareket toplamı tutarsızlıkları dashboard'da mutabakat uyarısı oluşturur. Eksik eski bildirim dönem/tarih bilgisi otomatik tahmin edilmez.
10. Başabaş sabit/değişken sınıflaması tamamlanmış giderlere dayanır. Gerçekleşen net kâr olarak sunulmaz; kapasite, bordro ve vergi kaynağı tamamlığı ayrıca doğrulanmalıdır.

## Test
- `node --test tests/*.test.mjs`
- İki depodaki `js/finans` ortak dosyalarının SHA-256 değerleri aynı olmalı (entry/home/portal-entry hariç).
- Kısmi Eylül → Ekim tahsilatı; tekrar onay; ek kıyafet; eski borç; eksik tarih; hareket toplamı uyumsuzluğu.

## 21 Eylül — ikinci geliştirme paketi
- Portal: 98 test geçti. ZEKY: 16 ortak hesap testi geçti.
- Yerel Firebase Rules Emulator: 41 senaryo geçti. Hiçbir canlı belge yazılmadı.
- `tests/finans-rules-emulator.cjs` yalnız `127.0.0.1` ve `demo-finance-review` projesiyle çalışır; aday kural dosyası zorunludur.
- Çalıştırma: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8791 FINANCE_RULES_FILE=/path/candidate.rules node tests/finans-rules-emulator.cjs` (`@firebase/rules-unit-testing` ve `firebase` test bağımlılıkları gerekir).
- Emülatör sınaması istemci akışı ve aday erişim kurallarını doğrular. Canlı tetikleyicilerin varlığını, tarayıcı görünümünü, Android cihazı veya banka hareketlerini doğrulamaz.
- İade/düzeltme yalnız bu modülün oluşturduğu tahsilat ve denetim kaydı eşleştiğinde yapılabilir; eski kayıtlara tahminle uygulanmaz.
- Dekont için mevcut genel medya yükleme yolunun mali belgelerde özel erişim sağladığı doğrulanmadı; özel dosya erişimi sağlanmadan dekont bu yola bağlanmadı.

## 21 Eylül — üçüncü geliştirme paketi
- Kısmi iade: özgün tahsilata bağlı birden fazla iade, toplam limit ve mükerrer işlem kimliği denetimi; atomik dönem/bildirim/denetim güncellemesi.
- Özel dekont: PDF/JPG/PNG, 2 MB sınırı, dosya imzası kontrolü, SHA-256 bütünlük doğrulaması; bildirimle tek atomik yükleme. Ayrı Firestore belgelerinde parçalara ayrılır, herkese açık URL üretilmez. Veli sahipliği ve muhasebe/yönetim erişimi kurallarla sınanır. Değiştirme/silme kapalıdır; saklama/imha politikası ayrıca belirlenmelidir.
- CSV banka/POS mutabakatı: hesap adı, sütun eşleme, Türkçe/ondalık tutar biçimi, tarih doğrulama, benzersiz banka referansı, tahsilat/iade seçimi ve komisyon farkı. Tek banka hareketi ile tek tahsilat eşleştirilir; yinelenen referans ve tahsilat engellenir.
- Mutabakat banka API bağlantısı veya banka bakiyesi değildir. Çoklu tahsilata karşı tek toplu POS yatırımı bu ilk sürümde eşleştirilmez. Komisyon otomatik gider kaydı oluşturmaz.
- Önceki listelerde kalan olarak belirtilen dekont ve kısmi iade bu paketle kodlandı; CSV mutabakatı eklendi. Gerçek banka/POS verisiyle saha doğrulaması, özel kasa sayımı ve dış gelir kaynakları hâlâ ayrı işlerdir.
- ZEKY muhasebe dalı, daha önce dahili teste çıkan PDR/danışma dalıyla birleştiriliyor; eski rol geliştirmeleri korunur.
- Yerel test: Portal 102, ZEKY 20. Emülatör sonucu ve Android derleme bağlantısı PR açıklamasında güncellenir.
- Yayın sırası: güncel canlı kurallardan aday üret, emülatör testini tekrarla, kuralları yayınla; ardından portal/Android sürümü. Henüz üretim dağıtımı yapılmadı.
