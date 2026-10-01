// Bildirim düğmesi oturumun mevcut üst alanında kalır; veri/dinleyici yönetmez.
export function createNotificationHeaderMounts(doc) {
  const targets = [], created = [], decorated = [];
  let parentObserver = null, parentHeader = null, disposed = false;
  const addClass = (node, value) => {
    if (!node) return;
    node.classList.add(value); decorated.push([node, value]);
  };
  const staff = doc.querySelector?.('#dashboard .user-menu');
  if (staff) {
    const slot = doc.createElement('span'); slot.className = 'pbm-baslik-yuvasi';
    const profile = staff.querySelector?.('.user-badge');
    if (profile) staff.insertBefore(slot, profile); else staff.appendChild(slot);
    created.push(slot); targets.push(slot);
    addClass(doc.querySelector?.('#dashboard .dash-header'), 'pbm-baslik-aktif');
  }
  // Veli ekranı her gezinmede yeniden çizilir. Aynı zil düğmesini mevcut
  // ikon satırına taşı; ana tasarımın üstüne ayrı bir araç çubuğu ekleme.
  const parent = doc.querySelector?.('#veliPanel .veli-main');
  if (parent) {
    const slot = doc.createElement('span'); slot.className = 'pbm-baslik-yuvasi pbm-veli-yuva';
    created.push(slot); targets.push(slot);
    addClass(doc.getElementById?.('veliPanel'), 'pbm-veli-aktif');
    const placeParent = () => {
      if (disposed) return;
      const active = parent.querySelector?.('.veli-tab-panel.active');
      const backBar = active?.querySelector?.('.zeky-geri-bar');
      const header = backBar || active?.querySelector?.('.ca-topbar');
      if (parentHeader !== header) {
        parentHeader?.classList.remove('pbm-veli-baslik');
        parentHeader = header || null;
        parentHeader?.classList.add('pbm-veli-baslik');
      }
      // Ana sayfadaki eski zilin yeri menü ve çıkış simgelerinin arasındadır.
      // Eski kısayol CSS ile gizlidir; onun yerine canlı sayaçlı düğme görünür.
      const oldBell = header?.querySelector?.('button[onclick="veliSwitchTab(\'bildirimler\')"]');
      const target = oldBell?.parentNode || header;
      if (!target) { slot.remove(); return; }
      if (slot.parentNode === target) return;
      if (oldBell) target.insertBefore(slot, oldBell); else target.appendChild(slot);
    };
    placeParent();
    const Observer = doc.defaultView?.MutationObserver || globalThis.MutationObserver;
    if (typeof Observer === 'function') {
      parentObserver = new Observer(placeParent);
      parentObserver.observe(parent, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    }
  }
  if (!targets.length && doc.body) {
    const bar = doc.createElement('div'); bar.className = 'pbm-veli-ustbar pbm-yedek-ustbar';
    const label = doc.createElement('span'); label.className = 'pbm-ustbar-etiket'; label.textContent = 'Bildirimler';
    const slot = doc.createElement('span'); slot.className = 'pbm-baslik-yuvasi';
    bar.append(label, slot); doc.body.prepend(bar); created.push(bar); targets.push(slot);
  }
  return { targets, cleanup() {
    disposed = true; parentObserver?.disconnect(); parentHeader?.classList.remove('pbm-veli-baslik');
    created.forEach(node => node.remove());
    decorated.forEach(([node, value]) => node.classList.remove(value));
  } };
}

export function positionNotificationPanel(panel, buttons, win = globalThis.window) {
  if (!panel?.style || !win) return;
  const visible = buttons.map(value => value.button || value).find(button => {
    const rect = button.getBoundingClientRect?.();
    return rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < win.innerHeight;
  });
  const rect = visible?.getBoundingClientRect();
  const height = Number(win.innerHeight) || 800;
  const top = Math.max(12, Math.min(rect ? rect.bottom + 10 : 76, height - 140));
  panel.style.setProperty('--pbm-panel-top', `${top}px`);
}
