(function(root){
 function resolveArena(current,uid,now,index){
  if(!current||current.hostUid!==uid||current.phase!=='playing'||current.currentIndex!==index)return;
  const r=structuredClone(current),players=r.players||{},alive=Object.values(players).filter(p=>Number(p.hp)>0),responses=r.responses?.[index]||{},q=r.questions?.[r.questionIds?.[index]];
  if(!q||!alive.length)return;if(now<r.deadline&&!alive.every(p=>responses[p.uid]))return;
  const logs=r.logs||(r.logs={});let n=0;
  function targetFor(id){const list=Object.values(players).filter(p=>p.hp>0).sort((a,b)=>String(a.joinedAt||a.uid).localeCompare(String(b.joinedAt||b.uid)));if(list.length<2)return null;const at=list.findIndex(p=>p.uid===id);return list[(at+1+list.length)%list.length];}
  for(const player of alive){const response=responses[player.uid];if(!response)continue;const correct=response.option===q.c&&response.answeredAt<=r.deadline;player.answers=(Number(player.answers)||0)+1;if(correct){player.correct=(Number(player.correct)||0)+1;player.score=(Number(player.score)||0)+100;const target=targetFor(player.uid);if(target&&target.uid!==player.uid){target.hp=Math.max(0,(Number(target.hp)||0)-25);logs[now+n++]=`${player.name} trả lời đúng → -25 HP ${target.name}.`;}}}
  const remain=Object.values(players).filter(p=>p.hp>0),next=index+1;
  if(remain.length<=1||next>=r.questionIds.length){r.phase='ended';r.status='ended';r.deadline=0;logs[now+n]='Kết thúc trận đấu.';}else{r.currentIndex=next;r.deadline=now+(Number(r.turnSeconds)||15)*1000;}
  return r;
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={resolveArena};else root.HL.resolveArena=resolveArena;
})(typeof window!=='undefined'?window:globalThis);
