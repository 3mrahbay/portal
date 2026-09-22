export const CATEGORIES=['Sınıf malzemesi','Sanat','Kırtasiye','Gıda','Temizlik','Onarım','Kitap','Ulaşım','Ofis','Diğer'];
export function receiptTotal(text){
 const lines=String(text||'').toLocaleUpperCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/İ/g,'I').split(/\r?\n/);
 const found=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(!/(TOPLAM|TOTAL|ODENECEK|GENEL TUTAR)/.test(line)||/(ARA\s*TOPLAM|SUBTOTAL|KDV|VERGI|ISKONTO|INDIRIM|PARA USTU)/.test(line))continue;
  const score=/(GENEL\s*TOPLAM|ODENECEK|GRAND\s*TOTAL)/.test(line)?2:1;
  let values=line.match(/\d[\d.,]*[.,]\d{2}(?!\d)/g);
  if(!values?.length&&/^\s*[*₺TL\s\d.,]+$/.test(lines[i+1]||''))values=lines[i+1].match(/\d[\d.,]*[.,]\d{2}(?!\d)/g);
  if(values?.length===1){const raw=values[0],last=Math.max(raw.lastIndexOf(','),raw.lastIndexOf('.')),value=Number(raw.slice(0,last).replace(/[.,]/g,'')+'.'+raw.slice(last+1));if(Number.isFinite(value)&&value>0)found.push({value,score});}
 }
 const max=Math.max(0,...found.map(x=>x.score)),values=[...new Set(found.filter(x=>x.score===max).map(x=>x.value))];
 return {amount:values.length===1?values[0]:null,candidates:values};
}
export function validateReceipt(file){if(!file)return;if(file.size>15*1024*1024)throw Error('Dosya en fazla 15 MB olabilir.');if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))throw Error('JPG, PNG, WebP veya PDF seçin.');}
export function localDate(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());}
