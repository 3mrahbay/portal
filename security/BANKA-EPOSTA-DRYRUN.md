# Banka e-postası mutabakatı — güvenli ön inceleme

Bu dal **canlı tahsilat yazmaz**, personel gideri oluşturmaz, ödeme durumu değiştirmez ve bildirim göndermez. Şimdilik yalnız saf JavaScript denetim fonksiyonudur.

## Kapsam
- Banka e-postasının gönderen alanı ödeme kanıtı sayılmaz; gerçek banka referansı ve hesaba geçen tutar ayrıca doğrulanmalıdır.
- Öğrenci, dönem, taksit ve ödenmiş kayıt çakışması otomatik karar vermez.
- Zaten ödenmiş görünen kalemler tekrar yazılmaz; banka kayıtlarıyla karşılaştırma muhasebe onayında kalır.
- POS takası/brüt slip/komisyon ayrımına ve kendi hesaplar arası transferlere farklı iş akışları gerekir.
- `reviewBankPayment` tüm sonuçlarda `allowAutomaticPosting:false` döndürür.

## Test
`node --test tests/bank-dryrun-gates.test.mjs`

## Canlıya alma öncesinde
1. Yetkili sunucu bağlantısıyla (istemci anahtarı olmadan) e-posta alıcıları ve kimlik doğrulaması.
2. Paylaşılan gerçek banka referansına dayanan mükerrerlik anahtarı.
3. Eski ve yeni eğitim dönemlerine ait öğrenci kimliği kontrolü.
4. Firestore transaction ve izin kuralları için emülatör testleri.
5. Muhasebe onay ekranı ve log/audit.
6. Gerçek banka ekstresi ve POS dökümüyle mutabakat testi.

Bu paket **üretime hazır değildir**. Başka modül çağırmadığı ve yalnız yeni dosyalar içerdiği için mevcut Portal/ZEKY davranışı değişmez.
