// Decision + immutable audit are committed together. Security Rules enforce both.
export async function izinKararKaydet({db, fb}, {id, actor, karar, not = '', onaylananGun = null, inisiyatif = false, kaynak}) {
  if (!id || !actor || !['onaylandi','reddedildi'].includes(karar)) throw Error('Geçersiz izin kararı.');
  const aciklama=String(not).trim();
  if (aciklama.length>1000 || (karar==='reddedildi' && !aciklama)) throw Error('Ret açıklaması gerekli; not en fazla 1000 karakter olabilir.');
  if (onaylananGun!=null && (!Number.isInteger(onaylananGun)||onaylananGun<0||onaylananGun>366)) throw Error('Geçerli bir onay gün sayısı girin.');
  const ref=fb.doc(db,'izinTalepleri',id), audit=fb.doc(db,'ozlukIslemKayitlari','izin_'+id);
  return fb.runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists())throw Error('İzin talebi bulunamadı.');
    const once=snap.data();
    if(!['bekliyor','beklemede','onaybekliyor'].includes(once.durum))throw Error('Bu talep zaten sonuçlandırılmış. Listeyi yenileyin.');
    const sonra={durum:karar,kararVeren:actor,kararTarihi:new Date().toISOString(),kararNotu:aciklama};
    if(karar==='onaylandi'&&onaylananGun!=null)sonra.onaylananGun=onaylananGun;
    if(karar==='onaylandi'&&inisiyatif){sonra.etki='inisiyatif';sonra.etkiMetin='Kurum inisiyatifi · kesinti yok';}
    tx.update(ref,sonra);
    tx.set(audit,{tur:'izin-karar',talepId:id,personelEmail:once.personelEmail,actor,oncekiDurum:once.durum,yeniDurum:karar,zaman:fb.serverTimestamp(),kaynak});
  });
}
