# Anlık Personel Bildirimleri + Yönetim Sabah Girişi — Devir Notu

**Tarih:** 24 Eylül 2026 · **Yapan:** Claude · **Sürüm:** ANLIK-BILDIRIM-1

Bu alanda paralel iş yapılmasın. Genişletme gerekirse bu nottaki yapıya eklenmeli.

## Sorun

Veli portalda "🚗 Yola çıktık, geliyoruz" dediğinde kayıt `sabahGirisleri/{ogrenciId}__{tarih}` belgesine doğru düşüyordu. Danışma ve öğretmen ana sayfasında Sabah Girişi kartı vardı, ancak **yönetim ana sayfasında (`yonetimHomeHTML`) bu kart hiç yoktu**. Bildirim bu yüzden yönetime görünmüyordu.

## Değişiklikler

1. **`index.html` · `yonetimHomeHTML`** — "Sabah Girişi · Geliş Akışı" bölümü eklendi (`#yonSabahGirisiKart`), Okul Zili'nin üstünde. Yalnız `danismaProjeksiyonYonetebilirMi()` rolleri görür (kurucu_mudur, mudur, egitim_koordinator — bu roller `sabahGirisleri`ni zaten okuyor). Kart, mevcut `moduller/sabah-girisi.js → ogretmenKart()` ile dolar ve canlı güncellenir. Kutu en fazla 340px, içi kayar.
2. **`index.html` · `adminHomeGorevleriSirala`** — "sabah girişi" görevi, "okul zili" görevinin hemen arkasında.
3. **Yeni `moduller/personel-anlik-bildirim.js`** — veli "Yola çıktık" (Sabah Girişi) veya "Almaya geliyorum" (Okul Zili) dediğinde ilgili personele **tek seferlik** açılır pencere. Personel girişinde başlar (`gorusme-notlari` satırının hemen altında), çıkışta durur (`mesajBildirimDurdur` satırının altında).
4. **Yeni `tests/personel-anlik-bildirim.test.mjs`** — saf mantık testleri (`node --test`).
5. `PORTAL_SURUM` ve `serviceworker.js` `CACHE_VERSION` birer artırıldı.

## Kurallar

- Modül **hiçbir koleksiyona yazmaz**; Firestore kuralı değişmedi. Sorgular, mevcut kartların yaptığı `where("tarih","==",bugün)` sorgularıyla birebir aynı.
- Kim görür: kurucu_mudur, mudur → tüm okul · danisma/halkla_iliskiler → tüm okul (`danismaSabahGirisleri`, `danismaPickupBildirimleri` projeksiyonlarından) · ogretmen → yalnız kendi sınıfı; sınıf ataması yoksa bildirim almaz.
- Tek seferlik: görülen anahtarlar `localStorage` → `pab-gorulen:{eposta}`. Anahtar = tür + belge + veli bildirim saati; veli tekrar bildirirse yeni pencere çıkar.
- Portal açılırken son 30 dakikadaki bekleyenler gösterilir, daha eskiler sessizce "görüldü" sayılır.
- Aynı 2,5 saniyede gelenler tek pencerede toplanır; yığında en fazla 3 kart.
- Açılır pencere yığını `gorusme-notlari.js` ile aynı `#gnYigin` kapsayıcıyı paylaşır (üst üste binmesin diye).
- Rol listeleri `ayarlar/anlikBildirimler` belgesinden değiştirilebilir: `{ acik, sabahRolleri[], zilRolleri[], ilkYuklemePencereDk }`. Belge yoksa varsayılan geçerli. Henüz bunu yazan bir yönetim ekranı yok.
- Yeni bildirim türü eklemek için: `TUR` nesnesine giriş + `olayUret()` içine dal + test.

## Açık konular

- Portal (sekme/uygulama) kapalıyken bildirim düşmez. Bunun için FCM push gerekir — ayrı iş.
- Danışma projeksiyonu dinler. Veli projeksiyona yazamazsa (velide "SG-OZET" uyarısı çıkar) danışmaya pencere, yönetimin portalı açıp projeksiyonu eşitlemesine kadar düşmez.
