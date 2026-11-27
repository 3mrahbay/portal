import {readFileSync,writeFileSync} from 'node:fs';
export function invoiceDraftRules(source){
 if(source.includes('match /faturaHazirlik/'))throw Error('Taslak kuralları zaten mevcut.');
 const marker='    // ========== VARSAYILAN ==========';
 const guard="collection != 'config'";
 if(!source.includes(marker)||!source.includes(guard))throw Error('Beklenen kural koruması bulunamadı.');
 return source.replace(marker,()=>readFileSync(new URL('./invoice-drafts.rules.snippet',import.meta.url),'utf8')+'\n'+marker).replace(guard,"collection != 'faturaHazirlik' && "+guard);
}
if(process.argv[2]&&process.argv[3])writeFileSync(process.argv[3],invoiceDraftRules(readFileSync(process.argv[2],'utf8')));
