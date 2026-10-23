import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_LIMITS, validateTutorInput, consumeAiRateLimit } from '../shared/ai-safety.js';

test('AI tutor requires question or image and trims text', () => {
  assert.throws(() => validateTutorInput({}), /câu hỏi hoặc/);
  assert.deepEqual(validateTutorInput({ question: '  Giải thích  ' }), { question: 'Giải thích', image: null });
});
test('AI question has a strict length cap and image type allowlist', () => {
  assert.throws(() => validateTutorInput({ question: 'x'.repeat(AI_LIMITS.questionChars + 1) }), /tối đa/);
  assert.throws(() => validateTutorInput({ question: 'x', image: { mimeType: 'image/svg+xml', data: 'PHN2Zz4=' } }), /JPG, PNG hoặc WebP/);
});
test('AI image payload must be valid base64 and under 2 MB', () => {
  assert.throws(() => validateTutorInput({ question: 'x', image: { mimeType: 'image/png', data: 'not base64??' } }), /không hợp lệ/);
  assert.throws(() => validateTutorInput({ question: 'x', image: { mimeType: 'image/png', data: 'A'.repeat(3_000_000) } }), /2 MB/);
  assert.deepEqual(validateTutorInput({ image: { mimeType: 'image/jpeg', data: 'AQID' } }).image.mimeType, 'image/jpeg');
});
test('AI quota allows within limit then blocks and resets on new window/day', () => {
  let state;
  for (let i = 0; i < AI_LIMITS.windowCount; i++) {
    const attempt = consumeAiRateLimit(state, 1_000_000, 100);
    assert.equal(attempt.allowed, true); state = attempt.state;
  }
  assert.equal(consumeAiRateLimit(state, 1_000_001, 100).allowed, false);
  assert.equal(consumeAiRateLimit(state, 1_000_000 + AI_LIMITS.windowMs + 1, 100).allowed, true);
  assert.equal(consumeAiRateLimit(state, 1_000_000 + AI_LIMITS.windowMs + 1, 101).allowed, true);
});
