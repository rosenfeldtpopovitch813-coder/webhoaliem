import QRCode from 'qrcode';
import { element, button } from '../../core/dom.js';
import { auth } from '../../core/firebase.js';
import { ARENA_SUBJECTS } from '../../../shared/arena-core.js';

export function renderHundredArena(host, { apiCall, availableDecks = [], initialCode = '', onBack = null } = {}) {
  let pollTimer = null;
  let activeCode = null;
  let seqId = 0;
  let sentRound = 0;

  const stop = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    activeCode = null;
    sentRound = 0;
    seqId++;
  };

  const wrap = element('section', 'arena-mode-wrap');
  const head = element('div', 'arena-mode-head');
  head.append(element('h3', 'exam-heading', 'Đấu trường 100'));
  if (onBack) head.append(button('← Hub Arena', 'exam-tab', () => { stop(); onBack(); }));
  const tabs = element('div', 'exam-tabs');
  const content = element('div', 'arena-mode-body');
  wrap.append(head, tabs, content);
  host.replaceChildren(wrap);

  const tabJoin = button('Vào phòng', 'exam-tab', () => showJoin());
  const tabCreate = button('Tạo phòng', 'exam-tab', () => showCreate());
  tabs.append(tabJoin, tabCreate);

  const markTab = (active) => {
    tabJoin.classList.toggle('selected', active === tabJoin);
    tabCreate.classList.toggle('selected', active === tabCreate);
  };

  function showJoin(prefill = initialCode) {
    stop();
    markTab(tabJoin);
    const p = element('section', 'exam-panel');
    const codeIn = Object.assign(document.createElement('input'), {
      className: 'exam-input',
      placeholder: 'Nhập mã 8 ký tự sau khi quét QR',
      maxLength: 8,
      value: String(prefill || '').toUpperCase()
    });
    const msg = element('p', 'exam-message', auth?.currentUser
      ? 'Trả lời sai hoặc hết giờ bạn sẽ chuyển sang chế độ khán giả cho đến khi còn 1 người thắng!'
      : 'Đăng nhập Google trên thiết bị để tham gia phòng Đấu trường 100.');

    const joinBtn = button('Vào phòng', 'primary-btn', async () => {
      const code = codeIn.value.trim().toUpperCase();
      if (!code) { msg.textContent = 'Hãy nhập mã phòng.'; return; }
      joinBtn.disabled = true;
      msg.textContent = 'Đang vào sảnh Đấu trường 100…';
      try {
        const res = await apiCall('h100-join', { code });
        enterHundredRoom(res.room.id, res.room);
      } catch (e) {
        msg.textContent = e.message;
        joinBtn.disabled = false;
      }
    });
    p.append(element('h4', '', 'Tham gia phòng thi loại trực tiếp'), codeIn, joinBtn, msg);
    content.replaceChildren(p);

    if (prefill && auth?.currentUser) joinBtn.click();
  }

  function showCreate() {
    stop();
    markTab(tabCreate);
    const p = element('section', 'exam-panel');

    const deckSel = document.createElement('select');
    deckSel.className = 'exam-input';
    for (const d of availableDecks) {
      const o = element('option', '', `[${d.subject}] ${d.title} (${(d.questions || []).length} câu)`);
      o.value = d.id;
      deckSel.append(o);
    }

    const defaultDeck = availableDecks.find((d) => d.id === 'starter-tonghop-100') || availableDecks[0];
    if (defaultDeck) deckSel.value = defaultDeck.id;

    const titleIn = Object.assign(document.createElement('input'), {
      className: 'exam-input',
      placeholder: 'Tên phòng Đấu trường 100',
      value: defaultDeck?.title || 'Đấu trường 100'
    });
    const subjectSel = document.createElement('select');
    subjectSel.className = 'exam-input';
    for (const s of ARENA_SUBJECTS) {
      const o = element('option', '', s);
      o.value = s;
      subjectSel.append(o);
    }
    if (defaultDeck?.subject && ARENA_SUBJECTS.includes(defaultDeck.subject)) subjectSel.value = defaultDeck.subject;

    const hostPlaysLabel = element('label', 'focus-share');
    const hostPlaysCheck = document.createElement('input');
    hostPlaysCheck.type = 'checkbox';
    hostPlaysCheck.checked = false;
    hostPlaysLabel.append(hostPlaysCheck, document.createTextNode(' Chủ phòng cũng trực tiếp trả lời cùng học sinh (bỏ tick nếu chỉ chiếu máy chiếu)'));

    let questions = (defaultDeck?.questions || []).map((q) => ({
      kind: q.kind === 'short' ? 'short' : 'mcq',
      prompt: q.prompt || '',
      options: Array.isArray(q.options) ? [...q.options] : ['', '', '', ''],
      answer: q.answer || 'A',
      topic: q.topic || subjectSel.value
    }));

    const list = element('div', 'exam-editor');
    deckSel.onchange = () => {
      const d = availableDecks.find((x) => x.id === deckSel.value);
      if (!d) return;
      titleIn.value = d.title;
      if (ARENA_SUBJECTS.includes(d.subject)) subjectSel.value = d.subject;
      questions = (d.questions || []).map((q) => ({
        kind: q.kind === 'short' ? 'short' : 'mcq',
        prompt: q.prompt || '',
        options: Array.isArray(q.options) ? [...q.options] : ['', '', '', ''],
        answer: q.answer || 'A',
        topic: q.topic || subjectSel.value
      }));
      renderQEditor();
    };

    const renderQEditor = () => {
      list.replaceChildren();
      questions.forEach((q, i) => {
        const card = element('section', 'exam-question');
        const top = element('div', 'arena-q-head');
        const kindSel = document.createElement('select');
        kindSel.className = 'exam-input';
        for (const [kv, kl] of [['mcq', 'Trắc nghiệm (A/B/C/D)'], ['short', 'Nhập đáp án ngắn']]) {
          const o = element('option', '', kl);
          o.value = kv;
          kindSel.append(o);
        }
        kindSel.value = q.kind;
        kindSel.onchange = () => {
          q.kind = kindSel.value;
          q.answer = q.kind === 'short' ? '' : 'A';
          renderQEditor();
        };
        top.append(element('h4', '', `Câu ${i + 1}`), kindSel, button('Xóa', 'exam-tab', () => { questions.splice(i, 1); renderQEditor(); }));
        card.append(top);

        const pr = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: 'Nội dung câu hỏi', value: q.prompt });
        pr.oninput = () => { q.prompt = pr.value; };
        card.append(pr);

        if (q.kind === 'short') {
          const ansIn = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: 'Đáp án đúng (vd: 18 hoặc CH3COOH)', value: q.answer });
          ansIn.oninput = () => { q.answer = ansIn.value; };
          card.append(ansIn);
        } else {
          for (let j = 0; j < 4; j++) {
            const optIn = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: `Đáp án ${'ABCD'[j]}`, value: q.options[j] || '' });
            optIn.oninput = () => { q.options[j] = optIn.value; };
            card.append(optIn);
          }
          const ansSel = document.createElement('select');
          ansSel.className = 'exam-input';
          for (const l of 'ABCD') {
            const o = element('option', '', `Đáp án đúng: ${l}`);
            o.value = l;
            ansSel.append(o);
          }
          ansSel.value = 'ABCD'.includes(q.answer) ? q.answer : 'A';
          ansSel.onchange = () => { q.answer = ansSel.value; };
          card.append(ansSel);
        }
        list.append(card);
      });
    };

    const status = element('p', 'exam-message', 'Hỗ trợ cả câu trắc nghiệm A/B/C/D và câu nhập đáp án trực tiếp (tối đa 100 học sinh quét QR vào phòng).');
    const createBtn = button('Mở phòng & Tạo mã QR', 'primary-btn', async () => {
      createBtn.disabled = true;
      status.textContent = 'Đang khởi tạo phòng Đấu trường 100…';
      try {
        const res = await apiCall('h100-create', {
          title: titleIn.value,
          subject: subjectSel.value,
          hostPlays: hostPlaysCheck.checked,
          questions
        });
        enterHundredRoom(res.room.id, res.room);
      } catch (e) {
        status.textContent = e.message;
        createBtn.disabled = false;
      }
    });

    const addBar = element('div', 'exam-tabs');
    addBar.append(
      button('+ Thêm câu Trắc nghiệm', 'exam-tab', () => {
        questions.push({ kind: 'mcq', prompt: '', options: ['', '', '', ''], answer: 'A', topic: subjectSel.value });
        renderQEditor();
      }),
      button('+ Thêm câu Nhập đáp án', 'exam-tab', () => {
        questions.push({ kind: 'short', prompt: '', options: [], answer: '', topic: subjectSel.value });
        renderQEditor();
      })
    );

    p.append(element('label', 'exam-label', 'Nạp nhanh bộ câu hỏi có sẵn hoặc do giáo viên giao'), deckSel, titleIn, subjectSel, hostPlaysLabel, status, addBar, list, createBtn);
    content.replaceChildren(p);
    renderQEditor();
  }

  function enterHundredRoom(code, initialRoom = null) {
    stop();
    activeCode = code;
    const seq = seqId;
    const wrapRoom = element('section', 'exam-panel');
    const qrUrl = `${window.location.origin}/arena?mode=hundred&code=${code}`;

    const qrBanner = element('div', 'arena-qr-invite');
    const qrImg = document.createElement('img');
    qrImg.className = 'arena-qr-img is-large';
    qrImg.alt = `QR Đấu trường 100 ${code}`;
    QRCode.toDataURL(qrUrl, { width: 220, margin: 1 }).then((u) => { qrImg.src = u; }).catch(() => {});

    const qrMeta = element('div', 'arena-invite-meta');
    const notice = element('p', 'exam-message', 'Đang kết nối Đấu trường 100…');
    qrMeta.append(
      element('h3', 'exam-heading', `Đấu trường 100 · Mã ${code}`),
      element('p', '', 'Học sinh quét mã QR trên màn hình hoặc nhập mã phòng để vào thi loại trực tiếp.'),
      (() => {
        const r = element('div', 'exam-tabs');
        r.append(
          button('Sao chép mã', 'exam-tab', () => navigator.clipboard?.writeText(code).then(() => { notice.textContent = `Đã sao chép mã ${code}`; })),
          button('Sao chép link QR', 'exam-tab', () => navigator.clipboard?.writeText(qrUrl).then(() => { notice.textContent = 'Đã sao chép liên kết phòng.'; })),
          button('Rời phòng', 'exam-tab', async () => {
            try { await apiCall('h100-leave', { code }); } catch {}
            showJoin('');
          })
        );
        return r;
      })()
    );
    qrBanner.append(qrImg, qrMeta);

    const survivorBar = element('div', 'h100-survivor-bar');
    const stageArea = element('div', 'h100-stage');
    const rosterBox = element('div', 'h100-roster');
    wrapRoom.append(qrBanner, survivorBar, stageArea, notice, rosterBox);
    content.replaceChildren(wrapRoom);

    let busy = false;
    const refresh = async () => {
      if (busy || seq !== seqId || activeCode !== code || !wrapRoom.isConnected) return;
      busy = true;
      try {
        const { room } = await apiCall('h100-state', { code }, 'GET');
        if (seq !== seqId) return;
        renderRoom(room);
      } catch (e) {
        if (seq === seqId) notice.textContent = e.message;
      } finally {
        busy = false;
      }
    };

    const renderRoom = (room) => {
      const uid = auth?.currentUser?.uid;
      const isHost = room.hostUid === uid;
      const me = (room.players || []).find((p) => p.uid === uid);

      survivorBar.replaceChildren(
        element('span', 'exam-card-pill is-done', `Còn lại: ${room.aliveCount}/${room.totalPlayers} thí sinh`),
        element('span', 'exam-card-pill', `Câu ${room.round || 0}/${room.totalRounds}`),
        element('span', 'exam-card-pill', room.status === 'LOBBY' ? 'Đang mở sảnh QR' : room.status === 'PLAYING' ? 'Đang làm bài' : room.status === 'ROUND_REVIEW' ? 'Chốt lượt vừa rồi' : 'Kết thúc')
      );

      stageArea.replaceChildren();

      if (room.status === 'LOBBY') {
        notice.textContent = `Đã có ${room.totalPlayers} thí sinh trong sảnh. Khi sẵn sàng, chủ phòng bấm Bắt đầu.`;
        if (isHost) {
          const startBtn = button('Bắt đầu Câu 1', 'primary-btn', async () => {
            startBtn.disabled = true;
            try { await apiCall('h100-start', { code: room.id }); refresh(); }
            catch (e) { notice.textContent = e.message; startBtn.disabled = false; }
          });
          stageArea.append(startBtn);
        }
      } else if (room.status === 'FINISHED') {
        const winners = (room.players || []).filter((p) => (room.winnerUids || []).includes(p.uid));
        const winNames = winners.map((w) => w.name).join(', ') || 'Chưa có thí sinh vượt qua câu cuối';
        stageArea.append(
          element('h3', 'exam-heading', `Người thắng cuộc: ${winNames}`),
          element('p', 'exam-message', room.lastRoundSummary ? `Đáp án câu cuối: ${room.lastRoundSummary.correctAnswer} · Còn trụ lại: ${room.lastRoundSummary.survivedCount} người.` : '')
        );
        notice.textContent = 'Trận Đấu trường 100 đã hoàn tất!';
      } else if (room.status === 'ROUND_REVIEW') {
        const sum = room.lastRoundSummary || {};
        stageArea.append(
          element('h4', '', `Tổng kết Câu ${sum.round || room.round}: Đáp án đúng là "${sum.correctAnswer || ''}"`),
          element('p', 'exam-message', `✓ Còn trụ lại: ${sum.survivedCount || 0} thí sinh · ✗ Bị loại lượt này: ${sum.eliminatedCount || 0} thí sinh.`)
        );
        if (me && !me.alive) {
          stageArea.append(element('p', 'exam-auto-banner', `Bạn đã dừng bước ở Câu ${me.eliminatedRound || room.round} — tiếp tục theo dõi với vai trò khán giả.`));
        }
        if (isHost) {
          const nextBtn = button(`Câu tiếp theo (${room.round + 1}/${room.totalRounds})`, 'primary-btn', async () => {
            nextBtn.disabled = true;
            try { await apiCall('h100-next', { code: room.id }); refresh(); }
            catch (e) { notice.textContent = e.message; nextBtn.disabled = false; }
          });
          stageArea.append(nextBtn);
        }
        notice.textContent = isHost ? 'Bấm chuyển câu khi lớp đã xem xong kết quả.' : 'Chờ chủ phòng chuyển sang câu tiếp theo…';
      } else if (room.status === 'PLAYING') {
        const seconds = Math.max(0, Math.ceil((room.roundEndsAt - room.serverNow) / 1000));
        notice.textContent = `Câu ${room.round}/${room.totalRounds} · Còn ${seconds}s${room.myAnswered ? ' · Đã ghi nhận đáp án của bạn' : ''}`;
        const q = room.question;
        if (q) {
          stageArea.append(element('h4', 'exam-heading', q.prompt));
          if (!me) {
            stageArea.append(element('p', 'exam-message', 'Bạn đang quan sát màn hình điều phối của chủ phòng.'));
          } else if (!me.alive) {
            stageArea.append(element('p', 'exam-auto-banner', `Bạn đã bị loại ở Câu ${me.eliminatedRound || room.round - 1} · Đang xem trực tiếp.`));
          } else if (room.myAnswered || sentRound === room.round) {
            stageArea.append(element('p', 'exam-message', `✓ Đã khóa câu trả lời "${room.myAnswer?.chosen || ''}". Chờ hết giờ hoặc các thí sinh còn lại hoàn tất…`));
          } else if (q.kind === 'short') {
            const ansIn = Object.assign(document.createElement('input'), { className: 'exam-input', placeholder: 'Nhập nhanh đáp án ngắn…' });
            const sendBtn = button('Gửi đáp án', 'primary-btn', async () => {
              const val = ansIn.value.trim();
              if (!val) return;
              sendBtn.disabled = true;
              try {
                await apiCall('h100-answer', { code: room.id, round: room.round, answer: val });
                sentRound = room.round;
                refresh();
              } catch (e) { notice.textContent = e.message; sendBtn.disabled = false; }
            });
            stageArea.append(ansIn, sendBtn);
          } else {
            const opts = element('div', 'exam-options');
            q.options.forEach((optText, idx) => {
              const letter = 'ABCD'[idx];
              const ob = button(`${letter}. ${optText}`, 'exam-option', async () => {
                for (const c of opts.children) c.disabled = true;
                try {
                  await apiCall('h100-answer', { code: room.id, round: room.round, answer: letter });
                  sentRound = room.round;
                  refresh();
                } catch (e) { notice.textContent = e.message; }
              });
              opts.append(ob);
            });
            stageArea.append(opts);
          }
        }
      }

      rosterBox.replaceChildren(element('strong', '', `Danh sách thí sinh (${room.totalPlayers})`));
      const chips = element('div', 'h100-roster-grid');
      for (const pl of room.players || []) {
        const chip = element('div', `h100-player-chip${pl.alive ? ' is-alive' : ' is-out'}${pl.uid === uid ? ' is-me' : ''}`);
        chip.append(
          element('strong', '', pl.name),
          element('small', '', pl.alive ? `Còn thi · ${pl.correctCount} đúng` : `Loại C${pl.eliminatedRound || '?'}`)
        );
        chips.append(chip);
      }
      rosterBox.append(chips);
    };

    if (initialRoom) renderRoom(initialRoom);
    refresh();
    pollTimer = setInterval(refresh, 1500);
  }

  if (initialCode) showJoin(initialCode);
  else showJoin('');

  return stop;
}
