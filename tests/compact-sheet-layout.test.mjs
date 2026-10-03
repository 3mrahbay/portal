import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// DOM lifecycle/structural checks only. These do not substitute for browser
// geometry tests at mobile widths with real fonts, form controls and live data.
function runtime(file) {
  const source=readFileSync(new URL('../moduller/'+file,import.meta.url),'utf8')
    .replace(/^import .*;\n/gm,'').replace(/\bexport (?=(?:async )?function)/g,'');
  class Element {
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.style={};this.dataset={};this.attributes={};this.events={};this.className='';this._html='';}
    get classList(){return {add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(name)=>{this.className=this.className.split(/\s+/).filter(x=>x!==name).join(' ');},contains:name=>this.className.split(/\s+/).includes(name),toggle:(name,on)=>{on?this.classList.add(name):this.classList.remove(name);}};}
    get isConnected(){return this===document.body||this===document.head||Boolean(this.parentNode?.isConnected);}
    set innerHTML(html){this._html=html;for(const child of this.children)child.parentNode=null;this.children=[];const stack=[this];for(const token of html.matchAll(/<\/?([\w-]+)\b([^>]*)>/g)){if(token[0].startsWith('</')){if(stack.length>1)stack.pop();continue;}const node=new Element(token[1]);for(const a of token[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)){node.setAttribute(a[1],a[2]||'');}stack.at(-1).appendChild(node);if(!['input','img','br','hr'].includes(token[1])&&!token[0].endsWith('/>'))stack.push(node);}}
    get innerHTML(){return this._html;}
    set textContent(text){this._text=String(text);this.children=[];}
    get textContent(){return this._text??this._html.replace(/<[^>]+>/g,'');}
    setAttribute(name,value){this.attributes[name]=String(value);if(name==='id')this.id=String(value);if(name==='class')this.className=String(value);}
    removeAttribute(name){delete this.attributes[name];}
    appendChild(child){child.remove();child.parentNode=this;this.children.push(child);return child;}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
    addEventListener(name,fn){this.events[name]=fn;}
    focus(){}
    matches(selector){if(selector[0]==='.')return this.classList.contains(selector.slice(1));if(selector[0]==='#')return this.id===selector.slice(1);if(selector[0]==='[')return Object.hasOwn(this.attributes,selector.slice(1,-1));return this.tagName.toLowerCase()===selector;}
    querySelectorAll(selector){const selectors=selector.split(',').map(s=>s.trim());return this.children.flatMap(child=>[...(selectors.some(s=>child.matches(s))?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    cloneNode(deep){const clone=new Element(this.tagName);clone.className=this.className;clone.style={...this.style};clone._html=this._html;clone._text=this._text;clone.attributes={...this.attributes};if(deep)this.children.forEach(child=>clone.appendChild(child.cloneNode(true)));return clone;}
  }
  const document={head:new Element('head'),body:new Element('body'),createElement:tag=>new Element(tag),addEventListener(){},removeEventListener(){},getElementById(id){return [this.body,this.head].flatMap(n=>n.querySelectorAll('#'+id))[0]||null;},querySelector(){return null;}};
  const window={PortalAPI:{bugun:()=> '2026-10-03',state:{}},lucideYenile(){}};
  const context=vm.createContext({document,window,console,MutationObserver:class{observe(){}},setInterval(){return 0;},clearInterval(){},setTimeout:fn=>{fn();return 0;},clearTimeout(){},requestAnimationFrame:fn=>fn()});
  vm.runInContext(source,context);
  return {document,window,run:code=>vm.runInContext(code,context),set:(key,value)=>{context[key]=value;},node:(className='')=>{const node=new Element();node.className=className;return node;}};
}

for(const [file,prefix] of [['veli-kompakt.js','vkp'],['ogretmen-anasayfa.js','oak']]) {
  test(`${prefix}: moved live card retains theme and identity through repeated open/update/close`,()=>{
    const r=runtime(file);r.run('stilEkle()');
    const host=r.node('cicek-app'),hazne=r.node(),card=r.node('ca-card');
    r.document.body.appendChild(host);host.appendChild(hazne);hazne.appendChild(card);r.set('card',card);
    r.set('sheetConfig',{ad:'Çok uzun çocuk ve sınıf başlığı '.repeat(8),ikon:'calendar',renk:'#123456',acik:'#eeeeee',eylem:{yazi:'Uzun işlem başlığı '.repeat(5),ikon:'check',git(){}}});
    for(let i=0;i<3;i++){
      r.run('sayfaAc(sheetConfig, card)');
      const overlay=r.document.body.querySelector('.'+prefix+'-arka');
      assert.ok(overlay.classList.contains('cicek-app'),'body-level overlay preserves ca-* theme selectors');
      const body=overlay.querySelector('.'+prefix+'-govde');assert.equal(body.children[0],card);
      card.innerHTML=`<div class="ca-row"><span>${'ÇokUzunBitişikAd'.repeat(12)}</span><b>${99999+i}</b></div>`;
      assert.equal(body.children[0],card,'realtime update keeps original observed node');
      assert.ok(card.textContent.includes(String(99999+i)));
      r.run('sayfaKapat()');assert.equal(card.parentNode,hazne);assert.ok(!r.document.body.classList.contains(prefix+'-kilit'));
      assert.equal(r.document.body.querySelector('.'+prefix+'-arka'),null);
    }
    // A new home/role render can detach the original holding area while open.
    r.run('sayfaAc(sheetConfig, card)');host.remove();r.run('sayfaKapat()');
    assert.equal(card.parentNode,null,'closing must discard a stale card after root replacement');
    assert.ok(!r.document.body.classList.contains(prefix+'-kilit'));
    const css=r.document.head.children.map(n=>n.textContent).join('\n');
    assert.match(css,new RegExp('\\.'+prefix+'-govde[^}]*overflow-wrap:anywhere'));
    assert.match(css,new RegExp('\\.'+prefix+'-govde table \\{[^}]*overflow-x:auto'));
    assert.match(css,new RegExp('\\.'+prefix+'-alt \\{[^}]*flex-wrap:wrap'));
    assert.match(css,new RegExp('\\.'+prefix+'-durum \\{[^}]*min-width:0'));
    assert.doesNotMatch(css,/overflow-x:hidden/);
  });
}

test('payment detail clone also preserves the parent theme outside the portal shell',()=>{
  const r=runtime('veli-kompakt.js');r.run('stilEkle()');
  const card=r.node('ca-card ca-pay vkp-odeme');card.innerHTML='<div class="ca-row"><strong>₺999.999.999,99</strong></div><button>Ödeme Bildir</button>';
  r.set('card',card);r.run('odemeAc(card)');
  const overlay=r.document.body.querySelector('.vkp-arka');assert.ok(overlay.classList.contains('cicek-app'));
  const clone=overlay.querySelector('.vkp-govde').children[0];assert.notEqual(clone,card);assert.equal(clone.querySelector('button'),null);assert.ok(!clone.classList.contains('vkp-odeme'));
  overlay.querySelector('[data-vkp-kapat]').events.click();assert.equal(r.document.body.querySelector('.vkp-arka'),null);
});

for(const [file,api,id,prefix,styleId] of [
  ['veli-izinleri.js','_veliIzin','veliIzinForm','vz','veliIzinFormStil'],
  ['pickup-yetkilileri.js','_pickupYetki','pyForm','py','pickupYetkiFormStil']
]){
  test(`${prefix}: dynamically opened form owns its shrinkable grid even in a body sheet`,()=>{
    const r=runtime(file),sheet=r.node('vkp-arka cicek-app'),form=r.node();form.id=id;form.style.display='none';r.document.body.appendChild(sheet);sheet.appendChild(form);
    r.window[api].formAc();assert.equal(form.style.display,'block');assert.ok(form.querySelector('.'+prefix+'-form-grid'));
    const css=r.document.getElementById(styleId).textContent;
    assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
    assert.match(css,/@media \(max-width:420px\)[^}]*grid-template-columns:minmax\(0,1fr\)/);
    assert.match(css,/> \* \{ min-width:0; \}/);assert.match(css,/min-width:0; max-width:100%; width:100%/);
    assert.doesNotMatch(form.innerHTML,/grid-template-columns:1fr 1fr/);
    r.window[api].formAc();assert.equal(form.style.display,'none');r.window[api].formAc();
    assert.equal(r.document.head.querySelectorAll('#'+styleId).length,1,'reopening does not duplicate module stylesheet');
  });
}
