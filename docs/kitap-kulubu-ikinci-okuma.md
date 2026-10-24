# İkinci okuma: Ebeveynliği Hissetmek

Annelere özel buluşma: **26 Kasım 2026 Perşembe, 19.00 (Europe/Istanbul)**.
Lider: **Psikolog Şeyma Baydaroğlu**. Yazar: **Jennifer Day**.
Yazar ve konu kontrolü: https://www.nezih.com.tr/ebeveynligi-hissetmek (24 Ekim 2026).
Davet metinleri kulüp için özgün hazırlanmıştır; kitap alıntısı değildir.

## İçerik ve veri sözleşmesi

- Yeni belge: `kitapKulubu/2026-11-ebeveynligi-hissetmek`, `status=active`.
- İlk belge: `kitapKulubu/2026-10-bes-sevgi-dili`, yalnız `status=archived` ve sunucu `updatedAt` alanı güncellenir. Kitap metni, kimliği, `paylasimlar` altındaki mesajlar ve fotoğraflar korunur.
- Kitaplar aynı mevcut yedi içerik alanını ve `updatedAt` alanını kullanır. Yeni koleksiyon, indeks veya güvenlik kuralı yoktur. Onaylı anne ve okul ekibi erişimi değişmez.
- Amaç belgeye yazılır. Neden katılmalı, konuşma başlıkları ve hazırlık metni ilk kitaptaki yöntemle kaynakta bulunur; `eventDetails(bookId)` iki platformda aynı metni üretir. İlk kitabın özgün başlıkları ve ileride eklenecek kitapların genel metni korunur.
- Portal yönetimi aynı koleksiyondaki iki kitabı aktif/geçmiş olarak listeler; detay metinlerini de gösterir. Mevcut düzenleme alanları, arşiv/yeniden açma işlemleri korunur.
- Duyuru kartı 27 Kasım 2026 00.00 Türkiye saatine kadar ikinci buluşmayı tanıtır; sonra genel kitaplık kartına döner. Bu süre kitabı otomatik arşivlemez.
- Portal ve ZEKY kaynakları birlikte yayımlanmalıdır. Eski mobil paket yeni Firestore kitabını görebilir, ancak kitaba özel ek metinler için güncel paket gerekir. Bu PR mağaza dağıtımı yapmaz.

## Yayın sınırı ve veri geçişi

Bu çalışma **merge/deploy veya canlı veri yazması yapmaz**. Kitabı aktifleştirecek geçiş ayrı yayın onayından sonra bir kez Portal deposundan çalıştırılmalıdır; ZEKY için aynı kayıt tekrar oluşturulmaz.

1. Yerel inceleme, kimlik bilgisi/ağ gerektirmez:
   `node scripts/kitap-kulubu-second-reading.mjs --plan`
2. Yetkili operatörün kısa ömürlü Google OAuth erişim tokenı ortamda `GOOGLE_OAUTH_ACCESS_TOKEN` olarak bulunmalıdır. Tokenı yazdırmayın veya depoya kaydetmeyin. Salt okunur kontrol:
   `node scripts/kitap-kulubu-second-reading.mjs --check`
3. **Yalnız ayrı yayın onayı sonrası**, ön yüzler hazırlanıp doğrulandıktan sonra:
   `node scripts/kitap-kulubu-second-reading.mjs --apply --backup /guvenli/konum/kitap-kulubu-oncesi.json`

Geçiş önce iki belgeyi okur. İlk kitabın kimliği/başlığı/tarihi farklıysa veya ikinci kimlikte farklı içerik varsa durur. Yeni ve özel izinli yedek dosyası oluşturulamadan yazmaz. Oluşturma ve arşivleme tek atomik commit içindedir; `exists:false` ve `updateTime` önkoşulları çakışmada işlemi reddeder. Tekrar çalıştırma aynı içeriği çoğaltmaz. Başarılı yazma iki belgeyi tekrar okuyarak doğrulanır. İşlemi sayfa açılışına veya otomatik dağıtım adımına bağlamayın.

Geri alma gerekiyorsa kitapları/paylaşımları silmeyin. Yetkili yönetim ekranından ilk kitabı yeniden açıp ikinciyi arşive alın; ön yüz geri dönüşünü ayrıca değerlendirin.

## Doğrulama (24 Ekim 2026)

- Canlı salt okunur kontrolde ilk kitap beklenen kimlik/başlık/tarih ile aktif, ikinci belge henüz yok. `--check` tam iki yazma planladı; `--apply` çalıştırılmadı.
- Kitap Kulübü + PWA hedefli testler: 36/36.
- Portal tam kaynak paketi: 1221 test, 1216 başarılı; 5 PDF testi ortamda `pdftotext` bulunmadığı için çalışamıyor. Aynı 5 eksik araç hatası değişiklik öncesi `main` kopyasında da görüldü. PWA sürüm uyuşmazlıkları bu PR'da v217 ile eşitlendi.
- Portal yönetim DOM akışı ve yeni iki kitap DOM akışı başarılı: aktif seçim, geçmiş kitap, eski mesaj/fotoğraf, arşivde kapalı yazma formu, geri dönüş, yönetim tarihi ve metinleri.
- ZEKY: 1143/1143 Node testi; Python 49 başarılı, 3 araç koşullu atlama. Python için gerçek çalışma dizininde `TMPDIR` kullanıldı (macOS `/var` → `/private/var` yol farkı giderildi).
- ZEKY iki kitap DOM akışı başarılı. Canlı anne hesabından veya mağaza paketinden dağıtım testi yapılmadı.

## Kalıcı Portal görseli

Kullanıcının sağladığı özgün JPEG, `assets/kitap-kulubu/annelerle-kitap-kulubu.jpeg` olarak eklenmiştir (1024×1536). Portal ana sayfa kartında ve kulüp sayfasının ilk bölümünde yer alır; duyuru süresi dolunca veya geçmiş okumaya geçilince kaldırılmaz. Kulüp başlığındaki görsele dokunarak tam afiş açılabilir. Görselin kendi üzerindeki Kasım etkinliği bilgileri aynen korunmuştur; yeni ay duyurusu gerektiğinde bu dosyanın editoryal olarak güncellenmesi gerekir. İzin kapısı korunur, görsel mevcut herkese açık statik site varlığı olarak sunulur. Yeni görsel çevrimdışı önbelleğe dahildir (v218).
