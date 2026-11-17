import { identity, fail, assert } from '../lib/exam-server.js';
import { rtdbGet, rtdbPut, rtdbTransaction, abortTx } from '../lib/rtdb-rest.js';
import {
  MAX_PLAYERS,
  MAX_HUNDRED_PLAYERS,
  INITIAL_HP,
  ROUND_MS,
  HUNDRED_ROUND_MS,
  BETWEEN_ROUNDS_MS,
  ARENA_SUBJECTS,
  damageFor,
  publicRoom,
  publicHundredRoom,
  finalizeHundredRound,
  isArenaAnswerCorrect,
  isValidQuestion,
  isValidHundredQuestion,
  winner,
  safeCode
} from '../shared/arena-core.js';
import { randomBytes } from 'node:crypto';

const delayReason = 'Lượt trả lời đã đóng hoặc câu hỏi không hợp lệ.';

function sanitizeMetaTitle(value, fallback) {
  const s = String(value || '').trim().slice(0, 120);
  return s || fallback;
}

function sanitizeSubject(value) {
  const s = String(value || '').trim().slice(0, 40);
  return ARENA_SUBJECTS.includes(s) ? s : (s || 'Tổng hợp');
}

function finishBattle(room, now) {
  room.status = 'FINISHED';
  room.finishedAt = now;
  room.roundEndsAt = 0;
  room.winnerUid = winner(room.players || {});
}

function advanceBattle(room, now) {
  if (room.status !== 'PLAYING') return;
  if (room.roundEndsAt > now) return;
  if (room.round >= room.questions.length || Object.values(room.players || {}).filter((p) => p.hp > 0).length <= 1) {
    finishBattle(room, now);
    return;
  }
  room.round++;
  room.roundStartedAt = now;
  room.roundEndsAt = now + ROUND_MS;
}

function validateBattleQuestions(questions) {
  assert(Array.isArray(questions) && questions.length >= 2 && questions.length <= 20, 'Cần từ 2 đến 20 câu hỏi.');
  assert(questions.every(isValidQuestion), 'Câu hỏi không hợp lệ (ít nhất 4 ký tự, 4 đáp án A–D).');
  return questions.map((q) => ({
    prompt: q.prompt.trim(),
    options: q.options.map((s) => s.trim()),
    answer: q.answer,
    topic: String(q.topic || 'Tổng hợp').trim(),
    level: q.level || 'Thông hiểu'
  }));
}

function validateHundredQuestions(questions) {
  assert(Array.isArray(questions) && questions.length >= 1 && questions.length <= 40, 'Cần từ 1 đến 40 câu hỏi cho Đấu trường 100.');
  assert(questions.every(isValidHundredQuestion), 'Câu hỏi không hợp lệ (trắc nghiệm 4 lựa chọn A–D hoặc đáp án ngắn).');
  return questions.map((q) => q.kind === 'short'
    ? {
        kind: 'short',
        prompt: q.prompt.trim(),
        answer: String(q.answer).trim(),
        acceptedAnswers: Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length
          ? q.acceptedAnswers.map((a) => String(a).trim()).filter(Boolean).slice(0, 8)
          : [String(q.answer).trim()],
        topic: String(q.topic || 'Tổng hợp').trim()
      }
    : {
        kind: 'mcq',
        prompt: q.prompt.trim(),
        options: q.options.map((s) => s.trim()),
        answer: String(q.answer).trim().toUpperCase(),
        topic: String(q.topic || 'Tổng hợp').trim()
      }
  );
}

function makeRoomPath(code) {
  assert(safeCode(code), 'Mã phòng gồm 8 chữ/số in hoa.');
  return `arena_rooms/${code}`;
}

function ensureMember(room, uid) {
  assert(room && room.players?.[uid], 'Bạn chưa tham gia phòng đấu này.', 403);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const method = req.method;
    assert(['POST', 'GET'].includes(method), 'HTTP method không được hỗ trợ.', 405);
    const id = await identity(req);
    const data = method === 'GET' ? req.query : (req.body || {});
    const action = String(data.action || '');
    assert(JSON.stringify(data).length <= 64000, 'Yêu cầu quá lớn.', 413);

    // =====================================================
    // TEACHER QUICK-QUIZ DECKS (MULTI-SUBJECT)
    // =====================================================
    if (action === 'deck-list') {
      assert(method === 'GET', 'Yêu cầu GET.', 405);
      const raw = (await rtdbGet('arena_decks')) || {};
      const decks = Object.values(raw)
        .filter((d) => d && d.id)
        .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
        .slice(0, 50)
        .map((d) => ({
          id: d.id,
          title: d.title,
          subject: d.subject || 'Tổng hợp',
          ownerUid: d.ownerUid,
          ownerName: d.ownerName || 'Giáo viên',
          isOwner: d.ownerUid === id.uid,
          questionCount: Array.isArray(d.questions) ? d.questions.length : 0,
          questions: d.questions || [],
          createdAt: d.createdAt || 0
        }));
      return res.json({ decks });
    }

    if (action === 'deck-create') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const title = sanitizeMetaTitle(data.title, 'Bộ đề học nhanh');
      const subject = sanitizeSubject(data.subject);
      const questions = validateHundredQuestions(data.questions);
      const deckId = randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
      const deck = {
        id: deckId,
        title,
        subject,
        ownerUid: id.uid,
        ownerName: id.name,
        createdAt: Date.now(),
        questions
      };
      await rtdbPut(`arena_decks/${deckId}`, deck);
      return res.status(201).json({ deck: { ...deck, isOwner: true, questionCount: questions.length } });
    }

    if (action === 'deck-delete') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const deckId = String(data.deckId || '').trim().toUpperCase();
      assert(safeCode(deckId), 'Mã bộ đề không hợp lệ.');
      const cur = await rtdbGet(`arena_decks/${deckId}`);
      assert(cur, 'Không tìm thấy bộ đề.', 404);
      assert(cur.ownerUid === id.uid, 'Chỉ người tạo mới có quyền xóa bộ đề này.', 403);
      await rtdbPut(`arena_decks/${deckId}`, null);
      return res.json({ deleted: true, deckId });
    }

    // =====================================================
    // MODE 1: BATTLE 2–8 PLAYERS (200 HP, MULTI-SUBJECT)
    // =====================================================
    if (action === 'create') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const questions = validateBattleQuestions(data.questions);
      const code = randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
      const now = Date.now();
      const room = {
        id: code,
        mode: 'battle',
        title: sanitizeMetaTitle(data.title, 'Đấu trường Đối kháng'),
        subject: sanitizeSubject(data.subject),
        hostUid: id.uid,
        createdAt: now,
        status: 'LOBBY',
        round: 0,
        players: { [id.uid]: { name: id.name, hp: INITIAL_HP, score: 0, joinedAt: now } },
        questions,
        events: {}
      };
      await rtdbTransaction(makeRoomPath(code), (cur) => {
        if (cur !== null) return abortTx('Mã phòng trùng ngẫu nhiên, hãy bấm tạo lại.', 409);
        return room;
      });
      return res.status(201).json({ room: publicRoom(room, now) });
    }

    if (action === 'join') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const code = String(data.code || '').trim().toUpperCase();
      const path = makeRoomPath(code);
      const now = Date.now();
      const resTx = await rtdbTransaction(path, (room) => {
        if (!room) return abortTx('Không tìm thấy phòng với mã này.', 404);
        if (room.mode === 'hundred') return abortTx('Mã này thuộc phòng Đấu trường 100 — hãy mở mục Đấu trường 100 để tham gia.', 400);
        if (room.players?.[id.uid]) return room;
        if (room.status !== 'LOBBY') return abortTx('Trận đấu đã bắt đầu.', 409);
        if (Object.keys(room.players || {}).length >= MAX_PLAYERS) return abortTx('Phòng đã đủ 8 người.', 409);
        room.players = room.players || {};
        room.players[id.uid] = { name: id.name, hp: INITIAL_HP, score: 0, joinedAt: now };
        return room;
      });
      return res.json({ room: publicRoom(resTx.val, Date.now()) });
    }

    if (action === 'state') {
      assert(method === 'GET', 'Yêu cầu GET.', 405);
      const code = String(data.code || '').trim().toUpperCase();
      const path = makeRoomPath(code);
      let room = await rtdbGet(path);
      ensureMember(room, id.uid);
      const now = Date.now();
      if (room.status === 'PLAYING' && now >= room.roundEndsAt) {
        const updated = await rtdbTransaction(path, (cur) => {
          if (!cur || cur.status !== 'PLAYING') return undefined;
          advanceBattle(cur, Date.now());
          return cur;
        });
        if (updated.committed && updated.val) room = updated.val;
      }
      const response = publicRoom(room, Date.now());
      response.myAnswered = Boolean(room.answers?.[room.round]?.[id.uid]);
      return res.json({ room: response });
    }

    if (action === 'start') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const code = String(data.code || '').trim().toUpperCase();
      const path = makeRoomPath(code);
      const resTx = await rtdbTransaction(path, (room) => {
        if (!room) return abortTx('Không tìm thấy phòng.', 404);
        if (room.hostUid !== id.uid) return abortTx('Chỉ chủ phòng được bắt đầu.', 403);
        if (room.status !== 'LOBBY') return abortTx('Trận đấu đã bắt đầu.', 409);
        if (Object.keys(room.players || {}).length < 2) return abortTx('Cần ít nhất 2 người chơi trong phòng.', 409);
        const now = Date.now();
        room.status = 'PLAYING';
        room.round = 1;
        room.roundStartedAt = now;
        room.roundEndsAt = now + ROUND_MS;
        return room;
      });
      return res.json({ room: publicRoom(resTx.val, Date.now()) });
    }

    if (action === 'answer') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const code = String(data.code || '').trim().toUpperCase();
      const path = makeRoomPath(code);
      const chosen = String(data.answer || '').toUpperCase();
      assert(/^[ABCD]$/.test(chosen), 'Chọn A/B/C/D.');
      const resTx = await rtdbTransaction(path, (room) => {
        if (!room) return abortTx('Không tìm thấy phòng.', 404);
        if (!room.players?.[id.uid]) return abortTx('Không thuộc phòng.', 403);
        if (room.status !== 'PLAYING' || room.round !== Number(data.round)) return abortTx(delayReason, 409);
        const now = Date.now();
        if (now >= room.roundEndsAt || now < room.roundStartedAt) return abortTx(delayReason, 409);
        if (room.players[id.uid].hp <= 0) return abortTx('Bạn đã hết HP.', 409);
        room.answers ||= {};
        room.answers[room.round] ||= {};
        if (room.answers[room.round][id.uid]) return abortTx('Bạn đã trả lời lượt này.', 409);
        const q = room.questions[room.round - 1];
        const isCorrect = chosen === q.answer;
        const dmg = isCorrect ? damageFor(now - room.roundStartedAt) : 0;
        room.answers[room.round][id.uid] = { chosen, correct: isCorrect, at: now };
        if (isCorrect) {
          const targets = Object.keys(room.players).filter((uid) => uid !== id.uid && room.players[uid].hp > 0);
          const target = targets.sort((a, b) => room.players[b].hp - room.players[a].hp || a.localeCompare(b))[0];
          if (target) {
            room.players[target].hp = Math.max(0, room.players[target].hp - dmg);
            room.players[id.uid].score += dmg;
          }
          room.events ||= {};
          room.events[`${room.round}_${id.uid}`] = { by: id.uid, target: target || null, damage: target ? dmg : 0, at: now };
        }
        const eligible = Object.keys(room.players).filter((uid) => room.players[uid].hp > 0);
        if (eligible.length <= 1) finishBattle(room, now);
        else if (eligible.every((uid) => room.answers[room.round][uid])) {
          room.roundEndsAt = Math.min(room.roundEndsAt, now + BETWEEN_ROUNDS_MS);
        }
        return room;
      });
      const committed = resTx.val;
      const entry = committed.answers?.[Number(data.round)]?.[id.uid];
      return res.json({
        accepted: !!entry,
        correct: entry?.correct ?? false,
        damage: entry?.correct ? committed.events?.[`${data.round}_${id.uid}`]?.damage || 0 : 0,
        room: publicRoom(committed, Date.now())
      });
    }

    if (action === 'leave') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const code = String(data.code || '').trim().toUpperCase();
      const path = makeRoomPath(code);
      await rtdbTransaction(path, (room) => {
        if (!room || !room.players?.[id.uid]) return abortTx('Không thuộc phòng.', 403);
        if (room.status === 'LOBBY') {
          delete room.players[id.uid];
          if (!Object.keys(room.players).length) return null;
          if (room.hostUid === id.uid) {
            room.hostUid = Object.keys(room.players).sort((a, b) => room.players[a].joinedAt - room.players[b].joinedAt)[0];
          }
        } else if (room.status === 'PLAYING') {
          room.players[id.uid].hp = 0;
          if (Object.values(room.players).filter((p) => p.hp > 0).length <= 1) finishBattle(room, Date.now());
        }
        return room;
      });
      return res.json({ ok: true });
    }

    // =====================================================
    // MODE 2: ĐẤU TRƯỜNG 100 (QR CODE + ELIMINATION)
    // =====================================================
    if (action === 'h100-create') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const questions = validateHundredQuestions(data.questions);
      const hostPlays = Boolean(data.hostPlays);
      const code = randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
      const now = Date.now();
      const room = {
        id: code,
        mode: 'hundred',
        title: sanitizeMetaTitle(data.title, 'Đấu trường 100'),
        subject: sanitizeSubject(data.subject),
        hostUid: id.uid,
        hostName: id.name,
        createdAt: now,
        status: 'LOBBY',
        round: 0,
        players: hostPlays ? { [id.uid]: { name: id.name, alive: true, correctCount: 0, totalResponseMs: 0, joinedAt: now } } : {},
        questions,
        answers: {}
      };
      await rtdbTransaction(makeRoomPath(code), (cur) => {
        if (cur !== null) return abortTx('Mã phòng trùng ngẫu nhiên, hãy tạo lại.', 409);
        return room;
      });
      return res.status(201).json({ room: publicHundredRoom(room, now) });
    }

    if (action === 'h100-join') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const code = String(data.code || '').trim().toUpperCase();
      const path = makeRoomPath(code);
      const now = Date.now();
      const resTx = await rtdbTransaction(path, (room) => {
        if (!room) return abortTx('Không tìm thấy phòng Đấu trường 100.', 404);
        if (room.mode !== 'hundred') return abortTx('Mã này không phải phòng Đấu trường 100.', 400);
        if (room.players?.[id.uid]) return room;
        if (room.status !== 'LOBBY') return abortTx('Đấu trường 100 đã bắt đầu.', 409);
        if (Object.keys(room.players || {}).length >= MAX_HUNDRED_PLAYERS) return abortTx(`Phòng đã đủ ${MAX_HUNDRED_PLAYERS} người.`, 409);
        room.players = room.players || {};
        room.players[id.uid] = { name: id.name, alive: true, correctCount: 0, totalResponseMs: 0, joinedAt: now };
        return room;
      });
      return res.json({ room: publicHundredRoom(resTx.val, Date.now()) });
    }

    if (action === 'h100-state') {
      assert(method === 'GET', 'Yêu cầu GET.', 405);
      const code = String(data.code || '').trim().toUpperCase();
      const path = makeRoomPath(code);
      let room = await rtdbGet(path);
      assert(room && (room.hostUid === id.uid || room.players?.[id.uid]), 'Bạn không thuộc phòng Đấu trường 100 này.', 403);
      const now = Date.now();
      if (room.status === 'PLAYING' && now >= Number(room.roundEndsAt || 0)) {
        const updated = await rtdbTransaction(path, (cur) => {
          if (!cur || cur.status !== 'PLAYING' || Date.now() < Number(cur.roundEndsAt || 0)) return undefined;
          return finalizeHundredRound(cur, Date.now());
        });
        if (updated.committed && updated.val) room = updated.val;
      }
      const pub = publicHundredRoom(room, Date.now());
      pub.myAnswered = Boolean(room.answers?.[room.round]?.[id.uid]);
      pub.myAnswer = room.answers?.[room.round]?.[id.uid] || null;
      return res.json({ room: pub });
    }

    if (action === 'h100-start') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const code = String(data.code || '').trim().toUpperCase();
      const resTx = await rtdbTransaction(makeRoomPath(code), (room) => {
        if (!room) return abortTx('Không tìm thấy phòng.', 404);
        if (room.hostUid !== id.uid) return abortTx('Chỉ chủ phòng được bắt đầu.', 403);
        if (room.status !== 'LOBBY') return abortTx('Trận đấu đã bắt đầu.', 409);
        if (Object.keys(room.players || {}).length < 1) return abortTx('Cần ít nhất 1 thí sinh trong sảnh để bắt đầu.', 409);
        const now = Date.now();
        room.status = 'PLAYING';
        room.round = 1;
        room.roundStartedAt = now;
        room.roundEndsAt = now + HUNDRED_ROUND_MS;
        return room;
      });
      return res.json({ room: publicHundredRoom(resTx.val, Date.now()) });
    }

    if (action === 'h100-next') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const code = String(data.code || '').trim().toUpperCase();
      const resTx = await rtdbTransaction(makeRoomPath(code), (room) => {
        if (!room) return abortTx('Không tìm thấy phòng.', 404);
        if (room.hostUid !== id.uid) return abortTx('Chỉ chủ phòng được chuyển câu.', 403);
        const now = Date.now();
        if (room.status === 'PLAYING') {
          finalizeHundredRound(room, now);
          if (room.status === 'FINISHED') return room;
        }
        if (room.status !== 'ROUND_REVIEW') return abortTx('Không thể chuyển câu ở trạng thái hiện tại.', 409);
        room.round += 1;
        room.status = 'PLAYING';
        room.roundStartedAt = now;
        room.roundEndsAt = now + HUNDRED_ROUND_MS;
        return room;
      });
      return res.json({ room: publicHundredRoom(resTx.val, Date.now()) });
    }

    if (action === 'h100-answer') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const code = String(data.code || '').trim().toUpperCase();
      const submitted = String(data.answer || '').trim();
      assert(submitted.length > 0 && submitted.length <= 200, 'Hãy chọn hoặc nhập đáp án hợp lệ.');
      const resTx = await rtdbTransaction(makeRoomPath(code), (room) => {
        if (!room) return abortTx('Không tìm thấy phòng.', 404);
        const player = room.players?.[id.uid];
        if (!player) return abortTx('Không thuộc phòng.', 403);
        if (player.alive === false) return abortTx('Bạn đã bị loại ở câu trước, hiện đang ở chế độ khán giả.', 403);
        if (room.status !== 'PLAYING' || room.round !== Number(data.round)) return abortTx(delayReason, 409);
        const now = Date.now();
        if (now >= Number(room.roundEndsAt || 0) || now < Number(room.roundStartedAt || 0)) return abortTx('Đã hết thời gian câu này.', 409);
        room.answers ||= {};
        room.answers[room.round] ||= {};
        if (room.answers[room.round][id.uid]) return abortTx('Bạn đã gửi đáp án cho câu này.', 409);
        const q = room.questions[room.round - 1];
        const correct = isArenaAnswerCorrect(q, submitted);
        const responseMs = Math.max(0, now - Number(room.roundStartedAt || now));
        room.answers[room.round][id.uid] = {
          chosen: submitted.slice(0, 160),
          correct,
          at: now
        };
        if (correct) {
          player.correctCount = (player.correctCount || 0) + 1;
          player.totalResponseMs = (player.totalResponseMs || 0) + responseMs;
        }
        const aliveUids = Object.keys(room.players).filter((u) => room.players[u]?.alive !== false);
        if (aliveUids.length && aliveUids.every((u) => room.answers[room.round][u])) {
          finalizeHundredRound(room, now);
        }
        return room;
      });
      const committed = resTx.val;
      const entry = committed.answers?.[Number(data.round)]?.[id.uid];
      return res.json({
        accepted: Boolean(entry),
        correct: Boolean(entry?.correct),
        room: publicHundredRoom(committed, Date.now())
      });
    }

    if (action === 'h100-leave') {
      assert(method === 'POST', 'Yêu cầu POST.', 405);
      const code = String(data.code || '').trim().toUpperCase();
      await rtdbTransaction(makeRoomPath(code), (room) => {
        if (!room) return undefined;
        if (room.status === 'LOBBY' && room.players?.[id.uid]) {
          delete room.players[id.uid];
        } else if (room.players?.[id.uid] && room.status === 'PLAYING') {
          room.players[id.uid].alive = false;
          room.players[id.uid].eliminatedRound = room.round;
        }
        return room;
      });
      return res.json({ ok: true });
    }

    throw Object.assign(new Error('Hành động không được hỗ trợ.'), { status: 404 });
  } catch (error) {
    return fail(res, error);
  }
}
