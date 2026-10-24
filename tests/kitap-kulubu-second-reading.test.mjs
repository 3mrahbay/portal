import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SECOND_BOOK, SECOND_ID, INITIAL_BOOK, INITIAL_ID, eventDetails, groupBooks, canPost, accessFor } from '../js/kitap-kulubu/core.mjs';

test('second reading has the agreed date, audience and schema; first remains intact', () => {
  assert.equal(SECOND_BOOK.title,'Ebeveynliği Hissetmek');
  assert.equal(SECOND_BOOK.authors,'Jennifer Day');
  assert.equal(SECOND_BOOK.leader,'Psikolog Şeyma Baydaroğlu');
  assert.equal(SECOND_BOOK.date,'2026-11-26T19:00:00+03:00');
  assert.equal(new Date(SECOND_BOOK.date).getUTCDay(),4);
  assert.deepEqual(Object.keys(SECOND_BOOK).sort(),Object.keys(INITIAL_BOOK).sort());
  assert.match(SECOND_BOOK.purpose,/Annelere özel/);
  assert.equal(INITIAL_BOOK.title,'Çocuklar İçin Beş Sevgi Dili');
  assert.equal(INITIAL_BOOK.date,'2026-10-22T19:00:00+03:00');
  const books = groupBooks([{id:SECOND_ID,...SECOND_BOOK},{id:INITIAL_ID,...INITIAL_BOOK,status:'archived'}]);
  assert.equal(books.active[0].id,SECOND_ID);
  assert.equal(books.archive[0].id,INITIAL_ID);
  assert.equal(canPost(accessFor({parent:{yakinlik:'Baba',onaylandi:true}}),{status:'approved'},SECOND_BOOK),false);
  assert.equal(canPost(accessFor({parent:{yakinlik:'Anne',onaylandi:true}}),{status:'approved'},books.archive[0]),false);
});
test('each reading retains its own discussion and preparation copy', () => {
  assert.match(eventDetails(INITIAL_ID).topics.join(' '),/beş sevgi dili/);
  assert.match(eventDetails(SECOND_ID).topics.join(' '),/iç sesimize/);
  assert.doesNotMatch(eventDetails(SECOND_ID).topics.join(' '),/beş sevgi dili/);
  assert.match(eventDetails(SECOND_ID).preparation,/bitiremediyseniz/);
  assert.match(eventDetails(SECOND_ID).why,/annelerle/);
  assert.equal(eventDetails('future').topics.length,3);
});
test('Portal and ZEKY promotion lasts through the second meeting, then returns to library', () => {
  const context = {window:{},document:{addEventListener(){},readyState:'loading'}};
  vm.runInNewContext(readFileSync(new URL('../js/kitap-kulubu.js',import.meta.url),'utf8'),context);
  for(const surface of ['portal','zeky']) {
    const card=context.window.KitapKulubu.card(surface,Date.parse('2026-11-26T19:00:00+03:00'));
    assert.match(card,/Ebeveynliği Hissetmek/);
    assert.match(card,/26 Kasım 2026 Perşembe · 19.00/);
    assert.match(card,/ANNELERE ÖZEL/);
    assert.doesNotMatch(card,/Beş Sevgi/);
    const expired=context.window.KitapKulubu.card(surface,Date.parse('2026-11-27T00:00:00+03:00'));
    assert.match(expired,/data-bk-open="library"/);
    assert.doesNotMatch(expired,/Ebeveynliği Hissetmek/);
  }
});
