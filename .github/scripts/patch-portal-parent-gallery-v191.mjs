import fs from 'node:fs';

const path='serviceworker.js';
const source=fs.readFileSync(path,'utf8');
const before='./moduller/veli-galeri.js?v=v189';
const after='./moduller/veli-galeri.js?v=v191';
const found=source.split(before).length-1;
if(found!==1)throw new Error(`Expected one stale parent-gallery cache URL, found ${found}`);
fs.writeFileSync(path,source.replace(before,after));
console.log('Portal parent gallery precache aligned to v191.');
