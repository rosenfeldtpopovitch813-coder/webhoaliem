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

test('Vercel SPA rewrite excludes API, PWA files, and the visual-only 3D scene', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const source = config.rewrites.at(-1).source;
  assert.match(source, /api\//);
  assert.match(source, /icons\//);
  assert.ok(source.includes('manifest\\.webmanifest'));
  assert.ok(source.includes('sw\\.js'));
  assert.match(source, /exam-visual\//);
  assert.match(source, /focus-notes\//, 'Trang con Lớp học Mực phải được phục vụ trực tiếp');
  const matcher = new RegExp(`^${source}$`);
  assert.equal(matcher.test('/exam-visual/scene.html'), false, 'Cảnh 3D trang trí phải được phục vụ trực tiếp');
  assert.equal(matcher.test('/focus-notes/index.html'), false, 'Ứng dụng ghi chú phải được phục vụ tĩnh riêng, không trả HTML HTVVM');
  assert.equal(matcher.test('/exam3d'), true, 'Đường dẫn cũ đi qua SPA để hiện trang không tìm thấy, không mở app riêng');
  assert.equal(config.rewrites.some((rule) => rule.source === rule.destination), false, 'Không được rewrite một đường dẫn vào chính nó');
  assert.equal(matcher.test('/api/ai-tutor'), false, 'API không được SPA fallback bắt mất');
  assert.equal(matcher.test('/handbook'), true, 'Đường dẫn SPA cần trả về index.html');
});

test('service worker bypasses API routes and the decorative 3D scene', () => {
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw, /url\.pathname\.startsWith\('\/exam-visual\/'\)/, 'Service worker không được chặn cảnh 3D trang trí');
  assert.match(sw, /url\.pathname\.startsWith\('\/focus-notes\/'\)/, 'Service worker không được ghi đè cache index của ứng dụng ghi chú');
  assert.match(sw, /caches\.match\('\/index\.html'\)/);
  assert.match(sw, /self\.addEventListener\('activate'/);
});

test('the donated 3D scene is visual-only inside the single official exam route', () => {
  const html = fs.readFileSync(path.join(root, 'public/exam-visual/scene.html'), 'utf8');
  const examModule = fs.readFileSync(path.join(root, 'src/modules/exam-room/index.js'), 'utf8');
  const router = fs.readFileSync(path.join(root, 'src/core/router.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  assert.match(html, /htvvm-exam-scene-overrides/);
  assert.match(html, /inner-green-assets\/three\.min\.js/);
  assert.ok(fs.existsSync(path.join(root, 'public/exam-visual/inner-green-assets/three.min.js')));
  assert.match(examModule, /\/exam-visual\/scene\.html/);
  assert.match(examModule, /api\('submit'/, 'Nộp bài phải dùng API chấm điểm chính thức');
  assert.match(examModule, /api\('history'/, 'Lịch sử phải dùng API tập trung');
  assert.doesNotMatch(router, /exam3d|immersive-exam/);
  assert.doesNotMatch(main, /\/exam3d/);
  assert.equal(fs.existsSync(path.join(root, 'public/thi-thu/index.html')), false, 'Không còn ứng dụng thi thử độc lập trong public');
});
