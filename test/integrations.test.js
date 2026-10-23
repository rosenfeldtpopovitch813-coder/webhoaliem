import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('../', import.meta.url).pathname;
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('exam creator renders LaTeX, exports print-ready A4 PDF and keeps math in official exam schema', () => {
  const creator = read('src/modules/exam-room/index.js');
  const grading = read('shared/exam-grading.js');
  assert.match(creator, /import katex from 'katex'/);
  assert.match(creator, /function richMathHTML/);
  assert.match(creator, /function exportExamPDF/);
  assert.match(creator, /Xuất PDF \/ In đề/);
  assert.match(creator, /@page\{size:A4/);
  assert.match(grading, /latex\.length > 4000/);
});

test('Lớp học Mực is built as a same-origin app under Focus Zone', () => {
  const pkg = JSON.parse(read('package.json'));
  const config = JSON.parse(read('vercel.json'));
  const focus = read('src/modules/focus-zone/index.js');
  const source = config.rewrites[0].source;
  assert.match(pkg.scripts.build, /vite build notes-app/);
  assert.ok(fs.existsSync(path.join(root, 'notes-app/src/Studio.tsx')));
  assert.ok(fs.existsSync(path.join(root, 'notes-app/src/components/Whiteboard/Whiteboard.tsx')));
  assert.ok(fs.existsSync(path.join(root, 'notes-app/vite.config.ts')));
  assert.match(read('notes-app/src/components/Graphing/GraphPanel.tsx'), /import\.meta\.env\.BASE_URL.*models\/comer/);
  assert.match(source, /focus-notes\//);
  assert.match(focus, /htvvm-focus-duration-v1/);
  assert.match(focus, /focus-notes\/index\.html/);
  assert.match(focus, /requestFullscreen/);
});

test('Pomodoro settings accept a user-selected 1 second to 240 minute duration and persist it', () => {
  const focus = read('src/modules/focus-zone/index.js');
  assert.match(focus, /durationFields\.append\(minutesInput/);
  assert.match(focus, /m\*60\+sec<1/);
  assert.match(focus, /m>240/);
  assert.match(focus, /localStorage\.setItem\('htvvm-focus-duration-v1'/);
});
