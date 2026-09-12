import fs from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';

const projectId = 'demo-zeky-rules';
const rules = fs.readFileSync(new URL('../randevu-firestore.rules.proposal', import.meta.url), 'utf8');
let env;

const PERSONELLER = {
  'teacher1@example.com': { durum:'aktif', rol:'ogretmen' },
  'teacher2@example.com': { durum:'aktif', rol:'ogretmen' },
  'pdr@example.com': { durum:'aktif', rol:'pdr' },
  'manager@example.com': { durum:'aktif', rol:'mudur' }
};

const YETKILER = {
  rk_teacher1: { email:'teacher1@example.com', rol:'ogretmen', aktif:true },
  rk_teacher2: { email:'teacher2@example.com', rol:'ogretmen', aktif:true },
  rk_pdr: { email:'pdr@example.com', rol:'pdr', aktif:true },
  rk_manager: { email:'manager@example.com', rol:'mudur', aktif:true }
};

function randevu({ veliEmail, hedefKodu, hedefAd, hedefRol='ogretmen', tarih='2026-09-20', saat='16:00' }) {
  return {
    veliEmail,
    veliAd: veliEmail.split('@')[0],
    ogrenciId: 'ogrenci-test',
    ogrenciAd: 'Test Çocuk',
    veliNotu: 'Özel görüşme notu',
    hedefKodu,
    hedefAd,
    hedefRol,
    tarih,
    saat,
    baslangicSaat:saat,
    bitisSaat:'16:30',
    tip: hedefRol === 'pdr' ? 'pdr' : 'ogretmen_veli',
    durum:'talep',
    durumGecmisi:[]
  };
}

function doluluk(id, r) {
  return {
    randevuId:id,
    hedefKodu:r.hedefKodu,
    tarih:r.tarih,
    saat:r.saat,
    baslangicSaat:r.baslangicSaat,
    bitisSaat:r.bitisSaat,
    durum:r.durum,
    aktif:true,
    guncellendi:'seed'
  };
}

async function seed() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [email, data] of Object.entries(PERSONELLER)) {
      await setDoc(doc(db, 'personeller', email), data);
    }
    for (const [kod, data] of Object.entries(YETKILER)) {
      await setDoc(doc(db, 'randevuYetkileri', kod), data);
    }
    await setDoc(doc(db, 'ayarlar', 'randevu'), {
      onceden:1, tatiller:[], kategoriler:{}, kisiler:[
        { kod:'rk_teacher1', ad:'Öğretmen Bir', rol:'ogretmen' },
        { kod:'rk_pdr', ad:'PDR Uzmanı', rol:'pdr' }
      ], sure:30, ara:0, gunler:[]
    });

    const a = randevu({ veliEmail:'velia@example.com', hedefKodu:'rk_teacher1', hedefAd:'Öğretmen Bir' });
    const b = randevu({ veliEmail:'velib@example.com', hedefKodu:'rk_teacher2', hedefAd:'Öğretmen İki', saat:'16:30' });
    const p = randevu({ veliEmail:'velib@example.com', hedefKodu:'rk_pdr', hedefAd:'PDR Uzmanı', hedefRol:'pdr', saat:'17:00' });
    for (const [id, item] of [['r-a',a],['r-b',b],['r-pdr',p]]) {
      await setDoc(doc(db, 'randevuSlotlari', id), item);
      await setDoc(doc(db, 'randevuDoluluk', id), doluluk(id, item));
    }
  });
}

before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore:{ rules } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});
after(async () => {
  await env.cleanup();
});

describe('veli veri izolasyonu', () => {
  test('veli yalnız kendi randevusunu okur', async () => {
    const db = env.authenticatedContext('veli-a', { email:'velia@example.com' }).firestore();
    await assertSucceeds(getDoc(doc(db, 'randevuSlotlari', 'r-a')));
    await assertFails(getDoc(doc(db, 'randevuSlotlari', 'r-b')));
    const sonuc = await assertSucceeds(getDocs(query(
      collection(db, 'randevuSlotlari'),
      where('veliEmail', '==', 'velia@example.com')
    )));
    if (sonuc.size !== 1) throw new Error('Veli sorgusu yalnız bir kayıt döndürmeliydi.');
    await assertFails(getDocs(collection(db, 'randevuSlotlari')));
  });

  test('veli personel belgesini ve özel eşlemeyi okuyamaz', async () => {
    const db = env.authenticatedContext('veli-a', { email:'velia@example.com' }).firestore();
    await assertFails(getDoc(doc(db, 'personeller', 'teacher1@example.com')));
    await assertFails(getDoc(doc(db, 'randevuYetkileri', 'rk_teacher1')));
  });

  test('veli yalnız yayımlanmış katalog ve anonim doluluğu okuyabilir', async () => {
    const db = env.authenticatedContext('veli-a', { email:'velia@example.com' }).firestore();
    await assertSucceeds(getDoc(doc(db, 'ayarlar', 'randevu')));
    await assertSucceeds(getDocs(query(
      collection(db, 'randevuDoluluk'),
      where('hedefKodu', '==', 'rk_teacher1')
    )));
  });

  test('veli özel kayıt ve anonim doluluğu aynı işlemde oluşturabilir', async () => {
    const db = env.authenticatedContext('veli-a', { email:'velia@example.com' }).firestore();
    const id = 'r-yeni';
    const item = randevu({
      veliEmail:'velia@example.com',
      hedefKodu:'rk_teacher1',
      hedefAd:'Öğretmen Bir',
      tarih:'2026-09-21',
      saat:'16:30'
    });
    const batch = writeBatch(db);
    batch.set(doc(db, 'randevuSlotlari', id), item);
    batch.set(doc(db, 'randevuDoluluk', id), doluluk(id, item));
    await assertSucceeds(batch.commit());
  });

  test('veli başka veli adına kayıt oluşturamaz', async () => {
    const db = env.authenticatedContext('veli-a', { email:'velia@example.com' }).firestore();
    const item = randevu({ veliEmail:'velib@example.com', hedefKodu:'rk_teacher1', hedefAd:'Öğretmen Bir' });
    await assertFails(setDoc(doc(db, 'randevuSlotlari', 'sahte'), item));
  });
});

describe('personel hedef izolasyonu', () => {
  test('öğretmen yalnız kendi hedef kodundaki talepleri sorgular', async () => {
    const db = env.authenticatedContext('teacher-1', { email:'teacher1@example.com' }).firestore();
    await assertSucceeds(getDoc(doc(db, 'randevuSlotlari', 'r-a')));
    await assertFails(getDoc(doc(db, 'randevuSlotlari', 'r-b')));
    const sonuc = await assertSucceeds(getDocs(query(
      collection(db, 'randevuSlotlari'),
      where('hedefKodu', '==', 'rk_teacher1')
    )));
    if (sonuc.size !== 1) throw new Error('Öğretmen sorgusu yalnız kendi talebini döndürmeliydi.');
  });

  test('öğretmen kendi talebini onaylayıp doluluğu birlikte günceller', async () => {
    const db = env.authenticatedContext('teacher-1', { email:'teacher1@example.com' }).firestore();
    const batch = writeBatch(db);
    batch.update(doc(db, 'randevuSlotlari', 'r-a'), {
      durum:'dolu',
      durumDegistirenKodu:'rk_teacher1',
      durumDegistirenAd:'Öğretmen Bir',
      durumZamani:'2026-09-13T00:00:00Z',
      durumGecmisi:[],
      onayTarihi:'2026-09-13T00:00:00Z',
      guncellendi:serverTimestamp()
    });
    batch.update(doc(db, 'randevuDoluluk', 'r-a'), {
      durum:'dolu',
      aktif:true,
      guncellendi:serverTimestamp()
    });
    await assertSucceeds(batch.commit());
  });

  test('öğretmen başka öğretmenin talebini güncelleyemez', async () => {
    const db = env.authenticatedContext('teacher-1', { email:'teacher1@example.com' }).firestore();
    await assertFails(updateDoc(doc(db, 'randevuSlotlari', 'r-b'), {
      durum:'dolu',
      durumDegistirenKodu:'rk_teacher1',
      durumDegistirenAd:'Öğretmen Bir',
      durumZamani:'2026-09-13T00:00:00Z',
      durumGecmisi:[],
      onayTarihi:'2026-09-13T00:00:00Z',
      guncellendi:serverTimestamp()
    }));
  });

  test('PDR yalnız kendi talebini okuyabilir', async () => {
    const db = env.authenticatedContext('pdr', { email:'pdr@example.com' }).firestore();
    await assertSucceeds(getDoc(doc(db, 'randevuSlotlari', 'r-pdr')));
    await assertFails(getDoc(doc(db, 'randevuSlotlari', 'r-a')));
  });
});

describe('yönetim', () => {
  test('yönetim tüm talepleri ve özel eşlemeyi yönetebilir', async () => {
    const db = env.authenticatedContext('manager', { email:'manager@example.com' }).firestore();
    const sonuc = await assertSucceeds(getDocs(collection(db, 'randevuSlotlari')));
    if (sonuc.size !== 3) throw new Error('Yönetim tüm talepleri görmeliydi.');
    await assertSucceeds(setDoc(doc(db, 'randevuYetkileri', 'rk_yeni'), {
      email:'new@example.com', rol:'ogretmen', aktif:true
    }));
  });
});
