// Fictional fixtures only. These values never come from a service or real school.
export const BASLIKLAR = [
  'Sıra No', 'Ad Soyad', 'T.C. Kimlik No', 'Doğum Tarihi', 'Yaşı', 'Cinsiyet',
  'Sınıfı', 'Anne Ad Soyad', 'Anne T.C. Kimlik No', 'Baba Ad Soyad', 'Baba T.C. Kimlik No',
];
export function syntheticReport(count = 500) {
  return {
    donem: '2026-2027', tarih: '2026-10-01', basliklar: [...BASLIKLAR],
    kapsam: 'Tüm aktif öğrenciler',
    not: 'Boş hücreler: kayıtlı bilgi yok veya tarih geçersiz. Yaş, çıktı tarihine göre hesaplanır.',
    satirlar: Array.from({ length: count }, (_, index) => [
      index + 1, `Deneme${String(index + 1).padStart(4, '0')} İpek`,
      `000${String(index + 1).padStart(8, '0')}`, '01.10.2020', '6 yaş 0 ay',
      index % 2 ? 'Erkek' : 'Kız', index % 3 ? 'Mavi Sınıf' : 'Yıldızlar',
      index % 7 ? 'Çağla Şahin' : '', index % 7 ? '00000000002' : '',
      index % 11 ? 'Özgür Ünal' : '', index % 11 ? '00000000003' : '',
    ]),
  };
}
export function edgeReport() {
  const report = syntheticReport(5);
  report.satirlar[0][1] = 'Çağrı Işık İpek Şule Ünal Özgür Çınar';
  report.satirlar[1][1] = 'Ayşe Fatma Zeynep Gülşah Çok Uzun Birleşik Öğrenci Soyadı';
  report.satirlar[1][7] = 'Çağla Şule İpek Gülşah Birleşik Anne Soyadı';
  report.satirlar[1][9] = 'Özgür Çağrı Işık Uzun Birleşik Baba Soyadı';
  report.satirlar[2] = [3, 'Eksik Alan Örneği'];
  report.satirlar[3][1] = 'ÖĞÜŞİÇ öğüşıç';
  report.satirlar[4][1] = `Başlangıç${'ÇĞİÖŞÜ'.repeat(30)}Son`;
  return report;
}
export function oversizeReport() {
  const report = syntheticReport(1);
  report.satirlar[0][1] = `Başlangıç ${Array.from({ length: 220 }, (_, index) => `UzunAd${String(index + 1).padStart(4, '0')}`).join(' ')} Sonuç`;
  return report;
}
