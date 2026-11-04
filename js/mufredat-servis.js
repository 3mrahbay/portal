import {guvenliFunctionsGetir} from './zeky-randevu-cutover-runtime.js';
import {httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
export async function mufredatIslem(data) {
  const fn = httpsCallable(await guvenliFunctionsGetir(), 'mufredatIslemV1', {timeout:120000});
  return (await fn(data)).data;
}
