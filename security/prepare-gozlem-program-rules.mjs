// Review-only optimization of the released observation write checks. No deployment.
// Keeps the same role -> program mapping and all existing allow conditions.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export function prepare(source){
  const start="      allow create: if isAdmin() || isYonetim() || isKoordinator()\n        || (isSinifOgretmeni() && ogretmenOgrencisi(ogrenciId));";
  const end="      // Branş öğretmeni: kazanım yazamaz (kural yok = yasak)";
  const blockStart=source.indexOf(start,source.indexOf('match /ogrenciGelisim/'));
  const blockEnd=source.indexOf(end,blockStart);
  if(blockStart<0||blockEnd<0)throw Error('Gelişim yazma kuralları bulunamadı.');
  const expected=`${start}
      // Sınıf öğretmeni: tüm programlarda serbest
      allow update: if isAdmin() || isYonetim() || isKoordinator()
        || (isSinifOgretmeni() && ogretmenOgrencisi(ogrenciId));
      // Program öğretmeni: SADECE kendi disiplin alanını yazabilir.
      allow update: if isProgramOgretmeni() && ogretmenOgrencisi(ogrenciId)
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly([ogretmenDisiplini(), 'rozetler']);
`;
  if(source.slice(blockStart,blockEnd)!==expected)throw Error('Gelişim yetkileri değişmiş; yeniden inceleyin.');
  const replacement=`      // Same permissions; resolve the UID-aware staff role only once.
      function gelisimYazabilir(yeni) {
        let rol = personelRol();
        let program = rol == 'ingilizce_ogretmeni' ? 'ingilizce'
          : rol == 'degerler_ogretmeni' ? 'degerler'
          : rol == 'orman_ogretmeni' ? 'orman' : '__yok__';
        return rol in ['kurucu_mudur', 'mudur', 'egitim_koordinator']
          || (rol in ['ogretmen', 'yardimci_ogretmen'] && ogrenciSinifiEslesir(ogrenciId))
          || (!yeni && program != '__yok__' && ogrenciSinifiEslesir(ogrenciId)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly([program, 'rozetler']));
      }
      allow create: if isAdmin() || (isSignedIn() && gelisimYazabilir(true));
      allow update: if isAdmin() || (isSignedIn() && gelisimYazabilir(false));
`;
  return (source.slice(0,blockStart)+replacement+source.slice(blockEnd));
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [src,dest]=process.argv.slice(2);
  if(!src||!dest||src===dest)throw Error('Ayrı kaynak ve aday dosyaları gerekli.');
  writeFileSync(dest,prepare(readFileSync(src,'utf8')));
  console.log('Gözlem kural taslağı hazır; yayımlanmadı.');
}
