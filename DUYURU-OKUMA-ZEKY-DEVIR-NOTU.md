# Duyuru okunma kaydı ve ekler: ZEKY için devir notu

**Hazırlayan:** Claude · **Tarih:** 23 Eylül 2026 · **Durum:** Portal tarafı canlı, ZEKY tarafı bekliyor

Bu not, portalda yapılan değişikliklerin ZEKY'ye aynı veri modeliyle taşınması içindir
(kalıcı kural: Portal ve ZEKY tek sistem, iki arayüz, tek veri modeli).
Firestore kuralları bu yapıya göre güncellendi; farklı alan adı kullanılırsa yazma reddedilir.

---

## 1. Neden değişti (KVKK)

Veli bir duyuruyu gördüğünde e-postası `duyurular/{id}.okuyanVeliler` ve
`duyurular/{id}.popupKapatanVeliler` dizilerine ekleniyordu. `duyurular` okuması
`isSignedIn()` olduğu için bu diziler (veli e-postaları) giriş yapan **herkese** açıktı
(dört site aynı Firebase projesini kullanıyor; iş başvurusu yapanlar dahil).

**Yeni kural:** Veli e-postası duyuru belgesine **yazılmaz**.

---

## 2. Yeni veri modeli

### 2a. Korumalı okuma kaydı (personel görür)
`duyurular/{duyuruId}/okumalar/{kayitId}`

| Alan | Kim yazar | Açıklama |
|---|---|---|
| `eposta` | veli / personel | Veli e-postası, küçük harf. `kayitId` ile aynı. |
| `listedeGorulme` | veli | ISO tarih. Duyuruyu listede **ilk** gördüğü an. Bir kez yazılır. |
| `simsekOnay` | veli | ISO tarih. Şimşek popup'ta "Anladım" dediği an. |
| `sonGorulme` | veli | ISO tarih. Her veli yazımında güncellenir. **Sayım bu alana göre yapılır.** |
| `uygulama` | veli | `"portal"` ya da `"zeky"` (kural yalnız bu ikisini kabul eder). |
| `yuzyuze` | personel | `{ zaman, isaretleyen, isaretleyenAd }` — "Yüz yüze söyledim". |
| `eskiKayit`, `eskiSimsek` | yönetici (aktarım) | Eski dizilerden taşınan saatsiz kayıtlar. |

- `kayitId` = veli e-postası (küçük harf). Portal hesabı olmayan veli için personel
  `yok:{ogrenciId}:{anne|baba}` kimliğiyle yalnız `yuzyuze` yazar.
- **Veli yazarken** yalnız şu alanlara dokunabilir: `eposta, listedeGorulme, simsekOnay, sonGorulme, uygulama`.
  `kayitId` kendi e-postası olmalı. İlk görüş saatini ezmemek için yazmadan önce kendi belgesini okuyun (izinli).
- Okuma: personel hepsini, veli yalnız kendi belgesini.

### 2b. Velinin kendi okundu durumu (yalnız veli okur/yazar)
`kullaniciTercihleri/{veliEposta}` — mevcut belge (favoriMenuler burada)

| Alan | Açıklama |
|---|---|
| `okunanDuyurular` | Okunan duyuru kimlikleri — `arrayUnion` ile eklenir. Okunmamış noktası buradan. |
| `kapatilanSimsekler` | "Anladım" denen şimşek duyuru kimlikleri — popup bir daha çıkmaz. |

---

## 3. ZEKY'de yapılacaklar (veli tarafı)

1. **Duyuru listesi / bildirimler ekranı**
   - Açılışta `kullaniciTercihleri/{eposta}` bir kez okunur.
   - Okunmamış = `okunanDuyurular` içinde yok **ve** (geçiş dönemi) eski `okuyanVeliler` dizisinde de yok.
   - Ekran çizildikten sonra listelenen duyurular için:
     - `okunanDuyurular`'a `arrayUnion(...idler)` (tek yazım),
     - eski dizide olmayan (gerçekten ilk görülen) her duyuru için `okumalar/{eposta}`:
       `{ eposta, listedeGorulme, sonGorulme, uygulama: "zeky" }` (`merge: true`; `listedeGorulme` zaten varsa yazmayın).
   - **`duyurular/{id}` belgesine `okuyanVeliler` YAZMAYIN.**
2. **Şimşek popup**
   - Gösterme koşulu: `kapatilanSimsekler` içinde yok **ve** eski `popupKapatanVeliler` dizisinde yok.
   - "Anladım": `okumalar/{eposta}` → `{ eposta, simsekOnay, sonGorulme, uygulama: "zeky" }`,
     `kullaniciTercihleri` → `kapatilanSimsekler` ve `okunanDuyurular`'a `arrayUnion(id)`.
   - **`popupKapatanVeliler` YAZMAYIN.**
3. **Yeni duyuru oluştururken** `okuyanVeliler: []` ve `popupKapatanVeliler: []` alanlarını artık oluşturmayın.

Portal karşılığı: `moduller/duyuru-okunma.js` → `veliDurumuYukle`, `veliOkudu`,
`veliGorulenleriKaydet`, `simsekKapatildiMi`, `simsekKapat`.

---

## 4. ZEKY'de yapılacaklar (personel tarafı, isteğe bağlı)

- "Kimler gördü" sayısı: `getCountFromServer(query(collection(db,"duyurular",id,"okumalar"), where("sonGorulme",">","")))`.
- Liste/panel mantığı için portal: `moduller/duyuru-okunma.js` (`hedefVeliler`, `durumBul`, `panelCiz`).
  Hedef veli = aktif öğrencilerin `anne/baba.eposta` (duyuru maili ile aynı).
  Öğretmen yalnız kendi sınıflarının velilerini görür.

---

## 5. Ekler (resim/dosya) — duyurular ve etkinlikler

`duyurular/{id}.ekler` ve `etkinlikler/{id}.ekler`:

```
[{ tur: "resim" | "dosya", url, yol, ad, boyut, mime, en?, boy?, yuklendi }]
```

- `url` Bunny CDN adresi (yalnız `https://` gösterin). Resimlerde küçük önizleme için `url + "?width=520"` (GIF hariç).
- Resim: içerik altında sayfayı taşırmadan gösterilir, dokununca tam ekran, X ile kapanır.
- Dosya: ad + boyut + "Aç" bağlantısı.
- Portal karşılığı: `moduller/duyuru-ekleri.js` → `html(ekler)`, `tamEkranAc`.

---

## 6. Geçiş sırası (ÖNEMLİ)

| Adım | Ne | Kim | Durum |
|---|---|---|---|
| 1 | Portal yeni yapıya yazar, eski diziye yazmaz | Claude | ✅ |
| 1 | **ZEKY yeni yapıya yazar, eski diziye yazmaz** (bu not) | ChatGPT | ⏳ |
| 2 | Eski dizileri yeni yapıya aktar (portal: Duyurular ekranındaki "Şimdi aktar") | Emrah | ⏳ |
| 3 | ZEKY bittikten sonra: aktarımı tekrar çalıştır → eski dizileri duyurulardan **sil** | Claude | ⏳ |
| 4 | Kuraldan "Veli: yalnızca okundu/kapatıldı işaretleri" iznini kaldır | Emrah | ⏳ |

**3. adım ZEKY güncellenmeden yapılmamalı**: aksi hâlde ZEKY dizileri yeniden doldurur
ve velilere yanlış okunmamış noktası gösterir.
