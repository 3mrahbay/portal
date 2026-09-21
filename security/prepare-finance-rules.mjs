import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export function financeRulesPatch(source){
 const start=source.indexOf('    match /odemeBildirimleri/{bildirimId} {');
 if(start<0||source.indexOf('match /odemeBildirimleri',start+12)>=0)throw Error('Beklenen tek ödeme bildirimi bloğu bulunamadı.');
 let depth=0,end=-1;const brace=source.indexOf('{',source.indexOf('} {',start)+2);
 for(let i=brace;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0){end=i+1;break;}}
 if(end<0)throw Error('Kural bloğu tamamlanmamış.');
 return source.slice(0,start)+readFileSync(new URL('./finance.rules.snippet',import.meta.url),'utf8').trimEnd()+source.slice(end);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const [input,output]=process.argv.slice(2);if(!input||!output||input===output)throw Error('Kullanım: node prepare-finance-rules.mjs CANLI.rules ADAY.rules');writeFileSync(output,financeRulesPatch(readFileSync(input,'utf8')));}
