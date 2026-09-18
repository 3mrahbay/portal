// Veli eğitim ekranları için ortak, salt-okunur portföy veri modeli.
// Onaylı galeri kayıtları ile ogrenciGelisim aşamalarını tek zaman çizgisinde birleştirir.

export const EGITIM_PROGRAMLARI = [
  { id:'montessori', ad:'Montessori', renk:'#356B4A', acik:'#EAF3EC' },
  { id:'orman', ad:'Orman Okulu', renk:'#557B4E', acik:'#EDF4ED' },
  { id:'degerler', ad:'Değerler Eğitimi', renk:'#74549C', acik:'#F0EAF6' },
  { id:'ingilizce', ad:'İngilizce Eğitimi', renk:'#2E5C8A', acik:'#E4EEF6' }
];

export const EGITIM_ASAMALARI = {
  S:{ ad:'Sunuldu', renk:'#64748B', acik:'#F1F5F9' },
  T:{ ad:'Tekrar ediyor', renk:'#A66F00', acik:'#FFF6D8' },
  U:{ ad:'Ustalaştı', renk:'#2D7A2D', acik:'#E8F3E8' }
};

const ASAMA_SIRASI = ['S','T','U'];

export function tarihHam(v) {
  if (!v) return '';
  if (typeof v?.toDate === 'function') {
    try { return v.toDate().toISOString(); } catch (_) { return ''; }
  }
  if (typeof v === 'object' && Number.isFinite(v.seconds)) {
    return new Date(v.seconds * 1000).toISOString();
  }
  return String(v);
}

export function programKodu(m) {
  const ham = String(m?.program || m?.disiplin || m?.kategori || m?.etkinlikBaslik || '').toLocaleLowerCase('tr');
  if (ham.includes('montessori')) return 'montessori';
  if (ham.includes('orman')) return 'orman';
  if (ham.includes('değer') || ham.includes('deger')) return 'degerler';
  if (ham.includes('ingiliz') || ham.includes('english')) return 'ingilizce';
  return EGITIM_PROGRAMLARI.some(x => x.id === ham) ? ham : '';
}

export function egitimGaleriKaydiMi(m) {
  return Boolean(m && (m.egitimKaydi === true || m.albumTuru === 'egitim' || (m.kazanimAnahtari && programKodu(m))));
}

export async function onayliGaleriGetir(ogrenciId, portal = globalThis.window?.PortalAPI) {
  if (!ogrenciId || !portal?.fb || !portal?.db) return [];
  const { fb, db } = portal;
  try {
    // Veli galerisinin çalışan güvenlik kapsamıyla aynı sorgu: yalnız onaylı
    // kayıtları ister. Öğrenci filtresi istemcide uygulanır; böylece birleşik
    // Firestore indeksi gerektirmez ve sorgu izin kurallarıyla uyumlu kalır.
    const q = fb.query(fb.collection(db,'galeri'), fb.where('durum','==','onaylandi'));
    const snap = await fb.getDocs(q), sonuc = [];
    snap.forEach(d => {
      const v = d.data() || {};
      const hedef = v.ogrenciId || v.hedefOgrenciId || (v.hedefTur === 'ogrenci' ? v.hedefDeger : '');
      if (hedef !== ogrenciId || !egitimGaleriKaydiMi(v)) return;
      const url = v.url || v.bunnyUrl || '';
      if (!v.kazanimAnahtari || !ASAMA_SIRASI.includes(v.gozlemDurum || '')) return;
      sonuc.push({ id:d.id, ...v, url });
    });
    return sonuc;
  } catch (e) {
    console.warn('veli eğitim onaylı galerisi', e?.code || e?.message || e);
    return [];
  }
}

function mufredatHaritasi(programlar) {
  const harita = new Map();
  for (const pr of EGITIM_PROGRAMLARI) {
    for (const d of programlar?.[pr.id]?.dersler || []) harita.set(`${pr.id}|${d.anahtar}`, d);
  }
  return harita;
}

function anahtarCoz(anahtar) {
  const [alanId='', grupAd='', ...kalan] = String(anahtar || '').split('__');
  return { alanId, grupAd, dersAd:kalan.join('__') || String(anahtar || '') };
}

function sunumKimligi(program, anahtar, durum) { return `${program}|${anahtar}|${durum}`; }

export function portfolyoOlustur(gelisim = {}, galeri = [], programlar = {}) {
  const katalog = mufredatHaritasi(programlar), olaylar = new Map();
  const onayliGaleriId = new Set((galeri || []).map(x => x.id).filter(Boolean));

  for (const pr of EGITIM_PROGRAMLARI) {
    const dis = gelisim?.[pr.id] || {}, detaylar = dis.detay || {};
    const anahtarlar = new Set([...Object.keys(detaylar), ...Object.keys(dis.kayitlar || {})]);
    for (const anahtar of anahtarlar) {
      const detay = detaylar[anahtar] || {}, meta = katalog.get(`${pr.id}|${anahtar}`) || anahtarCoz(anahtar);
      const asamalar = { ...(detay.asamalar || {}) };
      const durum = dis.kayitlar?.[anahtar] || detay.durum || '';
      if (durum && !asamalar[durum]) asamalar[durum] = {
        durum, tarih:detay.tarih || dis.tarihler?.[anahtar] || '', not:detay.not || '', yazar:detay.yazar || '',
        fotoUrl:detay.fotoUrl || '', fotoDurum:detay.fotoDurum || '', galeriId:detay.galeriId || '', paylas:detay.paylas
      };
      for (const kod of ASAMA_SIRASI) {
        const a = asamalar[kod];
        if (!a || a.paylas === false) continue;
        const fotoBekliyor = a.galeriId && !onayliGaleriId.has(a.galeriId) && ['beklemede','onayBekliyor'].includes(a.fotoDurum || '');
        if (fotoBekliyor) continue;
        olaylar.set(sunumKimligi(pr.id, anahtar, kod), {
          id:`gelisim:${sunumKimligi(pr.id,anahtar,kod)}`, program:pr.id, programAd:pr.ad,
          anahtar, alanId:meta.alanId || detay.alanId || '', alanAd:meta.alanAd || detay.alanAd || '',
          grupAd:meta.grupAd || detay.grupAd || '', dersAd:meta.dersAd || detay.dersAd || anahtarCoz(anahtar).dersAd,
          durum:kod, tarih:tarihHam(a.tarih || (durum === kod ? dis.tarihler?.[anahtar] : '')),
          not:a.not || '', yazar:a.yazar || '', fotoUrl:a.fotoUrl || '', fotoDurum:a.fotoDurum || '', galeriId:a.galeriId || ''
        });
      }
    }
  }

  for (const m of galeri || []) {
    const program = programKodu(m), anahtar = m.kazanimAnahtari || '', durum = m.gozlemDurum || '';
    if (!program || !anahtar || !ASAMA_SIRASI.includes(durum)) continue;
    const pr = EGITIM_PROGRAMLARI.find(x => x.id === program), meta = katalog.get(`${program}|${anahtar}`) || anahtarCoz(anahtar);
    const kimlik = sunumKimligi(program, anahtar, durum), onceki = olaylar.get(kimlik) || {};
    olaylar.set(kimlik, {
      ...onceki, id:`galeri:${m.id || kimlik}`, program, programAd:m.programAd || pr?.ad || 'Eğitim', anahtar,
      alanId:m.alanId || meta.alanId || onceki.alanId || '', alanAd:m.alanAd || meta.alanAd || onceki.alanAd || '',
      grupAd:m.grupAd || meta.grupAd || onceki.grupAd || '',
      dersAd:m.kazanimAdi || m.baslik || meta.dersAd || onceki.dersAd || anahtarCoz(anahtar).dersAd,
      durum, tarih:tarihHam(m.tarih || m.yuklemeZamani || m.olusturuldu || onceki.tarih),
      not:m.aciklama || onceki.not || '', yazar:m.yukleyenAd || onceki.yazar || '',
      fotoUrl:m.url || m.bunnyUrl || onceki.fotoUrl || '', fotoDurum:'onaylandi', galeriId:m.id || onceki.galeriId || ''
    });
  }

  return [...olaylar.values()].sort((a,b) => tarihHam(b.tarih).localeCompare(tarihHam(a.tarih)));
}

export function programSunumlari(sunumlar, program) {
  return (sunumlar || []).filter(x => x.program === program);
}

export function bugununSunumlari(sunumlar, gun) {
  return (sunumlar || []).filter(x => tarihHam(x.tarih).slice(0,10) === gun);
}

