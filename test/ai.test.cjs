const test=require('node:test'),assert=require('node:assert/strict'),{extractText}=require('../lib/ai-response');
test('AI reads raw Responses API text blocks',()=>{assert.equal(extractText({output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:'Explanation'}]}]}),'Explanation');});
test('AI handles empty response without pretending to generate an answer',()=>{assert.equal(extractText({output:[]}), '');assert.equal(extractText(null),'');});
