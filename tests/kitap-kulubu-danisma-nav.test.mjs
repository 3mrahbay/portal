import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=(await readFile(new URL('../js/kitap-kulubu/gate.mjs',import.meta.url),'utf8'))
  .replace(/^import .+;\r?\n/gm,'');

function kur({rol='danisma',canRead=true}={}) {
  const state={rol,canRead,showHome:true};
  const links={quick:[],menu:[]};
  const has=(n,attribute)=>Object.hasOwn(n.attrs,attribute);
  const dugum=()=>({
    attrs:{}, hidden:false, style:{display:'',cssText:''}, href:'', className:'', innerHTML:'',
    setAttribute(k,v){this.attrs[k]=v;},
    remove(){ for(const xs of Object.values(links)){const i=xs.indexOf(this);if(i>=0)xs.splice(i,1);} }
  });
  const hızlı={
    querySelector:q=>links.quick.find(n=>has(n,'data-bk-danisma-quick'))||null,
    appendChild:n=>links.quick.push(n)
  };
  const anchor={
    insertAdjacentElement:(pos,n)=>{assert.equal(pos,'afterend');links.menu.push(n);}
  };
  const menu={
    querySelector:q=>q==='[data-bk-danisma-menu]'?links.menu[0]||null:
      q==='[data-modul="mesaj"]'?anchor:null
  };
  const document={
    body:{},
    createElement:dugum,
    getElementById:id=>id==='modulBar'?menu:null,
    querySelector:q=>
      q==='#adminHomeRoot .danisma-operasyon-paneli .danisma-hizli-islemler'?
        (state.showHome?hızlı:null):
      q==='[data-bk-danisma-quick]'?links.quick[0]||null:
      q==='[data-bk-danisma-menu]'?links.menu[0]||null:null,
    querySelectorAll:q=>
      q==='[data-bk-manage]'?[]:
      q==='[data-bk-host]'||q==='[data-bk-danisma-quick], [data-bk-danisma-menu]'?
        [...links.quick,...links.menu]:[]
  };
  let observe,authCallback;
  const window={danismaRolMu:()=>state.rol==='danisma',lucideYenile(){},KitapKulubu:{setViewer(){}}};
  const ctx={window,document,auth:{},db:{},fb:{},MutationObserver:class {
    constructor(fn){observe=fn;} observe(){}
  },onAuthStateChanged:(_,cb)=>{authCallback=cb;},createStore:()=>({
    identity:async()=>({read:state.canRead,manage:false})
  })};
  vm.runInNewContext(source,ctx);
  return {state,links,tick:()=>observe(),login:()=>authCallback({uid:'test'}),logout:()=>authCallback(null)};
}

test('danışma özet ve yan menüsünde yetkili ortak Kitap Kulübü bağlantıları',async()=>{
  const f=kur();
  f.tick();
  assert.equal(f.links.quick.length,1);
  assert.equal(f.links.menu.length,1);
  for(const bag of [...f.links.quick,...f.links.menu]){
    assert.equal(bag.href,'kitap-kulubu.html');
    assert.equal(bag.hidden,true);
    assert.equal(bag.style.display,'none');
    assert(Object.hasOwn(bag.attrs,'data-bk-host'));
    assert.match(bag.innerHTML,/Kitap Kulübü/);
    assert.doesNotMatch(bag.href,/yonetim/);
  }
  await f.login();
  f.tick();f.tick();
  assert.equal(f.links.quick.length,1);
  assert.equal(f.links.menu.length,1);
  assert([...f.links.quick,...f.links.menu].every(l=>!l.hidden&&l.style.display===''));
  f.state.showHome=false;f.links.quick[0].remove();f.tick();
  assert.equal(f.links.quick.length,0);
  assert.equal(f.links.menu.length,1); // Yan menü özet sayfası dışında da erişilebilir.
});

test('yetkisiz danışma hesabı linkleri göremez, öğretmen rolüne devredince kaldırılır',async()=>{
  const f=kur({canRead:false});
  f.tick();await f.login();
  assert([...f.links.quick,...f.links.menu].every(l=>l.hidden&&l.style.display==='none'));
  f.state.rol='ogretmen';f.tick();
  assert.equal(f.links.quick.length,0);
  assert.equal(f.links.menu.length,0);
});

test('öğretmen olmayan başka personel ve veli oturumlarında danışma linki eklenmez',async()=>{
  for(const rol of ['ogretmen','pdr','veli','mudur']){
    const f=kur({rol});
    f.tick();await f.login();
    assert.equal(f.links.quick.length+f.links.menu.length,0,rol);
  }
});
