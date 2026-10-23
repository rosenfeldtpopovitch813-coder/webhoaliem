import test from 'node:test';import assert from 'node:assert/strict';
import {damageFor,publicRoom,isValidQuestion,winner,safeCode,MAX_PLAYERS} from '../shared/arena-core.js';
test('giới hạn phòng 8 người',()=>assert.equal(MAX_PLAYERS,8));
test('sát thương trong khoảng 30-45',()=>{assert.equal(damageFor(0),45);assert.equal(damageFor(20000),30);assert.equal(damageFor(10000),38);assert.equal(damageFor(50000),30);});
test('kiểm tra phòng an toàn',()=>{assert.equal(safeCode('ABCDEF12'),true);assert.equal(safeCode('ABC'),false);assert.equal(safeCode('../ADMIN'),false);});
test('định dạng câu hỏi',()=>{assert.equal(isValidQuestion({prompt:'Câu hỏi dài hơn 8 ký tự?',options:['1','2','3','4'],answer:'A',topic:'Điện hóa',level:'Nhận biết'}),true);assert.equal(isValidQuestion({prompt:'Sai',options:['1'],answer:'A',topic:'Hóa',level:'Nhận biết'}),false);});
test('không rò đáp án khi lấy state',()=>{const room={id:'ABCDEF12',status:'PLAYING',round:1,roundEndsAt:Date.now()+10000,questions:[{prompt:'Câu hỏi bí mật',options:['a','b','c','d'],answer:'C',topic:'Hóa',level:'Nhận biết'}],players:{a:{hp:200,score:0,joinedAt:1}},answers:{1:{a:{chosen:'C'}}}};const result=publicRoom(room);assert.equal(result.question.answer,undefined);assert.equal(JSON.stringify(result).includes('chosen'),false);assert.equal(JSON.stringify(result).includes('"answer"'),false);});
test('xếp hạng HP rồi điểm',()=>{assert.equal(winner({a:{hp:100,score:5,joinedAt:1},b:{hp:100,score:9,joinedAt:2}}),'b');});
