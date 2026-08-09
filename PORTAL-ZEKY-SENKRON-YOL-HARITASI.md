# Portal ↔ ZEKY Senkronizasyon Yol Haritası

**Sürüm:** 1.0 · 9 Ağustos 2026
**Amaç:** ZEKY app'te geliştirilen özelliklerin portala taşınması ve iki sistemin bir daha ayrışmaması.

---

## 1. Neden bu belge gerekli

ZEKY app son aylarda hızla gelişti. Portal aynı hızda ilerlemedi. Bugün itibarıyla **ZEKY'de olup portalda olmayan** 15+ modül var. Bu ayrışma iki somut soruna yol açıyor:

- **Veri tutarsızlığı:** Aynı Firestore'u kullanıyorlar ama portal yeni alanları (`tarihler`, `veliylePaylas`, `alanAciklamalari`) tanımıyor. Portal bir kaydı güncellediğinde bu alanlar silinebilir.
- **Kullanıcı kafası karışıyor:** Veli telefondan gördüğünü bilgisayardan göremiyor.

**Kalıcı kural (hafızada kayıtlı):** Portal ve ZEKY iki arayüz, tek sistemdir. Aynı koleksiyon ve alan adları kullanılır. Bir özellik eklenirken her iki taraftaki hali karşılaştırılır, hangisi daha iyiyse o baz alınır ve diğerine de uygulanır.

---

## 2. Şu anki durum — envanter

### 2.1 ZEKY'de var, portalda YOK (taşınacak)

| # | Modül | Firestore | Öncelik |
|---|---|---|---|
| 1 | **Kazanım tarih takibi** | `ogrenciGelisim.{disiplin}.tarihler` | 🔴 KRİTİK |
| 2 | **Aşama/rozet sistemi** | `ayarlar/egitimAsama` + hesaplama | 🔴 KRİTİK |
| 3 | **Kazanım açıklamaları** | `mufredatlar.{d}.alanAciklamalari` / `.kazanimAciklamalari` | 🟡 |
| 4 | Yönetim eğitim panosu (sınıf×program ısı haritası) | okuma-türevi | 🟡 |
| 5 | Program / Sınıf görünümü | okuma-türevi | 🟡 |
| 6 | Rapor arşivi + veliye gönderim | `raporlar` | 🟡 |
| 7 | PDR birimi (gözlem, test, ilerleme) | `pdrGozlemleri`, `pdrTestleri` | 🟡 |
| 8 | Öğrenci belgeleri (evrak takibi) | `ogrenciBelgeleri`, `ayarlar/ogrenciBelgeTurleri` | 🟡 |
| 9 | Haftalık ebeveyn anketi | `memnuniyet`, `ayarlar/memnuniyetAnketi` | 🟡 |
| 10 | Anket/tercih yanıtları | `tercihler/{id}/yanitlar` | 🟢 |
| 11 | Fiş/masraf talepleri | `fisTalepleri` | 🟢 |
| 12 | Ev ziyareti | `evZiyaretleri` | 🟢 |
| 13 | Branş ders programı | `ayarlar/bransProgrami` | 🟢 |
| 14 | Doğum izni takibi | `dogumIzinleri` | 🟢 |
| 15 | Fatura/ödeme belgesi | `faturalar`, `ayarlar/faturaSayac` | 🟢 |
| 16 | Randevu slot üretimi | `randevuSlotlari` (mevcut, mantık yeni) | 🟢 |
| 17 | Belge/sözleşme onayları | `belgeOnaylari` | 🟢 |

### 2.2 Portalda var, ZEKY'de eksik olabilir (kontrol edilecek)

Portal repo'su ayrı incelenmeli. Bilinen: portal'ın devamsızlık, galeri albüm yönetimi ve finansal grafik modülleri daha olgun olabilir.

---

## 3. Kalıcı çalışma kuralları

Bunlar bir daha ayrışmayı önlemek için **her yeni özellikte** uygulanır.

### K1 — Tek veri sözleşmesi
Yeni bir Firestore alanı eklerken:
1. Alan adı **Türkçe ve açıklayıcı** olur (`veliylePaylas`, `tarihler`)
2. Bu belgenin **Bölüm 5'ine** eklenir
3. Her iki sistem de o alanı **korumalı** (bilmediği alanı silmemeli)

> ⚠️ **En sık hata:** `setDoc(ref, veri)` — merge olmadan yazmak diğer sistemin alanlarını siler.
> **Her zaman `{ merge: true }` kullan.**

### K2 — Önce veri, sonra arayüz
Yeni modül eklerken sıra: (1) Firestore yapısı → (2) Rules → (3) ZEKY ekranı → (4) portal ekranı.
Arayüz farklı olabilir, **veri yapısı asla**.

### K3 — Ortak fonksiyon kütüphanesi hedefi
ZEKY'de `js/zeky-data.js` var; portalda karşılığı yok (kod index.html içinde gömülü).
**Hedef:** portal da `js/portal-data.js` kullansın, iki dosya aynı fonksiyon adlarını taşısın.

### K4 — Değişiklik günlüğü
Her oturum sonunda bu belgenin **Bölüm 6'sına** bir satır eklenir: ne değişti, hangi koleksiyon etkilendi, portal etkilendi mi.

### K5 — Rules tek kaynak
Firestore Rules 4 sistemin ortağı. Her değişiklikte **mevcut Rules istenip üzerine eklenir**, sıfırdan yazılmaz.

---

## 4. Uygulama planı — 4 faz

### FAZ 0 · Acil güvenlik (1 oturum) 🔴
Portal'ın ZEKY verisini bozmasını engelle.

- [ ] Portal'daki tüm `setDoc` çağrılarını tara, `{merge:true}` olmayanları düzelt
- [ ] Özellikle `ogrenciGelisim` yazan yerler — `tarihler` alanını siliyor olabilir
- [ ] Portal `mufredatlar` yazarken `alanAciklamalari` / `kazanimAciklamalari` korunmalı

**Bu faz yapılmadan diğerlerine geçilmemeli.** Şu an portal bir öğrenci gelişimi kaydettiğinde ZEKY'nin tarih verisi kayboluyor olabilir.

### FAZ 1 · Ortak katman (2 oturum) 🔴
- [ ] `js/portal-data.js` oluştur — `zeky-data.js`'in portal ikizi
- [ ] Firebase init, `ogrencileriGetir`, `mufredatAlanlariGetir`, `sinifEslesirMi` gibi çekirdek fonksiyonları taşı
- [ ] Portal index.html'den bu fonksiyonları çağır (kopya kod silinir)

### FAZ 2 · Eğitim modülü senkronu (2-3 oturum) 🟡
Portalın en çok kullanılan bölümü.

- [ ] Kazanım işaretlemede **tarih kaydı** (`tarihler`)
- [ ] Aşama/rozet hesaplama + gösterimi
- [ ] Kazanım açıklamaları (editör + veli görünümü)
- [ ] Yönetim eğitim panosu

### FAZ 3 · Veli süreçleri (2 oturum) 🟡
- [ ] Öğrenci belgeleri (evrak takibi)
- [ ] Haftalık ebeveyn anketi + yönetim raporu
- [ ] Rapor arşivi
- [ ] Ev ziyareti, randevu

### FAZ 4 · Yönetim & finans (2 oturum) 🟢
- [ ] Fiş/masraf talepleri
- [ ] Fatura/ödeme belgesi
- [ ] Branş ders programı
- [ ] PDR birimi (portal versiyonu — geniş ekran avantajlı)
- [ ] Doğum izni takibi

---

## 5. Veri sözleşmesi — ortak alan tanımları

Her iki sistem bu yapıları **birebir** kullanır.

### ogrenciGelisim/{ogrenciId}
```
{
  montessori: {
    kayitlar:  { "alanId__grupAd__dersAd": "S" | "T" | "U" },
    tarihler:  { "alanId__grupAd__dersAd": "2026-08-09" },   ← YENİ
    guncellendi: serverTimestamp
  },
  orman: {...}, degerler: {...}, ingilizce: {...},
  ogretmenYorumlari: [...]
}
```
**Kural:** `tarihler` her `kayitlar` güncellemesinde birlikte yazılır. Portal bunu yazmıyorsa aylık grafikler bozulur.

### mufredatlar/{disiplin}
```
{
  alanlar: [{ id, ad, ikon, renk, gruplar: [{ ad, dersler: [...] }] }],
  alanAciklamalari:    { alanId: "metin" },                  ← YENİ
  kazanimAciklamalari: { "alanId__grup__ders": "metin" }      ← YENİ
}
```

### ayarlar/egitimAsama
```
{ esikYuzde: 80 }   // bir alandaki kazanımların %80'i "U" olunca aşama kazanılır
```

### pdrGozlemleri/{id}
```
{ ogrenciId, ogrenciAd, sinif, alan, baglam, seviye('takip'|'destek'|'tipik'),
  not, oneriler[], veliylePaylas(bool), uzmanEmail, uzmanAd, tarih }
```
**Kural:** `veliylePaylas` false ise veli GÖREMEZ. Portal bu filtreyi uygulamak zorunda (KVKK md.6).

### raporlar/{id}
```
{ ogrenciId, ogrenciAd, sinif, tur, turAd, donem, disiplin, ozet,
  olusturanEmail, olusturanAd, veliEmail, durum('olusturuldu'|'gonderildi'), tarih }
```

### ogrenciBelgeleri/{ogrenciId}__{turId}
```
{ ogrenciId, ogrenciAd, turId, turAd, ozel(bool),
  durum('yuklu'|'talep_edildi'), dosyaUrl, dosyaYol, dosyaAdi,
  yukleyenRol('veli'|'yonetim'), yukleyenEmail, tarih }
```

### memnuniyet/{veliEmail}__{hafta}
```
{ veliEmail, ogrenciId, ogrenciAd, sinif, hafta("2026-W32"),
  puanlar{}, puan(ortalama), yanitlar[], gizlilik, yorum, oneri, tarih }
```

### Diğer koleksiyonlar
`fisTalepleri` · `evZiyaretleri` · `dogumIzinleri` · `faturalar` · `belgeOnaylari` · `bransEgitmenleri`
→ Alan tanımları için `js/zeky-data.js` içindeki ilgili bölüm başlığına bakılır (her biri yorumla belgelenmiş).

---

## 6. Değişiklik günlüğü

| Tarih | Ne değişti | Etkilenen koleksiyon | Portal etkisi |
|---|---|---|---|
| 9 Ağu 2026 | Kazanım tarih takibi eklendi | `ogrenciGelisim.*.tarihler` | ⚠️ Portal bu alanı yazmıyor |
| 9 Ağu 2026 | Aşama/rozet sistemi | `ayarlar/egitimAsama` | Portal'da yok |
| 9 Ağu 2026 | Kazanım açıklamaları | `mufredatlar.*.alanAciklamalari` | ⚠️ Portal silebilir |
| 9 Ağu 2026 | PDR birimi | `pdrGozlemleri`, `pdrTestleri` | Portal'da yok |
| 9 Ağu 2026 | Rapor arşivi | `raporlar` | Portal'da yok |
| 9 Ağu 2026 | Öğrenci belgeleri | `ogrenciBelgeleri` | Portal'da yok |
| 9 Ağu 2026 | Fiş/masraf, ev ziyareti, doğum izni, branş programı | ilgili koleksiyonlar | Portal'da yok |
| 9 Ağu 2026 | Mesajlaşmada e-posta gizliliği (`gorunenAd`) | `mesajlar.katilimciBilgi` | ⚠️ Portal e-posta gösteriyor olabilir |

---

## 7. Nasıl kullanılır

**Yeni oturumda:** "Portal senkronuna devam edelim, Faz X" dediğinde bu belgeye bakılır, ilgili fazın maddeleri sırayla yapılır ve işaretlenir.

**Yeni özellik eklerken:** Bölüm 3'teki K1–K5 kurallarına uyulur, Bölüm 5'e veri sözleşmesi eklenir, Bölüm 6'ya günlük satırı yazılır.

**Bir sorun çıktığında:** Önce Bölüm 5'ten iki sistemin aynı alan adını kullanıp kullanmadığı kontrol edilir. Çoğu tutarsızlığın kaynağı budur.
