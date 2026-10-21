import test from 'node:test';
import assert from 'node:assert/strict';
import { SUBJECTS, COMBINATIONS, normalizeScore, normalizeScores, combinationMask, createSubjectBitmask, calculatePriority, calculateCombinations } from '../shared/admissions-math.js';

test('score parsing accepts comma decimal and rejects malformed / out of range', () => {
  assert.equal(normalizeScore('8,25'), 8.25);
  assert.equal(normalizeScore(' '), null);
  assert.equal(normalizeScore('10.5'), null);
  assert.equal(normalizeScore(true), null);
});
test('subject bitmask contains valid subjects only and combo is a subset', () => {
  const scores = { math: 8, physics: 7, chemistry: 9 };
  const userMask = createSubjectBitmask(scores);
  const a00 = COMBINATIONS.find((c) => c.code === 'A00');
  assert.equal((userMask & combinationMask(a00)) === combinationMask(a00), true);
  const b00 = COMBINATIONS.find((c) => c.code === 'B00');
  assert.equal((userMask & combinationMask(b00)) === combinationMask(b00), false);
});
test('priority adjustment follows the 22.5 threshold formula', () => {
  assert.equal(calculatePriority(2, 22), 2);
  assert.equal(calculatePriority(2, 22.5), 2);
  assert.equal(calculatePriority(2, 26.25), 1);
  assert.equal(calculatePriority(2, 30), 0);
});
test('valid combinations require all 3 scores and sorted by adjusted total', () => {
  const results = calculateCombinations({ math: 9, physics: 8, chemistry: 8, english: 9 }, 1.5);
  assert.deepEqual(results.map((r) => r.code), ['A01', 'D07', 'A00']);
  assert.equal(results[0].score, 26);
  assert.equal(results[0].priority, 0.8);
  assert.equal(results[0].total, 26.8);
});
test('invalid score keys and priority are rejected', () => {
  assert.throws(() => normalizeScores({ math: 11 }), /0–10/);
  assert.throws(() => normalizeScores({ madeUp: 10 }), /không hợp lệ/);
  assert.throws(() => calculatePriority(4, 25), /0 đến 3/);
});
test('catalog has known subjects and combinations have three unique subjects', () => {
  assert.ok(SUBJECTS.some((s) => s.key === 'chemistry'));
  for (const combo of COMBINATIONS) {
    assert.equal(combo.subjects.length, 3);
    assert.equal(new Set(combo.subjects).size, 3);
  }
});
