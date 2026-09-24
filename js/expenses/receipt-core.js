export const CATEGORIES=['Sınıf malzemesi','Sanat','Kırtasiye','Gıda','Temizlik','Onarım','Kitap','Ulaşım','Ofis','Diğer'];
// ── Fişten toplam tutar okuma ──
// OCR modelleri ₺ işaretini tanımıyor: ₺ çoğu zaman "£", "$", "+" gibi bir işarete, bazen de
// "1", "4" gibi bir RAKAMA dönüşüyor (₺650.00 → 1650.00). Bu yüzden önünde işaret olmayan her
// tutarın iki okuması tutulur: olduğu gibi (raw) ve baştaki rakam atılmış hali (alt).
// Hangisinin doğru olduğuna fişin kendi içindeki sağlamalar karar verir: ödeme satırı,
// KDV tablosu (matrah + KDV = KDV dahil, KDV = matrah × oran), adet satırları ve ürün toplamı.
const AMOUNT_RE=/\d[\d.,]*[.,]\d{2}(?!\d)/g,RATES=[0.01,0.08,0.1,0.18,0.2];
const cents=v=>Math.round(v*100);
function toNumber(raw){const last=Math.max(raw.lastIndexOf(','),raw.lastIndexOf('.'));if(last<1)return null;const int=raw.slice(0,last).replace(/[.,]/g,''),dec=raw.slice(last+1);if(!/^\d+$/.test(int)||!/^\d{2}$/.test(dec))return null;const v=Number(int+'.'+dec);return Number.isFinite(v)&&v>0?Math.round(v*100)/100:null;}
function amountsOf(line){
 const clean=line.replace(/(\d[.,])\s(\d{2})(?!\d)/g,'$1$2') // OCR bazen kuruşu ayırır: "439, 30"
  .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g,m=>' '.repeat(m.length)).replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g,m=>' '.repeat(m.length));
 const out=[];for(const m of clean.matchAll(AMOUNT_RE)){const raw=toNumber(m[0]);if(raw===null)continue;
  // Önünde "£", "*", "+" gibi bir işaret görünüyorsa ₺ zaten işaret olarak okunmuştur; ilk rakam gerçektir.
  const bare=m.index===0||/\s/.test(clean[m.index-1]);const alt=bare&&/^\d\d/.test(m[0])?toNumber(m[0].slice(1)):null;
  out.push({raw,alt:alt!==null&&cents(alt)!==cents(raw)?alt:null});}
 return out;}
const options=a=>a.alt===null?[a.raw]:[a.raw,a.alt];
function sums(list){let acc=[0];for(const opts of list){const next=new Set();for(const s of acc)for(const o of opts)next.add(s+cents(o));acc=[...next];if(acc.length>1024)return [];}return acc.map(c=>c/100);}
const has=(list,v)=>list.some(o=>cents(o)===cents(v));
export function receiptTotal(text){
 const lines=String(text||'').toLocaleUpperCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/İ/g,'I').split(/\r?\n/).filter(l=>l.trim());
 const KDV=/\bK[DO0Q]?V\b|VERGI/,SKIP=/(ARA\s*TOPLAM|SUBTOTAL|ISKONTO|INDIRIM|PARA\s*UST)/;
 const info=lines.map((line,i)=>{
  let am=amountsOf(line);
  const total=/(TOPLAM|TOTAL|ODENECEK|GENEL\s*TUTAR)/.test(line)&&!SKIP.test(line)&&!(KDV.test(line)&&!/(ODENECEK|DAHIL)/.test(line));
  if(total&&!am.length&&/^\W{0,3}\d[\d.,]*[.,]\d{2}\W{0,3}(TL)?\s*$/.test((lines[i+1]||'').trim()))am=amountsOf(lines[i+1]); // TOPLAM ⏎ *345,90
  const payment=!total&&/(KREDI|KART|BANKA|NAKIT|TAHSIL|VISA|MASTER)/.test(line)&&!SKIP.test(line);
  const qty=/\bX\s*\d/.test(line)&&/\d\s*(AD|ADET|KG|LT)?\s*X\b/.test(line);
  return {i,line,am,total,payment,qty,score:/(GENEL\s*TOPLAM|ODENECEK|GRAND\s*TOTAL|DAHIL)/.test(line)?2:1};
 });
 const evidence=[];
 for(const x of info){
  if(x.payment&&x.am.length)evidence.push({i:x.i,values:options(x.am[x.am.length-1]),w:1});
  if(x.total)for(const a of x.am)evidence.push({i:x.i,values:options(a),w:1});
 }
 // KDV tablosu: her satırda matrah + KDV = KDV dahil ve KDV ≈ matrah × (%1/%8/%10/%18/%20)
 const rows=info.filter(x=>!x.total&&!x.payment&&x.am.length>=3).map(x=>{const [m,k,d]=x.am.slice(-3);let best=[],ok=[];
  for(const dv of options(d))for(const mv of options(m))for(const kv of options(k)){if(Math.abs(cents(mv)+cents(kv)-cents(dv))>1)continue;ok.push(dv);if(RATES.some(r=>Math.abs(kv-mv*r)<=Math.max(0.02,mv*r*0.01)))best.push(dv);}
  return ok.length?[...new Set((best.length?best:ok).map(cents))].map(c=>c/100):null;});
 // Satırlardan biri bile tutmuyorsa (OCR bozmuş) tablo toplamına güvenilmez
 if(rows.length&&rows.length<=6&&rows.every(Boolean)){const s=sums(rows);if(s.length)evidence.push({i:-1,values:s,w:rows.every(r=>r.length===1)?2.5:1});}
 // Ürün satırları (ilk toplam/KDV satırından önce); "3 ad X 120.00" satırı altındaki ürün tutarını sağlar
 const firstTotal=info.findIndex(x=>x.total||KDV.test(x.line));let itemsRaw=null,itemsAlt=null;
 if(firstTotal>0){const items=[];for(let j=0;j<firstTotal;j++){const x=info[j];if(x.qty||x.am.length!==1||/(FIS|FATURA|NO\b|VKN|TCKN|ETTN|SIRA)/.test(x.line))continue;
   let opts=options(x.am[0]);const q=info[j-1];
   if(q&&q.qty){const m=q.line.match(/(\d+(?:[.,]\d+)?)\s*(?:AD|ADET|KG|LT)?\s*X\s*(\d[\d.,]*[.,]\d{2})/);if(m){const exp=Number(m[1].replace(',','.'))*(toNumber(m[2])||0);const hit=opts.filter(o=>Math.abs(cents(o)-cents(exp))<=1);if(hit.length)opts=hit;}}
   items.push(opts);}
  if(items.length&&items.length<=12){
   itemsRaw=items.reduce((s,o)=>s+cents(o[0]),0)/100;itemsAlt=items.reduce((s,o)=>s+cents(o[o.length-1]),0)/100;
   const s=sums(items);if(s.length)evidence.push({i:-2,values:s,w:1});}}
 // Adaylar: en güçlü toplam satır(lar)ındaki tutarlar. Bir sağlama yalnızca iki okumadan BİRİNİ
 // destekliyorsa puan verir (ikisini birden destekliyorsa ayırt edici değildir).
 const totals=info.filter(x=>x.total&&x.am.length),bestScore=Math.max(0,...totals.map(x=>x.score));
 const cand=new Map();
 const put=(v,score,support)=>{const k=cents(v),o=cand.get(k);if(!o||o.score<score)cand.set(k,{value:v,score,support});};
 for(const x of totals.filter(x=>x.score===bestScore))for(const a of x.am){
  let sR=0,sA=0;
  for(const e of evidence){if(e.i===x.i)continue;const hR=has(e.values,a.raw),hA=a.alt!==null&&has(e.values,a.alt);if(hR&&!hA)sR+=e.w;if(hA&&!hR)sA+=e.w;}
  if(itemsRaw!==null){const r=cents(itemsRaw)===cents(a.raw),al=a.alt!==null&&cents(itemsAlt)===cents(a.alt);if(r&&!al)sR+=1.5;if(al&&!r)sA+=1.5;}
  put(a.raw,1+sR,sR);if(a.alt!==null)put(a.alt,0.6+sA,sA);
 }
 if(!cand.size){const t=evidence.find(e=>e.i===-1&&e.w>=2.5&&e.values.length===1);return t?{amount:t.values[0],candidates:[t.values[0]],verified:true}:{amount:null,candidates:[],verified:false};}
 const list=[...cand.values()].sort((a,b)=>b.score-a.score),top=list[0],tie=list.length>1&&Math.abs(list[1].score-top.score)<1e-9;
 return {amount:tie?null:top.value,candidates:list.map(x=>x.value),verified:!tie&&top.support>0};
}
// Bazı telefonlar/uygulama içi tarayıcılar dosya türünü boş ya da 'octet-stream' gönderir; türü uzantıdan tamamla.
const EXT_TYPES={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',heic:'image/heic',heif:'image/heif'};
export function receiptType(file){let t=String(file?.type||'').toLowerCase();if(t==='image/jpg'||t==='image/pjpeg')return 'image/jpeg';if(/octet-stream/.test(t))t='';if(t)return t;const name=String(file?.name||'');return name.includes('.')?EXT_TYPES[name.split('.').pop().toLowerCase()]||'':'';}
export function validateReceipt(file){if(!file)return;if(file.size>15*1024*1024)throw Error('Dosya en fazla 15 MB olabilir.');const t=receiptType(file);if(/^image\/hei[cf]/.test(t))throw Error('Bu fotoğraf HEIC biçiminde. “Resim çek” ile çekin veya JPG seçin.');if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(t))throw Error('JPG, PNG, WebP veya PDF seçin.');}
export function localDate(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());}
