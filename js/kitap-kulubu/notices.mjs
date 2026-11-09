// In-app club notices use the existing recipient-scoped notification stream.
export function clubTarget(record) {
 if(!['kitap_kulubu_yanit','kitap_kulubu_tepki'].includes(record?.tip)) return '';
 const ids=[record.kitapId,record.paylasimId];
 if(ids.some(x=>typeof x!=='string'||!x||x.length>1500||/[\x00-\x1f/\\]/.test(x)))return '';
 return 'kitap-kulubu.html?book='+encodeURIComponent(ids[0])+'&post='+encodeURIComponent(ids[1]);
}
export function renderClubNotices(root,records,{open,isActive=()=>true}={}) {
 if(!root)return;
 root.replaceChildren();root.hidden=true;
 if(!isActive())return;
 const list=(records||[]).filter(clubTarget).sort((a,b)=>String(b.olusturuldu).localeCompare(String(a.olusturuldu)));
 if(!list.length)return;
 root.hidden=false;
 const doc=root.ownerDocument,heading=doc.createElement('h2');heading.textContent='Kitap Kulübü';root.append(heading);
 for(const record of list){
  const button=doc.createElement('button');button.type='button';
  button.style.cssText='display:block;width:100%;text-align:left;padding:16px;margin:8px 0;border:1px solid #d8e5da;border-radius:14px;background:#f4faf5;color:#23442d;font:inherit;cursor:pointer';
  const title=doc.createElement('strong');title.textContent=(record.okundu?'':'Yeni · ')+record.baslik;
  const text=doc.createElement('p');text.textContent=record.metin;
  const time=doc.createElement('small');const date=new Date(record.olusturuldu);time.textContent=Number.isFinite(+date)?date.toLocaleString('tr-TR'):'';
  button.append(title,text,time);button.addEventListener('click',async()=>{
   if(!isActive()||button.disabled)return;button.disabled=true;
   try{await open(record,clubTarget(record));}catch{if(isActive()){text.textContent='Bildirim açılamadı. Tekrar deneyin.';button.disabled=false;}}
  });root.append(button);
 }
}
