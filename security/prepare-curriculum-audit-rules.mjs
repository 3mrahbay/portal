// Review-only: all history access goes through the authorized callable.
import {readFileSync,writeFileSync} from 'node:fs';
export function prepare(source){
 const marker="    // ====== MÜFREDATLAR ======";
 const fallback="allow read, write: if collection != 'config'";
 if(!source.includes(marker)||!source.includes(fallback)||source.includes('match /mufredatDenetim/')) throw Error('Rules changed; review current source before preparing.');
 return source.replace(marker,"    match /mufredatDenetim/{document=**} { allow read, write: if false; }\n"+marker).replace(fallback,"allow read, write: if collection != 'mufredatDenetim' && collection != 'config'");
}
if(process.argv[2])writeFileSync(process.argv[3],prepare(readFileSync(process.argv[2],'utf8')));
