import { db, identity, fail, assert, newId } from '../lib/exam-server.js';
import { validateQuestions, publicQuestions, gradeExam, sanitizeDraftAnswers, sanitizeFlaggedQuestions, MAX_EXAM_QUESTIONS } from '../shared/exam-grading.js';
import { resolveResourceLink } from '../shared/resource-links.js';
const MAX_BODY = 4 * 1024 * 1024;
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store, private');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
  try {
    const bodyBytes = req.method === 'POST' ? Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8') : 0;
    assert(Number(req.headers['content-length'] || 0) <= MAX_BODY && bodyBytes <= MAX_BODY,'Nội dung yêu cầu quá lớn. Hãy nén ảnh trong đề rồi thử lại.',413);
    const user = await identity(req); const database=db(); const action = req.method === 'GET' ? req.query.action : req.body?.action;
    assert(typeof action === 'string', 'Thiếu action.');
    if (action === 'list') {
      // Sort in Node so deployment does not depend on a manually-published Realtime Database index.
      const snap = await database.ref('exams_meta').get();
      const list = Object.values(snap.val() || {}).filter(x=>x && (x.status === 'published' || x.owner === user.uid)).sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0)).slice(0,70).map(({id,title,durationMinutes,createdAt,status,owner,counts,sourceUrl})=>({id,title,durationMinutes,createdAt,status,isOwner:owner===user.uid,counts,hasSourceDocument:Boolean(sourceUrl)}));
      return res.json({exams:list});
    }
    if (action === 'create') {
      assert(req.method==='POST','POST bắt buộc.');
      // Any authenticated HTVVM user may create a practice exam; no role tiers are used in this build.
      const title = String(req.body.title || '').trim(); assert(title.length>=3 && title.length<=140,'Tên đề từ 3–140 ký tự.');
      const durationMinutes=Number(req.body.durationMinutes); assert(Number.isInteger(durationMinutes) && durationMinutes>=5 && durationMinutes<=240,'Thời gian 5–240 phút.');
      const questions=validateQuestions(req.body.questions); const id=newId(); const createdAt=Date.now();
      let sourceUrl = '', sourceOpenUrl = '';
      if (req.body.sourceUrl) {
        const resource = resolveResourceLink(req.body.sourceUrl);
        assert(resource.type === 'drive' || resource.type === 'pdf', 'Phòng thi chỉ nhận liên kết Google Drive / Docs hoặc file PDF trực tiếp (HTTPS).', 400);
        sourceUrl = resource.embedUrl;
        if (req.body.sourceOpenUrl) {
          try { const openResource = resolveResourceLink(req.body.sourceOpenUrl); if ((openResource.type === 'drive' || openResource.type === 'pdf') && openResource.embedUrl === sourceUrl) sourceOpenUrl = openResource.openUrl; } catch {}
        }
        sourceOpenUrl ||= resource.openUrl;
      }
      const counts={I:questions.filter(q=>q.part==='I').length, II:questions.filter(q=>q.part==='II').length,III:questions.filter(q=>q.part==='III').length};
      const meta={id,title,durationMinutes,createdAt,status:'published',owner:user.uid,ownerName:user.name,counts,...(sourceUrl ? {sourceUrl,sourceOpenUrl} : {})};
      await database.ref().update({[`exams_meta/${id}`]:meta,[`exams_private/${id}`]:questions,[`exams_public/${id}`]:publicQuestions(questions)});
      return res.status(201).json({exam:{...meta,isOwner:true,hasSourceDocument:Boolean(sourceUrl)}});
    }
    if (action === 'delete') {
      assert(req.method === 'POST', 'POST bắt buộc.');
      const id = String(req.body.id || '').toUpperCase();
      assert(/^[A-Z0-9]{12}$/.test(id), 'Mã đề không hợp lệ.');
      const metaSnap = await database.ref(`exams_meta/${id}`).get();
      assert(metaSnap.exists(), 'Không tìm thấy đề thi trong cơ sở dữ liệu.', 404);
      const meta = metaSnap.val();
      assert(meta.owner === user.uid, 'Chỉ người tạo đề mới có quyền xóa đề thi này.', 403);
      const lockSnap = await database.ref(`active_exam_locks/${user.uid}`).get();
      const clearOwnLock = lockSnap.exists() && lockSnap.val()?.examId === id;
      await database.ref().update({
        [`exams_meta/${id}`]: null,
        [`exams_private/${id}`]: null,
        [`exams_public/${id}`]: null,
        [`exam_sessions/${id}`]: null,
        ...(clearOwnLock ? { [`active_exam_locks/${user.uid}`]: null } : {})
      });
      return res.json({ deleted: true, id });
    }
    if (action === 'detail') {
      const id=String(req.query.id || '').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const snap=await database.ref(`exams_meta/${id}`).get(); assert(snap.exists(),'Không tìm thấy đề.',404);
      const meta=snap.val(); assert(meta.status==='published' || meta.owner===user.uid,'Đề chưa được phát hành.',403);
      return res.json({exam:{id:meta.id,title:meta.title,durationMinutes:meta.durationMinutes,counts:meta.counts,status:meta.status,isOwner:meta.owner===user.uid,hasSourceDocument:Boolean(meta.sourceUrl)}});
    }
    if (action==='start') {
      assert(req.method==='POST','POST bắt buộc.'); const id=String(req.body.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const metaSnap=await database.ref(`exams_meta/${id}`).get(); assert(metaSnap.exists() && metaSnap.val().status==='published','Phòng thi không tồn tại.',404);
      const meta=metaSnap.val(), sessionRef=database.ref(`exam_sessions/${id}/${user.uid}`);
      const now=Date.now();
      const tx=await sessionRef.transaction(current => current || {startedAt:now,endsAt:now+meta.durationMinutes*60000,status:'active',name:user.name},undefined,false);
      const session=tx.snapshot.val(); assert(session,'Không khởi tạo được phiên thi.',500);
      if (session.status === 'active' && session.endsAt > now) {
        await database.ref(`active_exam_locks/${user.uid}`).set({ examId: id, title: meta.title, endsAt: session.endsAt, updatedAt: now });
      } else if (session.status === 'submitted') {
        const lockSnap = await database.ref(`active_exam_locks/${user.uid}`).get();
        if (lockSnap.exists() && lockSnap.val()?.examId === id) await database.ref(`active_exam_locks/${user.uid}`).remove();
      }
      const questions=(await database.ref(`exams_public/${id}`).get()).val();
      return res.json({exam:{id,title:meta.title,durationMinutes:meta.durationMinutes,isOwner:meta.owner===user.uid,sourceUrl:meta.sourceUrl || null,sourceOpenUrl:meta.sourceOpenUrl || meta.sourceUrl || null},questions,session:{startedAt:session.startedAt,endsAt:session.endsAt,status:session.status,draftAnswers:session.draftAnswers||{},draftUpdatedAt:session.draftUpdatedAt||0,flaggedQuestions:session.flaggedQuestions||[]},serverNow:Date.now(),result:session.status==='submitted'?session.result:null});
    }
    if (action==='document') {
      // Stream the exam file as raw PDF so the client renders it with pdf.js: works on phones and has no Drive "open in new window" link.
      const id=String(req.query.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const meta=(await database.ref(`exams_meta/${id}`).get()).val(); assert(meta?.sourceUrl,'Phòng thi này không gắn file đề.',404);
      if (meta.owner!==user.uid) assert((await database.ref(`exam_sessions/${id}/${user.uid}`).get()).exists(),'Hãy vào phòng thi trước khi xem đề.',403);
      const m=/^https:\/\/(?:drive|docs)\.google\.com\/(file|document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]{5,200})\/preview$/.exec(meta.sourceUrl);
      assert(m,'Chỉ đọc trực tiếp được file Google Drive / Google Docs.',415);
      const [,kind,fileId]=m;
      const src=kind==='file' ? `https://drive.google.com/uc?export=download&id=${fileId}`
        : kind==='presentation' ? `https://docs.google.com/presentation/d/${fileId}/export/pdf`
        : `https://docs.google.com/${kind}/d/${fileId}/export?format=pdf`;
      const upstream=await fetch(src,{redirect:'follow',signal:AbortSignal.timeout(8000)}).catch(()=>null);
      const pdf=upstream?.ok ? Buffer.from(await upstream.arrayBuffer()) : Buffer.alloc(0);
      assert(pdf.subarray(0,5).toString('latin1')==='%PDF-','Không tải được file đề. Trên Google Drive hãy bật Chia sẻ → “Bất kỳ ai có liên kết”, và dùng file PDF hoặc Google Docs.',422);
      // shortcut: Vercel caps responses at ~4.5 MB, move to Firebase Storage signed URLs if teachers need bigger files.
      assert(pdf.length<=4_400_000,'File đề lớn hơn 4,4 MB. Hãy nén PDF (giảm chất lượng ảnh) rồi tạo lại phòng.',413);
      res.setHeader('Content-Type','application/pdf');
      return res.status(200).send(pdf);
    }
    if (action==='save-draft') {
      assert(req.method==='POST','POST bắt buộc.');
      const id=String(req.body.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const publicSet=(await database.ref(`exams_public/${id}`).get()).val(); assert(Array.isArray(publicSet),'Không tìm thấy đề.',404);
      const draftAnswers=sanitizeDraftAnswers(publicSet,req.body.answers||{});
      const flaggedQuestions=sanitizeFlaggedQuestions(publicSet,req.body.flaggedQuestions||[]);
      const sessionRef=database.ref(`exam_sessions/${id}/${user.uid}`); const now=Date.now();
      const tx=await sessionRef.transaction(session=>{
        // First call sees the empty local cache (null); returning undefined would abort before reading the server.
        if(session===null) return null;
        if(session.status!=='active' || now>session.endsAt+30000) return;
        return {...session,draftAnswers,flaggedQuestions,draftUpdatedAt:now};
      },undefined,false);
      assert(tx.committed && tx.snapshot.val()?.draftUpdatedAt===now,'Phiên thi đã kết thúc hoặc không còn tồn tại; không thể lưu bản nháp.',409);
      return res.json({savedAt:now,answerCount:Object.keys(draftAnswers).length,flaggedCount:flaggedQuestions.length});
    }
    if (action==='history') {
      assert(req.method==='GET','GET bắt buộc.');
      // Keep history independent of a manually configured Realtime Database index.
      const metaSnap=await database.ref('exams_meta').get();
      const metas=Object.values(metaSnap.val()||{}).filter(x=>x && x.id).sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0)).slice(0,100);
      const records=await Promise.all(metas.map(async meta=>{
        if(!meta?.id) return null;
        const attemptSnap=await database.ref(`exam_sessions/${meta.id}/${user.uid}`).get();
        if(!attemptSnap.exists()) return null;
        const attempt=attemptSnap.val();
        if(attempt?.status!=='submitted' || !attempt.result) return null;
        return {examId:meta.id,examTitle:meta.title||'Đề thi',durationMinutes:meta.durationMinutes||0,startedAt:attempt.startedAt||0,submittedAt:attempt.submittedAt||0,elapsedMs:Math.max(0,(attempt.submittedAt||0)-(attempt.startedAt||0)),score:Number(attempt.result.score)||0,total:Number(attempt.result.total)||0,fullyCorrect:Number(attempt.result.fullyCorrect)||0};
      }));
      const history=records.filter(Boolean).sort((a,b)=>b.submittedAt-a.submittedAt).slice(0,100);
      const scores=history.map(x=>x.score);
      return res.json({history,summary:{total:history.length,averageScore:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*100)/100:0,bestScore:scores.length?Math.max(...scores):0,latestScore:scores[0]??null}});
    }
    if (action==='submit') {
      assert(req.method==='POST','POST bắt buộc.'); const id=String(req.body.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const answers=req.body.answers; assert(answers && typeof answers==='object' && !Array.isArray(answers) && Object.keys(answers).length <= MAX_EXAM_QUESTIONS,'Bài làm không hợp lệ.');
      const questions=(await database.ref(`exams_private/${id}`).get()).val(); assert(Array.isArray(questions),'Không tìm thấy bộ đáp án.',404);
      const sessionRef=database.ref(`exam_sessions/${id}/${user.uid}`); const before=await sessionRef.get(); assert(before.exists(),'Bạn chưa bắt đầu thi.',403);
      const attempt=before.val();
      if (attempt.status==='submitted') return res.json({result:attempt.result,alreadySubmitted:true});
      // Allow a small transmission grace period. Server determines deadline, never the browser.
      assert(Date.now() <= attempt.endsAt+30000,'Đã quá hạn nộp bài; liên hệ giáo viên.',409);
      const grading=gradeExam(questions,answers), submittedAt=Date.now();
      const result={...grading,submittedAt};
      const tx=await sessionRef.transaction(current => {
        if (current===null) return null; // empty local cache on first call; SDK retries with the server value
        if (current.status!=='active') return;
        if (submittedAt > current.endsAt+30000) return;
        const {draftAnswers:_draftAnswers,draftUpdatedAt:_draftUpdatedAt,flaggedQuestions:_flaggedQuestions,...rest}=current;
        return {...rest,status:'submitted',submittedAt,result};
      },undefined,false);
      const saved=tx.snapshot.val(); assert(saved?.status==='submitted','Không thể ghi bài nộp.',409);
      await database.ref(`active_exam_locks/${user.uid}`).remove().catch(()=>{});
      // Retries return the first committed result; no double grading.
      return res.json({result:saved.result,alreadySubmitted:!tx.committed});
    }
    if (action==='review') {
      assert(req.method==='GET','GET bắt buộc.');
      const id=String(req.query.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const attemptSnap=await database.ref(`exam_sessions/${id}/${user.uid}`).get();
      assert(attemptSnap.exists() && attemptSnap.val()?.status==='submitted' && attemptSnap.val()?.result,'Chưa có kết quả đã nộp cho đề này.',404);
      return res.json({examId:id,result:attemptSnap.val().result});
    }
    if (action==='mistakes') {
      const snap=await database.ref('exam_sessions').get();
      const mistakes=[];
      snap.forEach(exam=>{const attempt=exam.child(user.uid).val(); if(attempt?.status==='submitted') for(const detail of attempt.result?.details||[]) if(!detail.correct) mistakes.push({examId:exam.key,...detail,submittedAt:attempt.submittedAt}); });
      return res.json({mistakes:mistakes.sort((a,b)=>b.submittedAt-a.submittedAt).slice(0,300)});
    }
    if (action==='leaderboard') {
      const id=String(req.query.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const snap=await database.ref(`exam_sessions/${id}`).get(); const ranking=[];
      snap.forEach(s=>{const v=s.val(); if(v.status==='submitted') ranking.push({name:v.name,score:v.result.score,submittedAt:v.submittedAt,elapsedMs:v.submittedAt-v.startedAt});});
      ranking.sort((a,b)=>b.score-a.score || a.elapsedMs-b.elapsedMs);
      return res.json({ranking:ranking.slice(0,50)});
    }
    assert(false,'Action không được hỗ trợ.',404);
  } catch(err){return fail(res,err);}
}
