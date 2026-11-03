# İngilizce grupları ve çoklu öğrenci hedefleme

Hazırlanan kaynak; henüz yayımlanmadı. Portal tabanı: abbedfbe65b2881ba8a41c734a4990315851fb07. ZEKY tabanı: d1d4b3d993dab83c5e4839e084f35076e57b13ab.

## Davranış

- Öğrenci ana kaydı ve ana sınıfı korunur. Yoklama veya yeni öğrenci kaydı oluşturulmaz.
- Aktif kurucu müdür, müdür ve eğitim koordinatörü grup oluşturabilir; mevcut öğrencileri doğum yılına/ana sınıfa göre süzüp topluca atayabilir.
- Her öğrencinin dönem başına en fazla bir İngilizce grubu vardır. Grup değişiklikleri aynı üyeliği günceller; değişiklik geçmişi saklanır.
- Atanan öğretmen kendi aktif İngilizce grubunu galeri/duyuru hedefi olarak seçebilir. Paylaşım anındaki mevcut öğrenci kimlikleri tek içerikte tutulur. Sonraki grup değişikliği eski içeriğin alıcılarını değiştirmez.
- Portal duyuru/galeri ve ZEKY galeri çoklu öğrenci seçer. ZEKY duyurularındaki mevcut çoklu seçim korunur. Bildirim, albüm, veli görünürlüğü ve fotoğraf izni tüm alıcılara uygulanır.
- Bir öğrenciye ait mali dönem belgesine İngilizce öğretmeni için yeni erişim verilmez.

## Doğrulama

- Firestore emülatörü: 74 izin/veri/geçmiş kontrolü geçti. Gerçek hesap, öğrenci ataması veya veli bildirimi kullanılmadı.
- Portal özellik ve medya regresyonları: 164/164 geçti. Genel tarama: 1263/1269 geçti; 5 testte pdftotext kurulu değil, 1 mesaj test dosyasının mevcut VM dinamik-import sorunu taban sürümde de yeniden üretildi. Son albüm ekleme düzeltmesi ayrıca özellik paketiyle doğrulandı.
- ZEKY JavaScript: 1152/1152 geçti. Python paketleme kontrolleri: 52 test, 3 ortam koşullu atlama; hata yok (geçici dizin gerçek /private yolu ile çalıştırıldı).
- Örnek öğrencilerle yönetim ekranı tarayıcıda incelendi.

## Sıralı yayın

1. Üretim yayını onaylandıktan sonra bcka-site projesinin aktif ruleset kimliğini ve kaynak dosyasını yeniden yedekle. security/prepare-egitim-gruplari-rules.mjs ile bu güncel kaynaktan ayrı aday üret. Yalnız yeni egitimGruplari, egitimGrupUyelikleri ve üyelik altındaki değişmez geçmiş izinleri ile galeri etkileşimlerinin çoklu alıcı kontrolünü ekle. Geniş genel kuralın bu iki koleksiyonu aşmadığını doğrula.
2. Aday emülatör kontrolünü çalıştır; yalnız onaylanan Firestore release değişikliğini yayımla, ardından aktif ruleset kimliği ve içeriğini geri oku.
3. ZEKY kaynak değişiklikleri kurulu uygulamayı güncellemez. Yeni Android/iOS paketleri ve dağıtımı ayrıca gerekir. Mevcut kurulu galeri sürümleri çoklu alıcılı yeni içerikleri eksik gösterebilir; güncel mobil sürümde ikinci öğrencinin görünürlüğü doğrulanmadan Portal v225 yayınını tamamlanmış sayma. Mağaza dağıtımı bu PR ile yapılmaz.
4. Portal v225 yayımlandığında yeni servis çalışanı ve bağımlılık URL’lerini yeniden yükleyerek doğrula. Yetkili yönetim ekranı, İngilizce öğretmeni hedef seçimi ve ikinci öğrenci velisinin görünürlüğünü kontrollü örneklerle onayla; gerçek veliye test bildirimi gönderme.

## Geri alma

Portal kaynağını önceki sürüme dönmek yeni üyelik belgelerini silmeyi gerektirmez. Firestore için yalnız yedeklenen release/ruleset kullanılır; kaynak ana sürümüyle senkron tutulur. Üyelik ve geçmiş belgeleri korunur.
