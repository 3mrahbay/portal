# Kitap ve buluşma oylamaları

Yönetim → Kitap Kulübü → Oylamalar bölümünde tür, başlık, 2–8 seçenek ve son oy verme zamanı girilir. Tarihler Türkiye saatidir. Buluşma seçenekleri oylama bitişinden sonra olmalıdır. Süre en fazla 90 gün; buluşma en fazla bir yıl sonrasıdır.

Onaylı anne üyeler ve mevcut yetkili personel tek seçim yapar; süre dolmadan değiştirebilir veya geri çekebilir. Yönetim toplamları canlı izler ve erken kapatabilir. Seçenekler açılıştan sonra değişmez; kapanan oylama yeniden açılmaz. Sonuç gerçek kitap/buluşma kaydını kendiliğinden oluşturmaz; eşit en yüksek sonuçlar birlikte işaretlenir.

## Veri ve gizlilik

- `kitapKulubuOylamalar/{id}` yalnız uygun kulüp katılımcılarına açık seçenekleri ve toplamları tutar. İlk sayfa 20; geçmiş sayfaları isteğe bağlı yüklenir. Yüklenen sonuçlar ve kullanıcının kendi oy kaydı canlı dinlenir, ekran kapanınca dinleyiciler kaldırılır.
- `oylar/{uid}` yalnız sahibine okunabilir. Yönetim dahil diğer istemciler oy sahibinin tercihini okuyamaz veya oy listesini sorgulayamaz. Bu tam anonim bir sistem değildir: sunucu UID ile tekil oy ve tekrar kontrolü yapar.
- `yonetim/kayit` sunucuya özel oluşturma/kapatma denetim kaydıdır. İstemciler okuyamaz.
- Hiçbir istemci bu koleksiyona doğrudan yazamaz. `kitapKulubuOylama` callable güncel kimlik, anne üyeliği veya aktif personel yetkisini kontrol eder; yönetim rolü sadece oluşturma/kapatmaya izin verir. Oy ve sayaç aynı işlemde güncellenir. İstek kimliği ve revizyon çakışmaları tekrar oy sayılmasını engeller.
- Üyelik iptalinden sonra yeni işlem ve okuma engellenir. Geçmiş geçerli oylar korunur. Mevcut kitap/üye verilerine taşıma veya toplu değişiklik yapılmaz. Yeni bildirim türü ve bildirim tercihi değişikliği yoktur.

## Dağıtım ve doğrulama

Sunucu kodu `3mrahbay/zeky-backend/prod-work/kitap-kulubu/functions`; callable bölgesi `europe-west3`. Önce sunucu, sonra kurallar, sonra Portal dağıtılır. ZEKY kaynak kodu hazırlanır; mağaza/TestFlight gönderimi ayrıca bekler.

Kuralları güncel canlı dosyadan `node security/prepare-kitap-polls-rules.mjs live.rules prepared.rules` ile hazırlayın. Araç yalnız yeni match bloğu ve varsayılan kuraldan koleksiyon istisnası ekler. Başka modülün değişikliğini korumak için yayından hemen önce canlı sürümü yeniden karşılaştırın. Depodaki eski birleşik kuralları körlemesine yayımlamayın.

Yerel Firestore emülatöründe `BOOK_RULES=prepared.rules FIRESTORE_EMULATOR_HOST=127.0.0.1:18792 node tests/kitap-kulubu-polls-rules.cjs` (firebase test bağımlılıkları gerekir). Sunucu testleri eşzamanlı oylar, tekrar deneme, eski revizyon, oy geri çekme, kapanma/oy yarışı ve yetki kaybını kapsar. `qa/kitap-kulubu-polls-dom.cjs` arayüz ve hata akışlarını; `tests/kitap-kulubu-polls-store.test.mjs` sayfalama/oturum izolasyonunu doğrular. Görsel önizleme sentetik verilerle yapılır; gerçek katılımcılara deneme oylaması gönderilmez. Fiziksel mobil cihaz testi yeni mobil derleme gerektirir.
