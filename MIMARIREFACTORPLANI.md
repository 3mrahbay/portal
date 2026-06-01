# Portal Mimari & Modülerleşme Planı

> Amaç: Tek 28.000+ satırlık `index.html`'i (1.5 MB) **kademeli** olarak,
> kodu bozmadan, daha bakımlı ve mobil-app'e uygun bir yapıya taşımak.
> Hedef mimari: **Modüler tek-sayfa uygulama (SPA) + PWA**, çok sayıda ayrı
> HTML değil.

## Neden çok ayrı HTML değil?

| | Tek dev `index.html` | Çok ayrı HTML (veliler.html…) | **Modüler SPA (hedef)** |
|---|---|---|---|
| Güvenlik | Rules'a bağlı | Rules'a bağlı (değişmez) | Rules'a bağlı |
| İlk yük (mobil) | ❌ 1.5 MB hep iner | 🟡 sayfa başına | ✅ lazy-load, küçük |
| Sayfa geçişi | ✅ anlık | ❌ tam reload | ✅ anlık |
| Kod tekrarı | ✅ yok | ❌ Firebase/auth tekrarı | ✅ ortak modül |
| Blast radius | ❌ bir hata = her şey | ✅ izole | ✅ izole modüller |
| Mobil app (PWA/Capacitor) | 🟡 olur ama ağır | ❌ app hissi bozuk | ✅ ideal |

**Sonuç:** Güvenlik dosya yapısından gelmez (→ `firestore.rules`). Asıl
kazanım performans + bakım + blast-radius; bunun için "ayrı HTML" değil,
"tek kabuk + parçalı JS modülleri + lazy-load" doğru yol.

---

## Mevcut durum (tespit)

- `index.html`: 28.354 satır / ~1.52 MB
  - Dev `<style>` blokları (binlerce satır CSS)
  - Tüm HTML iskeleti (admin + veli panelleri, mod'lar)
  - Firebase init + tüm uygulama mantığı (tek `<script type="module">`)
- Zaten modül olan parçalar (iyi başlangıç): `ogrenci-ekle.js`,
  `aidat-donem-genislet.js`, `pdf-*.js`
- 71 yazma işlemi, ~14 Firestore koleksiyonu
- Roller: admin / kurucu_mudur / mudur / egitim_koordinator / muhasebe /
  ogretmen / veli

---

## Hedef klasör yapısı

```
portal/
├─ index.html              # sadece KABUK: <head>, fontlar, kök kapsayıcılar, modül importları
├─ css/
│  ├─ tokens.css           # :root değişkenleri (mevcut yeşil tema)
│  ├─ cicek-app.css        # yeni tasarım dili (şu an inline; buraya taşınır)
│  ├─ admin.css
│  └─ veli.css
├─ js/
│  ├─ firebase.js          # init + auth + db export (TEK yerden)
│  ├─ auth.js              # login, rol belirleme, oturum
│  ├─ util.js              # escapeHtml, tarih, para format, brevoMail
│  ├─ veli/                # veli paneli modülleri (lazy)
│  │  ├─ dashboard.js
│  │  ├─ odemeler.js
│  │  ├─ raporlar.js
│  │  └─ yeniapp.js        # yeni tasarım pilotu
│  └─ admin/
│     ├─ ogrenciler.js
│     ├─ finans.js
│     ├─ egitim.js
│     ├─ personel.js
│     └─ ...
└─ firestore.rules
```

---

## Kademeli yol haritası (her adım bağımsız, geri alınabilir)

### Faz A — Hazırlık (risk: yok)
1. **CSS'i ayır:** Inline `<style>` bloklarını `css/*.css` dosyalarına taşı,
   `<link>` ile bağla. Davranış değişmez, `index.html` ~binlerce satır küçülür.
2. Ortak yardımcıları (`escapeHtml`, format, `brevoMail`) `js/util.js`'e taşı.

### Faz B — Çekirdek modüller (risk: düşük)
3. `firebase.js` + `auth.js` oluştur; init'i tek yere al. Diğer modüller
   `import { db, auth } from './firebase.js'` kullanır (tekrar init yok).
4. ES module bağımlılık yönü: kabuk → çekirdek → özellik modülleri.

### Faz C — Özellik modülleri + lazy-load (risk: orta, en çok kazanç)
5. Her sekmenin render mantığını kendi modülüne taşı.
6. **Lazy-load:** sekme ilk açıldığında dinamik import:
   ```js
   async function veliRenderTab(tab){
     if (tab === 'odemeler') (await import('./js/veli/odemeler.js')).render();
   }
   ```
   → Veli sadece açtığı sekmenin kodunu indirir. Mobilde ilk açılış çok hızlanır.

### Faz D — Mobil (PWA → Capacitor)
7. PWA: `manifest.json` + `service-worker.js` (ayrı adımda ekleniyor).
8. İsteğe bağlı: Capacitor ile App Store / Play Store paketleme (web kodu
   aynen kullanılır, yeniden yazım yok).

---

## Güvenli refactor kuralları

- ✅ Her faz ayrı commit, davranış testi sonrası.
- ✅ Bir seferde bir modül taşı; her taşımadan sonra uygulamayı aç, ilgili
  sekmeyi test et.
- ✅ Global fonksiyon adlarını koru (HTML `onclick="..."` bağımlılıkları var) —
  modül fonksiyonlarını gerektiğinde `window.fonksiyon = fonksiyon` ile dışa aç,
  ya da `onclick`'leri `addEventListener`'a çevir.
- ✅ `:root` ve mevcut sınıf adlarına dokunma.
- ✅ Önce CSS (en güvenli), en son lazy-load (en kazançlı ama en dikkatli).

## Öncelik önerisi
1. (TAMAM) `firestore.rules` — gerçek güvenlik
2. XSS düzeltmeleri (denetim raporuna göre)
3. Faz A (CSS ayır) — hızlı, görünür kazanç, sıfır risk
4. Faz D-PWA — mobil temel
5. Faz B/C — kademeli modülerleşme
