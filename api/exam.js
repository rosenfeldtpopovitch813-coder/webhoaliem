import { db, identity, fail, assert, newId } from '../lib/exam-server.js';
import { validateQuestions, publicQuestions, gradeExam, sanitizeDraftAnswers, sanitizeFlaggedQuestions, MAX_EXAM_QUESTIONS } from '../shared/exam-grading.js';
import {
  SUBMISSION_GRACE_MS,
  MAX_VIOLATION_EVENTS,
  parseMaxAttempts,
  hasRemainingAttempts,
  isExamLocked,
  computeAttemptEndsAt,
  normalizeLeaveScreenCount,
  normalizeViolationEvents,
  resolveAttemptReviewStatus,
  isAttemptLeaderboardEligible,
  summarizeUserModerationStatus,
  collectUserAttempts,
  buildAutoSubmitRecord,
  aggregateExamLeaderboard
} from '../shared/exam-attempts.js';
import { resolveResourceLink } from '../shared/resource-links.js';
const MAX_BODY = 4 * 1024 * 1024;
const VALID_VIOLATION_REASONS = new Set(['tab-hidden', 'fullscreen-exit']);

function parseOptionalDeadline(rawDeadline, now = Date.now()) {
  if (rawDeadline === null || rawDeadline === undefined || rawDeadline === '') return null;
  const ts = Number(rawDeadline);
  assert(Number.isFinite(ts) && ts > now + 60_000, 'Hạn chót đóng phòng thi phải ở tương lai ít nhất 1 phút.');
  assert(ts <= now + 365 * 86_400_000, 'Hạn chót không vượt quá 365 ngày.');
  return Math.floor(ts);
}

async function readActiveAttempt(database, id, uid) {
  const activeSnap = await database.ref(`exam_active_attempts/${id}/${uid}`).get();
  if (activeSnap.exists() && activeSnap.val()?.status === 'active') {
    return { source: 'new', ref: activeSnap.ref, val: activeSnap.val() };
  }
  const legacySnap = await database.ref(`exam_sessions/${id}/${uid}`).get();
  if (legacySnap.exists() && legacySnap.val()?.status === 'active') {
    return { source: 'legacy', ref: legacySnap.ref, val: legacySnap.val() };
  }
  return null;
}

async function readUserAttemptHistory(database, id, uid) {
  const [attemptsSnap, legacySnap] = await Promise.all([
    database.ref(`exam_attempts/${id}/${uid}`).get(),
    database.ref(`exam_sessions/${id}/${uid}`).get()
  ]);
  return collectUserAttempts(attemptsSnap.val(), legacySnap.val());
}

async function clearExamLockIfMatching(database, uid, id) {
  const lockSnap = await database.ref(`active_exam_locks/${uid}`).get();
  if (lockSnap.exists() && lockSnap.val()?.examId === id) {
    await database.ref(`active_exam_locks/${uid}`).remove().catch(() => {});
  }
}

async function finalizeActiveIfExpired(database, id, uid, questionsCache = null, now = Date.now()) {
  const activeInfo = await readActiveAttempt(database, id, uid);
  if (!activeInfo) return null;
  const active = activeInfo.val;
  if (now <= Number(active.endsAt || 0) + SUBMISSION_GRACE_MS) return { expired: false, activeInfo };
  const tx = await activeInfo.ref.transaction(current => {
    if (current === null) return null;
    if (current.status !== 'active' || now <= Number(current.endsAt || 0) + SUBMISSION_GRACE_MS) return;
    return { ...current, status: 'auto_finalizing' };
  }, undefined, false);
  if (!tx.committed) {
    const history = await readUserAttemptHistory(database, id, uid);
    return { expired: true, archived: history[0] || null };
  }
  const questions = questionsCache || (await database.ref(`exams_private/${id}`).get()).val();
  if (!Array.isArray(questions)) return { expired: true, archived: null };
  const existing = await readUserAttemptHistory(database, id, uid);
  const record = buildAutoSubmitRecord({ active: tx.snapshot.val(), questions, existingCount: existing.length, now });
  await database.ref().update({
    [`exam_attempts/${id}/${uid}/${record.attemptId}`]: record,
    [`exam_active_attempts/${id}/${uid}`]: null,
    [`exam_user_slots/${id}/${uid}`]: {
      completedCount: existing.length + 1,
      activeAttemptId: null,
      activeEndsAt: null,
      updatedAt: now
    },
    [`user_exam_ids/${uid}/${id}`]: record.submittedAt,
    ...(activeInfo.source === 'legacy' ? { [`exam_sessions/${id}/${uid}`]: null } : {})
  });
  await clearExamLockIfMatching(database, uid, id);
  return { expired: true, archived: record };
}

async function finalizeExpiredForExam(database, id, now = Date.now()) {
  const [activeSnap, legacySnap] = await Promise.all([
    database.ref(`exam_active_attempts/${id}`).get(),
    database.ref(`exam_sessions/${id}`).get()
  ]);
  const activeByUid = activeSnap.val() || {};
  const legacyVal = legacySnap.val() || {};
  const expiredUids = [];
  for (const [uid, val] of Object.entries(activeByUid)) {
    if (val?.status === 'active' && now > Number(val.endsAt || 0) + SUBMISSION_GRACE_MS) expiredUids.push(uid);
  }
  for (const [uid, val] of Object.entries(legacyVal)) {
    if (val?.status === 'active' && now > Number(val.endsAt || 0) + SUBMISSION_GRACE_MS && !expiredUids.includes(uid)) expiredUids.push(uid);
  }
  if (expiredUids.length) {
    const questions = (await database.ref(`exams_private/${id}`).get()).val();
    if (Array.isArray(questions)) {
      await Promise.all(expiredUids.map(uid => finalizeActiveIfExpired(database, id, uid, questions, now)));
    }
  }
}

function collectExamSubmissionRows(attemptsByUid = {}, legacyByUid = {}, maxDurationMs = 0) {
  const uids = new Set([...Object.keys(attemptsByUid || {}), ...Object.keys(legacyByUid || {})]);
  const rows = [];
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  const studentUids = new Set();

  for (const uid of uids) {
    const attempts = collectUserAttempts(attemptsByUid?.[uid], legacyByUid?.[uid]);
    if (!attempts.length) continue;
    studentUids.add(uid);
    for (const item of attempts) {
      const reviewStatus = resolveAttemptReviewStatus(item);
      const leaveScreenCount = normalizeLeaveScreenCount(item.leaveScreenCount);
      if (reviewStatus === 'pending') pendingCount += 1;
      else if (reviewStatus === 'approved' && leaveScreenCount > 0) approvedCount += 1;
      else if (reviewStatus === 'rejected') rejectedCount += 1;
      const rawElapsed = Math.max(0, (Number(item.submittedAt) || 0) - (Number(item.startedAt) || 0));
      const elapsedMs = maxDurationMs > 0 ? Math.min(rawElapsed, maxDurationMs) : rawElapsed;
      rows.push({
        uid,
        name: item.name || 'Học sinh',
        attemptId: item.attemptId,
        attemptNumber: item.attemptNumber || 1,
        score: Number(item.result?.score) || 0,
        fullyCorrect: Number(item.result?.fullyCorrect) || 0,
        total: Number(item.result?.total) || 0,
        startedAt: Number(item.startedAt) || 0,
        submittedAt: Number(item.submittedAt) || 0,
        elapsedMs,
        autoSubmitted: Boolean(item.autoSubmitted),
        leaveScreenCount,
        violationEvents: normalizeViolationEvents(item.violationEvents),
        reviewStatus,
        reviewedAt: Number(item.reviewedAt) || 0,
        reviewNote: item.reviewNote || '',
        leaderboardEligible: isAttemptLeaderboardEligible(item),
        legacy: Boolean(item.legacy)
      });
    }
  }
  const priority = { pending: 0, rejected: 1, approved: 2, clean: 3 };
  rows.sort((a, b) => (priority[a.reviewStatus] ?? 9) - (priority[b.reviewStatus] ?? 9) || b.submittedAt - a.submittedAt);
  return {
    rows,
    uniqueStudents: studentUids.size,
    pendingCount,
    approvedCount,
    rejectedCount
  };
}

function serializeExamSummary(meta, now, extra = {}) {
  const maxAttempts = Number(meta.maxAttempts) || 0;
  return {
    id: meta.id,
    title: meta.title,
    durationMinutes: meta.durationMinutes,
    maxAttempts,
    createdAt: meta.createdAt,
    status: meta.status,
    isOwner: extra.isOwner ?? false,
    counts: meta.counts,
    hasSourceDocument: Boolean(meta.sourceUrl),
    deadlineAt: meta.deadlineAt || null,
    manualLocked: Boolean(meta.manualLocked),
    isLocked: isExamLocked(meta, now),
    ...extra
  };
}
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
      const now = Date.now();
      const snap = await database.ref('exams_meta').get();
      const metas = Object.values(snap.val() || {})
        .filter(x => x && (x.status === 'published' || x.owner === user.uid))
        .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
        .slice(0, 70);
      const list = await Promise.all(metas.map(async (meta) => {
        const isOwner = meta.owner === user.uid;
        const finalized = await finalizeActiveIfExpired(database, meta.id, user.uid, null, now);
        const attempts = await readUserAttemptHistory(database, meta.id, user.uid);
        const hasActiveAttempt = Boolean(finalized && !finalized.expired);
        const activeEndsAt = hasActiveAttempt ? Number(finalized.activeInfo.val.endsAt) || null : null;
        const myBestScore = attempts.length ? Math.max(...attempts.map(a => Number(a.result?.score) || 0)) : null;
        const maxAttempts = Number(meta.maxAttempts) || 0;
        const locked = isExamLocked(meta, now);
        let pendingModerationCount = 0;
        let submissionsCount = 0;
        if (isOwner) {
          const [allAttSnap, allLegacySnap] = await Promise.all([
            database.ref(`exam_attempts/${meta.id}`).get(),
            database.ref(`exam_sessions/${meta.id}`).get()
          ]);
          const summary = collectExamSubmissionRows(allAttSnap.val() || {}, allLegacySnap.val() || {}, (Number(meta.durationMinutes) || 0) * 60_000);
          pendingModerationCount = summary.pendingCount;
          submissionsCount = summary.rows.length;
        }
        return serializeExamSummary(meta, now, {
          isOwner,
          hasActiveAttempt,
          activeEndsAt,
          myAttemptsCount: attempts.length,
          myBestScore,
          canRetake: !locked && hasRemainingAttempts(maxAttempts, attempts.length),
          ...(isOwner ? { pendingModerationCount, submissionsCount } : {})
        });
      }));
      return res.json({ exams: list });
    }
    if (action === 'create') {
      assert(req.method==='POST','POST bắt buộc.');
      // Any authenticated HTVVM user may create a practice exam; no role tiers are used in this build.
      const title = String(req.body.title || '').trim(); assert(title.length>=3 && title.length<=140,'Tên đề từ 3–140 ký tự.');
      const durationMinutes=Number(req.body.durationMinutes); assert(Number.isInteger(durationMinutes) && durationMinutes>=5 && durationMinutes<=240,'Thời gian 5–240 phút.');
      const maxAttempts = parseMaxAttempts(req.body.maxAttempts);
      const createdAt=Date.now();
      const deadlineAt = parseOptionalDeadline(req.body.deadlineAt, createdAt);
      const questions=validateQuestions(req.body.questions); const id=newId();
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
      const meta={id,title,durationMinutes,maxAttempts,createdAt,status:'published',owner:user.uid,ownerName:user.name,counts,manualLocked:false,...(deadlineAt?{deadlineAt}:{}),...(sourceUrl ? {sourceUrl,sourceOpenUrl} : {})};
      await database.ref().update({[`exams_meta/${id}`]:meta,[`exams_private/${id}`]:questions,[`exams_public/${id}`]:publicQuestions(questions)});
      return res.status(201).json({exam:serializeExamSummary(meta, createdAt, { isOwner: true, ownerName: user.name })});
    }
    if (action === 'update-lock') {
      assert(req.method === 'POST', 'POST bắt buộc.');
      const id = String(req.body.id || '').toUpperCase();
      assert(/^[A-Z0-9]{12}$/.test(id), 'Mã đề không hợp lệ.');
      const metaRef = database.ref(`exams_meta/${id}`);
      const metaSnap = await metaRef.get();
      assert(metaSnap.exists(), 'Không tìm thấy đề thi.', 404);
      const meta = metaSnap.val();
      assert(meta.owner === user.uid, 'Chỉ người tạo đề mới có quyền khóa hoặc mở lại phòng thi.', 403);
      const now = Date.now();
      const nextManualLocked = typeof req.body.manualLocked === 'boolean' ? req.body.manualLocked : Boolean(meta.manualLocked);
      let nextDeadline = meta.deadlineAt || null;
      if ('deadlineAt' in (req.body || {})) {
        nextDeadline = parseOptionalDeadline(req.body.deadlineAt, now);
      }
      let nextMaxAttempts = Number(meta.maxAttempts) || 0;
      if ('maxAttempts' in (req.body || {})) {
        nextMaxAttempts = parseMaxAttempts(req.body.maxAttempts);
      }
      assert(
        nextManualLocked || !nextDeadline || nextDeadline > now,
        'Hạn chót cũ đã qua. Hãy gia hạn thêm hoặc bỏ hạn chót để mở lại phòng thi.'
      );
      await metaRef.update({ manualLocked: nextManualLocked, deadlineAt: nextDeadline, maxAttempts: nextMaxAttempts });
      const updatedMeta = { ...meta, manualLocked: nextManualLocked, maxAttempts: nextMaxAttempts, ...(nextDeadline ? { deadlineAt: nextDeadline } : { deadlineAt: null }) };
      return res.json({ exam: serializeExamSummary(updatedMeta, now, { isOwner: true }) });
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
        [`exam_attempts/${id}`]: null,
        [`exam_active_attempts/${id}`]: null,
        [`exam_user_slots/${id}`]: null,
        ...(clearOwnLock ? { [`active_exam_locks/${user.uid}`]: null } : {})
      });
      return res.json({ deleted: true, id });
    }
    if (action === 'detail') {
      const id=String(req.query.id || '').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const snap=await database.ref(`exams_meta/${id}`).get(); assert(snap.exists(),'Không tìm thấy đề.',404);
      const meta=snap.val(); assert(meta.status==='published' || meta.owner===user.uid,'Đề chưa được phát hành.',403);
      return res.json({exam:serializeExamSummary(meta, Date.now(), { isOwner: meta.owner === user.uid })});
    }
    if (action==='start') {
      assert(req.method==='POST','POST bắt buộc.'); const id=String(req.body.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const metaSnap=await database.ref(`exams_meta/${id}`).get(); assert(metaSnap.exists() && metaSnap.val().status==='published','Phòng thi không tồn tại.',404);
      const meta=metaSnap.val(), now=Date.now(), retake=Boolean(req.body.retake);
      const maxAttempts = Number(meta.maxAttempts) || 0;
      const finalized = await finalizeActiveIfExpired(database, id, user.uid, null, now);
      if (finalized?.expired && finalized.archived && !retake) {
        const locked = isExamLocked(meta, now);
        const questions = (await database.ref(`exams_public/${id}`).get()).val() || [];
        return res.json({
          exam: serializeExamSummary(meta, now, { isOwner: meta.owner === user.uid, sourceUrl: meta.sourceUrl || null, sourceOpenUrl: meta.sourceOpenUrl || meta.sourceUrl || null }),
          session: { status: 'submitted', autoSubmitted: true, attemptNumber: finalized.archived.attemptNumber },
          autoSubmittedSession: true,
          canRetake: !locked && hasRemainingAttempts(maxAttempts, finalized.archived.attemptNumber),
          maxAttempts,
          questions,
          leaveScreenCount: normalizeLeaveScreenCount(finalized.archived.leaveScreenCount),
          violationEvents: normalizeViolationEvents(finalized.archived.violationEvents),
          reviewStatus: resolveAttemptReviewStatus(finalized.archived),
          serverNow: Date.now(),
          result: finalized.archived.result
        });
      }
      const existingActive = finalized && !finalized.expired ? finalized.activeInfo : await readActiveAttempt(database, id, user.uid);
      const locked = isExamLocked(meta, now);
      const history = await readUserAttemptHistory(database, id, user.uid);
      const endsAt = computeAttemptEndsAt(now, meta.durationMinutes, meta.deadlineAt);
      let reservedAttemptId = newId();
      if (!existingActive) {
        assert(!locked, 'Phòng thi hiện đang khóa hoặc đã quá hạn nộp bài. Hãy liên hệ người tạo đề để mở lại.', 403);
        const slotRef = database.ref(`exam_user_slots/${id}/${user.uid}`);
        let slotDenied = false;
        const slotTx = await slotRef.transaction(current => {
          const cur = current && typeof current === 'object' ? current : {};
          const completed = Math.max(Number(cur.completedCount) || 0, history.length);
          if (cur.activeAttemptId && Number(cur.activeEndsAt || 0) + SUBMISSION_GRACE_MS > now) {
            return cur;
          }
          if (!hasRemainingAttempts(maxAttempts, completed)) {
            slotDenied = true;
            return;
          }
          return {
            completedCount: completed,
            activeAttemptId: reservedAttemptId,
            activeEndsAt: endsAt,
            updatedAt: now
          };
        }, undefined, false);
        if (!slotTx.committed) {
          assert(!slotDenied, `Bạn đã sử dụng hết ${maxAttempts} lượt làm bài cho đề thi này.`, 403);
          assert(false, 'Không thể khởi tạo lượt thi lúc này. Hãy thử lại.', 409);
        }
        const slotVal = slotTx.snapshot.val();
        if (slotVal?.activeAttemptId) reservedAttemptId = slotVal.activeAttemptId;
      }
      const targetRef = existingActive ? existingActive.ref : database.ref(`exam_active_attempts/${id}/${user.uid}`);
      const freshAttempt = { attemptId: reservedAttemptId, startedAt: now, endsAt, status: 'active', name: user.name, leaveScreenCount: 0, violationEvents: [] };
      const tx = await targetRef.transaction(
        current => (current && current.status === 'active') ? current : freshAttempt,
        undefined,
        false
      );
      const session=tx.snapshot.val(); assert(session && session.status === 'active','Không khởi tạo được phiên thi.',500);
      await database.ref(`active_exam_locks/${user.uid}`).set({ examId: id, title: meta.title, endsAt: session.endsAt, updatedAt: now });
      const questions=(await database.ref(`exams_public/${id}`).get()).val();
      return res.json({
        exam: serializeExamSummary(meta, now, { isOwner: meta.owner === user.uid, sourceUrl: meta.sourceUrl || null, sourceOpenUrl: meta.sourceOpenUrl || meta.sourceUrl || null }),
        questions,
        attemptNumber: history.length + 1,
        session:{
          attemptId:session.attemptId || 'legacy',
          startedAt:session.startedAt,
          endsAt:session.endsAt,
          status:session.status,
          draftAnswers:session.draftAnswers||{},
          draftUpdatedAt:session.draftUpdatedAt||0,
          flaggedQuestions:session.flaggedQuestions||[],
          leaveScreenCount:normalizeLeaveScreenCount(session.leaveScreenCount),
          violationEvents:normalizeViolationEvents(session.violationEvents)
        },
        serverNow:Date.now(),
        result:null
      });
    }
    if (action==='report-violation') {
      assert(req.method==='POST','POST bắt buộc.');
      const id=String(req.body.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const reason = VALID_VIOLATION_REASONS.has(req.body.reason) ? req.body.reason : 'tab-hidden';
      const activeInfo = await readActiveAttempt(database, id, user.uid);
      assert(activeInfo, 'Phiên thi đã kết thúc hoặc chưa bắt đầu.', 409);
      const now = Date.now();
      const tx = await activeInfo.ref.transaction(session => {
        if (session === null) return null;
        if (session.status !== 'active' || now > Number(session.endsAt || 0) + SUBMISSION_GRACE_MS) return;
        const prevCount = normalizeLeaveScreenCount(session.leaveScreenCount);
        const prevEvents = normalizeViolationEvents(session.violationEvents);
        const nextEvents = prevEvents.length < MAX_VIOLATION_EVENTS
          ? [...prevEvents, { at: now, reason }]
          : prevEvents;
        return {
          ...session,
          leaveScreenCount: Math.min(200, prevCount + 1),
          violationEvents: nextEvents,
          lastViolationAt: now
        };
      }, undefined, false);
      assert(tx.committed && tx.snapshot.val(), 'Không thể ghi nhận trạng thái giám sát lúc này.', 409);
      const saved = tx.snapshot.val();
      return res.json({
        leaveScreenCount: normalizeLeaveScreenCount(saved.leaveScreenCount),
        violationEvents: normalizeViolationEvents(saved.violationEvents)
      });
    }
    if (action==='document') {
      // Stream the exam file as raw PDF so the client renders it with pdf.js: works on phones and has no Drive "open in new window" link.
      const id=String(req.query.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const meta=(await database.ref(`exams_meta/${id}`).get()).val(); assert(meta?.sourceUrl,'Phòng thi này không gắn file đề.',404);
      if (meta.owner!==user.uid) {
        const hasActive = await readActiveAttempt(database, id, user.uid);
        const history = hasActive ? [] : await readUserAttemptHistory(database, id, user.uid);
        assert(Boolean(hasActive) || history.length > 0,'Hãy vào phòng thi trước khi xem đề.',403);
      }
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
      const activeInfo = await readActiveAttempt(database, id, user.uid);
      assert(activeInfo, 'Phiên thi đã kết thúc hoặc chưa bắt đầu.', 409);
      const now=Date.now();
      const tx=await activeInfo.ref.transaction(session=>{
        // First call sees the empty local cache (null); returning undefined would abort before reading the server.
        if(session===null) return null;
        if(session.status!=='active' || now>Number(session.endsAt||0)+SUBMISSION_GRACE_MS) return;
        return {...session,draftAnswers,flaggedQuestions,draftUpdatedAt:now};
      },undefined,false);
      assert(tx.committed && tx.snapshot.val()?.draftUpdatedAt===now,'Phiên thi đã kết thúc hoặc không còn tồn tại; không thể lưu bản nháp.',409);
      return res.json({savedAt:now,answerCount:Object.keys(draftAnswers).length,flaggedCount:flaggedQuestions.length});
    }
    if (action==='history') {
      assert(req.method==='GET','GET bắt buộc.');
      const now = Date.now();
      // Keep history independent of a manually configured Realtime Database index.
      const metaSnap=await database.ref('exams_meta').get();
      const metas=Object.values(metaSnap.val()||{}).filter(x=>x && x.id).sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0)).slice(0,100);
      const perExam = await Promise.all(metas.map(async meta=>{
        if(!meta?.id) return [];
        await finalizeActiveIfExpired(database, meta.id, user.uid, null, now);
        const attempts = await readUserAttemptHistory(database, meta.id, user.uid);
        return attempts.map(attempt => ({
          examId:meta.id,
          attemptId:attempt.attemptId,
          attemptNumber:attempt.attemptNumber||1,
          autoSubmitted:Boolean(attempt.autoSubmitted),
          examTitle:meta.title||'Đề thi',
          durationMinutes:meta.durationMinutes||0,
          startedAt:attempt.startedAt||0,
          submittedAt:attempt.submittedAt||0,
          elapsedMs:Math.max(0,(attempt.submittedAt||0)-(attempt.startedAt||0)),
          score:Number(attempt.result?.score)||0,
          total:Number(attempt.result?.total)||0,
          fullyCorrect:Number(attempt.result?.fullyCorrect)||0
        }));
      }));
      const history=perExam.flat().sort((a,b)=>b.submittedAt-a.submittedAt).slice(0,120);
      const scores=history.map(x=>x.score);
      return res.json({history,summary:{total:history.length,averageScore:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*100)/100:0,bestScore:scores.length?Math.max(...scores):0,latestScore:scores[0]??null}});
    }
    if (action==='submit') {
      assert(req.method==='POST','POST bắt buộc.'); const id=String(req.body.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const answers=req.body.answers; assert(answers && typeof answers==='object' && !Array.isArray(answers) && Object.keys(answers).length <= MAX_EXAM_QUESTIONS,'Bài làm không hợp lệ.');
      const questions=(await database.ref(`exams_private/${id}`).get()).val(); assert(Array.isArray(questions),'Không tìm thấy bộ đáp án.',404);
      const now = Date.now();
      const activeInfo = await readActiveAttempt(database, id, user.uid);
      if (!activeInfo) {
        const prev = await readUserAttemptHistory(database, id, user.uid);
        if (prev.length && prev[0].submittedAt && now - prev[0].submittedAt < 120_000) {
          return res.json({ result: prev[0].result, attemptNumber: prev[0].attemptNumber, attemptId: prev[0].attemptId, alreadySubmitted: true });
        }
        assert(false, 'Bạn chưa bắt đầu lượt thi này.', 403);
      }
      const active = activeInfo.val;
      if (now > Number(active.endsAt || 0) + SUBMISSION_GRACE_MS) {
        const finalized = await finalizeActiveIfExpired(database, id, user.uid, questions, now);
        assert(finalized?.archived, 'Đã quá hạn nộp bài và không tìm thấy bản nháp trước hạn.', 409);
        return res.json({
          result: finalized.archived.result,
          attemptNumber: finalized.archived.attemptNumber,
          attemptId: finalized.archived.attemptId,
          autoSubmitted: true,
          alreadySubmitted: true
        });
      }
      const tx = await activeInfo.ref.transaction(current => {
        if (current === null) return null;
        if (current.status !== 'active') return;
        if (now > Number(current.endsAt || 0) + SUBMISSION_GRACE_MS) return;
        return { ...current, status: 'submitting' };
      }, undefined, false);
      if (!tx.committed) {
        const finalized = await finalizeActiveIfExpired(database, id, user.uid, questions, now);
        if (finalized?.archived) {
          return res.json({ result: finalized.archived.result, attemptNumber: finalized.archived.attemptNumber, autoSubmitted: true, alreadySubmitted: true });
        }
        assert(false, 'Không thể ghi bài nộp lúc này.', 409);
      }
      const claimed = tx.snapshot.val();
      const existing = await readUserAttemptHistory(database, id, user.uid);
      const grading=gradeExam(questions,answers), submittedAt=Date.now();
      const attemptId = claimed.attemptId || active.attemptId || newId();
      const attemptNumber = existing.length + 1;
      const serverLeaveCount = normalizeLeaveScreenCount(claimed.leaveScreenCount);
      const clientLeaveCount = normalizeLeaveScreenCount(req.body.leaveScreenCount);
      const finalLeaveCount = Math.max(serverLeaveCount, clientLeaveCount);
      const violationEvents = normalizeViolationEvents(claimed.violationEvents);
      const reviewStatus = finalLeaveCount > 0 ? 'pending' : 'clean';
      const result={...grading,submittedAt,attemptNumber,attemptId};
      const record = {
        attemptId,
        attemptNumber,
        startedAt: claimed.startedAt || now,
        endsAt: claimed.endsAt || now,
        submittedAt,
        elapsedMs: Math.max(0, submittedAt - (claimed.startedAt || now)),
        status: 'submitted',
        name: claimed.name || user.name,
        leaveScreenCount: finalLeaveCount,
        violationEvents,
        flaggedForCheating: finalLeaveCount > 0,
        reviewStatus,
        result
      };
      await database.ref().update({
        [`exam_attempts/${id}/${user.uid}/${attemptId}`]: record,
        [`exam_active_attempts/${id}/${user.uid}`]: null,
        [`exam_user_slots/${id}/${user.uid}`]: {
          completedCount: attemptNumber,
          activeAttemptId: null,
          activeEndsAt: null,
          updatedAt: submittedAt
        },
        [`user_exam_ids/${user.uid}/${id}`]: submittedAt,
        ...(activeInfo.source === 'legacy' ? { [`exam_sessions/${id}/${user.uid}`]: null } : {})
      });
      await clearExamLockIfMatching(database, user.uid, id);
      const metaVal = (await database.ref(`exams_meta/${id}`).get()).val() || {};
      const maxAttempts = Number(metaVal.maxAttempts) || 0;
      return res.json({
        result,
        attemptId,
        attemptNumber,
        maxAttempts,
        canRetake: !isExamLocked(metaVal, Date.now()) && hasRemainingAttempts(maxAttempts, attemptNumber),
        questions: publicQuestions(questions),
        examTitle: metaVal.title || id,
        sourceUrl: metaVal.sourceUrl || null,
        sourceOpenUrl: metaVal.sourceOpenUrl || metaVal.sourceUrl || null,
        leaveScreenCount: finalLeaveCount,
        violationEvents,
        reviewStatus,
        alreadySubmitted: false
      });
    }
    if (action==='review') {
      assert(req.method==='GET','GET bắt buộc.');
      const id=String(req.query.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const requestedStudentUid = String(req.query.studentUid || '').trim();
      if (requestedStudentUid) {
        assert(/^[A-Za-z0-9:_-]{4,128}$/.test(requestedStudentUid), 'Mã học sinh không hợp lệ.');
      }
      const metaSnap = await database.ref(`exams_meta/${id}`).get();
      assert(metaSnap.exists(), 'Không tìm thấy đề thi.', 404);
      const meta = metaSnap.val() || {};
      const isOwner = meta.owner === user.uid;
      const targetUid = requestedStudentUid || user.uid;
      if (targetUid !== user.uid) {
        assert(isOwner, 'Chỉ người tạo đề mới có quyền xem bài làm của học sinh khác.', 403);
      }
      await finalizeActiveIfExpired(database, id, targetUid);
      const [attempts, publicSnap] = await Promise.all([
        readUserAttemptHistory(database, id, targetUid),
        database.ref(`exams_public/${id}`).get()
      ]);
      assert(attempts.length > 0, targetUid === user.uid ? 'Chưa có kết quả đã nộp cho đề này.' : 'Học sinh này chưa có bài nộp cho đề thi này.', 404);
      const maxAttempts = Number(meta.maxAttempts) || 0;
      const requestedAttemptId = String(req.query.attemptId || '').trim();
      const chosen = requestedAttemptId ? attempts.find(a => a.attemptId === requestedAttemptId) || attempts[0] : attempts[0];
      return res.json({
        examId: id,
        examTitle: meta.title || id,
        studentUid: targetUid,
        studentName: chosen.name || (targetUid === user.uid ? user.name : 'Học sinh'),
        isOwner,
        isOwnerViewing: targetUid !== user.uid,
        attemptId: chosen.attemptId,
        attemptNumber: chosen.attemptNumber,
        autoSubmitted: Boolean(chosen.autoSubmitted),
        startedAt: chosen.startedAt || 0,
        submittedAt: chosen.submittedAt || 0,
        elapsedMs: chosen.elapsedMs || Math.max(0, (chosen.submittedAt || 0) - (chosen.startedAt || 0)),
        maxAttempts,
        canRetake: targetUid === user.uid && !isExamLocked(meta, Date.now()) && hasRemainingAttempts(maxAttempts, attempts.length),
        sourceUrl: meta.sourceUrl || null,
        sourceOpenUrl: meta.sourceOpenUrl || meta.sourceUrl || null,
        leaveScreenCount: normalizeLeaveScreenCount(chosen.leaveScreenCount),
        violationEvents: normalizeViolationEvents(chosen.violationEvents),
        reviewStatus: resolveAttemptReviewStatus(chosen),
        reviewedAt: Number(chosen.reviewedAt) || 0,
        reviewNote: chosen.reviewNote || '',
        questions: Array.isArray(publicSnap.val()) ? publicSnap.val() : [],
        attempts: attempts.map((a) => ({
          attemptId: a.attemptId,
          attemptNumber: a.attemptNumber || 1,
          score: Number(a.result?.score) || 0,
          submittedAt: a.submittedAt || 0,
          autoSubmitted: Boolean(a.autoSubmitted),
          elapsedMs: a.elapsedMs || 0,
          leaveScreenCount: normalizeLeaveScreenCount(a.leaveScreenCount),
          reviewStatus: resolveAttemptReviewStatus(a)
        })),
        result: chosen.result
      });
    }
    if (action==='submissions') {
      assert(req.method==='GET','GET bắt buộc.');
      const id=String(req.query.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const metaSnap = await database.ref(`exams_meta/${id}`).get();
      assert(metaSnap.exists(), 'Không tìm thấy đề thi.', 404);
      const meta = metaSnap.val() || {};
      assert(meta.owner === user.uid, 'Chỉ người tạo đề mới có quyền xem danh sách bài làm của học sinh.', 403);
      const now = Date.now();
      await finalizeExpiredForExam(database, id, now);
      const [freshAttemptsSnap, freshLegacySnap] = await Promise.all([
        database.ref(`exam_attempts/${id}`).get(),
        database.ref(`exam_sessions/${id}`).get()
      ]);
      const summary = collectExamSubmissionRows(
        freshAttemptsSnap.val() || {},
        freshLegacySnap.val() || {},
        (Number(meta.durationMinutes) || 0) * 60_000
      );
      return res.json({
        examId: id,
        examTitle: meta.title || id,
        isLocked: isExamLocked(meta, now),
        totalSubmissions: summary.rows.length,
        uniqueStudents: summary.uniqueStudents,
        pendingCount: summary.pendingCount,
        approvedCount: summary.approvedCount,
        rejectedCount: summary.rejectedCount,
        submissions: summary.rows
      });
    }
    if (action==='moderate-attempt') {
      assert(req.method==='POST','POST bắt buộc.');
      const id=String(req.body.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const studentUid = String(req.body.studentUid || '').trim();
      assert(/^[A-Za-z0-9:_-]{4,128}$/.test(studentUid), 'Mã học sinh không hợp lệ.');
      const attemptId = String(req.body.attemptId || '').trim();
      assert(/^[A-Za-z0-9_-]{2,64}$/.test(attemptId), 'Mã lượt thi không hợp lệ.');
      const decision = String(req.body.decision || '').trim().toLowerCase();
      assert(decision === 'approved' || decision === 'rejected', 'Trạng thái duyệt phải là approved hoặc rejected.');
      const note = String(req.body.note || '').trim().slice(0, 240);

      const metaSnap = await database.ref(`exams_meta/${id}`).get();
      assert(metaSnap.exists(), 'Không tìm thấy đề thi.', 404);
      const meta = metaSnap.val() || {};
      assert(meta.owner === user.uid, 'Chỉ người tạo đề mới có quyền duyệt bài làm vi phạm.', 403);

      const now = Date.now();
      const attemptRef = database.ref(`exam_attempts/${id}/${studentUid}/${attemptId}`);
      const attemptSnap = await attemptRef.get();
      let targetRef = null;
      if (attemptSnap.exists() && attemptSnap.val()?.status === 'submitted') {
        targetRef = attemptRef;
      } else {
        const legacyRef = database.ref(`exam_sessions/${id}/${studentUid}`);
        const legacySnap = await legacyRef.get();
        const legacyVal = legacySnap.val();
        if (legacyVal && legacyVal.status === 'submitted' && (attemptId === 'legacy' || legacyVal.attemptId === attemptId)) {
          targetRef = legacyRef;
        }
      }
      assert(targetRef, 'Không tìm thấy bài nộp tương ứng để duyệt.', 404);
      await targetRef.update({
        reviewStatus: decision,
        reviewedAt: now,
        reviewedBy: user.uid,
        reviewNote: note
      });
      return res.json({
        ok: true,
        examId: id,
        studentUid,
        attemptId,
        reviewStatus: decision,
        reviewedAt: now,
        reviewNote: note
      });
    }
    if (action==='mistakes') {
      assert(req.method==='GET','GET bắt buộc.');
      const now = Date.now();
      const indexSnap = await database.ref(`user_exam_ids/${user.uid}`).get();
      let examIds = Object.keys(indexSnap.val() || {}).filter((key) => /^[A-Z0-9]{12}$/.test(key));
      if (!examIds.length) {
        // One-time lazy backfill for legacy accounts without scanning other users' attempts.
        const metaSnap = await database.ref('exams_meta').get();
        const candidateIds = Object.values(metaSnap.val() || {})
          .filter(x => x && x.id)
          .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
          .slice(0, 100)
          .map(x => x.id);
        const backfill = {};
        const discovered = [];
        await Promise.all(candidateIds.map(async (examId) => {
          const attempts = await readUserAttemptHistory(database, examId, user.uid);
          if (attempts.length) {
            discovered.push(examId);
            backfill[`user_exam_ids/${user.uid}/${examId}`] = attempts[0].submittedAt || now;
          }
        }));
        if (Object.keys(backfill).length) {
          await database.ref().update(backfill).catch(() => {});
        }
        examIds = discovered;
      }
      const mistakes=[];
      await Promise.all(examIds.slice(0, 100).map(async (examId) => {
        await finalizeActiveIfExpired(database, examId, user.uid, null, now);
        const attempts = await readUserAttemptHistory(database, examId, user.uid);
        for (const attempt of attempts) {
          for (const detail of attempt.result?.details || []) {
            if (!detail.correct) {
              mistakes.push({
                examId,
                attemptId: attempt.attemptId,
                attemptNumber: attempt.attemptNumber || 1,
                ...detail,
                submittedAt: attempt.submittedAt
              });
            }
          }
        }
      }));
      return res.json({mistakes:mistakes.sort((a,b)=>b.submittedAt-a.submittedAt).slice(0,300)});
    }
    if (action==='leaderboard') {
      assert(req.method==='GET','GET bắt buộc.');
      const id=String(req.query.id||'').toUpperCase(); assert(/^[A-Z0-9]{12}$/.test(id),'Mã đề không hợp lệ.');
      const now = Date.now();
      const metaSnap = await database.ref(`exams_meta/${id}`).get();
      const meta = metaSnap.val() || {};
      const isOwner = meta.owner === user.uid;
      await finalizeExpiredForExam(database, id, now);
      const [freshAttemptsSnap, freshLegacySnap] = await Promise.all([
        database.ref(`exam_attempts/${id}`).get(),
        database.ref(`exam_sessions/${id}`).get()
      ]);
      const attemptsByUid = freshAttemptsSnap.val() || {};
      const legacyByUid = freshLegacySnap.val() || {};
      const maxDurationMs = (Number(meta.durationMinutes) || 0) * 60_000;
      const ranking = aggregateExamLeaderboard({
        attemptsByUid,
        legacyByUid,
        maxDurationMs
      });
      const myAttempts = collectUserAttempts(attemptsByUid?.[user.uid], legacyByUid?.[user.uid]);
      const myModerationStatus = summarizeUserModerationStatus(myAttempts);
      let pendingCount = 0;
      if (isOwner) {
        pendingCount = collectExamSubmissionRows(attemptsByUid, legacyByUid, maxDurationMs).pendingCount;
      }
      return res.json({
        examTitle: meta.title || id,
        isLocked: isExamLocked(meta, now),
        deadlineAt: meta.deadlineAt || null,
        isOwner,
        ...(isOwner ? { pendingCount } : {}),
        myModerationStatus,
        ranking: ranking.slice(0, 50)
      });
    }
    assert(false,'Action không được hỗ trợ.',404);
  } catch(err){return fail(res,err);}
}
