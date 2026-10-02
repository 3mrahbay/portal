import test from 'node:test';
import assert from 'node:assert/strict';
import { pushSonucunuDogrula, genelPushGonder, operasyonPushGonder, operasyonPushTetikle } from '../js/zeky-operasyon-push.js';

// Tüm ağ çağrıları sahte: gerçek endpoint/FCM, hesap veya cihaz kullanılmaz.
async function withFetch(response, run) {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const calls = [], warnings = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    if (response instanceof Error) throw response;
    return {
      ok: response.httpOk ?? true,
      status: response.status ?? 200,
      async text() {
        if (response.readError) throw response.readError;
        return response.text ?? JSON.stringify(response.json);
      }
    };
  };
  console.warn = (...args) => warnings.push(args);
  try { await run({ calls, warnings }); }
  finally { globalThis.fetch = originalFetch; console.warn = originalWarn; }
}

const success = { ok: true, gonderilen: 2, sonuclar: [{ ok: true }, { ok: true }] };
const allFailed = { ok: true, gonderilen: 2, sonuclar: [{ ok: false, hata: 'UNREGISTERED' }, { ok: false, hata: 'SENDER_ID_MISMATCH' }] };

test('sunucunun ok=true ve denenen sayısı tüm FCM hatalarını başarı yapmaz', () => {
  const result = pushSonucunuDogrula(allFailed);
  assert.equal(result.ok, false);
  assert.equal(result.istekKabulEdildi, true);
  assert.equal(result.gonderilen, 0);
  assert.equal(result.denenen, 2);
  assert.equal(result.basarisiz, 2);
  assert.equal(result.belirsiz, 0);
  assert.equal(result.durum, 'basarisiz');
  assert.equal(result.hata, 'UNREGISTERED');
});

test('FCM token kabulleri doğru sayılır; sonuç cihaz teslimatı iddiası içermez', () => {
  const result = pushSonucunuDogrula({ ...success, gonderilen: 999 });
  assert.equal(result.ok, true);
  assert.equal(result.istekKabulEdildi, true);
  assert.equal(result.gonderilen, 2);
  assert.equal(result.denenen, 2);
  assert.equal(result.basarisiz, 0);
  assert.equal(result.belirsiz, 0);
  assert.equal(result.durum, 'fcm-kabul-edildi');
  assert.equal(result.hata, '');
});

test('kısmi başarısızlık görünürdür ve başarı sayısını kaybetmez', () => {
  const result = pushSonucunuDogrula({ ok: true, gonderilen: 3, sonuclar: [{ ok: true }, { ok: false, hata: 'UNREGISTERED' }, { ok: true }] });
  assert.equal(result.ok, false);
  assert.equal(result.istekKabulEdildi, true);
  assert.equal(result.gonderilen, 2);
  assert.equal(result.basarisiz, 1);
  assert.equal(result.durum, 'kismi');
  assert.equal(result.hata, 'push-kismi-basarisizlik');
});

test('boş, eksik ve bozuk token sonuçları doğrulanmış gönderim sayılmaz', () => {
  for (const sonuclar of [undefined, null, {}, 'ok']) {
    const result = pushSonucunuDogrula({ ok: true, gonderilen: 10, sonuclar });
    assert.equal(result.ok, false);
    assert.equal(result.istekKabulEdildi, true);
    assert.equal(result.gonderilen, 0);
    assert.equal(result.denenen, null);
    assert.equal(result.durum, 'kabul-edildi');
    assert.equal(result.hata, 'push-fcm-sonucu-yok');
  }
  const empty = pushSonucunuDogrula({ ok: true, gonderilen: 0, sonuclar: [] });
  assert.equal(empty.ok, false);
  assert.equal(empty.denenen, 0);
  assert.equal(empty.hata, 'push-fcm-gonderim-yok');
  const invalid = pushSonucunuDogrula({ ok: true, sonuclar: [null, {}, { ok: 'true' }, { ok: 1 }] });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.gonderilen, 0);
  assert.equal(invalid.basarisiz, 0);
  assert.equal(invalid.belirsiz, 4);
  assert.equal(invalid.hata, 'push-fcm-sonucu-gecersiz');
  const partial = pushSonucunuDogrula({ ok: true, sonuclar: [{ ok: true }, {}] });
  assert.equal(partial.ok, false);
  assert.equal(partial.gonderilen, 1);
  assert.equal(partial.belirsiz, 1);
});

test('üst düzey hata veya eksik ok alanı token listesinden başarıya çevrilmez', () => {
  for (const ok of [false, undefined, 'true', 1]) {
    const result = pushSonucunuDogrula({ ...success, ok, hata: 'server-error' });
    assert.equal(result.ok, false);
    assert.equal(result.istekKabulEdildi, false);
    assert.equal(result.gonderilen, 2);
  }
  assert.equal(pushSonucunuDogrula({ ok: false, hata: 'auth-required' }).hata, 'auth-required');
});

test('JSON nesnesi olmayan yanıtlar açık hatadır', () => {
  for (const value of [undefined, null, true, false, 1, 'ok', [], [success]]) {
    const result = pushSonucunuDogrula(value);
    assert.equal(result.ok, false);
    assert.equal(result.istekKabulEdildi, false);
    assert.equal(result.gonderilen, 0);
    assert.equal(result.hata, 'push-yanit-gecersiz');
  }
});

test('normalleştirme girdiyi değiştirmez ve ek sunucu bilgilerini korur', () => {
  const input = Object.freeze({ ok: true, gonderilen: 999, olayId: 'event-A', sonuclar: Object.freeze([Object.freeze({ ok: true })]) });
  const result = pushSonucunuDogrula(input);
  assert.equal(input.gonderilen, 999);
  assert.equal(result.gonderilen, 1);
  assert.equal(result.olayId, 'event-A');
});

test('genel istek alıcıları ve varsayılanları korur, yalnız tek ağ çağrısı yapar', async () => {
  await withFetch({ json: success }, async ({ calls, warnings }) => {
    const result = await genelPushGonder([' Person@example.test ', 'person@example.test', '', null]);
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1].method, 'POST');
    assert.equal(calls[0][1].headers['Content-Type'], 'text/plain');
    assert.deepEqual(JSON.parse(calls[0][1].body), {
      aliciEmailler: ['person@example.test'], baslik: 'ZEKY', metin: '', hedefSayfa: 'bildirimler.html', tip: 'genel'
    });
    assert.equal(warnings.length, 0);
  });
});

test('genel köprü gizli token hatasını çağırana ve uyarıya taşır', async () => {
  await withFetch({ json: allFailed }, async ({ calls, warnings }) => {
    const result = await genelPushGonder(['person@example.test'], { baslik: 'Başlık', metin: 'Metin', tip: 'duyuru', hedefSayfa: 'duyurular.html' });
    assert.equal(result.ok, false);
    assert.equal(result.gonderilen, 0);
    assert.equal(result.hata, 'UNREGISTERED');
    assert.equal(calls.length, 1);
    assert.equal(warnings.length, 1);
    assert.equal(JSON.parse(calls[0][1].body).tip, 'duyuru');
  });
});

test('HTTP 200 ile boş, HTML veya bozuk JSON başarı olmaz', async () => {
  for (const [text, hata] of [
    ['', 'push-bos-yanit'], ['  \n', 'push-bos-yanit'],
    ['<html>login</html>', 'push-json-olmayan-yanit'], ['{', 'push-json-olmayan-yanit'],
    ['null', 'push-yanit-gecersiz'], ['true', 'push-yanit-gecersiz'], ['[]', 'push-yanit-gecersiz']
  ]) {
    await withFetch({ text }, async () => {
      const result = await genelPushGonder(['person@example.test']);
      assert.equal(result.ok, false);
      assert.equal(result.istekKabulEdildi, false);
      assert.equal(result.hata, hata);
    });
  }
});

test('HTTP hatası olumlu JSON ile gizlenmez; sunucu hata açıklaması korunur', async () => {
  for (const [json, hata] of [[success, 'push-http-503'], [{ ok: false, hata: 'yetkisiz' }, 'yetkisiz']]) {
    await withFetch({ json, httpOk: false, status: 503 }, async () => {
      const result = await genelPushGonder(['person@example.test']);
      assert.equal(result.ok, false);
      assert.equal(result.istekKabulEdildi, false);
      assert.equal(result.hata, hata);
    });
  }
  await withFetch({ text: '', httpOk: false, status: 502 }, async () => {
    assert.equal((await genelPushGonder(['person@example.test'])).hata, 'push-http-502');
  });
});

test('ağ veya yanıt okuma hatası başarısız döner ve otomatik tekrar göndermez', async () => {
  for (const response of [new Error('offline'), { readError: new Error('body-failed') }]) {
    await withFetch(response, async ({ calls }) => {
      const result = await genelPushGonder(['person@example.test']);
      assert.equal(result.ok, false);
      assert.equal(result.istekKabulEdildi, false);
      assert.equal(result.gonderilen, 0);
      assert.equal(calls.length, 1);
    });
  }
});

test('operasyon boolean API korunur ve yalnız doğrulanmış tam başarıda true olur', async () => {
  for (const [json, expected] of [[success, true], [allFailed, false], [{ ok: true }, false], [{ ok: true, sonuclar: [] }, false]]) {
    await withFetch({ json }, async ({ calls }) => {
      const result = await operasyonPushTetikle('sabah-yeni', 123);
      assert.equal(typeof result, 'boolean');
      assert.equal(result, expected);
      assert.equal(calls.length, 1);
      assert.deepEqual(JSON.parse(calls[0][1].body), { olay: 'sabah-yeni', kayitId: '123' });
    });
  }
});

test('ayrıntılı operasyon sonucu istek kabulü ile FCM kabulünü ayırır', async () => {
  await withFetch({ json: allFailed }, async () => {
    const result = await operasyonPushGonder('pickup-yeni', 'record-A');
    assert.equal(result.ok, false);
    assert.equal(result.istekKabulEdildi, true);
    assert.equal(result.gonderilen, 0);
    assert.equal(result.basarisiz, 2);
  });
});

test('eksik olay, kayıt veya alıcı ağ isteği oluşturmaz', async () => {
  await withFetch({ json: success }, async ({ calls }) => {
    assert.equal(await operasyonPushTetikle('', 'record-A'), false);
    assert.equal(await operasyonPushTetikle('sabah-yeni', ''), false);
    assert.equal((await operasyonPushGonder('', '')).hata, 'olay-veya-kayit-yok');
    assert.equal((await genelPushGonder([])).hata, 'alici-yok');
    assert.equal((await genelPushGonder(['', null, '  '])).ok, false);
    assert.equal(calls.length, 0);
  });
});


test('ayrı istek kabulü alanı yeni sunucu sözleşmesinde ve yeniden normalleştirmede korunur', () => {
  const corrected = { ...allFailed, ok: false, istekKabulEdildi: true, gonderilen: 0, hata: 'push-fcm-basarisiz' };
  const result = pushSonucunuDogrula(corrected);
  assert.equal(result.ok, false);
  assert.equal(result.istekKabulEdildi, true);
  assert.equal(result.gonderilen, 0);
  assert.equal(result.basarisiz, 2);
  assert.equal(result.hata, 'push-fcm-basarisiz');
  const normalized = pushSonucunuDogrula(allFailed);
  assert.deepEqual(pushSonucunuDogrula(normalized), normalized);
  const rejected = pushSonucunuDogrula({ ...success, istekKabulEdildi: false });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.istekKabulEdildi, false);
});

test('eski operasyon tekrar, sıfır hedef ve yalnız sayaç yanıtları kabul edilmiş/doğrulanmamış kalır', () => {
  for (const response of [
    { ok: true, tekrar: true, olay: 'sabah-yeni' },
    { ok: true, gonderilen: 0, olay: 'sabah-yeni' },
    { ok: true, olay: 'sabah-yeni', alici: 2, gonderilen: 3 }
  ]) {
    const result = pushSonucunuDogrula(response);
    assert.equal(result.ok, false);
    assert.equal(result.istekKabulEdildi, true);
    assert.equal(result.durum, 'kabul-edildi');
    assert.equal(result.gonderilen, 0);
    assert.equal(result.hata, 'push-fcm-sonucu-yok');
    if (response.tekrar) assert.equal(result.tekrar, true);
  }
});
