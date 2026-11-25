// Review-only candidate. Never deploys or changes the input snapshot.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export function prepare(source){
  const marker='    // ====== YENİ KAYIT ======';
  if(source.split(marker).length!==2 || /match \/ogrenciler\/\{ogrenciId\}\/bildirimler\//.test(source))
    throw Error('Bildirim kurallarının güncel konumunu inceleyin.');
  const student=source.slice(source.indexOf('match /ogrenciler/'),source.indexOf(marker));
  if(student.includes('match /bildirimler/'))throw Error('Öğrenci bildirim kuralları zaten var.');
  return source.replace(marker,readFileSync(new URL('./egitim-bildirimleri.rules.snippet',import.meta.url),'utf8')+'\n'+marker);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [src,dest]=process.argv.slice(2);
  if(!src||!dest||src===dest)throw Error('Ayrı kaynak ve aday dosyaları gerekli.');
  writeFileSync(dest,prepare(readFileSync(src,'utf8')));
  console.log('Eğitim bildirimi kuralları inceleme taslağı hazır; yayımlanmadı.');
}
