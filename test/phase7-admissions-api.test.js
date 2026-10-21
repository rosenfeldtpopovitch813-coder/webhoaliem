import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/admissions.js';
function mockResponse() { return { headers: {}, statusCode: 200, body: null, setHeader(k,v){this.headers[k]=v;}, status(n){this.statusCode=n;return this;}, json(v){this.body=v;return this;} }; }
test('GET admissions endpoint only exposes combination catalog with notice', async () => {
  const req={method:'GET',headers:{'x-forwarded-for':'test-catalog-ip'},socket:{}};const res=mockResponse();await handler(req,res);
  assert.equal(res.statusCode,200);assert.ok(res.body.subjects.length>=10);assert.ok(res.body.combinations.some((c)=>c.code==='A00'));assert.match(res.body.dataNotice,/chưa phải/);assert.equal(res.headers['Cache-Control'],'no-store');
});
test('POST admissions API returns valid score totals and rejects bad values', async () => {
  const res=mockResponse();await handler({method:'POST',headers:{'x-forwarded-for':'test-calc-ip'},body:{scores:{math:9,physics:8,chemistry:8},basePriority:1}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.results[0].code,'A00');assert.equal(res.body.results[0].score,25);assert.equal(res.body.results[0].priority,0.67);
  const bad=mockResponse();await handler({method:'POST',headers:{'x-forwarded-for':'test-bad-ip'},body:{scores:{math:15},basePriority:1}},bad);assert.equal(bad.statusCode,400);
});
