import { INITIAL_ID, INITIAL_BOOK, SECOND_ID, SECOND_BOOK } from '../js/kitap-kulubu/core.mjs';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';

const database = 'projects/bcka-site/databases/(default)';
const name = id => `${database}/documents/kitapKulubu/${id}`;
const fields = data => Object.fromEntries(Object.entries(data).map(([key,value]) => [key,{stringValue:value}]));
const stamp = [{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}];
export function migrationWrites(first, second) {
  if (!first || first.name !== name(INITIAL_ID) || !first.updateTime ||
      first.fields?.title?.stringValue !== INITIAL_BOOK.title ||
      first.fields?.date?.stringValue !== INITIAL_BOOK.date ||
      !['active','archived'].includes(first.fields?.status?.stringValue)) {
    throw Error('İlk okuma beklenen kayıtla eşleşmiyor; hiçbir değişiklik yapılmadı.');
  }
  if (second && (second.name !== name(SECOND_ID) || !second.updateTime ||
      Object.entries(SECOND_BOOK).some(([key,value]) => second.fields?.[key]?.stringValue !== value))) {
    throw Error('İkinci okuma zaten var ve içerik farklı; üzerine yazılmadı.');
  }
  const writes = [];
  if (!second) writes.push({
    update:{name:name(SECOND_ID),fields:fields(SECOND_BOOK)},
    currentDocument:{exists:false},updateTransforms:stamp,
  });
  if (first.fields.status.stringValue === 'active') writes.push({
    update:{name:name(INITIAL_ID),fields:fields({status:'archived'})},
    updateMask:{fieldPaths:['status']},currentDocument:{updateTime:first.updateTime},updateTransforms:stamp,
  });
  return writes;
}
export async function main(args = process.argv.slice(2)) {
  const mode = args[0] || '--plan';
  if (!['--plan','--check','--apply'].includes(mode) ||
      (mode !== '--apply' && args.length > 1) ||
      (mode === '--apply' && (args.length !== 3 || args[1] !== '--backup'))) {
    throw Error('Kullanım: --plan | --check | --apply --backup <yeni-dosya.json>');
  }
  if (mode === '--plan') {
    console.log(JSON.stringify({project:'bcka-site',collection:'kitapKulubu',create:{id:SECOND_ID,...SECOND_BOOK},archive:{id:INITIAL_ID,status:'archived'},liveWrites:false},null,2));
    return;
  }
  const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  if (!token) throw Error('GOOGLE_OAUTH_ACCESS_TOKEN gerekli; tokenı paylaşmayın veya depoya kaydetmeyin.');
  async function request(path, body) {
    const response = await fetch(`https://firestore.googleapis.com/v1/${path}`,{
      method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),
    });
    if (!body && response.status === 404) return null;
    if (!response.ok) throw Error(`Firestore isteği başarısız (${response.status}); yeniden okuyup kontrol edin.`);
    return response.json();
  }
  const read = () => Promise.all([request(name(INITIAL_ID)),request(name(SECOND_ID))]);
  const before = await read();
  const writes = migrationWrites(...before);
  if (mode === '--check') {
    console.log(JSON.stringify({mode,writeCount:writes.length,writes},null,2));
    return;
  }
  if (!writes.length) { console.log('Kayıtlar zaten hazır; yazma yapılmadı.'); return; }
  // A new private backup is mandatory. Atomic commit + preconditions prevent partial rollover or lost edits.
  await writeFile(args[2],JSON.stringify({database,before},null,2),{flag:'wx',mode:0o600});
  await request(`${database}/documents:commit`,{writes});
  const after = await read();
  if (migrationWrites(...after).length) throw Error('Yazma sonrası doğrulama başarısız; yedeği koruyun.');
  console.log('İkinci okuma aktif, ilk okuma arşivde. İki kayıt sunucudan doğrulandı.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode=1; });
}
