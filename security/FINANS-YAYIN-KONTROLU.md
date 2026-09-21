# Muhasebe bütünlüğü — yayın öncesi kontrol

Bu paket taslaktır; canlı kayıtları değiştirmez. Portal ve ZEKY aynı core/data/dashboard/parent modüllerini kullanır.

## Hazır olanlar
- Aylık/dönemlik ücret, ön ödeme ve ek kalemlerde ortak kalan hesabı; kuruş hassasiyeti.
- Kısmi tahsilat gelir listesine dahil; tahsilat tarihi ile ilgili ay ayrı.
- Veli ekranında çocuk/dönem seçimi, eski dönem borcu, kalem bazlı durum, bildirim geçmişi ve kısmi tutar girişi.
- Ödeme bildirimi onayı: dönem ve bildirim atomik güncellenir; personel kimliği yalnız personele açık odemeler kaydına yazılır.
- İşlenmiş bildirim, fazla tutar, eksik tarih ve uyumsuz hareket bakiyesi onayı engeller.
- Dashboard, alacak ve gider dağılımı, tahsilat grafiği, başabaş senaryosu, sıralama/arama/filtreleme ve CSV/yazdırma.
- ZEKY finans sayfalarındaki sabit finansal örnekler kaldırıldı. Gider kayıt düzenleme ve personel raporuna bağlantılar korunuyor.

## Yayın engelleri / kalan doğrulamalar
1. Canlı Firebase kuralları 21 Eylül ekranından salt okunur incelendi. Veli ödeme bildirimi sorgusu hem ogrenciId hem veliEmail içerir; kurallar mevcut e-posta filtresini zorunlu tutar.
2. `prepare-finance-rules.mjs` yalnız ödeme bildirim bloğunu değiştirir. Güncel kurallar yeniden dışa aktarılarak aday üretilmeli; diğer beş uygulamanın kuralları değiştirilmemeli.
3. Aday kural: veli başka öğrenci adına veya doğrudan onaylı bildirim oluşturamaz. Rules Emulator/Playground ile sahip veli, başka veli, muhasebe, öğretmen ve oturumsuz roller doğrulanmalı. Kural henüz yayınlanmadı.
4. Gerçek hesaplarla uçtan uca onay ve bağımsız tahsilat tetikleyicilerinin varlığı kontrol edilmeli. Otomatik sunucu muhasebeleştirmesi varsa aynı olayın ikinci kez işlenmediği doğrulanmalı.
5. Tarayıcı görsel/etkileşim QA henüz tamamlanmadı: yerel Chromium indirmesi zaman aşımına uğradı; cloud browser yerel file URL'sini güvenlik politikasıyla reddetti. Engelin etrafından dolaşılmadı.
6. Android derlemesi ve cihaz testi yapılmadı. Bu paket Play Store'a gönderilmedi.
7. Gerçek kasa/banka/POS bakiyeleri ve dış okul gelirleri için mevcut kaynak/hesap eşlemeleri incelenmeli. Bu paket yalnız öğrenci planlarından türetilen tahsilatı gösterir; banka mutabakatı veya ödeme entegrasyonu iddiası taşımaz.
8. Yeni sözleşme yönetimi, dekont dosyası yükleme, XLSX çıktı, iade/iptal ters kayıtları ve banka/POS hesabına göre muhasebeleştirme bu pakette tamamlanmadı. Portalın mevcut sözleşme/ücret düzenleme alanları korunur.
9. Tarihsiz eski tahsilatlar aylık nakit grafiğine yazılmaz; kullanıcıya adet gösterilir. `odendi` ve hareket toplamı tutarsızlıkları dashboard'da mutabakat uyarısı oluşturur. Eksik eski bildirim dönem/tarih bilgisi otomatik tahmin edilmez.
10. Başabaş sabit/değişken sınıflaması tamamlanmış giderlere dayanır. Gerçekleşen net kâr olarak sunulmaz; kapasite, bordro ve vergi kaynağı tamamlığı ayrıca doğrulanmalıdır.

## Test
- `node --test tests/*.test.mjs`
- İki depodaki `js/finans` ortak dosyalarının SHA-256 değerleri aynı olmalı (entry/home/portal-entry hariç).
- Kısmi Eylül → Ekim tahsilatı; tekrar onay; ek kıyafet; eski borç; eksik tarih; hareket toplamı uyumsuzluğu.
