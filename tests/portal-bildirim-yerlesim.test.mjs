import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNotificationHeaderMounts, positionNotificationPanel } from '../js/portal-bildirim-yerlesim.js';

class Node {
  constructor(tag='div') { this.tagName=tag; this.children=[]; this.className=''; this.attributes={}; this.selectors={}; }
  get classList() { return { add:name=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),name])].join(' ');}, remove:name=>{this.className=this.className.split(' ').filter(x=>x!==name).join(' ');} }; }
  append(...nodes) { nodes.forEach(n=>this.appendChild(n)); }
  get parentNode() { return this.parent; }
  appendChild(node) { node.remove();node.parent=this;this.children.push(node);return node; }
  prepend(node) { node.parent=this;this.children.unshift(node); }
  insertBefore(node, target) { const i=this.children.indexOf(target); assert.ok(i>=0);node.remove();node.parent=this;this.children.splice(i,0,node); }
  remove() { if(this.parent) this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null; }
  setAttribute(key,value) { this.attributes[key]=value; }
  querySelector(selector) { return this.selectors[selector]; }
}
const parentPage = (legacy=false) => {
 const active=new Node(),header=new Node(),left=new Node(),actions=new Node(),grid=new Node('button'),oldBell=new Node('button'),exit=new Node('button');
 if(legacy){active.selectors['.zeky-geri-bar']=header;header.append(left);}
 else {active.selectors['.ca-topbar']=header;actions.append(grid,oldBell,exit);header.append(left,actions);header.selectors['button[onclick="veliSwitchTab(\'bildirimler\')"]']=oldBell;}
 active.append(header);return {active,header,left,actions,grid,oldBell,exit};
};
const fixture = ({staff=true,parent=true,initialPage=true}={}) => {
 const header=new Node('header'),menu=new Node(),receipt=new Node('button'),profile=new Node(),logout=new Node('button');
 menu.append(receipt,profile,logout);menu.selectors['.user-badge']=profile;header.append(menu);
 const parentPanel=new Node(),parentMain=new Node('main'),root=new Node();parentMain.append(root);parentPanel.append(parentMain);
 let page=initialPage?parentPage():null;if(page){root.append(page.active);parentMain.selectors['.veli-tab-panel.active']=page.active;}
 const observers=[];
 class Observer {constructor(callback){this.callback=callback;observers.push(this);}observe(target,options){this.target=target;this.options=options;}disconnect(){this.stopped=true;}}
 const doc={body:new Node('body'),defaultView:{MutationObserver:Observer},createElement:tag=>new Node(tag),querySelector:selector=>({'#dashboard .user-menu':staff&&menu,'#dashboard .dash-header':staff&&header,'#veliPanel .veli-main':parent&&parentMain})[selector],getElementById:id=>id==='veliPanel'&&parent&&parentPanel};
 return {doc,header,menu,receipt,profile,logout,parentPanel,parentMain,root,observers,get page(){return page;},setPage(next){page=next;parentMain.selectors['.veli-tab-panel.active']=page?.active;root.children=[];if(page)root.append(page.active);observers.forEach(o=>{if(!o.stopped)o.callback();});},refresh(){observers.forEach(o=>{if(!o.stopped)o.callback();});}};
};

test('staff slot is unchanged; parent bell sits between existing menu and exit icons without a new row',()=>{
 const f=fixture(),mounts=createNotificationHeaderMounts(f.doc);
 assert.equal(mounts.targets.length,2);assert.deepEqual(f.menu.children,[f.receipt,mounts.targets[0],f.profile,f.logout]);
 assert.match(f.header.className,/pbm-baslik-aktif/);assert.match(f.parentPanel.className,/pbm-veli-aktif/);
 assert.deepEqual(f.page.actions.children,[f.page.grid,mounts.targets[1],f.page.oldBell,f.page.exit]);
 assert.deepEqual(f.parentMain.children,[f.root]);assert.equal(f.doc.body.children.length,0);
 mounts.cleanup();assert.deepEqual(f.menu.children,[f.receipt,f.profile,f.logout]);assert.deepEqual(f.page.actions.children,[f.page.grid,f.page.oldBell,f.page.exit]);
 assert.equal(f.header.className,'');assert.equal(f.parentPanel.className,'');assert.equal(f.observers[0].stopped,true);
});

test('parent navigation reuses one live bell with its badge and handles repeated rerenders',()=>{
 const f=fixture({staff:false}),m=createNotificationHeaderMounts(f.doc),slot=m.targets[0],bell=new Node('button'),badge=new Node('span');
 badge.textContent='4';bell.append(badge);slot.append(bell);
 for(let i=0;i<4;i++) {const page=parentPage();f.setPage(page);assert.equal(slot.parentNode,page.actions);assert.equal(slot.children[0],bell);assert.equal(bell.children[0].textContent,'4');f.refresh();assert.equal(page.actions.children.filter(x=>x===slot).length,1);}
 m.cleanup();assert.equal(slot.parentNode,null);
});

test('parent legacy screens use their existing back bar; loading states create no extra row',()=>{
 const f=fixture({staff:false,initialPage:false}),m=createNotificationHeaderMounts(f.doc),slot=m.targets[0];
 assert.equal(slot.parentNode,null);assert.deepEqual(f.parentMain.children,[f.root]);
 const legacy=parentPage(true);f.setPage(legacy);assert.equal(slot.parentNode,legacy.header);assert.deepEqual(legacy.header.children,[legacy.left,slot]);
 f.setPage(null);assert.equal(slot.parentNode,null);assert.deepEqual(f.parentMain.children,[f.root]);
 f.setPage(parentPage());assert.equal(slot.parentNode,f.page.actions);m.cleanup();
});

test('logout disconnects parent observer and late callbacks cannot reinsert the bell',()=>{
 const f=fixture({staff:false}),m=createNotificationHeaderMounts(f.doc),slot=m.targets[0],observer=f.observers[0];
 m.cleanup();f.setPage(parentPage());observer.callback();assert.equal(slot.parentNode,null);assert.equal(f.page.actions.children.length,3);
 assert.equal(observer.options.subtree,true);assert.deepEqual(observer.options.attributeFilter,['class']);
});

test('no known role layout uses a flow header, never bottom-right floating button; repeated lifecycle cleans up',()=>{
 const f=fixture({staff:false,parent:false});
 for(let i=0;i<3;i++){const m=createNotificationHeaderMounts(f.doc);assert.equal(f.doc.body.children.length,1);assert.match(f.doc.body.children[0].className,/pbm-yedek-ustbar/);m.cleanup();assert.equal(f.doc.body.children.length,0);}
});

test('one available role layout mounts once and does not add a second body fallback',()=>{
 for(const options of [{staff:true,parent:false},{staff:false,parent:true}]){const f=fixture(options),m=createNotificationHeaderMounts(f.doc);assert.equal(m.targets.length,1);assert.equal(f.doc.body.children.length,0);m.cleanup();}
});

test('panel anchors below visible role button and stays within short/mobile viewport',()=>{
 const values={}, panel={style:{setProperty:(k,v)=>values[k]=v}};
 const button=rect=>({getBoundingClientRect:()=>rect});
 positionNotificationPanel(panel,[button({width:0,height:0}),button({width:44,height:44,top:16,bottom:60})],{innerHeight:720});
 assert.equal(values['--pbm-panel-top'],'70px');
 positionNotificationPanel(panel,[button({width:44,height:44,top:200,bottom:244})],{innerHeight:320});
 assert.equal(values['--pbm-panel-top'],'180px');
 positionNotificationPanel(panel,[],{innerHeight:100});assert.equal(values['--pbm-panel-top'],'12px');
});

test('styles keep responsive header, readable full row titles and minimum touch target',async()=>{
 const source=await readFile(new URL('../js/portal-bildirim-merkezi.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/pbm-sabit|bottom:max\(82px/);
 assert.match(source,/min-width:44px;min-height:44px/);
 assert.match(source,/@media\(max-width:900px\).*dash-header-inner\{flex-wrap:wrap/s);
 assert.match(source,/white-space:normal;overflow-wrap:anywhere/);
 assert.match(source,/headerMounts\?\.cleanup\(\)/);
 assert.match(source,/window.removeEventListener\?\.\('resize', reposition\)/);
});


test('parent mobile button matches existing icon size and does not alter quick actions or staff colors',async()=>{
 const source=await readFile(new URL('../js/portal-bildirim-merkezi.js',import.meta.url),'utf8');
 const layout=await readFile(new URL('../js/portal-bildirim-yerlesim.js',import.meta.url),'utf8');
 assert.match(source,/\.cicek-app \.pbm-veli-yuva \.pbm-zil\{width:44px;height:44px/);
 assert.match(source,/background:var\(--c-surface\);color:var\(--c-ink\);box-shadow:none/);
 assert.match(source,/@media\(max-width:480px\)\{#veliPanel \.pbm-veli-baslik\{gap:8px/);
 assert.doesNotMatch(layout.slice(layout.indexOf('const parent ='),layout.indexOf('if (!targets.length')),/pbm-veli-ustbar|parent\.prepend/);
 assert.doesNotMatch(layout,/ca-quick|ca-qbtn/);
});
