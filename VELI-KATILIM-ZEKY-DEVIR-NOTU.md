# Veli katılım kaydı: ZEKY için devir notu

**Hazırlayan:** Claude · **Tarih:** 24 Eylül 2026 · **Durum:** Portal tarafı hazır, ZEKY tarafı bekliyor

Kurucu müdür portalda **Veli Katılımı** ekranından velilerin ne zaman girdiğini, hangi
bölümlere baktığını ve giriş sıklığını canlı izliyor. Kayıtlar portal ve ZEKY'den
**aynı yapıyla** gelmeli; tek fark `uygulama: "zeky"`. Firestore kuralı bu yapıya göre
yazıldı; farklı alan adı ya da ek alan kullanılırsa yazma reddedilir.

---

## 1. Veri modeli

### 1a. Özet — `veliKatilim/{veliEposta}` (küçük harf)
Her yazımda `merge: true`. **Her yazımda `sonGorulme: serverTimestamp()` zorunlu** (kural bunu şart koşuyor).

| Alan | Tür | Ne zaman |
|---|---|---|
| `eposta` | string | her yazım (belge kimliği ile aynı) |
| `sonGorulme` | serverTimestamp | **her yazım** |
| `sonUygulama` | `"zeky"` | her yazım |
| `sonGiris` | serverTimestamp | giriş olayında |
| `girisSayisi` | `increment(1)` | giriş olayında |
| `gunler` | `{ "YYYY-MM-DD": increment(1) }` | giriş olayında (cihazın yerel tarihi) |
| `uygulamalar` | `{ zeky: increment(1) }` | giriş olayında |
| `ogrenciIdler` | string[] (en fazla 10) | giriş olayında, velinin çocukları |
| `sonEkran` | string | bölüm olayında |
| `ekranlar` | `{ bolumAnahtari: increment(1) }` | bölüm olayında |

**İzin verilen alanlar bunlardan ibarettir.** Başka alan eklemeyin.

### 1b. Akış — `veliKatilimAkisi/{veliEposta}__{ms13}{rastgele4}`
Belge kimliği: `eposta + "__" + String(Date.now()).padStart(13,"0") + 4 harf/rakam`
(kimlik saate göre sıralanır; ayrıntı ekranı bu sırayı kullanıyor).

```
{ eposta, tur: "giris" | "ekran", ekran: "<bolumAnahtari>" | "", uygulama: "zeky",
  cihaz: "mobil" | "tablet" | "masaustu", zaman: serverTimestamp() }
```
Yalnız bu altı alan. Özet ve akış yazımını **tek writeBatch** içinde yapın.

---

## 2. Ne zaman yazılır

- **Giriş (`tur: "giris"`)**: uygulama açıldığında ya da öne geldiğinde, son hareketten
  bu yana **30 dakikadan fazla** geçmişse. Son hareket zamanını cihazda tutun
  (portal: `localStorage["vk-son:{eposta}"]`).
- **Bölüm (`tur: "ekran"`)**: veli bir bölümü açtığında. Aynı bölüm 5 dakika içinde
  tekrar açılırsa yazmayın. Ana sayfa ve menü yazılmaz.
- **Nabız**: uygulama önde ve veli son 15 dakikada dokunduysa, 2 dakikada bir yalnız
  `{ eposta, sonGorulme, sonUygulama }` yazın. "Çevrimiçi" göstergesi buna dayanıyor
  (son 4 dakika).
- Personel hesaplarında **hiçbir şey yazmayın** (yalnız veliler izlenir).

---

## 3. Bölüm anahtarları (portal ile ortak)

| Anahtar | Bölüm | | Anahtar | Bölüm |
|---|---|---|---|---|
| `cocugum` | Çocuğum | | `sozlesme` | Sözleşme |
| `gunluk` | Günlük Rapor | | `okul` | Okul Hayatı |
| `gelisim` | Gelişim ve Eğitim | | `etkinlikler` | Etkinlikler |
| `galeri` | Galeri | | `randevular` | Randevular |
| `mesajlar` | Mesajlar | | `pdr` | Rehberlik |
| `duyurular` | Duyurular / Bildirimler | | `takvim` | Takvim |
| `odemeler` | Ödemeler | | `yemek` | Yemek Menüsü |
| `ayarlar` | Ayarlar | | `oryantasyon` | İlk Adımlar |

Listede olmayan bir ZEKY ekranı varsa kısa, küçük harfli bir anahtar kullanın
(yalnız harf, rakam, `-`, `_`; en fazla 40 karakter) ve bu tabloya ekleyin; portal
bilinmeyen anahtarı baş harfi büyük olarak gösterir.

Portal karşılığı: `moduller/veli-katilim.js` → `veliBaslat`, `ziyaretKontrol`,
`ekranGirdi`, `nabiz`, `kaydet`.

---

## 4. Gizlilik

Kayıtları yalnız kurucu müdür okuyabilir. Veli kendi kaydını yazabilir ama okuyamaz
ve silemez. Akış 12 aydan eskiyse panel açıldığında otomatik silinir.
Kayıt tutulduğu velilere aydınlatma metninde bildirilmelidir.
