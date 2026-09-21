// Güncel canlı kurallar önce dışarı alınır. Bu araç yayımlamaz.
// node security/prepare-pdr-rules.mjs LIVE.rules REVIEW.rules
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export function prepare(source,snippet){
  if(source.includes('match /pdrTakipKayitlari/'))throw new Error('PDR takip kuralı zaten mevcut; elle birleştirme gerekli.');
  const marker='    // ====== PDR — ÖZEL NİTELİKLİ KİŞİSEL VERİ (KVKK md.6) ======';
  if(source.split(marker).length!==2)throw new Error('Beklenen PDR kuralı bulunamadı; işlem durdu.');
  let result=source.replace(marker,snippet+'\n'+marker);
  for(const col of ['duyurular','etkinlikler','takvim']){
    const pattern=new RegExp('(match /'+col+'/\\{[^}]+\\} \\{)');
    if(!pattern.test(result))throw new Error('Koleksiyon bulunamadı: '+col);
    const extra=`\n      // PDR okul geneline ekler; yalnız kendi içeriğini değiştirir.\n      allow create: if isPdr() && request.resource.data.get('olusturan','') == userEmail();\n      allow update: if isPdr() && resource.data.get('olusturan','') == userEmail()\n        && request.resource.data.get('olusturan','') == resource.data.get('olusturan','');\n      allow delete: if isPdr() && resource.data.get('olusturan','') == userEmail();`;
    result=result.replace(pattern,(_,match)=>match+extra);
  }
  return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [src,dest]=process.argv.slice(2);if(!src||!dest||src===dest)throw new Error('Ayrı kaynak ve çıktı yolları gerekli.');
  writeFileSync(dest,prepare(readFileSync(src,'utf8'),readFileSync(new URL('./pdr.rules.snippet',import.meta.url),'utf8')));
  console.log('İnceleme dosyası üretildi. Canlıya yayımlanmadı.');
}
