// Bildirim düğmesi oturumun mevcut üst alanında kalır; veri/dinleyici yönetmez.
export function createNotificationHeaderMounts(doc) {
  const targets = [], created = [], decorated = [];
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
  // Veli eski başlığı CSS ile gizlidir; yeniapp kökü her gezinmede değiştirilir.
  // Onun dışındaki kalıcı ana alanda küçük bir üst araç çubuğu kullanılır.
  const parent = doc.querySelector?.('#veliPanel .veli-main');
  if (parent) {
    const bar = doc.createElement('div'); bar.className = 'pbm-veli-ustbar';
    bar.setAttribute('aria-label', 'Bildirim araçları');
    const label = doc.createElement('span'); label.className = 'pbm-ustbar-etiket'; label.textContent = 'Bildirimler';
    const slot = doc.createElement('span'); slot.className = 'pbm-baslik-yuvasi';
    bar.append(label, slot); parent.prepend(bar); created.push(bar); targets.push(slot);
    addClass(doc.getElementById?.('veliPanel'), 'pbm-veli-aktif');
  }
  if (!targets.length && doc.body) {
    const bar = doc.createElement('div'); bar.className = 'pbm-veli-ustbar pbm-yedek-ustbar';
    const label = doc.createElement('span'); label.className = 'pbm-ustbar-etiket'; label.textContent = 'Bildirimler';
    const slot = doc.createElement('span'); slot.className = 'pbm-baslik-yuvasi';
    bar.append(label, slot); doc.body.prepend(bar); created.push(bar); targets.push(slot);
  }
  return { targets, cleanup() {
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
