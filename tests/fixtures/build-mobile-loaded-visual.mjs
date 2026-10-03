// Build only. This command never starts a server or browser.
// Usage: node tests/fixtures/build-mobile-loaded-visual.mjs /approved/path/fixture.html
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildScenarios, productionCss, lateReceptionCss, WIDTHS, ROLES, PHASES, assertNoCredentials } from '../helpers/mobile-loaded-fixture.mjs';

export function buildVisualFixture() {
  const payload = JSON.stringify({ scenarios:buildScenarios(), css:productionCss(), lateCss:lateReceptionCss(), widths:WIDTHS, roles:ROLES, phases:PHASES }).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src 'self' about:; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>Portal loaded mobile QA · synthetic offline fixture</title><style>
body{margin:0;background:#edf0f6;color:#18213e;font:14px system-ui}header{padding:16px;background:white;border-bottom:1px solid #bbc3d4}h1{font-size:20px;margin:0 0 8px}.controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}button,select{font:inherit;padding:8px;border:1px solid #8a96af;border-radius:7px;background:white;color:inherit}button{cursor:pointer}#viewport{overflow:auto;padding:16px}iframe{display:block;border:1px solid #909cb5;box-sizing:content-box;height:800px;background:white}pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:16px;background:white;padding:12px}p{max-width:1100px;line-height:1.5}#report{max-height:400px;overflow:auto}label{display:inline-flex;align-items:center;gap:5px}
</style></head><body><header><h1>Portal loaded mobile QA</h1><p>Offline synthetic data only. Selected production home, birthday, pickup and attendance renderers run in Node before building this file. Other asynchronous module bodies and parent favorites are labeled synthetic substitutes. Fonts use local fallbacks; icons and photos are omitted. This is not a full authenticated app test.</p><p id="status" role="status">Browser geometry NOT RUN. Loading this fixture alone is not a passing result.</p><div class="controls"><label>Role <select id="role"><option>admin</option><option>staff</option><option>parent</option></select></label><label>Phase <select id="phase"><option>loading</option><option>populated</option><option>stress</option><option>realtime</option></select></label><label>Width <select id="width">${WIDTHS.map(w=>`<option${w===375?' selected':''}>${w}</option>`).join('')}</select>px</label><label><input type="checkbox" id="late">Inject late reception CSS</label><button id="next">Next phase</button><button id="sequence">Play loading → populated → stress → realtime</button><button id="check">Check current bounds</button><button id="matrix">Run all roles × phases × widths × late CSS</button><button id="stop">Stop sequence/matrix</button></div><p>844 px is landscape; 1280/1440 px are desktop controls. The iframe retains the exact chosen width even when the outer fixture window is smaller. The realtime phase replaces card contents in the existing stress DOM, as a new snapshot would.</p></header><div id="viewport"><iframe id="preview" title="Synthetic Portal viewport"></iframe></div><pre id="report">No browser measurements yet</pre><script id="fixture-data" type="application/json">${payload}</script><script>
const data=JSON.parse(document.getElementById('fixture-data').textContent);
const $=id=>document.getElementById(id), frame=$('preview');
let mountedRole='',mountedPhase='',generation=0,lastResults=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
function shell(role){return role==='parent'?'<div id="veliPanel" class="active"><div class="veli-layout"><main class="veli-main"><div id="veliPanel-yeniapp" class="veli-tab-panel active"><div id="cicekAppRoot" class="cicek-app"></div></div></main></div></div>':'<div id="dashboard" class="active"><div class="dash-container"><div id="tab-anasayfa" class="tab-panel active"><div id="adminHomeRoot" class="cicek-app"></div></div></div></div>';}
function applyPatches(scenario){const doc=frame.contentDocument;for(const [id,value] of Object.entries(scenario.patches)){const el=doc.getElementById(id);if(!el)throw new Error('Missing loaded-card target '+id);if('text'in value)el.textContent=value.text;else el.innerHTML=value.html;}}
async function mount(role,phase,width,late){
  frame.style.width=width+'px';frame.style.height=(width===844?390:800)+'px';
  if(mountedRole!==role){
    const ready=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
    frame.srcdoc='<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \\'none\\'; style-src \\'unsafe-inline\\'; img-src data:; connect-src \\'none\\'; form-action \\'none\\'; base-uri \\'none\\'"><style>'+data.css+'</style></head><body class="rol-'+({admin:'yonetici',staff:'ogretmen',parent:'veli'}[role])+'">'+shell(role)+'</body></html>';
    await ready;mountedRole=role;mountedPhase='';
  }
  const doc=frame.contentDocument,root=doc.getElementById(role==='parent'?'cicekAppRoot':'adminHomeRoot');
  const scenario=data.scenarios[role][phase];
  if(phase==='realtime'){
    if(mountedPhase!=='stress'&&mountedPhase!=='realtime'){root.innerHTML=data.scenarios[role].stress.html;applyPatches(data.scenarios[role].stress);}
    applyPatches(scenario);
  }else{root.innerHTML=scenario.html;applyPatches(scenario);}
  doc.getElementById('late-reception-css')?.remove();
  if(late){const style=doc.createElement('style');style.id='late-reception-css';style.textContent=data.lateCss;doc.head.append(style);}
  mountedPhase=phase;
  await settle();
}
function label(el){return el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\\s+/).join('.'):'');}
function measure(role,phase,width,late){
  const doc=frame.contentDocument,win=frame.contentWindow,viewport=doc.documentElement.clientWidth;
  const root=doc.getElementById(role==='parent'?'cicekAppRoot':'adminHomeRoot');
  const errors=[],expectedEllipses=[],localScrollers=[];let checked=0;
  const record=(kind,el,extra)=>errors.push({kind,element:label(el),...extra});
  for(const el of [doc.documentElement,doc.body,...root.querySelectorAll('*')]){
    const css=win.getComputedStyle(el),rect=el.getBoundingClientRect();
    if(css.display==='none'||css.visibility==='hidden'||!el.getClientRects().length||(!rect.width&&!rect.height))continue;
    checked++;
    // getBoundingClientRect detects content outside clipped ancestors even when
    // html/body overflow:hidden makes document.scrollWidth appear acceptable.
    if(rect.left < -1 || rect.right > viewport+1)record('element bounds outside viewport',el,{left:rect.left,right:rect.right,viewport});
    const explicitEllipsis=css.textOverflow==='ellipsis'&&css.whiteSpace==='nowrap';
    if(el.clientWidth>0&&el.scrollWidth>el.clientWidth+1){
      if(explicitEllipsis)expectedEllipses.push(label(el));
      else if(['auto','scroll'].includes(css.overflowX)&&el!==doc.body&&el!==doc.documentElement)localScrollers.push(label(el));
      else record('uncontained scroll width',el,{clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,overflowX:css.overflowX});
    }
    // Measure text independently: element boxes can fit while their text is clipped.
    if(!explicitEllipsis)for(const node of el.childNodes){if(node.nodeType!==3||!node.textContent.trim())continue;const range=doc.createRange();range.selectNodeContents(node);for(const line of range.getClientRects()){if(line.left < -1 || line.right > viewport+1)record('text bounds outside viewport',el,{left:line.left,right:line.right,viewport});}range.detach();}
    // A control clipped by a narrow ancestor is still a failure when the page fits.
    if(el.matches('button,input,select,textarea'))for(let p=el.parentElement;p&&p!==doc.body;p=p.parentElement){const pcs=win.getComputedStyle(p);if(!['hidden','clip'].includes(pcs.overflowX))continue;const pr=p.getBoundingClientRect();if(rect.left<pr.left-1||rect.right>pr.right+1){record('control clipped by ancestor',el,{ancestor:label(p)});break;}}
  }
  const result={role,phase,width,lateReceptionCss:late,viewport,documentScrollWidth:doc.documentElement.scrollWidth,bodyScrollWidth:doc.body.scrollWidth,checkedElements:checked,errors,expectedEllipses:[...new Set(expectedEllipses)],localScrollers:[...new Set(localScrollers)]};
  result.pass=errors.length===0&&doc.documentElement.scrollWidth<=viewport+1&&doc.body.scrollWidth<=viewport+1;
  if(width<=600&&role!=='parent'&&phase!=='loading'){
    const btn=doc.querySelector('#okulZiliListe .portal-pickup-actions > button');
    if(btn&&win.getComputedStyle(btn).whiteSpace!=='normal'){record('late CSS defeated pickup action wrapping',btn,{});result.pass=false;}
  }
  return result;
}
function display(results){lastResults=results;const failed=results.filter(r=>!r.pass);$('status').textContent=results.length+' browser geometry case(s): '+(failed.length?failed.length+' FAILED':'PASS')+'. Review screenshots and expected truncation separately; no backend/authenticated checks were run.';$('report').textContent=JSON.stringify(results,null,2);}
async function show(check=false){await mount($('role').value,$('phase').value,Number($('width').value),$('late').checked);if(check)display([measure($('role').value,$('phase').value,Number($('width').value),$('late').checked)]);else $('status').textContent='Showing '+mountedRole+' / '+mountedPhase+'. Geometry for this view NOT RUN until checked.';}
for(const id of ['role','phase','width','late'])$(id).addEventListener('change',()=>{generation++;show().catch(reportError);});
$('check').onclick=()=>show(true).catch(reportError);
$('next').onclick=()=>{generation++;$('phase').value=data.phases[(data.phases.indexOf($('phase').value)+1)%data.phases.length];show(true).catch(reportError);};
$('stop').onclick=()=>{generation++;$('status').textContent='Stopped. Completed cases remain in the report; unmeasured cases are NOT RUN.';};
$('sequence').onclick=async()=>{const g=++generation,results=[];try{for(const phase of data.phases){if(g!==generation)return;$('phase').value=phase;await show();results.push(measure($('role').value,phase,Number($('width').value),$('late').checked));display(results);await pause(1000);}}catch(e){reportError(e);}};
$('matrix').onclick=async()=>{const g=++generation,results=[];try{for(const late of [false,true])for(const role of data.roles)for(const width of data.widths)for(const phase of data.phases){if(g!==generation)return;$('role').value=role;$('width').value=width;$('phase').value=phase;$('late').checked=late;await mount(role,phase,width,late);results.push(measure(role,phase,width,late));display(results);await pause(20);}}catch(e){reportError(e);}};
function reportError(e){$('status').textContent='Fixture ERROR: '+e.message+'; remaining browser cases NOT RUN.';}
window.portalLoadedQA={mount,measure,getResults:()=>lastResults};
show().catch(reportError);
</script></body></html>`;
  assertNoCredentials(html);
  return html;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  const destination=process.argv[2] || fileURLToPath(new URL('./mobile-loaded-visual.html',import.meta.url));
  const html=buildVisualFixture();
  writeFileSync(destination,html);
  console.log(`Built synthetic offline fixture (${Buffer.byteLength(html)} bytes). Browser geometry: NOT RUN.`);
}
