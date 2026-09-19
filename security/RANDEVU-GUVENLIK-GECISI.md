# Randevu güvenlik geçişi

Bu dal etkin `firestore.rules` dosyasını değiştirmez. Amaç, randevu kurallarını
mevcut üretim kurallarıyla karşılaştırıp test ettikten sonra kontrollü biçimde
devreye almaktır.

## Değişmez gizlilik şartı

- Veli başka bir velinin randevu belgesini, e-postasını, çocuğunu veya notunu okuyamaz.
- Veli `personeller` belgelerini okuyamaz.
- Randevu seçiminde yalnız yönetimin yayımladığı görünen ad ve görev etiketi bulunur.
- Personel e-postası yalnız `randevuYetkileri` özel eşleme koleksiyonunda tutulur.
- Öğretmen/PDR yalnız kendi hedef koduna gelen talebi okuyup yanıtlar.
- Yönetim tüm randevuları yönetebilir.
- `randevuDoluluk` belgeleri kişisel veri içermez.

## Koleksiyonlar

| Koleksiyon | İçerik | Veli erişimi |
|---|---|---|
| `randevuSlotlari` | Asıl talep, veli ve çocuk bilgisi | Yalnız kendi kaydı |
| `randevuDoluluk` | Hedef kodu, tarih, saat ve aktiflik | Okuyabilir; kişisel veri yok |
| `randevuYetkileri` | Hedef kodu ile personel e-postası eşlemesi | Doğrudan erişemez |
| `ayarlar/randevu` | Açık ad/görev kataloğu ve saat ayarları | Okuyabilir |

## Güvenli yayın sırası

1. ZEKY PR #10 henüz birleştirilmez.
2. Öneri kuralları mevcut Firebase Console kurallarıyla satır satır birleştirilir.
3. Rules Playground veya emülatörde aşağıdaki test matrisi çalıştırılır.
4. Kurallar yayımlanır.
5. Yönetim hesabında Randevu Ayarları bir kez kaydedilir. Bu işlem özel eşlemeyi
   ve eski kayıtların kişisel veri içermeyen doluluk karşılıklarını üretir.
6. Dört ayrı hesapla test tamamlanır.
7. Son olarak ZEKY PR #10 birleştirilir.

## Zorunlu test matrisi

- Veli A kendi randevusunu okuyabilir.
- Veli A, Veli B'nin randevusunu okuyamaz.
- Veli hiçbir `personeller` belgesini okuyamaz.
- Veli `randevuYetkileri` belgesini okuyamaz.
- Veli kişisel veri içermeyen doluluk kaydını okuyabilir.
- Öğretmen yalnız kendi hedef koduna gelen talebi okuyabilir ve yanıtlayabilir.
- Öğretmen başka öğretmenin talebini okuyamaz veya güncelleyemez.
- PDR yalnız kendi hedef koduna gelen talebi okuyabilir ve yanıtlayabilir.
- Yönetim tüm talepleri okuyabilir ve yönetebilir.
- Onay, ret, farklı saat ve iptal işlemleri doluluk kaydını aynı işlemde günceller.

## Geri dönüş

- Portal yedeği: `backup/pre-randevu-yetkisi-20260913`
- ZEKY yedeği: `backup/pre-randevu-onay-akisi-20260912`
- Eski randevular silinmez.
- Geçiş yalnız eski personel e-posta/audit alanlarını randevu belgesinden kaldırır;
  hedef kodu ve özel eşleme akışın devamını sağlar.
