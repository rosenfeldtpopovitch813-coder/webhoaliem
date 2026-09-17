(function(){
 let boardRef=null,cache=null,cacheAt=0,boardBusy=false;
 async function get(url){const user=window.auth?.currentUser;if(!user)throw Error('Cần đăng nhập.');const response=await fetch(url,{headers:{Authorization:'Bearer '+await user.getIdToken()},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Không thể tải dữ liệu.');return response.json();}
 function snapshot(data,key){return {val:()=>data,exists:()=>data!=null,key,forEach(fn){Object.entries(data||{}).forEach(([k,v])=>fn(snapshot(v,k)));}};}
 HL.roomSnapshot=async(id='')=>snapshot((await get('/api/rooms'+(id?'?id='+encodeURIComponent(id):''))).data,id);
 window.viewLeaderboard=async function(id){
  switchSection('sec-leaderboard');if(boardRef)boardRef.off();const box=document.getElementById('lb-container');box.textContent='Đang tải bảng điểm…';
  try{const room=(await HL.roomSnapshot(id)).val();boardRef=db.ref(`rooms/${id}/results`);boardRef.on('value',snap=>{const rows=Object.values(snap.val()||{}).sort((a,b)=>(+b.score||0)-(+a.score||0)||(+a.timeSpent||0)-(+b.timeSpent||0));box.replaceChildren();const title=document.createElement('h2');title.textContent=room?.title||'Bảng điểm';box.append(title);if(!rows.length){box.append(document.createTextNode('Chưa có kết quả.'));return;}const table=document.createElement('table');table.className='lb-table w-full';table.innerHTML='<thead><tr><th>Hạng</th><th>Học sinh</th><th>Điểm</th><th>Thời gian</th></tr></thead>';const body=document.createElement('tbody');for(const [i,r]of rows.slice(0,100).entries()){const tr=document.createElement('tr');for(const v of [i+1,r.name,(+r.score||0).toFixed(2),Math.floor((+r.timeSpent||0)/60)+' phút']){const td=document.createElement('td');td.textContent=String(v);tr.append(td);}body.append(tr);}table.append(body);box.append(table);},()=>{box.textContent='Không thể tải bảng điểm. Hãy mở lại khi có kết nối.';});}
  catch(error){console.warn(error);box.textContent='Không thể tải bảng điểm. Hãy thử lại.';}
 };
 document.addEventListener('hl:navigate',e=>{if(e.detail.id!=='sec-leaderboard'&&boardRef){boardRef.off();boardRef=null;}});
 window.addEventListener('hl:auth-change',()=>{if(boardRef){boardRef.off();boardRef=null;}cache=null;cacheAt=0;document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());});
 document.addEventListener('hl:navigate',e=>{
  if(!e.detail.restored)return;
  const loaders={'sec-exam-list':()=>loadExamList(),'sec-community':()=>openCommunity(),'sec-toolkit':()=>openToolkit(),'sec-stats':()=>openStats(),'sec-arena':()=>openChemArena(),'sec-learning':()=>HLLearning.open()};
  if(loaders[e.detail.id])Promise.resolve().then(loaders[e.detail.id]).catch(error=>{console.warn('Restore section',error);window.toast?.('Không thể tải mục này. Hãy thử lại.');});
 });
 window.loadDashboardLeaderboards=async function(){
  if(!window.auth?.currentUser||boardBusy)return;boardBusy=true;
  try{if(!cache||Date.now()-cacheAt>60000){cache=await get('/api/leaderboards');cacheAt=Date.now();}for(const type of ['study','streak']){const box=document.getElementById('dashboard-top-'+type);if(!box)continue;box.replaceChildren();for(const [i,r]of cache[type].entries()){const p=document.createElement('p');p.className='hl-rank-row';p.textContent=`${i+1}. ${r.name} · ${type==='study'?Math.floor(r.value/60)+' phút':r.value+' ngày học'}`;box.append(p);}if(!cache[type].length)box.textContent='Chưa có dữ liệu học được xác nhận.';}}
  catch(error){console.warn('Leaderboard',error);for(const id of ['dashboard-top-study','dashboard-top-streak']){const box=document.getElementById(id);if(box)box.textContent='Chưa tải được bảng xếp hạng. Thử lại khi có kết nối.';}}
  finally{boardBusy=false;}
 };
})();
