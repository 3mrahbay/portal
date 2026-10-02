/**
 * Öğrenci listesi PDF çıktısı. Yalnızca çağıranın verdiği satırları işler.
 * Veritabanı, yerel depolama, analitik, ortak jsPDF nesnesi veya uzak CDN kullanmaz.
 * Bağımlılıklar ve yazı tipleri bu modülün yanındaki sabit yerel dosyalardır.
 */
import { PDFDocument, PageSizes, rgb } from './vendor/ogrenci-liste-pdf/pdf-lib-1.17.1.esm.js';
import fontkit from './vendor/ogrenci-liste-pdf/fontkit-1.1.1.esm.js';

const REQUIRED_HEADERS = Object.freeze([
  'Sıra No', 'Ad Soyad', 'T.C. Kimlik No', 'Doğum Tarihi', 'Yaşı', 'Cinsiyet',
  'Sınıfı', 'Anne Ad Soyad', 'Anne T.C. Kimlik No', 'Baba Ad Soyad', 'Baba T.C. Kimlik No',
]);
const PAGE_WIDTH = PageSizes.A4[1];
const PAGE_HEIGHT = PageSizes.A4[0];
const MARGIN = 24;
const TABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;
const WIDTH_WEIGHTS = [30, 99, 74, 63, 55, 41, 52, 99, 75, 99, 75];
const WIDTH_TOTAL = WIDTH_WEIGHTS.reduce((sum, value) => sum + value, 0);
const WIDTHS = WIDTH_WEIGHTS.map(value => value / WIDTH_TOTAL * TABLE_WIDTH);
const BODY_SIZE = 7.2;
const LINE_HEIGHT = 10;
const PAD_X = 4;
const PAD_Y = 5;
const COLORS = {
  ink: rgb(0.12, 0.18, 0.23), muted: rgb(0.37, 0.42, 0.46),
  accent: rgb(0.11, 0.25, 0.34), line: rgb(0.79, 0.83, 0.86),
  stripe: rgb(0.965, 0.974, 0.98), white: rgb(1, 1, 1),
};
let fontBytesPromise;

async function localFontBytes() {
  if (!fontBytesPromise) {
    fontBytesPromise = Promise.all(['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'].map(async file => {
      const url = new URL(`./vendor/ogrenci-liste-pdf/${file}`, import.meta.url);
      // A fixed relative URL and same-origin mode forbid cross-origin asset redirects.
      const response = await fetch(url, { mode: 'same-origin', credentials: 'same-origin', redirect: 'error' });
      if (!response.ok) throw new Error('PDF yazı tipi yüklenemedi. Lütfen yeniden deneyin.');
      return new Uint8Array(await response.arrayBuffer());
    })).catch(() => {
      fontBytesPromise = undefined;
      throw new Error('PDF yazı tipi yüklenemedi. Lütfen yeniden deneyin.');
    });
  }
  return fontBytesPromise;
}

function textOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('PDF hücreleri metin veya sonlu sayı olmalıdır.');
  }
  // Preserve identifiers as strings (including leading zeroes), and preserve line breaks.
  return String(value).normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
}

function validateReport(report) {
  if (!report || !Array.isArray(report.satirlar) || !Array.isArray(report.basliklar) ||
      report.basliklar.length !== REQUIRED_HEADERS.length ||
      !report.basliklar.every((title, index) => title === REQUIRED_HEADERS[index])) {
    throw new Error('PDF raporunun 11 sütun başlığı beklenen sırada olmalıdır.');
  }
  const date = String(report.tarih || '');
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('PDF rapor tarihi geçersiz.');
  }
  const rows = report.satirlar.map(row => {
    if (!Array.isArray(row) || row.length > REQUIRED_HEADERS.length) {
      throw new Error('PDF raporundaki satır biçimi geçersiz.');
    }
    return Array.from({ length: REQUIRED_HEADERS.length }, (_, index) => textOf(row[index]));
  });
  return { rows, period: textOf(report.donem), scope: textOf(report.kapsam), note: textOf(report.not), date };
}

function ensureGlyphs(font, values) {
  const supported = new Set(font.getCharacterSet());
  for (const value of values) {
    for (const character of value) {
      if (character !== '\n' && !supported.has(character.codePointAt(0))) {
        // Do not silently replace unsupported characters with tofu; do not echo private data.
        throw new Error('PDF yazı tipinin desteklemediği bir karakter var. Lütfen metni kontrol edin.');
      }
    }
  }
}

function wrapText(value, font, size, availableWidth) {
  const lines = [];
  const fits = value => font.widthOfTextAtSize(value, size) <= availableWidth + 0.001;
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('tr', { granularity: 'grapheme' }) : null;
  for (const paragraph of value.split('\n')) {
    let current = '';
    for (const word of paragraph.trim().split(/\s+/u).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (fits(candidate)) { current = candidate; continue; }
      if (current) { lines.push(current); current = ''; }
      if (fits(word)) { current = word; continue; }
      // No ellipsis or slicing off: very long unbroken names wrap by grapheme.
      const characters = segmenter ? Array.from(segmenter.segment(word), item => item.segment) : Array.from(word);
      let offset = 0;
      while (offset < characters.length) {
        let low = 1;
        let high = characters.length - offset;
        let count = 0;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          if (fits(characters.slice(offset, offset + middle).join(''))) { count = middle; low = middle + 1; }
          else high = middle - 1;
        }
        if (!count) throw new Error('PDF hücresine sığmayan bir karakter var. Lütfen metni kontrol edin.');
        const part = characters.slice(offset, offset + count).join('');
        offset += count;
        if (offset < characters.length) lines.push(part);
        else current = part;
      }
    }
    lines.push(current);
  }
  return lines.length ? lines : [''];
}

/**
 * @param {{donem: string, tarih: string, kapsam?: string, not?: string, basliklar: string[], satirlar: (string|number)[][]}} report
 * @returns {Promise<Uint8Array>} Browser-local A4 landscape PDF bytes.
 */
export async function ogrenciListePdfOlustur(report) {
  const { rows, period, scope, note, date } = validateReport(report);
  const [regularBytes, boldBytes] = await localFontBytes();
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const [font, bold] = await Promise.all([
    document.embedFont(regularBytes, { subset: true }),
    document.embedFont(boldBytes, { subset: true }),
  ]);
  ensureGlyphs(font, [period, scope, note, ...rows.flat()]);
  document.setTitle('Öğrenci Listesi');
  document.setCreator('Okul Portalı');
  document.setProducer('pdf-lib 1.17.1');
  const dateLabel = date.split('-').reverse().join('.');
  const metaLines = wrapText(`Dönem: ${period || '-'}   |   Rapor tarihi: ${dateLabel}   |   Öğrenci sayısı: ${rows.length}`, font, 8, TABLE_WIDTH);
  if (scope) metaLines.push(...wrapText(`Kapsam: ${scope}`, font, 8, TABLE_WIDTH));
  const noteLines = wrapText(note || 'Öğrenci Listesi', font, 6.5, TABLE_WIDTH - 90);
  const footerTop = 29 + (noteLines.length - 1) * 9;
  const bottom = footerTop + 10;
  const headerLines = report.basliklar.map((title, index) => wrapText(title, bold, 7, WIDTHS[index] - PAD_X * 2));
  const headerHeight = Math.max(...headerLines.map(lines => lines.length)) * LINE_HEIGHT + PAD_Y * 2;
  const tableTop = PAGE_HEIGHT - 68 - (metaLines.length - 1) * 11;
  const bodyTop = tableTop - headerHeight;
  const pageLineCapacity = Math.floor((bodyTop - bottom - PAD_Y * 2) / LINE_HEIGHT);
  if (pageLineCapacity < 2) throw new Error('PDF açıklaması sayfaya sığmıyor. Lütfen açıklamayı kısaltın.');
  let page;
  let y;

  function drawCell(lines, x, top, width, height, header, fill) {
    page.drawRectangle({ x, y: top - height, width, height, color: fill, borderColor: COLORS.line, borderWidth: 0.4 });
    lines.forEach((line, index) => {
      if (!line) return;
      page.drawText(line, { x: x + PAD_X, y: top - PAD_Y - (header ? 7 : BODY_SIZE) - index * LINE_HEIGHT,
        font: header ? bold : font, size: header ? 7 : BODY_SIZE, color: header ? COLORS.white : COLORS.ink });
    });
  }

  function addPage(continuationRow = null) {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawText('ÖĞRENCİ LİSTESİ', { x: MARGIN, y: PAGE_HEIGHT - 36, font: bold, size: 15, color: COLORS.accent });
    metaLines.forEach((line, index) => page.drawText(line, { x: MARGIN, y: PAGE_HEIGHT - 53 - index * 11, font, size: 8, color: COLORS.muted }));
    if (continuationRow !== null) {
      const label = `${continuationRow + 1}. satırın devamı`;
      page.drawText(label, { x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(label, 8), y: PAGE_HEIGHT - 35, font, size: 8, color: COLORS.muted });
    }
    let x = MARGIN;
    headerLines.forEach((lines, index) => {
      drawCell(lines, x, tableTop, WIDTHS[index], headerHeight, true, COLORS.accent);
      x += WIDTHS[index];
    });
    y = bodyTop;
  }

  addPage();
  if (!rows.length) {
    page.drawText('Bu dönem için listelenecek öğrenci bulunamadı.', { x: MARGIN + 6, y: y - 23, font, size: 9, color: COLORS.muted });
  }
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const wrapped = rows[rowIndex].map((value, index) => wrapText(value, font, BODY_SIZE, WIDTHS[index] - PAD_X * 2));
    const lineCount = Math.max(...wrapped.map(lines => lines.length));
    const fullHeight = lineCount * LINE_HEIGHT + PAD_Y * 2;
    // Keep ordinary rows together. Rows taller than a whole page continue explicitly.
    if (fullHeight <= bodyTop - bottom && y - fullHeight < bottom) addPage();
    let lineOffset = 0;
    while (lineOffset < lineCount) {
      const capacity = Math.floor((y - bottom - PAD_Y * 2) / LINE_HEIGHT);
      if (capacity < 1) { addPage(lineOffset ? rowIndex : null); continue; }
      const segmentLength = Math.min(capacity, lineCount - lineOffset);
      const height = segmentLength * LINE_HEIGHT + PAD_Y * 2;
      let x = MARGIN;
      const fill = rowIndex % 2 ? COLORS.stripe : COLORS.white;
      wrapped.forEach((lines, index) => {
        drawCell(lines.slice(lineOffset, lineOffset + segmentLength), x, y, WIDTHS[index], height, false, fill);
        x += WIDTHS[index];
      });
      y -= height;
      lineOffset += segmentLength;
      if (lineOffset < lineCount) addPage(rowIndex);
    }
    // Let the browser update its busy state during larger exports; no data leaves this task.
    if ((rowIndex + 1) % 50 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  const pages = document.getPages();
  pages.forEach((current, index) => {
    current.drawLine({ start: { x: MARGIN, y: footerTop }, end: { x: PAGE_WIDTH - MARGIN, y: footerTop }, thickness: 0.5, color: COLORS.line });
    noteLines.forEach((line, lineIndex) => current.drawText(line, { x: MARGIN, y: footerTop - 12 - lineIndex * 9, font, size: 6.5, color: COLORS.muted }));
    const label = `Sayfa ${index + 1} / ${pages.length}`;
    current.drawText(label, { x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(label, 7), y: 17, font, size: 7, color: COLORS.muted });
  });
  return document.save({ objectsPerTick: 40 });
}
