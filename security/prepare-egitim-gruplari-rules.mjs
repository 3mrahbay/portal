// Produces a narrow candidate from a freshly captured live ruleset; never deploys.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export function prepare(source,snippet=readFileSync(new URL('./egitim-gruplari.rules.snippet',import.meta.url),'utf8')) {
  if(source.includes('match /egitimGruplari/'))throw Error('İngilizce grup kuralları zaten var; güncel farkı inceleyin.');
  const marker='    // ====== SINIFLAR (ZEKY) ======';
  if(source.split(marker).length!==2)throw Error('Sınıf kuralları beklenen yerde değil.');
  const fallback="allow read, write: if collection != 'config'";
  if(source.split(fallback).length!==2)throw Error('Genel kuralı elle inceleyin.');
  const legacyTarget="|| (tur == 'ogrenci' && hedef == ogrenciId)";
  const multiTarget="|| (tur == 'ogrenci' && (m.keys().hasAny(['ogrenciIds']) ? (m.ogrenciIds is list && m.ogrenciIds.size() <= 120 && hedef in m.ogrenciIds && ogrenciId in m.ogrenciIds) : hedef == ogrenciId))";
  if(source.split(legacyTarget).length!==2)throw Error('Galeri etkileşim hedefi değişmiş; inceleyin.');
  return source.replace(marker,()=>snippet+'\n'+marker).replace(fallback,fallback+" && !(collection in ['egitimGruplari','egitimGrupUyelikleri'])").replace(legacyTarget,()=>multiTarget);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [src,dest]=process.argv.slice(2);if(!src||!dest||src===dest)throw Error('Ayrı kaynak/aday dosyaları gerekli.');
 writeFileSync(dest,prepare(readFileSync(src,'utf8')));console.log('İngilizce grupları kural adayı hazır; yayımlanmadı.');
}
