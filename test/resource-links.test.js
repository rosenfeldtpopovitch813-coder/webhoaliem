import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveResourceLink } from '../shared/resource-links.js';

test('YouTube watch and short links resolve to safe embed URLs', () => {
  assert.equal(resolveResourceLink('https://www.youtube.com/watch?v=abcdefghijk').embedUrl, 'https://www.youtube-nocookie.com/embed/abcdefghijk');
  assert.equal(resolveResourceLink('https://youtu.be/abcdefghijk').type, 'youtube');
  assert.equal(resolveResourceLink('https://www.youtube.com/playlist?list=PL123456789012345').embedUrl, 'https://www.youtube-nocookie.com/embed/videoseries?list=PL123456789012345');
});

test('Google Drive file and Docs URLs resolve to preview links', () => {
  assert.equal(resolveResourceLink('https://drive.google.com/file/d/AbCdE_12345/view?usp=sharing').embedUrl, 'https://drive.google.com/file/d/AbCdE_12345/preview');
  assert.equal(resolveResourceLink('https://docs.google.com/document/d/AbCdE_12345/edit').embedUrl, 'https://docs.google.com/document/d/AbCdE_12345/preview');
});

test('resource links reject unsupported and insecure URLs', () => {
  assert.throws(() => resolveResourceLink('http://youtu.be/abcdefghijk'), /HTTPS/);
  assert.throws(() => resolveResourceLink('https://example.com/file'), /chưa được hỗ trợ/);
  assert.throws(() => resolveResourceLink('https://youtube.com/watch?v=bad'), /mã video/);
});
