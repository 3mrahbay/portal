import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { okulMailGonder } from '../js/finans/payment-actions.js';

// Ortak mail proxy'si (BCK_MailProxy) okul dışı alıcılarda gönderenin Firebase
// oturumunu doğrular. Bu testler istemcinin jetonu gönderdiğini sabitler.
async function fetchIle(run) {
  const eski = globalThis.fetch, govdeler = [];
  globalThis.fetch = async (_u, opt) => { govdeler.push(JSON.parse(opt.body)); return { ok: true, json: async () => ({ success: true, messageId: 'm1' }) }; };
  try { await run(govdeler); } finally { globalThis.fetch = eski; }
}

test('ortak finans mail yardımcısı oturum jetonunu ekler; veri alanı jetonu ezemez', async () => {
  globalThis.zekyOturumJetonu = async () => 'jeton-xyz';
  try {
    await fetchIle(async govdeler => {
      await okulMailGonder({ to: 'veli@example.test', subject: 'S', htmlContent: '<p>x</p>', idToken: 'sahte' });
      assert.equal(govdeler[0].idToken, 'jeton-xyz');
      assert.equal(govdeler[0].to, 'veli@example.test');
    });
  } finally { delete globalThis.zekyOturumJetonu; }
});

test('jeton sağlayıcısı yoksa veya hata verirse boş jetonla gider', async () => {
  await fetchIle(async govdeler => {
    await okulMailGonder({ to: 'veli@example.test', subject: 'S', htmlContent: 'x' });
    assert.equal(govdeler[0].idToken, '');
  });
  globalThis.zekyOturumJetonu = async () => { throw new Error('ag'); };
  try {
    await fetchIle(async govdeler => {
      await okulMailGonder({ to: 'veli@example.test', subject: 'S', htmlContent: 'x' });
      assert.equal(govdeler[0].idToken, '');
    });
  } finally { delete globalThis.zekyOturumJetonu; }
});

test('uygulamanın kendi mail gönderimi de jetonu ekler ve sağlayıcıyı paylaşır', async () => {
  const kaynak = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(kaynak, /idToken: await oturumJetonu\(\)/);
  assert.match(kaynak, /zekyOturumJetonu = /);
});
