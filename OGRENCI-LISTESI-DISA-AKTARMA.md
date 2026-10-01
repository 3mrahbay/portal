# Yönetim öğrenci listesi: Excel ve PDF

## Kullanım ve kapsam

Öğrenci Listesi ekranındaki indirme alanı yalnız yönetici, kurucu müdür ve müdür
oturumlarında görünür. **Aktif öğrenciler** ve **Arşiv öğrencileri** ayrı
kategorilerdir; her kategorinin kendi Excel (.xlsx) ve PDF düğmesi vardır.
Seçili eğitim yılında dönem kaydı bulunan ilgili kategorideki tüm öğrenciler
alınır. Arama, sınıf, görünüm filtresi ve ekranda görünen satır sayısı çıktıyı
daraltmaz. Başvuru ve yenileme kayıtları iki kategoriye de dahil değildir.
Arşiv kategorisi mevcut dönem-özet mantığındaki arsiv/arşiv/pasif/ayrildi/ayrıldı
durumlarını kapsar; başka yıla ait kayıtları içermez.

Sütunlar: Sıra No; Ad Soyad; T.C. Kimlik No; Doğum Tarihi; Yaşı; Cinsiyet;
Sınıfı; Anne Ad Soyad; Anne T.C. Kimlik No; Baba Ad Soyad; Baba T.C. Kimlik No.
Dosya adı ve içindeki açıklama eğitim yılını, kapsamı, öğrenci sayısını ve çıktı
tarihini içerir. Yaş, İstanbul takvimine göre çıktı tarihinde yıl ve ay olarak
hesaplanır. Eksik, geçersiz veya gelecekteki doğum tarihi boş kalır.

## Veri ve güvenlik

- Mevcut yetkili yönetim oturumunun `ogrenciList` ve `ayarListesi` belleği kullanılır
- Dönem üyeliği `ogrenciler/{id}/donemler/{seçili-yıl}` belgesine bağlıdır
- Kimlik alanları dönem belgesindeki `ogrenci`, sınıf `kayit.sinif`, ebeveynler
  açıkça adlandırılmış `anne` ve `baba` nesnelerinden gelir
- Genel Veli 1/Veli 2 veya vasi alanları anne/baba olarak tahmin edilmez
- Dönemde açıkça boşaltılmış alanlar eski ana kayıttan yeniden doldurulmaz
- Geçmiş dönemin eksik sınıfı, güncel ana kayıt sınıfıyla doldurulmaz
- Okunamayan tek bir dönem belgesi bile varsa eksik başarı yerine indirme engellenir
- Yıl/hesap değişen eşzamanlı yüklemeler atomik, sürüm kontrollü sonuç yayımlar
- Düğmeye basıldıktan sonra oturum, yetki, yıl veya yükleme değişirse dosya indirilmez
- Çıktı üretimi veritabanı yazmaz, servis çağırmaz, kimlik bilgisi loglamaz;
  dosya yalnız tarayıcı belleğinde oluşturulur
- PDF bağımlılıkları ve fontlar aynı sunucudan yüklenir; uzak CDN/çeviri/dönüştürme
  servisi kullanılmaz. Lisanslar `js/vendor/ogrenci-liste-pdf` içindedir

Excel gerçek OOXML/ZIP dosyasıdır. Tüm kimlik sütunları metindir; baştaki sıfırlar
korunur ve formül gibi görünen isimler çalıştırılmaz. Başlıklar sabitlenir,
otomatik filtre ve yazdırma başlıkları bulunur. PDF A4 yataydır; başlıklar her
sayfada tekrarlanır, uzun satırlar kesilmeden devam eder ve Türkçe font gömülür.

## Kontroller

Yalnız sentetik kayıtlarla çalıştırın:

```sh
node --test tests/ogrenci-liste-*.test.mjs
node --test tests/*.test.mjs
node tests/ogrenci-liste-pdf-browser.cjs /tmp/ogrenci-liste-pdf-qa
```

2026-10-01 doğrulaması: export birim/entegrasyon testleri geçti; gerçek XLSX
ZIP ve openpyxl ile yeniden okundu, LibreOffice ile ilk/son sayfalar görsel
kontrolden geçirildi. Gerçek PDF dosyaları parser ve Poppler ile kontrol edildi.

Tam depo testlerinde değişiklikten önce de bulunan beş hata vardır: dört eski
önbellek/sürüm beklentisi ve sabah giriş testinin `data:` modülünden göreli import
çözümleme sorunu. Yeni kapsam bu eski hataları düzeltmez.

Bu çalışma ortamında Chromium başlatma ve yerel sentetik sayfaya cloud-browser
erişimi engellendi. Dolayısıyla gerçek tarayıcı düğmesi/indirme etkileşimi burada
doğrulanamadı; yayımdan önce uygun test ortamında sentetik browser harness ve
yönetim/öğretmen oturumu görünürlük kontrolü tamamlanmalıdır. Gerçek öğrenci
verileri test dosyalarına veya hata raporlarına eklenmemelidir.
