import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNotificationHeaderMounts, positionNotificationPanel } from '../js/portal-bildirim-yerlesim.js';

class Node {
  constructor(tag='div') { this.tagName=tag; this.children=[]; this.className=''; this.attributes={}; this.selectors={}; }
  get classList() { return { add:name=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),name])].join(' ');}, remove:name=>{this.className=this.className.split(' ').filter(x=>x!==name).join(' ');} }; }
  append(...nodes) { nodes.forEach(n=>this.appendChild(n)); }
  appendChild(node) { node.parent=this;this.children.push(node);return node; }
  prepend(node) { node.parent=this;this.children.unshift(node); }
  insertBefore(node, target) { const i=this.children.indexOf(target); assert.ok(i>=0);node.parent=this;this.children.splice(i,0,node); }
  remove() { if(this.parent) this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null; }
  setAttribute(key,value) { this.attributes[key]=value; }
  querySelector(selector) { return this.selectors[selector]; }
}
const fixture = ({staff=true,parent=true}={}) => {
 const header=new Node('header'),menu=new Node(),receipt=new Node('button'),profile=new Node(),logout=new Node('button');
 menu.append(receipt,profile,logout);menu.selectors['.user-badge']=profile;header.append(menu);
 const parentPanel=new Node(),parentMain=new Node('main'),root=new Node();parentMain.append(root);parentPanel.append(parentMain);
 const doc={body:new Node('body'),createElement:tag=>new Node(tag),querySelector:selector=>({'#dashboard .user-menu':staff&&menu,'#dashboard .dash-header':staff&&header,'#veliPanel .veli-main':parent&&parentMain})[selector],getElementById:id=>id==='veliPanel'&&parent&&parentPanel};
 return {doc,header,menu,receipt,profile,logout,parentPanel,parentMain,root};
};

test('staff header slot is between receipt and profile; parent slot survives dynamic page replacement',()=>{
 const f=fixture(),mounts=createNotificationHeaderMounts(f.doc);
 assert.equal(mounts.targets.length,2);assert.deepEqual(f.menu.children,[f.receipt,mounts.targets[0],f.profile,f.logout]);
 assert.match(f.header.className,/pbm-baslik-aktif/);assert.match(f.parentPanel.className,/pbm-veli-aktif/);
 const bar=f.parentMain.children[0];assert.equal(bar.children[1],mounts.targets[1]);assert.notEqual(bar,f.root);
 f.root.children=[new Node()];assert.equal(f.parentMain.children[0],bar);
 mounts.cleanup();assert.deepEqual(f.menu.children,[f.receipt,f.profile,f.logout]);assert.deepEqual(f.parentMain.children,[f.root]);
 assert.equal(f.header.className,'');assert.equal(f.parentPanel.className,'');
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
