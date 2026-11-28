// Explicit local snapshot only. Never imports the onCall entry point or calls production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.env.DEVAM_SOURCE_PATH;
const d=root ? await import(pathToFileURL(path.join(root,'src/devam-domain.mjs'))) : null;
const check=(name,fn)=>test(name,{skip:!root},fn);
check('Dağıtılmış QR sözleşmesi istemciden kimlik/zaman kabul etmez',()=>{
 assert.throws(()=>d.istekDogrula({islem:'mola-basla',kaynak:'zeky',personelEmail:'other@test.example'}),/INVALID_INPUT/);
 assert.throws(()=>d.istekDogrula({islem:'giris',kaynak:'portal',qr:'x',konum:{enlem:0,boylam:0,dogrulukMetre:NaN}}),/INVALID_INPUT/);
});
check('QR yanlış jeton ve okul dışı konumu reddeder',()=>{
 const a={okulId:'test',jeton:'synthetic',enlem:0,boylam:0,yaricapMetre:100};
 assert.throws(()=>d.qrDogrula('ZEKY-DEVAM:test:wrong',a),/QR_GECERSIZ/);
 assert.throws(()=>d.konumKarari({enlem:1,boylam:1,dogrulukMetre:10},a),/OKUL_DISINDA/);
 assert.throws(()=>d.konumKarari({enlem:0,boylam:0,dogrulukMetre:150},a),/KONUM_DOGRULUGU/);
});
check('Sunucu pasif/çelişkili profili reddeder ve İstanbul gününü kullanır',()=>{
 assert.throws(()=>d.personelEmailCoz(null,{email:'a@test.example',email_verified:false}),/PERSONEL_DEGIL/);
 assert.throws(()=>d.personelEmailCoz({aktif:false,primaryProfile:'personel',refEmail:'a@test.example'},{}),/PERSONEL_DEGIL/);
 assert.throws(()=>d.personelEmailCoz({primaryProfile:'personel',refEmail:'a@test.example',profiles:{personel:{refEmail:'b@test.example'}}},{}),/PERSONEL_DEGIL/);
 assert.throws(()=>d.aktifPersonelDogrula({durum:'arsiv'}),/PERSONEL_PASIF/);
 assert.equal(d.istanbulTarihi(Date.parse('2026-11-27T21:30:00Z')),'2026-11-28');
});
