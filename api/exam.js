import { db, identity, fail, assert, newId } from '../lib/exam-server.js';
import { validateQuestions, publicQuestions, gradeExam, sanitizeDraftAnswers, sanitizeFlaggedQuestions } from '../shared/exam-grading.js';
const MAX_BODY = 350000;
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store, private');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
  try {
    assert(Number(req.headers['content-length'] || 0) <= MAX_BODY,'Nội dung quá lớn.',413);
    const user = await identity(req); const database=db(); const action = req.method === 'GET' ? req.query.action : req.body?.action;
    assert(typeof action === 'string', 'Thiếu action.');
    if (action === 'list') {
      const snap = await database.ref('exams_meta').orderByChild('createdAt').limitToLast(70).get();
      const list = Object.values(snap.val() || {}).filter(x=>x.status === 'published' || x.owner === user.uid).map(({id,title,durationMinutes,createdAt,status,owner,counts})=>({id,title,durationMinutes,createdAt,status,isOwner:owner===user.uid,counts})).reverse();
      return res.json({exams:list});
    }
    if (action === 'create') {
      assert(req.method==='POST','POST bắt buộc.');
      // Any authenticated HTVVM user may create a practice exam; no role tiers are used in this build.
      const title = String(req.body.title || '').trim(); assert(title.length>=3 && title.length<=140,'Tên đề từ 3–140 ký tự.');
      const durationMinutes=Number(req.body.durationMinutes); assert(Number.isInteger(durationMinutes) && durationMinutes>=5 && durationMinutes<=240,'Thời gian 5–240 phút.');
      const questions=validateQuestions(req.body.questions); const id=newId(); const createdAt=Date.now();
      const counts={I:questions.filter(q=>q.part==='I').length, II:questions.filter(q=>q.part==='II').length,III:questions.filter(q=>q.part==='III').length};
      const meta={id,title,durationMinutes,createdAt,status:'published',owner:user.uid,counts};
      await database.ref().update({[`exams_meta/${id}`]:meta,[`exams_private/${id}`]:questions,[`exams_public/${id}`]:publicQuestions(questions)});
      return res.status(201).json({exam:meta});
    }
    if (action === 'detail') {
      const id=String(req.query.id || '').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const snap=await database.ref(`exams_meta/${id}`).get(); assert(snap.exists(),'Không tìm thấy đề.',404);
      const meta=snap.val(); assert(meta.status==='published' || meta.owner===user.uid,'Đề chưa được phát hành.',403);
      return res.json({exam:{id:meta.id,title:meta.title,durationMinutes:meta.durationMinutes,counts:meta.counts,status:meta.status}});
    }
    if (action==='start') {
      assert(req.method==='POST','POST bắt buộc.'); const id=String(req.body.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const metaSnap=await database.ref(`exams_meta/${id}`).get(); assert(metaSnap.exists() && metaSnap.val().status==='published','Phòng thi không tồn tại.',404);
      const meta=metaSnap.val(), sessionRef=database.ref(`exam_sessions/${id}/${user.uid}`);
      const now=Date.now();
      const tx=await sessionRef.transaction(current => current || {startedAt:now,endsAt:now+meta.durationMinutes*60000,status:'active',name:user.name},undefined,false);
      const session=tx.snapshot.val(); assert(session,'Không khởi tạo được phiên thi.',500);
      const questions=(await database.ref(`exams_public/${id}`).get()).val();
      return res.json({exam:{id,title:meta.title,durationMinutes:meta.durationMinutes},questions,session:{startedAt:session.startedAt,endsAt:session.endsAt,status:session.status,draftAnswers:session.draftAnswers||{},draftUpdatedAt:session.draftUpdatedAt||0,flaggedQuestions:session.flaggedQuestions||[]},serverNow:Date.now(),result:session.status==='submitted'?session.result:null});
    }
    if (action==='save-draft') {
      assert(req.method==='POST','POST bắt buộc.');
      const id=String(req.body.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const publicSet=(await database.ref(`exams_public/${id}`).get()).val(); assert(Array.isArray(publicSet),'Không tìm thấy đề.',404);
      const draftAnswers=sanitizeDraftAnswers(publicSet,req.body.answers||{});
      const flaggedQuestions=sanitizeFlaggedQuestions(publicSet,req.body.flaggedQuestions||[]);
      const sessionRef=database.ref(`exam_sessions/${id}/${user.uid}`); const now=Date.now();
      const tx=await sessionRef.transaction(session=>{
        if(!session || session.status!=='active' || now>session.endsAt+30000) return;
        return {...session,draftAnswers,flaggedQuestions,draftUpdatedAt:now};
      },undefined,false);
      assert(tx.committed,'Phiên thi đã kết thúc hoặc không còn tồn tại; không thể lưu bản nháp.',409);
      return res.json({savedAt:tx.snapshot.val().draftUpdatedAt,answerCount:Object.keys(draftAnswers).length,flaggedCount:flaggedQuestions.length});
    }
    if (action==='history') {
      assert(req.method==='GET','GET bắt buộc.');
      const metaSnap=await database.ref('exams_meta').orderByChild('createdAt').limitToLast(100).get();
      const metas=Object.values(metaSnap.val()||{});
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
      const answers=req.body.answers; assert(answers && typeof answers==='object' && !Array.isArray(answers) && Object.keys(answers).length <= 60,'Bài làm không hợp lệ.');
      const questions=(await database.ref(`exams_private/${id}`).get()).val(); assert(Array.isArray(questions),'Không tìm thấy bộ đáp án.',404);
      const sessionRef=database.ref(`exam_sessions/${id}/${user.uid}`); const before=await sessionRef.get(); assert(before.exists(),'Bạn chưa bắt đầu thi.',403);
      const attempt=before.val();
      if (attempt.status==='submitted') return res.json({result:attempt.result,alreadySubmitted:true});
      // Allow a small transmission grace period. Server determines deadline, never the browser.
      assert(Date.now() <= attempt.endsAt+30000,'Đã quá hạn nộp bài; liên hệ giáo viên.',409);
      const grading=gradeExam(questions,answers), submittedAt=Date.now();
      const result={...grading,submittedAt};
      const tx=await sessionRef.transaction(current => {
        if (!current || current.status!=='active') return;
        if (submittedAt > current.endsAt+30000) return;
        const {draftAnswers:_draftAnswers,draftUpdatedAt:_draftUpdatedAt,flaggedQuestions:_flaggedQuestions,...rest}=current;
        return {...rest,status:'submitted',submittedAt,result};
      },undefined,false);
      const saved=tx.snapshot.val(); assert(saved?.status==='submitted','Không thể ghi bài nộp.',409);
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
