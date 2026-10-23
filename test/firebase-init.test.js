import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Firebase Admin initializes databaseURL before getDatabase and uses Admin SDK signature', () => {
  const source = fs.readFileSync(new URL('../lib/firebase-admin.js', import.meta.url), 'utf8');
  assert.match(source, /import \{ getDatabase \} from 'firebase-admin\/database'/);
  assert.match(source, /if \(databaseURL\) config\.databaseURL = databaseURL/);
  assert.match(source, /return getDatabase\(app\);/);
  assert.doesNotMatch(source, /getDatabase\(app,\s*databaseURL\)/);
  assert.match(source, /FIREBASE_DATABASE_URL_NOT_ON_ADMIN_APP/);
  assert.doesNotMatch(source, /process\.env\.FIREBASE_DATABASE_URL \|\| process\.env\.VITE_FIREBASE_DATABASE_URL/);
});

test('Exam creation no longer requires teacher/admin custom claims', () => {
  const source = fs.readFileSync(new URL('../api/exam.js', import.meta.url), 'utf8');
  assert.match(source, /action === 'create'/);
  assert.doesNotMatch(source, /assert\(\['teacher','admin'\]\.includes\(user\.role\)/);
});

test('Auth token endpoint no longer exposes a teacher/admin role split', () => {
  const source = fs.readFileSync(new URL('../api/auth-token.js', import.meta.url), 'utf8');
  assert.match(source, /role: 'user'/);
  assert.doesNotMatch(source, /decoded\.admin|decoded\.teacher/);
});
