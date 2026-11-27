import {readFileSync,writeFileSync} from 'node:fs';
export function prepare(source,snippet){
 const marker='    // ========== VARSAYILAN ==========';
 const exclusion="!(collection in ['kitapKulubu','kitapKulubuUyeler'])";
 if(!source.includes('function kkYazar()')||source.split(marker).length!==2||source.split(exclusion).length!==2||source.includes('match /kitapKulubuOylamalar/'))throw Error('Canlı kural yapısı değişmiş; yeniden inceleyin.');
 return source.replace(marker,()=>snippet+'\n'+marker).replace(exclusion,"!(collection in ['kitapKulubu','kitapKulubuUyeler','kitapKulubuOylamalar'])");
}
if(process.argv[2])writeFileSync(process.argv[3],prepare(readFileSync(process.argv[2],'utf8'),readFileSync(new URL('./kitap-kulubu-polls.rules.snippet',import.meta.url),'utf8')));
