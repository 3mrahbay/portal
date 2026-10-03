// Standalone body-level lightbox: no dependency on the .cicek-app CSS namespace.
// ZEKY gallery reference: translucent circular controls, dark backdrop, rounded media.
export const galleryLightboxStyles = `
#vgLightbox {
  position:fixed;inset:0;z-index:10040;width:100%;height:100vh;height:100dvh;
  box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr) auto;
  align-items:stretch;justify-items:center;gap:14px;overflow:hidden;
  padding:max(16px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));
  background:rgba(10,18,27,.97);color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  -webkit-tap-highlight-color:transparent;
}
#vgLightbox *,#vgLightbox *::before,#vgLightbox *::after {box-sizing:border-box;}
#vgLightbox .vg-lb-top {display:flex;align-items:center;justify-content:space-between;gap:16px;width:min(1120px,100%);min-width:0;}
#vgLightbox .vg-lb-position {font-size:12px;font-weight:600;letter-spacing:.04em;color:#dce6e1;padding:10px 14px;border:1px solid #ffffff20;border-radius:999px;background:#ffffff09;}
#vgLightbox [data-vg-media] {display:flex;align-items:center;justify-content:center;align-self:stretch;width:min(1120px,100%);height:100%;min-height:0;min-width:0;overflow:hidden;border-radius:20px;}
#vgLightbox [data-vg-media] > img,#vgLightbox [data-vg-media] > video {
  display:block;width:100%;height:100%;min-height:0!important;max-width:100%;max-height:100%!important;object-fit:contain;border-radius:18px;margin:0 auto;
}
#vgLightbox [data-vg-media] > iframe {display:block;width:100%;height:100%!important;max-width:100%;min-height:0;border:0;border-radius:18px;}
#vgLightbox .pg-media-status {max-width:100%;max-height:100%;overflow:auto;border-radius:16px;}
#vgLightbox .vg-lb-footer {display:flex;flex-direction:column;align-items:center;gap:14px;width:min(760px,100%);min-width:0;}
#vgLightbox .vg-lb-details {width:100%;min-width:0;max-height:112px;max-height:min(18dvh,112px);overflow:auto;text-align:center;overflow-wrap:anywhere;line-height:1.45;scrollbar-width:thin;}
#vgLightbox .vg-lb-title {font-size:17px;font-weight:700;line-height:1.35;margin:0;}
#vgLightbox .vg-lb-subtitle {font-size:12px;color:#bbc9c3;margin-top:5px;}
#vgLightbox .vg-lb-caption {font-size:13px;color:#e4ebe7;margin-top:8px;}
#vgLightbox .vg-lb-date {font-size:11px;color:#9eadab;margin-top:5px;}
#vgLightbox .vg-lb-actions {display:grid;grid-template-columns:48px minmax(116px,auto) 48px;align-items:center;gap:12px;max-width:100%;}
#vgLightbox .vg-lb-btn {
  appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:9px;
  width:48px;height:48px;min-width:44px;min-height:44px;margin:0;padding:0;border:1px solid #ffffff30;border-radius:50%;
  background:#ffffff15;backdrop-filter:blur(10px);color:#fff;font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  cursor:pointer;text-decoration:none;flex-shrink:0;transition:background .16s,border-color .16s,transform .16s;
}
#vgLightbox .vg-lb-btn svg {display:block;width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;flex-shrink:0;}
#vgLightbox .vg-lb-btn:hover {background:#ffffff25;border-color:#ffffff55;}
#vgLightbox .vg-lb-btn:active {transform:scale(.95);}
#vgLightbox .vg-lb-btn:focus-visible {outline:3px solid #a6ddbb;outline-offset:4px;}
#vgLightbox .vg-lb-btn:disabled {cursor:wait;opacity:.6;transform:none;}
#vgLightbox .vg-lb-download {width:auto;min-width:116px;padding:0 22px;border-radius:999px;background:#315a43;border-color:#669b7a;white-space:nowrap;}
#vgLightbox .vg-lb-download:hover {background:#3e7053;}
@media(max-width:600px) {
  #vgLightbox {gap:10px;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(14px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));}
  #vgLightbox .vg-lb-top {gap:12px;}
  #vgLightbox .vg-lb-btn {width:44px;height:44px;}
  #vgLightbox .vg-lb-actions {grid-template-columns:44px minmax(116px,auto) 44px;gap:10px;}
  #vgLightbox .vg-lb-download {width:auto;}
  #vgLightbox .vg-lb-title {font-size:15px;}
  #vgLightbox .vg-lb-footer {gap:10px;}
  #vgLightbox [data-vg-media],#vgLightbox [data-vg-media]>img,#vgLightbox [data-vg-media]>video {border-radius:14px;}
}
@media(max-height:500px) and (min-width:601px) {
  #vgLightbox {gap:8px;padding-top:10px;padding-bottom:10px;}
  #vgLightbox .vg-lb-footer {flex-direction:row;gap:18px;width:min(1000px,100%);}
  #vgLightbox .vg-lb-details {flex:1;max-height:66px;text-align:left;}
  #vgLightbox .vg-lb-actions {flex-shrink:0;}
}
@media(prefers-reduced-motion:reduce) {#vgLightbox .vg-lb-btn {transition:none;}}
`;
export const galleryLightboxIcons = Object.freeze({
  close:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  previous:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m14 6-6 6 6 6"/></svg>',
  next:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m10 6 6 6-6 6"/></svg>',
  download:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/></svg>'
});

// The shared downloader temporarily writes textContent. Restore this dialog's
// static icon/label after it finishes without altering its save or tracking flow.
export async function lightboxDownload(button, action) {
  if (!button?.matches?.('.vg-lb-download')) return action();
  if (button.disabled) return false;
  const markup = button.innerHTML;
  try { return await action(); }
  finally { button.innerHTML = markup; }
}
