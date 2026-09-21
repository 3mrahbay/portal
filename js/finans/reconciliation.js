import {kurus,gecerliTarih,odemePlani,esc,para,sirala} from './core.js';
export function csvOku(text){
 if(text.length>2*1024*1024)throw Error('CSV en fazla 2 MB olmalı.');
 text=text.replace(/^\uFEFF/,'');const head=text.split(/\r?\n/,1)[0],delimiter=(head.match(/;/g)||[]).length>(head.match(/,/g)||[]).length?';':',';
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))rows.push(row);row=[];value='';}else value+=c;}
 if(quoted)throw Error('CSV içinde kapanmamış tırnak var.');row.push(value);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2||rows.length>501)throw Error('Başlık ve en fazla 500 hareket içeren CSV seçin.');
 const headers=rows.shift().map(s=>s.trim());if(rows.some(r=>r.length!==headers.length))throw Error('CSV satırlarının sütun sayıları uyuşmuyor.');return {headers,rows};
}
export function csvTutar(value,format='tr'){
 let s=String(value).trim().replace(/\s/g,'');
 if(format==='tr'){if(!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s))throw Error('Tutar biçimi geçersiz: '+value);s=s.replace(/\./g,'').replace(',','.');}
 else if(!/^-?\d+(?:\.\d{1,2})?$/.test(s))throw Error('Tutar biçimi geçersiz: '+value);
 const n=Number(s);if(!Number.isFinite(n)||n===0)throw Error('Tutar sıfır veya geçersiz.');return kurus(n)/100;
}
export function csvTarih(value){const s=String(value).trim(),m=s.match(/^(\d{2})[./](\d{2})[./](\d{4})$/),date=m?`${m[3]}-${m[2]}-${m[1]}`:s;if(!gecerliTarih(date))throw Error('Geçerli işlem tarihi gerekli: '+s);return date;}
export async function anahtar(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function mutabakatKaydet({fb,db,email,hesap,satir,kaynak,komisyon=0}){
 if(!hesap?.trim()||!satir.referans?.trim()||!gecerliTarih(satir.tarih)||!Number.isFinite(satir.tutar)||satir.tutar===0)throw Error('Hesap, benzersiz banka referansı, tarih ve tutar gerekli.');
 if(!Number.isFinite(komisyon)||komisyon<0)throw Error('Komisyon negatif olamaz.');
 const id='mutabakat_'+await anahtar(JSON.stringify([hesap.trim().toLocaleLowerCase('tr'),satir.referans.trim()]));
 const link='mutabakatHareket_'+await anahtar(JSON.stringify([kaynak.ogrenciId,kaynak.donem,kaynak.kalemId,kaynak.hareketId]));
 return fb.runTransaction(db,async tx=>{
 const record=fb.doc(db,'odemeler',id),lock=fb.doc(db,'odemeler',link),old=await tx.get(record),used=await tx.get(lock);
 if(old.exists()||used.exists())throw Error('Banka referansı veya tahsilat hareketi daha önce eşleştirilmiş.');
 const ds=await tx.get(fb.doc(db,'ogrenciler',kaynak.ogrenciId,'donemler',kaynak.donem));
 if(!ds.exists())throw Error('Öğrencinin dönem kaydı bulunamadı.');
 const r=odemePlani(ds.data()).satirlar.find(r=>r.id===kaynak.kalemId),m=r?.record.hareketler?.find(m=>m.id===kaynak.hareketId);
 if(!m||m.eskiKayit||m.id==='devir'||m.tur==='duzeltme')throw Error('Kimliği doğrulanmış tahsilat hareketi gerekli.');
 if(kurus(m.tutar)-kurus(komisyon)!==kurus(satir.tutar))throw Error('Tahsilat eksi komisyon banka net tutarına eşit olmalı.');
 if(kurus(m.tutar)<0&&komisyon!==0)throw Error('İade eşleştirmesinde komisyon ayrı gider hareketi olarak izlenmeli.');
 const data={tur:'banka_mutabakati',hesap:hesap.trim(),bankaReferans:satir.referans.trim(),bankaTarihi:satir.tarih,bankaTutar:satir.tutar,aciklama:satir.aciklama||'',komisyon,tahsilatTutar:Number(m.tutar),...kaynak,islemYapan:email,olusturuldu:fb.serverTimestamp()};
 tx.set(record,data);tx.set(lock,{tur:'mutabakat_kilidi',mutabakatId:id});return id;
 });
}
export function mutabakatEkrani(root,ctx,data){
 let parsed,rows=[],account='',format='tr';
 root.innerHTML='<h2>Banka / POS mutabakatı</h2><p>Hesap hareketlerini CSV olarak seçin, sütunları eşleyin ve tahsilatla karşılaştırın. Kayıt banka bakiyesi oluşturmaz. POS komisyonu burada fark olarak izlenir; gider kaydına ayrıca işlenmelidir.</p><div class="toolbar"><label>Hesap adı / son 4 hane<input id="bankAccount" maxlength="100" placeholder="Örn. Kuveyt Türk · 0002"></label><label>Hareket dosyası<input id="bankCsv" type="file" accept=".csv,text/csv"></label></div><div id="bankMapping"></div><p class="error" id="bankError" hidden></p><div id="bankRows"></div><h3>Kaydedilmiş eşleştirmeler</h3><div class="toolbar"><input id="bankSearch" placeholder="Hesap veya referans ara"><select id="bankSort"><option value="bankaTarihi-desc">Tarih · yeni → eski</option><option value="bankaTarihi-asc">Tarih · eski → yeni</option><option value="bankaTutar-desc">Tutar · büyük → küçük</option><option value="bankaTutar-asc">Tutar · küçük → büyük</option><option value="hesap-asc">Hesap · A–Z</option></select></div><div id="bankSaved"></div>';
 const error=e=>{const el=root.querySelector('#bankError');el.hidden=false;el.textContent=e.message;};
 function saved(){const term=root.querySelector('#bankSearch').value.toLocaleLowerCase('tr'),[key,dir]=root.querySelector('#bankSort').value.split('-');root.querySelector('#bankSaved').innerHTML=sirala((data.mutabakatlar||[]).filter(r=>[r.hesap,r.bankaReferans].join(' ').toLocaleLowerCase('tr').includes(term)),key,dir).map(r=>`<p>${esc(r.hesap)} · ${esc(r.bankaTarihi)} · ${esc(r.bankaReferans)} · ${para(r.bankaTutar)} net · ${para(r.komisyon)} komisyon</p>`).join('')||'<p>Eşleştirme bulunmuyor.</p>';}
 root.querySelector('#bankSearch').oninput=saved;root.querySelector('#bankSort').onchange=saved;saved();
 root.querySelector('#bankCsv').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>2*1024*1024)throw Error('CSV en fazla 2 MB olmalı.');parsed=csvOku(await file.text());const options=parsed.headers.map((h,i)=>`<option value="${i}">${esc(h)}</option>`).join('');root.querySelector('#bankMapping').innerHTML=`<div class="toolbar">${[['ref','Benzersiz referans'],['date','İşlem tarihi'],['amount','Net tutar'],['description','Açıklama']].map(([id,label])=>`<label>${label}<select id="map-${id}">${options}</select></label>`).join('')}<label>Tutar biçimi<select id="bankFormat"><option value="tr">1.234,56</option><option value="en">1234.56</option></select></label><button id="bankPreview">Karşılaştır</button></div>`;root.querySelector('#bankPreview').onclick=preview;}catch(e){error(e);}};
 function preview(){try{account=root.querySelector('#bankAccount').value.trim();if(!account)throw Error('Hesap adını girin.');format=root.querySelector('#bankFormat').value;const col=k=>Number(root.querySelector('#map-'+k).value),refs=new Set();if(new Set(['ref','date','amount'].map(col)).size!==3)throw Error('Referans, tarih ve tutar ayrı sütunlar olmalı.');rows=parsed.rows.map(r=>{const referans=r[col('ref')].trim();if(!referans||refs.has(referans))throw Error('Dosyada boş veya tekrarlanan referans var.');refs.add(referans);return {referans,tarih:csvTarih(r[col('date')]),tutar:csvTutar(r[col('amount')],format),aciklama:r[col('description')]};});renderRows();}catch(e){error(e);}}
 function renderRows(){root.querySelector('#bankError').hidden=true;const movements=data.gelirler.filter(r=>r.hareketId&&r.hareketId!=='devir'&&!r.eskiKayit&&r.tur!=='duzeltme');
 root.querySelector('#bankRows').innerHTML=`<p>${esc(account)} · ${rows.length} hareket</p>`+rows.map((r,i)=>`<div class="card"><b>${esc(r.referans)} · ${esc(r.tarih)} · ${para(r.tutar)}</b><p>${esc(r.aciklama)}</p><label>Tahsilat / iade<select data-source="${i}"><option value="">Hareket seçin</option>${movements.map((m,j)=>`<option value="${j}">${esc(m.ogrenci)} · ${esc(m.kalem)} · ${esc(m.tarih)} · ${para(m.tutar)}</option>`).join('')}</select></label><label>POS komisyonu<input data-fee="${i}" type="number" min="0" step="0.01" value="0"></label><button data-match="${i}">Eşleştirmeyi kaydet</button><small data-result="${i}"></small></div>`).join('');
 root.querySelectorAll('[data-match]').forEach(button=>button.onclick=async()=>{const i=Number(button.dataset.match),value=root.querySelector(`[data-source="${i}"]`).value,result=root.querySelector(`[data-result="${i}"]`);if(value===''){result.textContent='Önce ilgili tahsilatı seçin.';return;}const m=movements[Number(value)],komisyon=Number(root.querySelector(`[data-fee="${i}"]`).value);button.disabled=true;try{const id=await mutabakatKaydet({...ctx,hesap:account,satir:rows[i],komisyon,kaynak:{ogrenciId:m.ogrenciId,donem:m.donem,kalemId:m.kalemId,hareketId:m.hareketId}});result.textContent='Eşleştirme kaydedildi.';data.mutabakatlar.push({id,hesap:account,bankaReferans:rows[i].referans,bankaTarihi:rows[i].tarih,bankaTutar:rows[i].tutar,komisyon});saved();}catch(e){result.textContent=e.message;button.disabled=false;}});
 }
}
