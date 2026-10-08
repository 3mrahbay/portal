# Finans mutabakatı – güvenli canlı kontrol

Bu araçlar **canlı muhasebe kayıtlarını kendiliğinden değiştirmez**. PR #59 tamamlanmadan ana dala almayın. İlk araç sadece okuma yapar; ikinci araç da `--apply` kullanılmadıkça yazmaz.

## A) Firestore veri kontrolü (salt okunur)

Yetkili Google Cloud Shell oturumunda:

```bash
workdir="$(mktemp -d)"
git clone --depth 1 --branch fix/finans-tahsilat-mutabakat-20261008 https://github.com/3mrahbay/portal.git "$workdir/portal"
cd "$workdir/portal"
node --version
npm install --no-save firebase-admin
PROJECT="$(gcloud config get-value project)"
test -n "$PROJECT" && test "$PROJECT" != "(unset)" || { echo "Önce gcloud projesini seçin."; exit 1; }
node scripts/finans-canli-kontrol.cjs --project "$PROJECT" --period 2026-2027 --month 2026-10 --focus "<öğrenci adı>"
```

Dönen rapor: aktif ve arşiv dönem öğrenci sayısı, dönem planı, ilgili ayın aidatına işlenen, ayın gerçek tahsilatı, tarihsiz hareketler ve kayıt uyarıları. Aranan öğrenci için kayıt ID'si ve ödeme tarihleri görüntülenir. Çıktı kişisel finans verileri içerir: **ortak sohbet veya herkese açık GitHub'a yapıştırmayın**. Önce yalnızca özet tutarları paylaşın.

## B) Geçmiş tarihli toplu havale düzeltmesi (önce dry-run)

Banka dökümü veya dekontla tarih, toplam, öğrenci kaydı ve kaynak dönem doğrulandıktan sonra:

```bash
node scripts/finans-tarih-duzelt.cjs \
 --project "$PROJECT" \
 --student-id "<Firestore öğrenci belge ID'si>" \
 --period 2026-2027 \
 --from "<SİSTEMDEKİ YANLIŞ GERÇEK TAHSİLAT TARİHİ YYYY-AA-GG>" \
 --to "<DOĞRU BANKA TAHSİLAT TARİHİ YYYY-AA-GG>" \
 --entry-date "<SİSTEME GİRİŞ TARİHİ YYYY-AA-GG>" \
 --start-month "<İLK AİDAT AYI YYYY-AA>" \
 --count "<AY SAYISI>" \
 --monthly "<AYLIK TUTAR>" \
 --total "<TOPLAM TUTAR>" \
 --bank-ref "<BENZERSİZ BANKA DEKONT REFERANSI>"
```

Dry-run sonucu her ayın tutarı, önceki tarih, doğru tarih ve toplam tutar **tam eşleşirse** aynı komuta sonuna `--apply` eklenebilir. Hata durumunda işlem durur. `--apply` tek Firestore transaction içinde aylık tahsilat tarihlerinin güncellenmesini ve eski kayıtların denetim koleksiyonuna alınmasını sağlar. Öğrencinin ödendi ve borç durumları korunur; başka öğrenciler etkilenmez.

## C) Kod yayın kontrolü

- GitHub Actions finans testleri yeşil olmalı.
- Muhasebe/gelirler sayfasında **Aylık Aidat** filtreli Excel, aynı tarih penceresindeki ekran listesiyle aynı satır sayısında olmalı.
- Yönetici ana sayfası ile muhasebe finans paneli aynı ay için “aidata işlenen” tutarı göstermeli.
- Gerçek ödeme tarihi olan nakit grafiği; tarih düzeltmesinden sonra eski yanlış ayı değil, doğru tahsilat ayını göstermeli.
- Veli ekranında 10 ayın ödendi durumu ve toplam kalan tutar değişmemeli.
- Önce dry-run ve hesap mutabakatı; sonra kod yayını. Gerçek Firestore verisi değiştirilmeden PR'ı canlıya taşımayın.

### Belirsizlikler

Excel, kaynak Firestore belge ID'leri veya gerçek banka hareketlerini doğrulamaz. Raporun toplamı bir giriş tablosunun özeti olabilir; gerçek banka hareketiyle mutabakat yapmadan “bankaya giren nakit” iddiasında bulunmayın.
