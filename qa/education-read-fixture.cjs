// Extract the actual production matrix and reader; use only synthetic in-memory adapters.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const styles=[...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const markup=source.slice(source.indexOf('<div id="egitimMatrixContainer"'),source.indexOf('<!-- YENİ BRANŞ EKLEME MODALI -->'));
const matrix=source.slice(source.indexOf('const egitimOkuyucu ='),source.indexOf('// ============ ÖĞRENCİ FOTOĞRAF YÖNETİMİ'));
const bootstrap=`
import {educationPrograms,canObserveProgram,EDUCATION_TEACHERS} from './js/egitim-program-yetki.mjs?v=1';
import {educationReadScope,createEducationReader,watchEducationRecords} from './js/egitim-gelisim-okuma.mjs?v=1';
window.failRead=new URLSearchParams(location.search).has('error');window.calls={reads:0,writes:0};window.showToast=()=>{};
const escapeHtmlGelisim=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DISIPLINLER=[{id:'montessori',ad:'Montessori',renk:'#16834b',ikon:'🌱',aciklama:'Sentetik test'}];
const aktifMufredatlar={},areas=[{id:'practical',ad:'Günlük Yaşam',ikon:'🌿',gruplar:[{ad:'Ön Çalışmalar',dersler:['Kaşıklama 1','Kuru Aktarma 3','Sandalye Taşıma']}]}];
const ogrenciList=[{id:'a',ogrenciAdSoyad:'Örnek Öğrenci A',sinif:'Örnek Sınıf'},{id:'b',ogrenciAdSoyad:'Örnek Öğrenci B',sinif:'Başka Sınıf'}],ayarListesi={a:{kayit:{sinif:'Örnek Sınıf'},durum:'aktif'},b:{kayit:{sinif:'Başka Sınıf'},durum:'aktif'}};
window.PortalAPI={state:{currentUser:{uid:'synthetic',email:'synthetic@example.test'},rol:'ogretmen',personel:{sinifAtamalari:['Örnek Sınıf']},siniflar:['Örnek Sınıf'],ogrenciVerileriHazirMi:true,aktifDonem:'2026-2027',ogrenciList,ayarListesi}};
const records={a:{montessori:{kayitlar:{'practical__Ön Çalışmalar__Kaşıklama 1':'U','practical__Ön Çalışmalar__Kuru Aktarma 3':'T'}}}};
const getOgrenciDurum=()=> 'aktif',db={},doc=(db,col,id)=>({col,id}),collection=(db,col)=>({col});
const getDocFromServer=async ref=>{calls.reads++;if(ref.col==='mufredatlar')return {exists:()=>true,data:()=>({alanlar:areas})};if(failRead)throw Object.assign(Error('synthetic permission denied'),{code:'permission-denied'});return {exists:()=>!!records[ref.id],data:()=>records[ref.id]}};
const getDocsFromServer=async()=>{throw Error('Teacher must never query collection')};
const onSnapshot=(ref,opts,next,error)=>()=>{};
const gelisimDersGuncelle=async()=>{calls.writes++;return false};
window.retrySynthetic=()=>{window.failRead=false;return egitimMatrixYenile()};
`;
const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body><h2>Örnek verilerle kayıt okuma testi</h2><button onclick="retrySynthetic()">Bağlantıyı düzelt ve yeniden dene</button><section id="tab-egitim" class="active"><div id="egitimDisiplinSecici"></div>${markup}</section><script type="module">${bootstrap}\n${matrix}\nawait egitimDisiplinAc('montessori');window.ready=true;</script></body></html>`;
fs.writeFileSync(path.join(root,'../fixture.html'),html);fs.mkdirSync(path.join(root,'../js'),{recursive:true});fs.copyFileSync(path.join(root,'js/egitim-gelisim-okuma.mjs'),path.join(root,'../js/egitim-gelisim-okuma.mjs'));
