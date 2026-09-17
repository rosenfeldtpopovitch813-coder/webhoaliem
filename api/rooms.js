const {getAdmin,verifyUser}=require('../lib/firebase-admin');
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({error:'Chỉ nhận GET.'});
 try{const app=getAdmin(),user=await verifyUser(req),id=String(req.query?.id||'');if(id&&!/^[A-Za-z0-9_-]{1,128}$/.test(id))return res.status(400).json({error:'Mã đề không hợp lệ.'});
  const snap=await app.database().ref(id?'rooms/'+id:'rooms').once('value');
  function publicRoom(r,key){if(!r)return null;const output={title:r.title||'',code:key,creatorUid:r.creatorUid||'',creatorName:r.creatorName||'',createdAt:r.createdAt||0,status:r.status||'open',config:r.config||{}};if(r.creatorUid===user.uid){output.answers=r.answers||{};output.results=r.results||{};}return output;}
  const value=id?publicRoom(snap.val(),id):Object.fromEntries(Object.entries(snap.val()||{}).filter(([key,r])=>/^[A-Za-z0-9_-]{1,128}$/.test(key)&&r.config).map(([key,r])=>[key,publicRoom(r,key)]));
  return res.status(200).json({data:value});
 }catch(error){console.error('Rooms',error);return res.status(error.status||503).json({error:'Không thể tải đề thi.'});}
};
