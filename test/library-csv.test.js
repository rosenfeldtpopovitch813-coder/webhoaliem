import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, normalizeHeader, rowsToLibraryItems } from '../shared/library-csv.js';

test('CSV parser handles BOM, quotes, comma and line breaks inside values', () => {
  const rows = parseCsv('\uFEFFTên tài liệu,Link,Mô tả\r\n"Bài 1, chương 2",https://example.com/a.pdf,"Tài liệu dòng 1\nTài liệu dòng 2"\r\n');
  assert.deepEqual(rows, [['Tên tài liệu','Link','Mô tả'], ['Bài 1, chương 2','https://example.com/a.pdf','Tài liệu dòng 1\nTài liệu dòng 2']]);
  assert.equal(normalizeHeader('Đường dẫn tài liệu'), 'duong dan tai lieu');
});

test('Library detects folders and exposes only folder action kind', () => {
  const items = rowsToLibraryItems([
    ['Tên tài liệu', 'Loại', 'Link'],
    ['Kho đề Hóa', 'Folder', 'https://drive.google.com/drive/folders/abcdefghijk']
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'folder');
  assert.equal(items[0].previewUrl, '');
  assert.equal(items[0].downloadUrl, '');
  assert.equal(items[0].url, 'https://drive.google.com/drive/folders/abcdefghijk');
});

test('Library creates preview and download links for Google Drive files', () => {
  const [file, doc] = rowsToLibraryItems([
    ['Tên tài liệu', 'Link', 'Môn học'],
    ['Đề Hóa', 'https://drive.google.com/file/d/AbCdE_12345/view?usp=sharing', 'Hóa học'],
    ['Phiếu học tập', 'https://docs.google.com/document/d/XyZab_12345/edit', 'Hóa học']
  ]);
  assert.equal(file.previewUrl, 'https://drive.google.com/file/d/AbCdE_12345/preview');
  assert.equal(file.downloadUrl, 'https://drive.google.com/uc?export=download&id=AbCdE_12345');
  assert.equal(doc.previewUrl, 'https://docs.google.com/document/d/XyZab_12345/preview');
  assert.equal(doc.downloadUrl, 'https://docs.google.com/document/d/XyZab_12345/export?format=pdf');
});

test('CSV rows without a link are not displayed as library resources', () => {
  assert.deepEqual(rowsToLibraryItems([['Tên tài liệu','Link'],['Không có link','']]), []);
});
