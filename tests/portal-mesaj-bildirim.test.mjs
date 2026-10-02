import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMessageNoticeTracker } from '../js/portal-mesaj-bildirim.js';

const email = 'personel@example.test';
const incoming = 'diger@example.test';
const thread = (seconds, extra = {}) => ({
  id: 'sohbet-1', sonMesajTarihi: { seconds, nanoseconds: 0 },
  sonMesajGonderen: incoming, okunmamis: { [email]: 1 }, ...extra
});
const update = (tracker, threads, options = {}) => tracker.update({ email, threads, ...options });
const liveTracker = (threads = [thread(1)]) => {
  const tracker = createMessageNoticeTracker();
  assert.deepEqual(update(tracker, threads), []);
  return tracker;
};

test('ilk sunucu görüntüsü eski okunmamış mesajları bildirmez', () => {
  const tracker = liveTracker([thread(1), thread(2, { id: 'sohbet-2' })]);
  assert.deepEqual(update(tracker, [thread(1), thread(2, { id: 'sohbet-2' })]), []);
  assert.equal(update(tracker, [thread(3)])[0].id, 'sohbet-1');
});

test('boş/eksik önbellek ve ilk sunucu görüntüsü birlikte açılış sayılır', () => {
  const tracker = createMessageNoticeTracker();
  assert.deepEqual(update(tracker, [], { fromCache: true }), []);
  assert.deepEqual(update(tracker, [thread(1)], { fromCache: true }), []);
  assert.deepEqual(update(tracker, [thread(5), thread(7, { id: 'sohbet-2' })]), []);
  assert.deepEqual(update(tracker, [thread(5), thread(7, { id: 'sohbet-2' })]), []);
  assert.equal(update(tracker, [thread(8)])[0].id, 'sohbet-1');
});

test('boş ilk sunucu görüntüsünden sonraki yeni sohbet bildirilir', () => {
  const tracker = liveTracker([]);
  const added = thread(8);
  assert.deepEqual(update(tracker, [added]), [added]);
});

test('tekrarlanan görüntü, rozet değişmesi ve geriye giden veri bildirmez', () => {
  const tracker = liveTracker();
  assert.equal(update(tracker, [thread(2)]).length, 1);
  for (const value of [thread(2), thread(2, { okunmamis: { [email]: 4 } }), thread(1), thread(2)]) {
    assert.deepEqual(update(tracker, [value]), []);
  }
  assert.equal(update(tracker, [thread(3)]).length, 1);
});

test('kendi mesajı ve boş gönderen sessizce tüketilir', () => {
  const tracker = liveTracker();
  assert.deepEqual(update(tracker, [thread(2, { sonMesajGonderen: ' PERSONEL@EXAMPLE.TEST ' })]), []);
  assert.deepEqual(update(tracker, [thread(2)]), []);
  assert.deepEqual(update(tracker, [thread(3, { sonMesajGonderen: '' })]), []);
  assert.deepEqual(update(tracker, [thread(3)]), []);
  assert.equal(update(tracker, [thread(4)]).length, 1);
});

test('yalnız şu anda gerçekten görünen sohbet sessizdir; çıkınca tekrarlanmaz', () => {
  const tracker = liveTracker();
  assert.deepEqual(update(tracker, [thread(2)], { viewedThreadId: 'sohbet-1' }), []);
  assert.deepEqual(update(tracker, [thread(2)], { viewedThreadId: '' }), []);
  assert.equal(update(tracker, [thread(3)], { viewedThreadId: 'diger-sohbet' }).length, 1);
});

test('okunmuş veya geçersiz sayaç bildirmez; sonradan sayaç değişmesi geçmişi oynatmaz', () => {
  const tracker = liveTracker();
  for (const [index, count] of [0, -1, Infinity, 'bozuk'].entries()) {
    const seconds = index + 2;
    assert.deepEqual(update(tracker, [thread(seconds, { okunmamis: { [email]: count } })]), []);
    assert.deepEqual(update(tracker, [thread(seconds)]), []);
  }
  assert.deepEqual(update(tracker, [thread(7, { okunmamis: { [incoming]: 5 } })]), []);
  assert.equal(update(tracker, [thread(8)]).length, 1);
});

test('sunucu hazırken önbellek bildirmez veya sunucudaki yeni mesajı tüketmez', () => {
  const tracker = liveTracker();
  assert.deepEqual(update(tracker, [thread(2)], { fromCache: true }), []);
  assert.equal(update(tracker, [thread(2)]).length, 1);
  assert.deepEqual(update(tracker, [thread(1)], { fromCache: true }), []);
  assert.deepEqual(update(tracker, [thread(2)]), []);
});

test('sorgudan silinip yeniden gelen aynı sohbet aynı mesajı yinelemez', () => {
  const tracker = liveTracker();
  assert.equal(update(tracker, [thread(2)]).length, 1);
  assert.deepEqual(update(tracker, []), []);
  assert.deepEqual(update(tracker, [thread(2)]), []);
});

test('aynı milisaniyede farklı nanosaniyeli mesajlar ayrılır', () => {
  const tracker = liveTracker([thread(2, { sonMesajTarihi: { seconds: 2, nanoseconds: 100 } })]);
  const next = thread(2, { sonMesajTarihi: { seconds: 2, nanoseconds: 101 } });
  assert.deepEqual(update(tracker, [next]), [next]);
  assert.deepEqual(update(tracker, [next]), []);
});

test('geçersiz/çözümlenmemiş zamanlar çökmez; daha sonra onaylanan zaman işlenir', () => {
  const tracker = liveTracker();
  for (const sonMesajTarihi of [null, {}, { seconds: 2, nanoseconds: -1 }, { toMillis() { throw Error('bad'); } }]) {
    assert.deepEqual(update(tracker, [thread(2, { sonMesajTarihi })]), []);
  }
  assert.equal(update(tracker, [thread(2)]).length, 1);
  assert.equal(update(tracker, [thread(3, { sonMesajTarihi: { toMillis: () => 3000 } })]).length, 1);
  assert.equal(update(tracker, [thread(4, { sonMesajTarihi: new Date(4000) })]).length, 1);
});

test('hesap değişimi, çıkış ve reset yeni açılış geçmişini susturur', () => {
  const tracker = liveTracker();
  assert.equal(update(tracker, [thread(2)]).length, 1);
  const nextUser = 'yeni@example.test';
  const other = thread(3, { okunmamis: { [nextUser]: 1 } });
  assert.deepEqual(update(tracker, [other], { email: nextUser }), []);
  assert.deepEqual(update(tracker, [thread(3)]), []);
  assert.deepEqual(update(tracker, [thread(4)], { email: '' }), []);
  assert.deepEqual(update(tracker, [thread(4)]), []);
  tracker.reset();
  assert.deepEqual(update(tracker, [thread(5)]), []);
  assert.equal(update(tracker, [thread(6)]).length, 1);
});

test('hesap normalizasyonu, yinelenen kayıt ve bozuk dizi güvenli işlenir', () => {
  const tracker = createMessageNoticeTracker();
  assert.deepEqual(tracker.update(), []);
  assert.deepEqual(update(tracker, null), []);
  assert.deepEqual(update(tracker, [null, {}, thread(1)], { email: ' PERSONEL@EXAMPLE.TEST ' }), []);
  const next = thread(2);
  assert.deepEqual(update(tracker, [next, next]), [next]);
});

test('girdi ve okunmamış sayacı değiştirilmez', () => {
  const tracker = liveTracker();
  const value = Object.freeze(thread(2, { okunmamis: Object.freeze({ [email]: 2 }) }));
  assert.deepEqual(update(tracker, Object.freeze([value])), [value]);
  assert.equal(value.okunmamis[email], 2);
});

// Küçük DOM/Audio sahtecisi: gerçek hesap, ağ, Firestore veya tarayıcı izni kullanmaz.
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.listeners = {}; this.className = ''; this.text = ''; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
  setAttribute(name, value) { this.attributes[name] = value; }
  get classList() { return { add: value => { this.className += ` ${value}`; } }; }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  appendChild(node) { node.parent = this; this.children.push(node); return node; }
  prepend(node) { node.parent = this; this.children.unshift(node); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
  contains(target) { return target === this || this.children.some(node => node.contains(target)); }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  emit(type, event = {}) { for (const callback of this.listeners[type] || []) callback(event); }
}
const descendants = node => [node, ...node.children.flatMap(descendants)];
const byClass = (node, name) => descendants(node).filter(child => child.className.split(' ').includes(name));
let browserId = 0;
async function withBrowser(run) {
  const module = await import(`../js/portal-mesaj-bildirim.js?browserTest=${++browserId}`);
  const old = { document: globalThis.document, window: globalThis.window, setTimeout, clearTimeout };
  const body = new Element('body'), head = new Element('head');
  const document = {
    body, head, activeElement: null, createElement: tag => new Element(tag),
    getElementById: id => [...descendants(head), ...descendants(body)].find(node => node.id === id)
  };
  const events = {}, audio = { instances: [], oscillators: [] }, timers = new Map();
  let timerId = 0;
  const window = {
    navigator: { userActivation: { hasBeenActive: false } },
    addEventListener(type, callback) { (events[type] ||= []).push(callback); },
    AudioContext: class {
      constructor() { this.state = 'suspended'; this.currentTime = 1; audio.instances.push(this); }
      resume() { this.state = 'running'; return Promise.resolve(); }
      createOscillator() {
        const oscillator = { frequency: {}, connect() {}, disconnect() {}, start() {}, stop() {} };
        audio.oscillators.push(oscillator); return oscillator;
      }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    }
  };
  Object.assign(globalThis, { document, window,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id)
  });
  try { await run({ module, document, window, events, audio, timers }); }
  finally {
    module.clearMessageNotices();
    for (const [name, value] of Object.entries(old)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  }
}

test('görsel uyarı güvenli genel metin, erişilebilir durum ve aç/kapat eylemi içerir', async () => {
  await withBrowser(({ module, document }) => {
    let opened = null;
    const value = thread(2, { sonMesaj: 'ÖZEL MESAJ GÖVDESİ', ogrenciAd: 'ÖZEL ÖĞRENCİ' });
    const card = module.showMessageNotice(value, { senderName: '<img onerror=bad>', onOpen: item => { opened = item; } });
    assert.ok(card.textContent.includes('<img onerror=bad> · Yeni mesaj'));
    assert.ok(!card.textContent.includes(value.sonMesaj));
    assert.ok(!card.textContent.includes(value.ogrenciAd));
    assert.ok(!card.textContent.includes(incoming));
    assert.equal(descendants(card).find(node => node.attributes.role === 'status').attributes['aria-live'], 'polite');
    assert.equal(document.activeElement, null);
    byClass(card, 'pmb-ac')[0].emit('click');
    assert.equal(opened, value);
    assert.equal(card.parent, null);
    const dismissible = module.showMessageNotice(value);
    byClass(dismissible, 'pmb-kapat')[0].emit('click');
    assert.equal(dismissible.parent, null);
    assert.equal(value.okunmamis[email], 1);
  });
});

test('aynı sohbet tek karttır; en fazla üç kart/üç zamanlayıcı ve temiz çıkış', async () => {
  await withBrowser(({ module, document, timers }) => {
    const unrelated = new Element('aside');
    unrelated.id = 'gnYigin';
    unrelated.className = 'gn-yigin';
    document.body.appendChild(unrelated);
    const first = module.showMessageNotice(thread(2));
    module.showMessageNotice(thread(3));
    assert.equal(first.parent, null);
    assert.equal(timers.size, 1);
    for (const id of ['sohbet-2', 'sohbet-3', 'sohbet-4']) module.showMessageNotice(thread(4, { id }));
    assert.equal(byClass(document.body, 'pmb-kart').length, 3);
    assert.equal(timers.size, 3);
    assert.equal(unrelated.className, 'gn-yigin');
    assert.equal(unrelated.children.length, 0);
    assert.equal(document.getElementById('portalMesajBildirimYigin').children.length, 3);
    module.clearMessageNotices();
    module.clearMessageNotices();
    assert.equal(byClass(document.body, 'pmb-kart').length, 0);
    assert.equal(timers.size, 0);
    assert.ok(unrelated.parent);
  });
});

test('uyarı kendiliğinden kapanır; fare veya klavye odağı sırasında bekler', async () => {
  await withBrowser(({ module, document, timers }) => {
    const card = module.showMessageNotice(thread(2), { onOpen() {} });
    card.emit('pointerenter');
    assert.equal(timers.size, 0);
    card.emit('pointerleave');
    assert.equal(timers.size, 1);
    const open = byClass(card, 'pmb-ac')[0];
    document.activeElement = open;
    card.emit('focusin');
    assert.equal(timers.size, 0);
    card.emit('pointerleave');
    assert.equal(timers.size, 0);
    document.activeElement = null;
    card.emit('focusout', { relatedTarget: null });
    assert.equal(timers.size, 1);
    [...timers.values()][0]();
    assert.equal(card.parent, null);
    assert.equal(timers.size, 0);
    const other = module.showMessageNotice(thread(3));
    other.emit('keydown', { key: 'Escape' });
    assert.equal(other.parent, null);
  });
});

test('ses etkileşim öncesinde çalmaz, tekrar kurulum tek dinleyici ve toplu olay tek sestir', async () => {
  await withBrowser(({ module, events, audio }) => {
    module.setupMessageSound(); module.setupMessageSound();
    module.showMessageNotice(thread(2));
    assert.equal(audio.instances.length, 0);
    assert.equal(events.pointerdown.length, 1);
    events.pointerdown[0]();
    assert.equal(audio.instances.length, 1);
    assert.equal(audio.oscillators.length, 0);
    module.showMessageNotice(thread(3));
    assert.equal(audio.oscillators.length, 2);
    assert.deepEqual(audio.oscillators.map(value => value.frequency.value), [880, 1175]);
    module.showMessageNotice(thread(4, { id: 'sohbet-2' }));
    assert.equal(audio.oscillators.length, 2);
    audio.instances[0].currentTime += 1;
    module.showMessageNotice(thread(5));
    assert.equal(audio.oscillators.length, 4);
  });
});

test('geç yüklenen modül önceki etkileşimi kullanmayı dener; ses engeli görseli engellemez', async () => {
  await withBrowser(({ module, window, audio, document }) => {
    window.navigator.userActivation.hasBeenActive = true;
    window.AudioContext.prototype.resume = function () { return Promise.reject(Error('autoplay')); };
    module.setupMessageSound();
    module.showMessageNotice(thread(2));
    assert.equal(audio.instances.length, 1);
    assert.equal(audio.oscillators.length, 0);
    assert.equal(byClass(document.body, 'pmb-kart').length, 1);
  });
});

test('DOM bulunmayan ortamda tarayıcı yardımcıları güvenli ve etkisizdir', async () => {
  const module = await import('../js/portal-mesaj-bildirim.js');
  assert.equal(module.showMessageNotice(thread(2)), null);
  module.setupMessageSound(); module.clearMessageNotices();
});
