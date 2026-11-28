# Oylama açılış bildirimleri

Yeni `kitapKulubuOylamalar/{pollId}` belgesinin oluşturulması `kitapKulubuOylamaBildir` sunucu işlevini tetikler. Yalnız kimliği/veli kaydı geçerli, onaylı anne ve kulüp üyeliği approved olan hesaplar alıcıdır. Bekleyen, engelli, pasif kimlikli, devre dışı Auth hesabı, baba ve personel profili dışlanır. İstemciler üye listesini okumaz; bildirim gönderme yetkisi edinmez.

Bildirim Portal ve ZEKY'nin mevcut alıcı e-postasına göre okunan `bildirimler` akışına `kitap_kulubu_oylama` türüyle eklenir. Mevcut davranış korunur: uygulama içi kayıt tutulur; telefon bildirimi `kullaniciTercihleri/{email}.veliAyarlari.bildirimler.duyuru !== false` koşuluna ve kullanıcıya bağlı güncel cihaz kaydına bağlıdır. Tercih belgesi değiştirilmez. Kilit ekranı metninde kitap başlığı, kişisel tercih veya üye adı bulunmaz.

Hedef `kitap-kulubu.html?poll=<id>` olur. Portal kutusu, ZEKY kutusu, native push ve Android ön plan bildirimi aynı oylamaya gider. Oylama ilk 20 kayıtta olmasa da kimliğiyle yüklenir, üstte gösterilir ve odaklanır. Kapalı oylama sonuçları gösterir. Silinmiş kayıt, geçersiz bağlantı ve erişim kaybı açık mesaj verir. Bağlantı üyelik kontrolünü aşmaz; oturum kapandığında tüm dinleyiciler kaldırılır.

Her oylama/alıcı çifti deterministik bildirim ve sunucu defterine sahiptir. Tekrar deneme okundu durumunu sıfırlamaz, silinmiş bildirimi geri getirmez. Her cihaz için tek gönderim denemesi kaydedilir; FCM belirsiz sonucu otomatik tekrar gönderilmez. Mevcut işleyicinin 24 saat olay yaşı sınırı geçerlidir; kapatılan, süresi dolan veya silinen oylama için yeni dağıtım yapılmaz. Devam eden gönderimde üyelik ve tercihler yeniden kontrol edilir.

Dağıtım: Portal arayüzü hazırlandıktan sonra yalnız `functions:kitap-kulubu:kitapKulubuOylamaBildir` yayımlanır. Eski oylamalar toplu olarak taranmaz ve geriye dönük bildirim gönderilmez. Var olan dört kulüp işlevi ve güvenlik kuralları değiştirilmez. ZEKY kaynak kodu birleştirilebilir; mağaza/TestFlight gönderimi ayrı bekler. Eski kurulu uygulama oylama ekranını içermiyorsa doğrudan oylama açılması için yeni mobil sürüm gerekir.

Testler: gerçek yerel Firestore işlem testleri (eşzamanlı tekrar, 100+ üye, yarıda kalan dağıtım, üyelik iptali, cihaz devri, kapalı tercihler), güvenli bağlantı testleri ve Portal/ZEKY DOM akışları. FCM taklidi kullanılır; gerçek üyelere deneme bildirimi gönderilmez. Fiziksel cihazda teslim ve tıklama doğrulaması ayrıca yapılmalıdır.
