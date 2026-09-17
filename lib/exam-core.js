const {grade,validateConfig}=require('../js/core');
function cleanAnswers(config,input){
 const output={};if(!input||typeof input!=='object'||Array.isArray(input))return output;
 for(const [key,value]of Object.entries(input)){
  if(typeof value!=='string'||value.length>500)continue;
  const m=key.match(/^(abcd|short)_(\d+)$/),tf=key.match(/^tf_(\d+)_([0-3])$/);
  if(m&&+m[2]>=1&&+m[2]<=config[m[1]]){if(m[1]==='short'||/^[ABCD]$/.test(value))output[key]=value;}
  if(tf&&+tf[1]>=1&&+tf[1]<=config.tf&&/^[DS]$/.test(value))output[key]=value;
 }return output;
}
function beginAttempt(room,user,id,now){
 if(!room||!validateConfig(room.config)||room.status==='closed'||room.status==='draft')throw Error('EXAM_CLOSED');
 return {id,uid:user.uid,name:String(user.name||'Học viên').slice(0,120),title:String(room.title||'Đề thi'),config:room.config,key:room.answers||{},startAt:now,duration:+room.config.timeLimit*60,status:'active',answers:{},revision:0};
}
function advanceAttempt(current,action,body,now){
 if(!current)return;const a=structuredClone(current);if(a.status==='submitted')return a;
 const deadline=a.startAt+a.duration*1000;
 if(now<=deadline&&Number.isInteger(body.revision)&&body.revision>a.revision){a.answers=cleanAnswers(a.config,body.answers);a.revision=body.revision;}
 if(action==='save'&&now<deadline)return a;
 if(action!=='submit'&&now<deadline)return;
 a.status='submitted';a.submittedAt=Math.min(now,deadline);a.timeSpent=Math.max(0,Math.floor((a.submittedAt-a.startAt)/1000));a.result=grade(a.config,a.key,a.answers);a.usedCheckpoint=now>deadline;return a;
}
module.exports={cleanAnswers,beginAttempt,advanceAttempt};
