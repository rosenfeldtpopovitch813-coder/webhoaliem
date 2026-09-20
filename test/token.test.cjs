const test=require('node:test');const assert=require('node:assert/strict');const core=require('../lib/token-core');
const {rewardFromTotal}=core;
test('study reward boundaries',()=>{assert.equal(rewardFromTotal(3599),0);assert.equal(rewardFromTotal(3600),50);assert.equal(rewardFromTotal(7200),100);assert.equal(rewardFromTotal(10800),150);});
test('token amount validation rejects numeric strings, NaN, negative and overflow',()=>{for(const v of ['2500',NaN,-1,0,Infinity])assert.throws(()=>core.validateAmount(v));assert.equal(core.validateAmount(2500),2500);});
test('wallet cannot become negative and ledger-facing counters are monotonic',()=>{assert.throws(()=>core.applyWallet({balance:100,lifetimeEarned:100,lifetimeSpent:0},-101,Date.now()),/Insufficient/);const w=core.applyWallet({balance:2500,lifetimeEarned:2500,lifetimeSpent:0},-2500,Date.now());assert.equal(w.balance,0);assert.equal(w.lifetimeSpent,2500);});
