import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('../', import.meta.url).pathname;
test('PWA manifest declares valid application scope and install icons', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'HTVVM Studio');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
  assert.ok(fs.existsSync(path.join(root, 'public/icons/icon-192.png')));
  assert.ok(fs.existsSync(path.join(root, 'public/icons/icon-512.png')));
});
test('Vercel SPA rewrite excludes PWA assets from index.html fallback', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const source = config.rewrites.at(-1).source;
  assert.match(source, /icons\//);
  assert.match(source, /manifest\\\.webmanifest/);
  assert.match(source, /sw\\\.js/);
});
test('service worker never caches API routes and defines offline navigation fallback', () => {
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw, /caches\.match\('\/index\.html'\)/);
  assert.match(sw, /self\.addEventListener\('activate'/);
});
