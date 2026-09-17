(function(root){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function safeURL(value){try{const u=new URL(String(value).trim());return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
 const dayKey=(date=new Date())=>new Date(+date+7*3600000).toISOString().slice(0,10);
 const normalize=v=>String(v??'').trim().toLowerCase().replace(/,/g,'.').replace(/\s+/g,' ');
 function validateConfig(c){return !!c&&['abcd','tf','short'].every(k=>Number.isInteger(+c[k])&&+c[k]>=0&&+c[k]<=200)&&(+c.abcd+ +c.tf+ +c.short)>0&&Number.isFinite(+c.timeLimit)&&+c.timeLimit>0&&+c.timeLimit<=600;}
 function grade(c,key,answers){
  if(!validateConfig(c))throw new Error('Cấu hình đề không hợp lệ.');
  const details=[],parts={abcd:0,tf:0,short:0};
  function check(id,type){const actual=normalize(answers[id]),expected=normalize(key[id]),correct=!!actual&&!!expected&&actual===expected;details.push({id,type,answer:answers[id]||'',expected:key[id]||'',correct,blank:!actual});return correct;}
  for(let i=1;i<=c.abcd;i++)if(check('abcd_'+i,'abcd'))parts.abcd+=.25;
  for(let i=1;i<=c.tf;i++){let n=0;for(let j=0;j<4;j++)if(check(`tf_${i}_${j}`,'tf'))n++;parts.tf+=[0,.1,.25,.5,1][n];}
  for(let i=1;i<=c.short;i++)if(check('short_'+i,'short'))parts.short+=.25;
  const max=c.abcd*.25+ +c.tf+c.short*.25,correct=details.filter(d=>d.correct).length,blank=details.filter(d=>d.blank).length;
  return {score:+((parts.abcd+parts.tf+parts.short)/max*10).toFixed(2),parts,details,correct,blank,wrong:details.length-correct-blank,accuracy:details.length?Math.round(correct/details.length*100):0};
 }
 const storage={get(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}};
 const api={esc,safeURL,dayKey,normalize,validateConfig,grade,storage};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HL=api;
})(typeof window!=='undefined'?window:globalThis);
