// Proposed browser adapter. The page must pass the already configured
// Firebase Functions instance. No identity, e-mail, UID or staff document is
// accepted from localStorage or from page arguments.
import {
  httpsCallable
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

function callableResult(response) {
  if (!response || !response.data || typeof response.data !== 'object') {
    throw new Error('Randevu servisi geçersiz yanıt verdi.');
  }
  return response.data;
}

export function yeniRandevuIstekAnahtari() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Güvenli işlem anahtarı üretilemedi.');
  }
  // UI, belirsiz ağ hatasında aynı kullanıcı eylemini tekrar gönderirken bu
  // değeri değiştirmemelidir. Yeni bir buton eyleminde yeni değer üretilir.
  return globalThis.crypto.randomUUID().replaceAll('-', '_');
}

export function randevuCallableAdapter(functions) {
  if (!functions) throw new Error('Firebase Functions bağlantısı gerekli.');
  const queryCall = httpsCallable(functions, 'randevuSorguV3');
  const commandCall = httpsCallable(
    functions,
    'randevuKomutV3',
    { limitedUseAppCheckTokens: true }
  );

  const query = async data => callableResult(await queryCall(data));
  const command = async data => callableResult(await commandCall(data));

  return Object.freeze({
    hedefleriGetir: (ogrenciId, tip) => query({
      op: 'targets', ogrenciId, tip
    }).then(x => x.hedefler || []),

    saatleriGetir: (ogrenciId, hedefKodu, tip) => query({
      op: 'slots', ogrenciId, hedefKodu, tip
    }).then(x => x.saatler || []),

    randevularim: ogrenciId => query({
      op: 'mine', ogrenciId
    }).then(x => x.randevular || []),

    personelKutusu: () => query({ op: 'inbox' }),

    yonetimKutusu: () => query({ op: 'management_inbox' }),

    personelBaglami: () => query({ op: 'staff_context' }).then(x => {
      if (!['ogretmen_veli', 'pdr', 'idare'].includes(x.tip)) {
        throw new Error('Personel randevu bağlamı geçersiz.');
      }
      return Object.freeze({ tip: x.tip });
    }),

    personelOgrencileri: () => query({ op: 'staff_children' })
      .then(x => x.ogrenciler || []),

    musaitlikHedefleri: () => query({ op: 'availability_targets' })
      .then(x => x.hedefler || []),

    musaitlikleriGetir: hedefKodu => query({
      op: 'availability_list', hedefKodu
    }).then(x => x.saatler || []),

    veliOgrencileri: () => query({ op: 'parent_children' })
      .then(x => x.ogrenciler || []),

    veliRandevuOlustur: ({
      requestId, ogrenciId, hedefKodu, slotKodu, not = ''
    }) => command({
      action: 'create_parent', requestId,
      ogrenciId, hedefKodu, slotKodu, not
    }),

    personelRandevuOlustur: ({
      requestId, ogrenciId, baslangicMillis, not = ''
    }) => command({
      action: 'create_staff', requestId,
      ogrenciId, baslangicMillis, not
    }),

    musaitlikTopluOlustur: ({ requestId, hedefKodlari, baslangicMillisListesi }) => command({
      action: 'availability_bulk_create', requestId, hedefKodlari, baslangicMillisListesi
    }),
    musaitlikOlustur: ({ requestId, hedefKodu, baslangicMillis }) => command({
      action: 'availability_create', requestId, hedefKodu, baslangicMillis
    }),

    musaitlikSil: ({ requestId, hedefKodu, baslangicMillis }) => command({
      action: 'availability_delete', requestId, hedefKodu, baslangicMillis
    }),

    onayla: (requestId, randevuId) => command({
      action: 'approve', requestId, randevuId
    }),

    reddet: (requestId, randevuId, neden) => command({
      action: 'reject', requestId, randevuId, neden
    }),

    farkliSaatOner: ({ requestId, randevuId, baslangicMillis, not }) => command({
      action: 'propose', requestId, randevuId, baslangicMillis, not
    }),

    teklifiKabulEt: (requestId, randevuId) => command({
      action: 'accept_proposal', requestId, randevuId
    }),

    teklifiReddet: (requestId, randevuId, neden) => command({
      action: 'reject_proposal', requestId, randevuId, neden
    }),

    iptalEt: (requestId, randevuId, neden) => command({
      action: 'cancel', requestId, randevuId, neden
    })
  });
}
