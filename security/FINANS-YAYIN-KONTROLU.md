# Muhasebe paketi — güncel yayın durumu

Portal ve ZEKY aynı finans hesaplama, veli, dekont, dashboard ve mutabakat modüllerini kullanır. Paket taslaktır; üretim verileri değiştirilmedi.

## Tamamlanan geliştirmeler
- Aylık/dönemlik ücret, ön ödeme ve ek kalemler için kuruş hassasiyetli ortak borç hesabı; kısmi ödeme ve geçmiş borçlar korunur.
- Veli kartında ödeme ayı ve durum; yeşil ödendi, turuncu gecikmiş. Çocuk/dönem seçimi, açık borçlar, hareket ve bildirim geçmişi, sıralama/filtreleme.
- Atomik onay: dönem, bildirim ve özel muhasebe denetimi birlikte yazılır. Mükerrer onay, fazla tutar, geçersiz tarih ve hareket-bakiye tutarsızlığı engellenir.
- Tam/kısmi iade ve hatalı onay düzeltmesi: özgün hareket silinmez, ters hareketle borç yeniden açılır. İşlem kimliği, özgün tahsilat, toplam iade ve bakiye birlikte doğrulanır. Para transferi yapmaz.
- Özel dekont: PDF/JPG/PNG, en fazla 2 MB. Dosya imzası ve SHA-256 doğrulaması; bildirimle atomik yükleme. Ayrı Firestore belgeleri/parçaları kullanır, herkese açık URL oluşturmaz. Yalnız bildiren veli ve muhasebe/yönetim okuyabilir. Personel açıklaması ve kimliği veli kaydına yazılmaz.
- Gerçek kayıtlardan dashboard, gelir/gider grafikleri, başabaş senaryosu, Türkçe sıralama, arama/filtre, CSV/yazdırma ve aylık toplu rapor.
- Banka/POS CSV mutabakatı: hesap ve sütun eşleme, Türkçe/ondalık tutar seçimi, tarih/ref doğrulaması, tahsilat/iade seçimi ve komisyon kontrolü. Banka referansı ve tahsilat hareketi ikinci kez eşleştirilemez.
- ZEKY taslağı daha önce yayımlanan PDR/danışma dalıyla birleştirildi; ilgili rol ekranları korunur.

## Doğrulama
- Portal: 104 test geçti. ZEKY: 22 test geçti.
- Yerel Firestore Emulator: 71 kontrol geçti. Sahip veli, başka veli, muhasebe, öğretmen, danışma, PDR ve oturumsuz erişim; kısmi ödeme, eşzamanlı onay/ters kayıt, fazla iade, özel dekont ve banka eşleştirmesi sınandı.
- Test komutu: `node --test tests/*.test.mjs`.
- Emülatör: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8791 FINANCE_RULES_FILE=/path/candidate.rules node tests/finans-rules-emulator.cjs`. `@firebase/rules-unit-testing` ve `firebase` test bağımlılıkları gerekir. Test yalnız yerel adres ve demo-finance-review projesiyle çalışır.
- JavaScript sözdizimi ve ortak modüllerin eşitliği kontrol edildi. Canlı yazma testi yapılmadı.
- Android 1.0.7 iş akışı: https://github.com/3mrahbay/zeky-app/actions/runs/35597371931 . Sonuç PR açıklamasında takip edilir.

## Yayın kapıları
1. Güncel canlı kurallar yeniden dışa aktarılmalı. `prepare-finance-rules.mjs` bildirim bloğunu değiştirir, özel dekont kurallarını ekler ve genel yönetici kuralının dekont değişmezliğini aşmasını önler. Diğer uygulama kurallarını korur. İkinci kez eklemeyi reddeder.
2. Güncel kaynakla üretilen aday emülatörde yeniden sınanmalı ve kurallar uygulama yayınından önce devreye alınmalı. Kurallar henüz üretime yayımlanmadı.
3. Yerel görsel önizleme tarayıcı güvenlik politikası tarafından engellendi; görsel QA tamamlanmadı. Android cihazında dosya seçme/indirme ve ekran boyutları henüz sınanmadı.
4. 21 Eylül canlı Firebase Functions listesi salt okunur incelendi: toplam iki işlev, randevuKomutV3 ve randevuSorguV3; ikisi de HTTP tetiklemeli. Listede ödeme/Firestore tetikleyicisi bulunmuyor. Haricî banka/Apps Script otomasyonlarının varlığı bu konsol kontrolüyle doğrulanmış sayılmaz.
5. Gerçek banka/POS dökümüyle hesap/sütun eşlemesi ve yetkili gerçek hesaplarla son kabul testi yapılmalı. Ana dallar ve Play Store yayını henüz değiştirilmedi.

## Kapsam sınırları
- Mutabakat banka API bağlantısı veya banka bakiyesi değildir. İlk sürüm tek banka hareketini tek tahsilatla eşleştirir; toplu POS yatırımları çoklu tahsilata dağıtılmaz. Komisyon otomatik gider oluşturmaz.
- Gelirler öğrenci ödeme kayıtlarından türetilir. Dış gelirler, kasa sayımı, fatura entegrasyonu ve tüm bordro/vergi kayıtlarının tamamlığı bu paket tarafından doğrulanmaz.
- Başabaş, sınıflandırılmış giderlere dayanan senaryodur; gerçekleşmiş net kâr olarak sunulmaz.
- Tarihsiz eski tahsilatlar aylık nakit grafiğine yazılmaz. Eksik dönem/tarih veya tutarsız hareketlere tahmin uygulanmaz. Eski sözleşme/ücret yönetimi korunur; yeni sözleşme sistemi ve XLSX çıktı eklenmedi.
- Dekontlar istemci üzerinden değiştirilmez/silinmez. Saklama ve yetkili imha süreci ayrıca tanımlanmalıdır.

## 21 Eylül — referans ekranlarına göre ilk arayüz paketi
11 ekran görüntüsü incelendi. Kart → öğrenci cari özeti → ay/kalem detayı akışı, üst bölüm gezinmesi, 10/25/50/100 satırlık sayfalama, Türkçe sütun sıralaması, bu ay vadesi gelen açık borç filtresi eklendi. Öğrenci detayında ödeme planı ve tahsilat/iade hareketleri birlikte görünür. Vade ekranı ayın gerçek vadelerini günlere göre gruplar; vadesiz borç adedi ayrıca gösterilir. Toplu rapor ekranda açılır, aranır/sıralanır, ek kalem ve ay toplamlarıyla CSV alınır. Belirsiz gider ödeme durumu artık ödendi sayılmaz.

Bu paket görsel/cihaz kabulünden geçmedi ve üretime yayımlanmadı. Önceki 1.0.7 AAB bu yeni arayüz değişikliklerini içermez; son kod için yeniden derleme gerekir.

Referansların kalan kapsamı: yeni sözleşme/ücret düzenleyicisi, okul dışı gelirler, gerçek kasa/banka/POS bakiyesi ve hesap hareketleri, çek/senet, XLSX çıktı; tüm ikincil listelerde tutarlı filtre/sıralama ve görsel kabul. Vade ekranı günlere ayrılmış aylık listedir; ay/hafta/gün takvim ızgarası henüz yoktur. Örnek ekranlardaki bakiye ve kişiler uygulamaya eklenmedi. WhatsApp gönderimi veya ödeme transferi yapılmadı.
