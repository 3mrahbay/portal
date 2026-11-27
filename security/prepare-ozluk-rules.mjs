// Transform a fresh production snapshot; never deploys or rewrites other modules.
import fs from 'node:fs';
const [input,output]=process.argv.slice(2);
if(!input||!output||input===output)throw Error('Usage: node prepare-ozluk-rules.mjs LIVE_RULES OUTPUT');
let rules=fs.readFileSync(input,'utf8');
const fragment=fs.readFileSync(new URL('./ozluk.rules.snippet',import.meta.url),'utf8');
function replaceMatch(name){
 const marker=`match /${name}/{`, start=rules.indexOf(marker);
 if(start<0||rules.indexOf(marker,start+marker.length)>=0)throw Error(`Ambiguous match: ${name}`);
 let pos=rules.indexOf(' {',start)+1,depth=0,end=pos;
 if(pos===0)throw Error('Unexpected rule format');
 for(;end<rules.length;end++){if(rules[end]==='{')depth++;if(rules[end]==='}'&&--depth===0)break;}
 rules=rules.slice(0,start)+rules.slice(end+1);
}
for(const name of ['izinTalepleri','puantaj','puantajDuzeltmeleri','personelDurum'])replaceMatch(name);
const insertion=rules.indexOf('match /bordrolar/');
if(insertion<0||rules.includes('function ozlukYetkili()'))throw Error('Unexpected base or already applied');
rules=rules.slice(0,insertion)+fragment+'\n    '+rules.slice(insertion);
const fallback = "allow read, write: if collection != 'config'";
if(!rules.includes(fallback)) throw Error('Unknown admin fallback');
rules=rules.replace(fallback, fallback + " && !(collection in ['izinTalepleri','puantaj','puantajDuzeltmeleri','ozlukIslemKayitlari','personelDurum'])");
fs.writeFileSync(output,rules);
