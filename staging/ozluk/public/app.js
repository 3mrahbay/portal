import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {getAuth, setPersistence, inMemoryPersistence, signInWithEmailAndPassword, signOut, onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {personelBelgeServisi, personelBelgeAc} from './personel-belge-client.js';
const $ = id => document.getElementById(id);
const status = text => {$('status').textContent = text;};
const config = await (await fetch('config.json', {cache:'no-store'})).json();
if (config.projectId !== 'bcka-site-staging') throw new Error('Test ortamı eşleşmiyor.');
const auth = getAuth(initializeApp(config));
await setPersistence(auth, inMemoryPersistence);
const service = personelBelgeServisi(auth);
let busy=false;
async function run(fn) {
  if(busy)return; busy=true;
  document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try {await fn();} catch(e) {status(e.message || 'İşlem tamamlanamadı.');}
  finally {busy=false; document.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
onAuthStateChanged(auth, user => {
  $('login').hidden=!!user; $('actions').hidden=!user;
  $('identity').textContent=user?`Test hesabı: ${user.email}`:'';
  status(user?'Giriş tamamlandı. Örnek test belgesini yükleyebilirsiniz.':'Yalnız size verilen test hesabıyla giriş yapın.');
});
$('loginForm').onsubmit=e=>{e.preventDefault();run(async()=>{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);$('password').value='';});};
$('logout').onclick=()=>run(async()=>{document.querySelectorAll('dialog').forEach(d=>d.close());await signOut(auth);});
async function upload(file){status('Yapay belge güvenli depoya yükleniyor…');const r=await service.upload(file);$('documentId').value=r.belgeId;status('Yüklendi. Belgeyi güvenli aç düğmesiyle erişimi kontrol edin.');}
$('upload').onclick=()=>run(()=>upload($('file').files[0]));
$('sample').onclick=()=>run(async()=>{
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
  const c=canvas.getContext('2d');c.fillStyle='#edf3f0';c.fillRect(0,0,640,360);c.fillStyle='#173c35';c.font='bold 30px sans-serif';c.fillText('SENTETİK TEST BELGESİ',35,100);c.font='22px sans-serif';c.fillText('Gerçek kişi veya sağlık bilgisi içermez.',35,165);c.fillText('Özlük • Ayrı test ortamı',35,230);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  await upload(new File([blob],'sentetik-test.png',{type:'image/png'}));
});
$('read').onclick=()=>run(async()=>{await personelBelgeAc(auth,$('documentId').value.trim());status('Yetki kontrolü geçti. Belgeyi kapatınca geçici önizleme silinir.');});
