// Minimal, dependency-free OOXML workbook for a text-only identity report.
// Stored ZIP entries are intentional: everything stays in this browser and
// there is no script/CDN dependency, formula interpretation or CSV masquerade.
const encoder = new TextEncoder();
const widths = [9, 30, 18, 17, 18, 13, 28, 30, 18, 30, 18];
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function cell(value, column, row, style = 0) {
  const ref = `${String.fromCharCode(65 + column)}${row}`;
  if (String(value ?? '').length > 32767) throw new Error('Bir hücre Excel metin sınırını aşıyor. Kayıt bilgisini kısaltıp tekrar deneyin.');
  if (column === 0 && row >= 5) return `<c r="${ref}" s="${style}" t="n"><v>${Number(value)}</v></c>`;
  // Explicit inlineStr: =, +, -, @ and leading zeroes are literal text.
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let n = i;
  for (let bit = 0; bit < 8; bit++) n = (n & 1) ? (0xedb88320 ^ (n >>> 1)) : n >>> 1;
  crcTable[i] = n >>> 0;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function header(length) {
  const bytes = new Uint8Array(length), view = new DataView(bytes.buffer);
  return { bytes, u16: (p, n) => view.setUint16(p, n, true), u32: (p, n) => view.setUint32(p, n, true) };
}
function zip(files) {
  const entries = files.map(([name, source]) => ({ name: encoder.encode(name), data: encoder.encode(declaration + source) }));
  const localSize = entries.reduce((sum, e) => sum + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((sum, e) => sum + 46 + e.name.length, 0);
  if (localSize + centralSize + 22 > 0xffffffff) throw new Error('Liste tek Excel dosyası için fazla büyük.');
  const output = new Uint8Array(localSize + centralSize + 22);
  let offset = 0, centralOffset = localSize;
  for (const entry of entries) {
    const { name, data } = entry, crc = crc32(data), local = header(30), central = header(46);
    local.u32(0, 0x04034b50); local.u16(4, 20); local.u16(6, 0x800); local.u16(12, 33);
    local.u32(14, crc); local.u32(18, data.length); local.u32(22, data.length); local.u16(26, name.length);
    central.u32(0, 0x02014b50); central.u16(4, 20); central.u16(6, 20); central.u16(8, 0x800); central.u16(14, 33);
    central.u32(16, crc); central.u32(20, data.length); central.u32(24, data.length); central.u16(28, name.length); central.u32(42, offset);
    output.set(local.bytes, offset); output.set(name, offset + 30); output.set(data, offset + 30 + name.length);
    output.set(central.bytes, centralOffset); output.set(name, centralOffset + 46);
    offset += 30 + name.length + data.length; centralOffset += 46 + name.length;
  }
  const end = header(22); end.u32(0, 0x06054b50); end.u16(8, entries.length); end.u16(10, entries.length);
  end.u32(12, centralSize); end.u32(16, localSize); output.set(end.bytes, centralOffset);
  return output;
}

export function ogrenciListeXlsxOlustur(report) {
  if (report.satirlar.length > 1048572) throw new Error('Liste Excel satır sınırını aşıyor.');
  const last = Math.max(4, report.satirlar.length + 4);
  const summary = `${report.donem} eğitim yılı · ${report.satirlar.length} öğrenci · ${report.kapsam || ''} · Çıktı: ${report.tarih}`;
  const rows = [
    `<row r="1" ht="30" customHeight="1">${cell('Öğrenci Listesi', 0, 1, 1)}</row>`,
    `<row r="2" ht="25" customHeight="1">${cell(summary, 0, 2, 2)}</row>`,
    `<row r="3" ht="24" customHeight="1">${cell(report.not || '', 0, 3, 2)}</row>`,
    `<row r="4" ht="32" customHeight="1">${report.basliklar.map((v, c) => cell(v, c, 4, 3)).join('')}</row>`,
    ...report.satirlar.map((row, index) => {
      const height = Math.min(409, Math.max(28, 15 * Math.max(...row.map((v, c) => Math.ceil([...String(v)].length / Math.max(5, widths[c] - 3)))) + 12));
      return `<row r="${index + 5}" ht="${height}" customHeight="1">${row.map((v, c) => cell(v, c, index + 5, index % 2 ? 5 : 4)).join('')}</row>`;
    })
  ].join('');
  const sheet = `<worksheet xmlns="${ns}" xmlns:r="${relns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:K${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="28"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A4:K${last}"/><mergeCells count="3"><mergeCell ref="A1:K1"/><mergeCell ref="A2:K2"/><mergeCell ref="A3:K3"/></mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;L${xml(report.donem)} · ${report.satirlar.length} öğrenci&amp;RSayfa &amp;P / &amp;N</oddFooter></headerFooter></worksheet>`;
  const styles = `<styleSheet xmlns="${ns}"><fonts count="4"><font><sz val="11"/><color rgb="FF20362A"/><name val="Calibri"/></font><font><b/><sz val="19"/><color rgb="FF285640"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF53665A"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF285640"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F6F2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="49" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="3" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zip([
    ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<workbook xmlns="${ns}" xmlns:r="${relns}"><bookViews><workbookView/></bookViews><sheets><sheet name="Öğrenci Listesi" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'Öğrenci Listesi'!$1:$4</definedName><definedName name="_xlnm.Print_Area" localSheetId="0">'Öğrenci Listesi'!$A$1:$K$${last}</definedName></definedNames><calcPr calcId="191029"/></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', sheet], ['xl/styles.xml', styles]
  ]);
}
