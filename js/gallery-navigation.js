export function visibleGalleryIds(root) {
  return [...new Set(Array.from(root?.querySelectorAll?.('[data-gallery-media-id],[onclick*="acGaleriLightbox("]')||[]).map(el=>el.dataset?.galleryMediaId||/(?:acGaleriLightbox)\(['"]([^'"]+)['"]/.exec(el.getAttribute('onclick')||'')?.[1]).filter(Boolean))];
}
// Horizontal, single-finger photo gestures only. Leave scrolling, zooming and
// native video/iframe controls to the browser.
export function bindGallerySwipe(host,navigate) {
  let start=null;
  const begin=e=>{start=e.touches?.length===1&&!e.target?.closest?.('button,a,input,textarea,select,video,iframe,[contenteditable]')?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;};
  const end=e=>{const from=start;start=null;if(!from||e.touches?.length||e.changedTouches?.length!==1)return;const dx=e.changedTouches[0].clientX-from.x,dy=e.changedTouches[0].clientY-from.y;if(Math.abs(dx)>=60&&Math.abs(dx)>Math.abs(dy)*1.5)navigate(dx<0?1:-1);};
  const cancel=()=>start=null;
  host.addEventListener('touchstart',begin,{passive:true});host.addEventListener('touchend',end,{passive:true});host.addEventListener('touchcancel',cancel,{passive:true});
  return ()=>{host.removeEventListener('touchstart',begin);host.removeEventListener('touchend',end);host.removeEventListener('touchcancel',cancel);};
}
