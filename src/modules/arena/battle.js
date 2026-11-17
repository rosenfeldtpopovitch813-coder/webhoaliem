import QRCode from 'qrcode';
import { element, button } from '../../core/dom.js';
import { auth } from '../../core/firebase.js';
import { ARENA_SUBJECTS, INITIAL_HP, damageFor } from '../../../shared/arena-core.js';

export function renderBattleMode(host, { apiCall, availableDecks = [], initialCode = '', onBack = null } = {}) {
  let pollInterval = null;
  let botTimer = null;
  let activeCode = null;
  let seqId = 0;
  let answerSent = false;
  let selectedLetter = null;
  let lastRoundSeen = 0;

  const stop = () => {
    if (pollInterval) clearInterval(pollInterval);
    if (botTimer) clearInterval(botTimer);
    pollInterval = null;
    botTimer = null;
    activeCode = null;
    answerSent = false;
    selectedLetter = null;
    lastRoundSeen = 0;
    seqId++;
  };

  const buildShell = (title) => {
    const wrap = element('section', 'arena-mode-wrap');
    const head = element('div', 'arena-mode-head');
    head.append(element('h3', 'exam-heading', title));
    if (onBack) head.append(button('← Hub Arena', 'exam-tab', () => { stop(); onBack(); }));
    const tabs = element('div', 'exam-tabs');
    const content = element('div', 'arena-mode-body');
    wrap.append(head, tabs, content);
    host.replaceChildren(wrap);
    return { wrap, tabs, content };
  };

  const { tabs, content } = buildShell('Đối kháng 200 HP (Online đa người & Offline Bot)');
  const tabBot = button('Đấu Bot Offline (Vào ngay)', 'exam-tab', () => showBotSetup());
  const tabJoin = button('Vào phòng Online (Mã / QR)', 'exam-tab', () => showJoin());
  const tabCreate = button('Tạo phòng Online (2–8 người)', 'exam-tab', () => showCreate());
  const tabRules = button('Luật chơi', 'exam-tab', () => showRules());
  tabs.append(tabJoin, tabCreate, tabBot, tabRules);

  function markTab(btn) {
    for (const c of tabs.children) c.classList.toggle('selected', c === btn);
  }

  function showRules() {
    stop();
    markTab(tabRules);
    const card = element('section', 'exam-panel');
    card.append(
      element('h4', '', 'Luật chơi Đối kháng 200 HP'),
      element('p', 'exam-message', 'Mỗi người chơi bắt đầu với 200 HP. Mỗi vòng kéo dài 20 giây: trả lời đúng càng nhanh, sát thương gây lên đối thủ còn nhiều HP nhất càng lớn (tối đa 45 sát thương/lượt). Trận kết thúc khi hết bộ câu hỏi hoặc chỉ còn 1 người còn HP > 0.')
    );
    content.replaceChildren(card);
  }

  // =========================================================
  // OFFLINE MODE: SOLO VS ADAPTIVE BOT (NO LOGIN NEEDED)
  // =========================================================
  function showBotSetup() {
    stop();
    markTab(tabBot);
    const p = element('section', 'exam-panel');
    const mcqsDecks = availableDecks.filter((d) => (d.questions || []).filter((q) => q.kind !== 'short').length >= 2);
    const deckSel = document.createElement('select');
    deckSel.className = 'exam-input';
    for (const d of mcqsDecks) {
      const o = element('option', '', `[${d.subject}] ${d.title}`);
      o.value = d.id;
      deckSel.append(o);
    }
    const diffSel = document.createElement('select');
    diffSel.className = 'exam-input';
    for (const [val, lbl] of [['normal', 'Bot Cơ bản (chính xác 65%)'], ['hard', 'Bot Nâng cao (chính xác 85%, phản xạ nhanh)']]) {
      const o = element('option', '', lbl);
      o.value = val;
      diffSel.append(o);
    }
    p.append(
      element('p', 'exam-message', 'Luyện đối kháng tốc độ 1v1 với máy ngay lập tức, không cần đăng nhập hay chờ người khác.'),
      deckSel,
      diffSel,
      button('Bắt đầu đấu với Bot →', 'primary-btn', () => {
        const deck = mcqsDecks.find((d) => d.id === deckSel.value) || mcqsDecks[0];
        if (deck) runBotMatch(deck, diffSel.value);
      })
    );
    content.replaceChildren(p);
  }

  function runBotMatch(deck, difficulty) {
    stop();
    markTab(tabBot);
    const questions = (deck.questions || []).filter((q) => q.kind !== 'short').slice(0, 15);
    let round = 0;
    let playerHp = INITIAL_HP;
    let botHp = INITIAL_HP;
    let playerScore = 0;
    let botScore = 0;
    const logs = [];

    const board = element('section', 'exam-panel');
    content.replaceChildren(board);

    const drawNext = () => {
      if (!board.isConnected) { stop(); return; }
      if (round >= questions.length || playerHp <= 0 || botHp <= 0) {
        const winText = playerHp > botHp || (playerHp === botHp && playerScore >= botScore)
          ? 'BẠN ĐÃ CHIẾN THẮNG BOT!'
          : 'BOT THẮNG VÁN NÀY!';
        board.replaceChildren(
          element('h3', 'exam-heading', winText),
          element('p', 'exam-message', `HP cuối: Bạn ${playerHp} HP (${playerScore} dmg) · Bot ${botHp} HP (${botScore} dmg)`),
          button('Đấu ván mới', 'primary-btn', () => runBotMatch(deck, difficulty)),
          button('Chọn đề khác', 'exam-tab', () => showBotSetup())
        );
        return;
      }

      const q = questions[round];
      const roundStart = performance.now();
      let remain = 20;
      let resolved = false;

      const statusGrid = element('div', 'arena-players');
      const pCard = element('article', 'arena-player');
      pCard.append(element('strong', '', 'Bạn (Offline)'), element('span', '', `${playerHp} / 200 HP · ${playerScore} sát thương`));
      const pBar = element('div', 'arena-hp');
      const pFill = element('div', 'arena-hp-fill');
      pFill.style.width = `${playerHp / 2}%`;
      pBar.append(pFill);
      pCard.append(pBar);

      const bCard = element('article', 'arena-player');
      bCard.append(element('strong', '', `AI Bot (${difficulty === 'hard' ? 'Khó' : 'Thường'})`), element('span', '', `${botHp} / 200 HP · ${botScore} sát thương`));
      const bBar = element('div', 'arena-hp');
      const bFill = element('div', 'arena-hp-fill');
      bFill.style.width = `${botHp / 2}%`;
      bBar.append(bFill);
      bCard.append(bBar);
      statusGrid.append(pCard, bCard);

      const clockLine = element('p', 'exam-message', `Vòng ${round + 1}/${questions.length} · Còn 20s`);
      const promptEl = element('h4', 'exam-heading', q.prompt);
      const opts = element('div', 'exam-options');
      const feedback = element('p', 'exam-message', '');

      const finishRound = (chosenLetter) => {
        if (resolved) return;
        resolved = true;
        if (botTimer) clearInterval(botTimer);
        botTimer = null;
        for (const el of opts.children) el.disabled = true;

        const elapsed = performance.now() - roundStart;
        const pOk = chosenLetter === q.answer;
        const pDmg = pOk ? damageFor(Math.min(20000, elapsed)) : 0;
        if (pDmg > 0) {
          botHp = Math.max(0, botHp - pDmg);
          playerScore += pDmg;
        }

        const botAccuracy = difficulty === 'hard' ? 0.85 : 0.65;
        const botOk = Math.random() < botAccuracy;
        const botSpeedMs = difficulty === 'hard' ? (2500 + Math.random() * 5500) : (5000 + Math.random() * 9000);
        const bDmg = botOk ? damageFor(botSpeedMs) : 0;
        if (bDmg > 0) {
          playerHp = Math.max(0, playerHp - bDmg);
          botScore += bDmg;
        }

        if (chosenLetter) {
          const ci = 'ABCD'.indexOf(chosenLetter);
          if (opts.children[ci]) opts.children[ci].classList.add(pOk ? 'is-correct' : 'is-wrong');
        }
        const ri = 'ABCD'.indexOf(q.answer);
        if (opts.children[ri]) opts.children[ri].classList.add('is-correct');

        feedback.textContent = `${pOk ? `✓ Bạn gây ${pDmg} sát thương!` : `✗ Đáp án đúng là ${q.answer}.`} · ${botOk ? `Bot đánh trả ${bDmg} sát thương` : 'Bot trả lời sai!'}`;
        logs.unshift(`Vòng ${round + 1}: Bạn ${pOk ? `+${pDmg}dmg` : 'trượt'} | Bot ${botOk ? `+${bDmg}dmg` : 'trượt'}`);

        setTimeout(() => {
          round++;
          drawNext();
        }, 1250);
      };

      q.options.forEach((optText, i) => {
        const l = 'ABCD'[i];
        opts.append(button(`${l}. ${optText}`, 'exam-option', () => finishRound(l)));
      });

      const logEl = element('div', 'arena-log');
      for (const line of logs.slice(0, 4)) logEl.append(element('p', '', line));

      board.replaceChildren(statusGrid, clockLine, promptEl, opts, feedback, logEl);

      botTimer = setInterval(() => {
        if (!board.isConnected) { stop(); return; }
        remain--;
        clockLine.textContent = `Vòng ${round + 1}/${questions.length} · Còn ${Math.max(0, remain)}s`;
        if (remain <= 0) finishRound(null);
      }, 1000);
    };

    drawNext();
  }

  // =========================================================
  // ONLINE MODE: FIXED RTDB REST TRANSACTION + QR INVITE
  // =========================================================
  function showJoin(prefill = initialCode) {
    stop();
    markTab(tabJoin);
    const p = element('section', 'exam-panel');
    const codeIn = Object.assign(document.createElement('input'), {
      className: 'exam-input',
      placeholder: 'Nhập mã phòng 8 ký tự (VD: A1B2C3D4)',
      maxLength: 8,
      value: String(prefill || '').toUpperCase()
    });
    const msg = element('p', 'exam-message', auth?.currentUser ? 'Nhập mã phòng từ người tạo hoặc quét QR để vào thẳng.' : 'Hãy đăng nhập Google để tham gia phòng Online.');
    const joinBtn = button('Vào phòng đấu', 'primary-btn', async () => {
      const code = codeIn.value.trim().toUpperCase();
      if (!code) { msg.textContent = 'Hãy nhập mã phòng.'; return; }
      joinBtn.disabled = true;
      msg.textContent = 'Đang kết nối phòng…';
      try {
        const res = await apiCall('join', { code });
        enterRoom(res.room.id, res.room);
      } catch (e) {
        msg.textContent = e.message;
        joinBtn.disabled = false;
      }
    });
    p.append(element('h4', '', 'Tham gia phòng Đối kháng Online'), codeIn, joinBtn, msg);
    content.replaceChildren(p);

    if (prefill && auth?.currentUser) {
      joinBtn.click();
    }
  }

  function showCreate() {
    stop();
    markTab(tabCreate);
    const p = element('section', 'exam-panel');
    const mcqsDecks = availableDecks.filter((d) => (d.questions || []).filter((q) => q.kind !== 'short').length >= 2);
    const deckSel = document.createElement('select');
    deckSel.className = 'exam-input';
    for (const d of mcqsDecks) {
      const o = element('option', '', `[${d.subject}] ${d.title}`);
      o.value = d.id;
      deckSel.append(o);
    }

    const titleIn = Object.assign(document.createElement('input'), {
      className: 'exam-input',
      placeholder: 'Tên phòng thi đấu',
      value: mcqsDecks[0]?.title || 'Đấu trường Đối kháng'
    });
    const subjectSel = document.createElement('select');
    subjectSel.className = 'exam-input';
    for (const s of ARENA_SUBJECTS) {
      const o = element('option', '', s);
      o.value = s;
      subjectSel.append(o);
    }

    let questions = (mcqsDecks[0]?.questions || []).filter((q) => q.kind !== 'short').slice(0, 20).map((q) => ({ ...q, options: [...q.options] }));
    const list = element('div', 'exam-editor');

    const loadDeck = () => {
      const d = mcqsDecks.find((x) => x.id === deckSel.value);
      if (!d) return;
      titleIn.value = d.title;
      subjectSel.value = ARENA_SUBJECTS.includes(d.subject) ? d.subject : 'Tổng hợp';
      questions = (d.questions || []).filter((q) => q.kind !== 'short').slice(0, 20).map((q) => ({ ...q, options: [...q.options] }));
      renderEditor();
    };
    deckSel.onchange = loadDeck;

    const renderEditor = () => {
      list.replaceChildren();
      questions.forEach((q, i) => {
        const card = element('section', 'exam-question');
        card.append(element('h4', '', `Câu ${i + 1}`));
        const pr = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: 'Nội dung câu hỏi', value: q.prompt });
        pr.oninput = () => { q.prompt = pr.value; };
        card.append(pr);
        for (let j = 0; j < 4; j++) {
          const inp = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: `Đáp án ${'ABCD'[j]}`, value: q.options[j] || '' });
          inp.oninput = () => { q.options[j] = inp.value; };
          card.append(inp);
        }
        const row = element('div', 'exam-tabs');
        const ans = document.createElement('select');
        ans.className = 'exam-input';
        for (const l of 'ABCD') {
          const o = element('option', '', `Đáp án ${l}`);
          o.value = l;
          ans.append(o);
        }
        ans.value = q.answer;
        ans.onchange = () => { q.answer = ans.value; };
        row.append(ans, button('Xóa', 'exam-tab', () => { questions.splice(i, 1); renderEditor(); }));
        card.append(row);
        list.append(card);
      });
    };

    const status = element('p', 'exam-message', 'Chọn nhanh bộ đề có sẵn/do giáo viên giao ở trên hoặc tự thêm từ 2–20 câu.');
    const createBtn = button('Tạo phòng Online (tối đa 8 người)', 'primary-btn', async () => {
      createBtn.disabled = true;
      status.textContent = 'Đang tạo phòng…';
      try {
        const res = await apiCall('create', { title: titleIn.value, subject: subjectSel.value, questions });
        enterRoom(res.room.id, res.room);
      } catch (e) {
        status.textContent = e.message;
        createBtn.disabled = false;
      }
    });

    p.append(
      element('label', 'exam-label', 'Chọn bộ câu hỏi mẫu / đề giáo viên giao'),
      deckSel,
      titleIn,
      subjectSel,
      status,
      button('+ Thêm câu hỏi', 'exam-tab', () => {
        questions.push({ topic: subjectSel.value, level: 'Thông hiểu', prompt: '', options: ['', '', '', ''], answer: 'A' });
        renderEditor();
      }),
      list,
      createBtn
    );
    content.replaceChildren(p);
    renderEditor();
  }

  function enterRoom(code, initialRoom = null) {
    stop();
    activeCode = code;
    const seq = seqId;
    const wrap = element('section', 'exam-panel');
    const inviteRow = element('div', 'arena-qr-invite');
    const qrImg = document.createElement('img');
    qrImg.className = 'arena-qr-img';
    qrImg.alt = `Mã QR phòng ${code}`;
    const inviteUrl = `${window.location.origin}/arena?mode=battle&code=${code}`;
    QRCode.toDataURL(inviteUrl, { width: 168, margin: 1 }).then((url) => { qrImg.src = url; }).catch(() => {});

    const inviteMeta = element('div', 'arena-invite-meta');
    const notice = element('p', 'exam-message', 'Đang đồng bộ phòng…');
    inviteMeta.append(
      element('h3', 'exam-heading', `Phòng Đối kháng · ${code}`),
      element('p', '', `Chia sẻ mã ${code} hoặc quét QR để bạn bè vào phòng.`),
      (() => {
        const r = element('div', 'exam-tabs');
        r.append(
          button('Sao chép mã phòng', 'exam-tab', () => navigator.clipboard?.writeText(code).then(() => { notice.textContent = 'Đã sao chép mã phòng.'; })),
          button('Sao chép link mời', 'exam-tab', () => navigator.clipboard?.writeText(inviteUrl).then(() => { notice.textContent = 'Đã sao chép link mời trực tiếp.'; })),
          button('Rời phòng', 'exam-tab', async () => {
            try { await apiCall('leave', { code }); } catch {}
            showJoin('');
          })
        );
        return r;
      })()
    );
    inviteRow.append(qrImg, inviteMeta);

    const board = element('div', 'arena-board');
    wrap.append(inviteRow, board, notice);
    content.replaceChildren(wrap);

    let busy = false;
    const refresh = async () => {
      if (busy || seq !== seqId || activeCode !== code || !wrap.isConnected) return;
      busy = true;
      try {
        const { room } = await apiCall('state', { code }, 'GET');
        if (seq !== seqId) return;
        renderRoomState(room);
      } catch (e) {
        if (seq === seqId) notice.textContent = e.message;
      } finally {
        busy = false;
      }
    };

    const renderRoomState = (room) => {
      const uid = auth?.currentUser?.uid;
      board.replaceChildren();
      const list = element('div', 'arena-players');
      for (const pl of room.players) {
        const card = element('article', 'arena-player');
        card.append(
          element('strong', '', `${pl.name}${pl.uid === uid ? ' (Bạn)' : ''}${pl.uid === room.hostUid ? ' ★' : ''}`),
          element('span', '', `${pl.hp} / 200 HP • ${pl.score} sát thương`)
        );
        const bar = element('div', 'arena-hp');
        const fill = element('div', 'arena-hp-fill');
        fill.style.width = `${Math.min(100, pl.hp / 2)}%`;
        bar.append(fill);
        card.append(bar);
        list.append(card);
      }
      board.append(list);

      if (room.status === 'LOBBY') {
        notice.textContent = `Sảnh chờ (${room.subject || 'Đa môn'}): ${room.players.length}/8 người. Cần tối thiểu 2 người để bắt đầu.`;
        if (room.hostUid === uid) {
          const startBtn = button('Bắt đầu trận đấu', 'primary-btn', async () => {
            startBtn.disabled = true;
            try { await apiCall('start', { code: room.id }); refresh(); }
            catch (e) { notice.textContent = e.message; startBtn.disabled = false; }
          });
          board.append(startBtn);
        }
        return;
      }
      if (room.status === 'FINISHED') {
        const win = room.players.find((pl) => pl.uid === room.winnerUid);
        notice.textContent = `Trận đấu kết thúc! Người chiến thắng: ${win?.name || 'Hòa'}.`;
        return;
      }
      if (room.round !== lastRoundSeen) {
        lastRoundSeen = room.round;
        selectedLetter = null;
        answerSent = false;
      }
      const q = room.question;
      const seconds = Math.max(0, Math.ceil((room.roundEndsAt - room.serverNow) / 1000));
      notice.textContent = `Vòng ${room.round}/${room.totalRounds} • Còn ${seconds}s${room.myAnswered ? ' • Đã gửi đáp án' : ''}`;
      if (!q) { board.append(element('p', 'exam-message', 'Đang chuyển vòng kế tiếp…')); return; }

      board.append(element('h4', 'exam-heading', q.prompt), element('p', 'exam-message', `${q.topic} · ${q.level}`));
      const options = element('div', 'exam-options');
      q.options.forEach((optText, i) => {
        const letter = 'ABCD'[i];
        const b = button(`${letter}. ${optText}`, 'exam-option', async () => {
          if (room.myAnswered || answerSent) return;
          answerSent = true;
          selectedLetter = letter;
          for (const el of options.children) el.disabled = true;
          try {
            const res = await apiCall('answer', { code: room.id, round: room.round, answer: letter });
            notice.textContent = res.correct ? `Chính xác! Gây ${res.damage} sát thương.` : 'Chưa chính xác. Chờ vòng sau.';
            setTimeout(() => refresh(), 250);
          } catch (e) {
            notice.textContent = e.message;
            answerSent = false;
          }
        });
        b.disabled = room.myAnswered || answerSent || seconds === 0;
        b.classList.toggle('selected', selectedLetter === letter);
        options.append(b);
      });
      board.append(options);
    };

    if (initialRoom) renderRoomState(initialRoom);
    refresh();
    pollInterval = setInterval(refresh, 1400);
  }

  if (initialCode) showJoin(initialCode);
  else showJoin('');

  return stop;
}
