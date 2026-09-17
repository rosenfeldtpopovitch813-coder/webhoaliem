'use strict';
const DAY_MS=86400000,FIVE_HOURS=18000;
const dayKey=now=>new Date(now+7*3600000).toISOString().slice(0,10);
// Session cursor, shared interval cursor and both totals commit atomically.
function applyStudy(current,action,id,now){
 const user=structuredClone(current||{}),sessions=user._studySessions||(user._studySessions={});
 for(const [key,s] of Object.entries(sessions))if(now-s.lastAt>DAY_MS)delete sessions[key];
 if(action==='start'){if(Object.keys(sessions).length>=8)return;sessions[id]={startedAt:now,lastAt:now,confirmAt:now+FIVE_HOURS*1000};return user;}
 const session=sessions[id];if(!session)return;
 if(action==='stop'){delete sessions[id];return user;}
 if(action==='continue'){if(now>session.confirmAt+30000)return;session.confirmAt=now+FIVE_HOURS*1000;session.lastAt=now;return user;}
 if(action!=='heartbeat')return;
 const previous=session.lastAt,end=Math.min(now,session.confirmAt),cursor=Number(user._studyClock)||previous,start=Math.max(previous,cursor,now-30000);
 session.lastAt=now;user._studyClock=Math.max(cursor,end);
 if(now-previous>45000||end<=start)return user;
 const daily=user.dailyStudy||(user.dailyStudy={});let accepted=0;
 for(let at=start;at<end;){const midnight=Math.floor((at+7*3600000)/DAY_MS+1)*DAY_MS-7*3600000,until=Math.min(end,midnight),key=dayKey(at),old=Math.max(0,Number(daily[key])||0),seconds=Math.min(Math.floor((until-at)/1000),Math.max(0,86400-old));daily[key]=old+seconds;accepted+=seconds;at=until;}
 user.totalStudySeconds=Math.max(0,Number(user.totalStudySeconds)||0)+accepted;
 if(accepted>0){const today=dayKey(end-1);if(user.lastStudyDate!==today){user.studyStreak=user.lastStudyDate===dayKey(end-DAY_MS)?(Number(user.studyStreak)||0)+1:1;user.lastStudyDate=today;}if(!session.counted){const counts=user.dailySessions||(user.dailySessions={});counts[today]=(Number(counts[today])||0)+1;session.counted=true;}}
 return user;
}
module.exports={applyStudy,dayKey};
