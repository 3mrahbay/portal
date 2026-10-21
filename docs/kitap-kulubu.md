# Kitap Kulübü

Onaylı anne hesapları ve aktif okul ekibi kitaplığı ve paylaşımları okuyabilir. Kulübe katılım başvurusu okul yönetimi/PDR tarafından onaylanan anneler ile aktif okul ekibi mesaj ve fotoğraf ekleyebilir. Yönetim/PDR yeni okuma ekler, geçmiş okumayı arşivler veya yeniden açar. Arşivde yeni paylaşım yapılmaz; mevcut içerik korunur.

## Veri ve yayın

- Ortak Firebase projesi: bcka-site. Kitaplar `kitapKulubu`, katılım kayıtları `kitapKulubuUyeler`; paylaşımlar kitap altındaki `paylasimlar` koleksiyonunda.
- Bir mesaj en fazla 2000 karakter ve bir fotoğraf içerir. Fotoğraf JPEG olarak küçültülür, EXIF temizlenir, en fazla 280000 karakterlik veri URI'si aynı korumalı belgede saklanır. Dışarı açık fotoğraf URL'si üretilmez.
- Her sorgu sınırlandırılır; paylaşımlar 20'şer yüklenir. Kitap ve üyelik ekranları en fazla 100 kayıt gösterir.
- Mevcut UID/profil eşlemesi ve `veliler.yakinlik=Anne` (eski kayıtlarda `rol=anne` ile geriye uyumlu), `onaylandi=true` doğrulanır. Profil yetkileri sunucudan okunur. Arayüzü gizlemek tek güvenlik önlemi değildir.
- Portal deposundaki security/kitap-kulubu.rules.snippet mevcut canlı kurallara prepare-kitap-kulubu-rules.mjs ile eklenir. Geniş varsayılan kural yeni koleksiyonları dışlar. Önce emülatör testi, sonra sunucuda derleme; canlı ruleset değişmişse işlem durdurulup yeniden birleştirilir.
- İlk gerçek etkinlik kimliği: 2026-10-bes-sevgi-dili. Test anneleri, mesajları veya geçmiş kitapları canlıya aktarılmaz.
- Geri alma: ön yüz değişikliğini geri alın; gerekirse kaydedilmiş önceki Firestore ruleset sürümüne dönün. Kitap/paylaşım verilerini silmeyin. Mobil paketin üretimi ile mağaza üzerinden kullanıcılara dağıtım ayrı adımlardır.

## Kontrol

Portal: 1158 Node testi. ZEKY: 968 Node testi, 52 Python testi (yerelde 3 araç koşullu atlama). Ortak izinler: 62 Firestore emülatör senaryosu. Tarayıcı: anne/katılımcı/ekip/yönetici/baba görünümleri, mesaj/fotoğraf ekleme, katılım onayı, arşiv, 390px mobil taşma kontrolü.

## Ayrı Portal yönetimi

`kitap-kulubu-yonetim.html`, Portal yönetim panelindeki **Kitap Kulübü Yönetimi** kartından ve kulüp sayfasındaki yönetim bağlantısından açılır. Kart, modül sekmelerini filtreleyen eski menü kodunun dışında tutulur. Sunucudan çözümlenen mevcut `access.manage` kontrolü kullanılır: aktif kurucu müdür, müdür, PDR ve mevcut `kkYonetici` içindeki admin istisnası korunur. Firestore kuralları değiştirilmez.

- Özet, katılım talepleri/üyeler, tüm kitapların mesaj/fotoğrafları ve aktif/geçmiş okumalar tek ekrandadır. Kitap/buluşma bilgileri düzenlenebilir, yeni okuma eklenebilir, arşive alınabilir veya yeniden açılabilir.
- Kitaplar ve üyeler 100, kitap altı paylaşımlar 20 kayıtlık **belge kimliği sıralı sayfalarla sunucudan sonuna kadar** okunur. İlk sayfa toplam gibi gösterilmez. Yeni koleksiyon, collection-group sorgusu veya birleşik indeks gerekmez. Görünen üyeler/paylaşımlar 20'şer açılır.
- Özet yalnız tam yükleme başarılıysa gösterilir. Toplam paylaşım kaldırılmamış kayıtları sayar; kaldırılmış kayıtlar moderasyon listesinde işaretli kalır. Sayaçlar atomik veya canlı bir rapor değildir; son yenilemede okunan kayıtları temsil eder. **Verileri yenile** ile güncellenir; yönetim işlemi sonrasında otomatik yeniden okunur.
- Bu uyumluluk yaklaşımı her yenilemede tüm kitap/üye/paylaşım belgelerini (fotoğraf alanları dahil) okur. Okuma maliyeti ve bellek kullanımı toplam içerikle artar; büyük arşivler için sunucuda ayrı bir sayım çözümü gelecekte değerlendirilmelidir. Bu PR böyle bir koleksiyon veya yetki genişlemesi eklemez.
- Üyelik şeması yalnız `updatedAt` içerir. Bekleyen kayıtta bu zaman talep zamanıdır; onay/engelleme sonrasında ilk talep zamanı **Kayıtlı değil** gösterilir. Son güncelleme ayrıca gösterilir; sahte tarih üretilmez.
- Kaldırma mevcut davranışı kullanır: belgenin metni/fotoğrafı boşaltılır, `deleted=true` olur. Öncesinde onay sorulur. Üye onayı ortak üyelik belgesini günceller; mevcut Portal/ZEKY üyelik dinleyicileri değişikliği alır.
- Her yazma öncesi sunucu profili yeniden kontrol edilir; asıl güvenlik mevcut Firestore kurallarıdır. Oturum değişiminde devam eden sayfalama durdurulur, eski ekran temizlenir. Hatalı yenilemede eski sayılar/işlem düğmeleri kullanılmaz.

### Yönetim doğrulaması

- `node --test tests/kitap-kulubu*.test.mjs`: rol sınırları, Türkiye saati, form doğrulaması, özet, tarih dürüstlüğü, 100/20 üzeri sayfalama, hata/iptal ve Portal giriş kartı.
- `NODE_PATH=<test-bağımlılıkları>/node_modules node qa/kitap-kulubu-admin-dom.cjs` (`jsdom`): gerçek yönetim modülünde onay, engelleme, kaldırma, kitap düzenleme, arşiv/yeniden açma, rol iptali, başarısız yenileme/tekrar deneme ve temizleme. Sentetik veriler kullanır.
- `tests/kitap-kulubu-rules.cjs`: yalnız emülatörde çalışır. `BOOK_RULES` mevcut temel kurallar ile depodaki güncel Kitap Kulübü parçasının birleştirilmiş yerel dosyası olmalıdır. Kurucu müdür/müdür/PDR/admin, belge kimliği sayfalaması ve yetkisiz yazmalar dahil 98 kontrol.
- `qa/kitap-kulubu-admin-ui.cjs`: Playwright yüklü bir test ortamı için sentetik tarayıcı senaryosu; `CHROME_PATH` ve isteğe bağlı `CLUB_QA_OUTPUT` ayarlanabilir. Gerçek Firebase istekleri engellenir.
