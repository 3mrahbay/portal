"""Validate synthetic PDF output and render selected pages with Poppler.

Usage: python tests/ogrenci-liste-pdf-verify.py /tmp/ogrenci-liste-pdf-qa
Dependencies: pypdf, pdfplumber, pdftoppm. Never use real student PDFs as fixtures.
"""
from pathlib import Path
import json
import re
import subprocess
import sys

import pdfplumber
from pypdf import PdfReader

root = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/ogrenci-liste-pdf-qa')
summaries = []
for stem in ['edges', '500-rows', 'oversized-row', 'empty']:
    path = root / f'{stem}.pdf'
    reader = PdfReader(path)
    count = len(reader.pages)
    texts = [page.extract_text() or '' for page in reader.pages]
    all_text = '\n'.join(texts)
    for index, page in enumerate(reader.pages):
        assert abs(float(page.mediabox.width) - 841.89) < 0.1
        assert abs(float(page.mediabox.height) - 595.28) < 0.1
        assert 'ÖĞRENCİ LİSTESİ' in texts[index]
        assert f'Sayfa {index + 1} / {count}' in texts[index]
        assert 'Anne Ad Soyad' in texts[index]
        assert 'Baba Ad Soyad' in texts[index]
    assert '\ufffd' not in all_text
    if stem == '500-rows':
        for index in range(1, 501):
            assert all_text.count(f'Deneme{index:04d}') == 1
            assert f'000{index:08d}' in all_text
    if stem == 'edges':
        for token in ['Çağrı', 'Işık', 'İpek', 'Şule', 'Ünal', 'Özgür', 'Çınar', 'ÖĞÜŞİÇ', 'öğüşıç', '00000000001', 'Eksik Alan Örneği']:
            assert token in all_text
        assert 'null' not in all_text and 'undefined' not in all_text
        assert re.sub(r'\s+', '', all_text).count('ÇĞİÖŞÜ') == 30
    if stem == 'oversized-row':
        for index in range(1, 221):
            assert all_text.count(f'UzunAd{index:04d}') == 1
        assert 'Başlangıç' in all_text and 'Sonuç' in all_text
        assert '1. satırın devamı' in all_text
    # Extract every glyph bounding box independently; reject page-edge clipping.
    with pdfplumber.open(path) as document:
        for page in document.pages:
            for character in page.chars:
                assert 23 <= character['x0'] <= character['x1'] <= page.width - 23
                assert 14 <= character['top'] <= character['bottom'] <= page.height - 12
    for number in sorted({1, (count + 1) // 2, count}):
        subprocess.run(['pdftoppm', '-f', str(number), '-l', str(number), '-r', '120', '-png', '-singlefile', str(path), str(root / f'{stem}-page-{number}')], check=True, stdout=subprocess.DEVNULL)
    summaries.append({'file': path.name, 'pages': count, 'glyph_bounds': 'pass', 'text_completeness': 'pass'})
(root / 'parser-qa.json').write_text(json.dumps(summaries, indent=2))
print(json.dumps(summaries, indent=2))
