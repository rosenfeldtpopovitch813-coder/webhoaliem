import test from 'node:test';import assert from 'node:assert/strict';
import { validateQuestions,publicQuestions,gradeExam,normalizeShort,PART2_WEIGHTS,sanitizeDraftAnswers, sanitizeFlaggedQuestions } from '../shared/exam-grading.js';
const input=[{part:'I',prompt:'Chất nào?',options:['A','B','C','D'],answer:'B'},{part:'II',prompt:'Đúng sai?',options:['a','b','c','d'],answer:[true,false,true,false]},{part:'III',prompt:'Kết quả?',answer:'12,5'}];
const questions=validateQuestions(input);
test('accepts comma and decimal notation but rejects malformed numbers',()=>{assert.equal(normalizeShort(' 12,5 '),12.5);assert.equal(normalizeShort('12.5'),12.5);assert.equal(normalizeShort('12abc'),null);assert.equal(normalizeShort('1,2,3'),null);});
test('rejects invalid question schemas',()=>{assert.throws(()=>validateQuestions([{part:'II',prompt:'a',options:['1','2','3','4'],answer:[true,false]}]));assert.throws(()=>validateQuestions([]));});
test('no answer or tolerance leaks in public payload',()=>{const p=publicQuestions(questions);assert.ok(p.every(q=>!Object.hasOwn(q,'answer') && !Object.hasOwn(q,'tolerance')));});
test('correct grades give ten points',()=>{const g=gradeExam(questions,{q1:'B',q2:[true,false,true,false],q3:'12.5000'});assert.equal(g.score,10);assert.equal(g.fullyCorrect,3);});
test('partial credit part II is fixed at integer hundredths',()=>{assert.deepEqual(PART2_WEIGHTS,[0,10,25,50,100]);const g=gradeExam(questions,{q1:'A',q2:[true,true,true,false],q3:'invalid'});assert.equal(g.details[1].earned,50);assert.equal(g.earnedHundredths,50);assert.equal(g.score,3.33);});
test('unanswered questions earn zero',()=>{const g=gradeExam(questions,{});assert.equal(g.score,0);});
test('short answers accept tiny numeric error',()=>{assert.equal(gradeExam(questions,{q3:'12.50009'}).details[2].correct,true);assert.equal(gradeExam(questions,{q3:'12.51'}).details[2].correct,false);});

test('autosave sanitizer keeps only valid answers for public question ids',()=>{
  const safe=sanitizeDraftAnswers(publicQuestions(questions),{q1:'b',q2:[true,false,null,true],q3:' 12,5 ',unknown:'A',q4:'A'});
  assert.deepEqual(safe,{q1:'B',q2:[true,false,null,true],q3:' 12,5 '});
});
test('autosave sanitizer rejects malformed payloads and oversized short answers',()=>{
  assert.throws(()=>sanitizeDraftAnswers(publicQuestions(questions),[]));
  const safe=sanitizeDraftAnswers(publicQuestions(questions),{q1:{unexpected:true},q2:[true,'true',false,null],q3:'x'.repeat(201)});
  assert.deepEqual(safe,{});
});


test('answer-sheet flags only keep valid unique question ids', () => {
  const questions = validateQuestions([
    { part: 'I', prompt: 'Câu một', options: ['A','B','C','D'], answer: 'A' },
    { part: 'III', prompt: 'Câu hai', answer: 2 }
  ]);
  assert.deepEqual(sanitizeFlaggedQuestions(questions, ['q1', 'q1', 'q999', 4, 'q2']), ['q1', 'q2']);
  assert.deepEqual(sanitizeFlaggedQuestions(questions, 'q1'), []);
});

test('LaTeX field survives server question validation and is omitted when empty',()=>{
  const withMath=validateQuestions([{part:'III',prompt:'Tính tích phân',latex:'\\int_0^1 x^2\,dx',answer:1/3}]);
  assert.equal(withMath[0].latex,'\\int_0^1 x^2\,dx');
  assert.equal(Object.hasOwn(validateQuestions([{part:'III',prompt:'Tính',answer:2}])[0],'latex'),false);
  assert.throws(()=>validateQuestions([{part:'III',prompt:'Tính',latex:'x'.repeat(4001),answer:2}]));
});
