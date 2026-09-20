/* Server-aligned 2026 admissions calculation helpers. No school-specific data is embedded here. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HLAdmissionsCore=factory();})(this,function(){
  const SUBJECTS={
    toan:'Toán', van:'Ngữ văn', anh:'Tiếng Anh', ly:'Vật lý', hoa:'Hóa học', sinh:'Sinh học', su:'Lịch sử', dia:'Địa lý', tin:'Tin học'
  };
  const COMMON_COMBINATIONS={
    A00:['toan','ly','hoa'],A01:['toan','ly','anh'],B00:['toan','hoa','sinh'],C00:['van','su','dia'],
    D01:['toan','van','anh'],D07:['toan','hoa','anh'],D14:['van','su','anh'],D15:['van','dia','anh'],
    D96:['toan','anh','gdcd'],X26:['toan','ly','tin']
  };
  function n(v){return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function numeric(value){return typeof value==='number'&&Number.isFinite(value)?value:null;}
  function validateSubjectScores(subjectScores,scale=10){
    const src=subjectScores&&typeof subjectScores==='object'?subjectScores:{};const clean={};
    for(const [subject,value] of Object.entries(src)){
      if(value===undefined||value===null||value==='')continue;
      if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>scale)throw Object.assign(new Error(`Điểm ${subject} không hợp lệ`),{code:'INVALID_SCORE',subject});
      clean[subject]=value;
    }
    return clean;
  }
  function combinationSubjects(combination){
    if(Array.isArray(combination))return combination;
    const key=String(combination||'').toUpperCase();
    return COMMON_COMBINATIONS[key]||[];
  }
  function priorityApplied(base,priority){
    const p=numeric(priority)||0;if(p<=0)return 0;
    return base<22.5?p:((30-base)/7.5)*p;
  }
  function calculateAdmissionScore({method='thpt',subjectScores={},combination=[],priorityScore=0,bonusScore=0,scale=30}={}){
    if(!['thpt','school_record','other'].includes(method))throw Object.assign(new Error('Phương thức không hợp lệ'),{code:'INVALID_METHOD'});
    const scores=validateSubjectScores(subjectScores,10);const combo=combinationSubjects(combination);
    if(!combo.length)throw Object.assign(new Error('Thiếu tổ hợp xét tuyển'),{code:'MISSING_COMBINATION'});
    const missing=combo.filter(key=>typeof scores[key]!=='number');
    if(missing.length)throw Object.assign(new Error('Thiếu điểm môn trong tổ hợp'),{code:'MISSING_SUBJECT',missing});
    let base=combo.reduce((sum,key)=>sum+scores[key],0);
    if(scale!==30){base=(base/(combo.length*10))*scale;}
    const rawPriority=numeric(priorityScore)||0,rawBonus=numeric(bonusScore)||0;
    if(rawPriority<0||rawBonus<0||rawBonus>3)throw Object.assign(new Error('Điểm cộng/ưu tiên không hợp lệ'),{code:'INVALID_BONUS'});
    const priority=priorityApplied(base,rawPriority);const final=Math.min(30,Math.max(0,base+priority+rawBonus));
    return {method,combination:Array.isArray(combination)?combination:String(combination||''),subjectKeys:combo,baseScore:+base.toFixed(2),priorityScore:+priority.toFixed(2),bonusScore:+rawBonus.toFixed(2),finalScore:+final.toFixed(2),scale:30,capped:base+priority+rawBonus>30};
  }
  function evaluateCombinations(subjectScores,combinations){
    const rows=[];for(const combo of combinations||[]){try{rows.push(calculateAdmissionScore({subjectScores,combination:combo}));}catch(e){if(e.code!=='MISSING_SUBJECT')throw e;}}
    return rows.sort((a,b)=>b.finalScore-a.finalScore);
  }
  function findValidCombinations(subjectScores,combinations=Object.keys(COMMON_COMBINATIONS)){
    const clean=validateSubjectScores(subjectScores,10);const chosen=new Set(Object.keys(clean));return combinations.filter(id=>combinationSubjects(id).every(s=>chosen.has(s)));
  }
  function validateAspirationCount(count,{isTeacherProgram=false,rules={}}={}){const n=Number(count);const limit=isTeacherProgram?Number(rules.teacherProgramMaxAspirations||5):Number(rules.maxAspirations||15);return {valid:Number.isInteger(n)&&n>=0&&n<=limit,limit};}
  return {SUBJECTS,COMMON_COMBINATIONS,validateSubjectScores,calculateAdmissionScore,evaluateCombinations,findValidCombinations,validateAspirationCount,normalize:n};
});
