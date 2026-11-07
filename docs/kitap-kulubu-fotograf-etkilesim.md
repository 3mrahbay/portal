# Fotoğraf yanıtları ve emoji tepkileri

Onaylı kulüp üyeleri ve aktif okul ekibi, fotoğraflı paylaşımlara 500 karaktere kadar yanıt ve ❤️ 👏 🌸 😍 tepkisi ekler. Yanıtlar bu üyelere görünür. Fotoğraf başına kişi başına bir tepki tutulur; seçim değiştirilebilir veya geri alınabilir. Kullanıcı kendi yanıtını; yönetim/PDR tüm yanıtları kaldırabilir.

Yeni alt koleksiyonlar: `kitapKulubu/{book}/paylasimlar/{photo}/yanitlar/{replyId}` ve `tepkiler/{uid}`. Eski kitap ve paylaşım belgelerine veri geçişi gerekmez. Fotoğraf kaldırılırsa alt kayıtlar korunur ancak okunamaz/yazılamaz. Arşivde mevcut etkileşimler okunur, yeni yanıt/tepki yazılamaz. Yanıt silmek arşivde de mümkündür. Bildirim, e-posta veya push gönderilmez.

Yanıtlar açıldığında son 20 yanıt dinlenir; eski yanıtlar 20'şer yüklenir. Eski sayfalarda başka kullanıcının yaptığı silmeler sayfa yeniden açıldığında görünür. Tepkiler son 1000 kayıtla sınırlıdır; sınıra ulaşılırsa sayım kapsamı açıkça belirtilir. Kişinin kendi tepkisi ayrı dinlenir. Kitap/oturum/üyelik değişiminde dinleyiciler kapatılır. Feed güncellemesi yazılan taslağı silmez. Gönderim hatasında metin ve tekrar deneme kimliği korunur.

## Güvenlik ve yayın

Önce `security/prepare-kitap-interactions-rules.mjs <güncel-canlı.rules> <hazırlanan.rules>` ile canlı kurallara yalnız yeni alt koleksiyonları ekleyin. Canlı kuralları yayın öncesi tekrar okuyun; değişmişse yeniden hazırlayıp test edin. Genel joker izin kulüp koleksiyonlarını dışlamalıdır. Hazırlanan kurallar emülatör doğrulaması olmadan yayınlanmamalı.

`tests/kitap-kulubu-interactions-rules.cjs` tam hazırlanmış kural dosyasını `BOOK_RULES` ve yerel `FIRESTORE_EMULATOR_HOST` ile alır. Test yalnız demo projesini kullanır. Üyelik, anonim erişim, şema/alan sınırları, başka kişinin kaydı, fotoğraf/kitap yokluğu, arşiv ve aynı atomik işlemde fotoğrafı silip yanıt ekleme denenir.

`node --test tests/kitap-kulubu*.test.mjs` ve `NODE_PATH=<jsdom bağımlılığı> node qa/kitap-kulubu-interactions-dom.cjs` ile veri ve arayüz testleri çalışır. ZEKY aynı etkileşim modüllerini taşır; native cihaz testi ve mağaza paketi ayrıca gereklidir. Portal uygulama önbelleği sürümü artırılır.

Geri alma: ön yüzü önceki sürüme döndürün. Yeni alt koleksiyonları silmeyin; kuralları geri almak erişimi kapatır. Mevcut kitap/fotoğraf içerikleri değişmez.
