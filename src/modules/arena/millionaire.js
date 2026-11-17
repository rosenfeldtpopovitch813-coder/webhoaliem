import { element, button } from '../../core/dom.js';
import { MILLIONAIRE_LADDER } from '../../../shared/arena-core.js';

export function renderMillionaire(host, { availableDecks = [], onBack = null } = {}) {
  let selectedDeckId = availableDecks[0]?.id || '';
  let useTimer = true;
  let roundTimer = null;

  const stopTimer = () => {
    if (roundTimer) clearInterval(roundTimer);
    roundTimer = null;
  };

  function renderSetup() {
    stopTimer();
    const wrap = element('section', 'arena-mode-wrap');
    const head = element('div', 'arena-mode-head');
    head.append(element('h3', 'exam-heading', 'Ai là Triệu Phú'));
    if (onBack) head.append(button('← Hub Arena', 'exam-tab', () => { stopTimer(); onBack(); }));

    const desc = element('p', 'exam-message', 'Trả lời lần lượt tối đa 15 câu hỏi với 3 mốc an toàn (Câu 5, 10, 15) và 3 quyền trợ giúp: 50:50, Hỏi khán giả, Gợi ý chuyên gia.');

    const deckList = availableDecks.filter((d) => (d.questions || []).some((q) => q.kind !== 'short' && Array.isArray(q.options) && q.options.length === 4));
    const select = document.createElement('select');
    select.className = 'exam-input';
    for (const d of deckList) {
      const mcqCount = (d.questions || []).filter((q) => q.kind !== 'short').length;
      const opt = element('option', '', `[${d.subject || 'Tổng hợp'}] ${d.title} (${mcqCount} câu)`);
      opt.value = d.id;
      select.append(opt);
    }
    if (selectedDeckId && deckList.some((d) => d.id === selectedDeckId)) select.value = selectedDeckId;
    select.onchange = () => { selectedDeckId = select.value; };

    const timerOpt = element('label', 'focus-share');
    const timerCheck = document.createElement('input');
    timerCheck.type = 'checkbox';
    timerCheck.checked = useTimer;
    timerCheck.onchange = () => { useTimer = timerCheck.checked; };
    timerOpt.append(timerCheck, document.createTextNode(' Bật đồng hồ 30 giây mỗi câu'));

    const startBtn = button('Bắt đầu', 'primary-btn', () => {
      const deck = deckList.find((d) => d.id === select.value) || deckList[0];
      if (!deck) return;
      startRun(deck);
    });
    if (!deckList.length) startBtn.disabled = true;

    wrap.append(head, desc, select, timerOpt, startBtn);
    host.replaceChildren(wrap);
  }

  function startRun(deck) {
    stopTimer();
    const mcqs = (deck.questions || []).filter((q) => q.kind !== 'short' && Array.isArray(q.options) && q.options.length === 4);
    // Repeat/pad cleanly up to 15 only if custom short deck has <15? Better play exact length up to 15!
    const questions = mcqs.slice(0, 15);
    const ladder = MILLIONAIRE_LADDER.slice(0, questions.length);

    let index = 0;
    let locked = false;
    let remainSec = 30;
    let hiddenLetters = new Set();
    let audienceData = null;
    let expertHint = '';
    const usedLifelines = { fifty: false, audience: false, expert: false };

    const wrap = element('section', 'arena-mode-wrap');
    const layout = element('div', 'mill-layout');
    const stageCol = element('div', 'mill-stage');
    const ladderCol = element('aside', 'mill-ladder');

    const topBar = element('div', 'mill-topbar');
    const titleEl = element('strong', '', `${deck.subject || 'Đa môn'} · ${deck.title}`);
    const clockEl = element('span', 'exam-run-clock', useTimer ? '30s' : 'Không giới hạn giờ');
    const exitBtn = button('Thoát', 'exam-tab', () => renderSetup());
    topBar.append(titleEl, clockEl, exitBtn);

    const lifelinesRow = element('div', 'mill-lifelines');
    const qCard = element('article', 'mill-qcard');
    const helperBanner = element('div', 'mill-helper-box');
    helperBanner.hidden = true;
    const msgEl = element('p', 'exam-message', '');
    stageCol.append(topBar, lifelinesRow, qCard, helperBanner, msgEl);
    layout.append(stageCol, ladderCol);
    wrap.append(layout);
    host.replaceChildren(wrap);

    const drawLadder = () => {
      ladderCol.replaceChildren(element('h4', 'mill-ladder-title', 'Nấc thang giải thưởng'));
      for (let i = ladder.length - 1; i >= 0; i--) {
        const step = ladder[i];
        const row = element('div', `mill-step${i === index ? ' is-current' : i < index ? ' is-passed' : ''}${step.safe ? ' is-safe' : ''}`);
        row.append(element('span', '', `Câu ${step.step}`), element('strong', '', step.reward));
        ladderCol.append(row);
      }
    };

    const safeMilestoneBefore = (currIndex) => {
      for (let i = currIndex - 1; i >= 0; i--) {
        if (ladder[i]?.safe) return ladder[i];
      }
      return null;
    };

    const showEndScreen = (won, stopped, reasonText) => {
      stopTimer();
      const prizeStep = won
        ? ladder[ladder.length - 1]
        : stopped
          ? (index > 0 ? ladder[index - 1] : null)
          : safeMilestoneBefore(index);
      const resultCard = element('article', 'mill-qcard mill-end');
      resultCard.append(
        element('h3', '', won ? 'Hoàn thành toàn bộ 15 câu' : stopped ? 'Đã dừng cuộc chơi' : 'Kết thúc lượt chơi'),
        element('p', 'mill-prize-big', prizeStep ? `Thành tích: ${prizeStep.reward} (${prizeStep.points} điểm)` : 'Chưa vượt qua mốc an toàn đầu tiên (0 điểm)'),
        element('p', 'exam-message', reasonText),
        (() => {
          const r = element('div', 'exam-tabs');
          r.append(button('Chơi ván mới', 'primary-btn', () => startRun(deck)), button('Chọn bộ đề khác', 'exam-tab', () => renderSetup()));
          return r;
        })()
      );
      qCard.replaceWith(resultCard);
      lifelinesRow.hidden = true;
      helperBanner.hidden = true;
    };

    const drawQuestion = () => {
      stopTimer();
      if (!wrap.isConnected) return;
      if (index >= questions.length) {
        return showEndScreen(true, false, `Bạn đã trả lời chính xác toàn bộ ${questions.length}/${questions.length} câu!`);
      }
      locked = false;
      remainSec = 30;
      hiddenLetters = new Set();
      audienceData = null;
      expertHint = '';
      helperBanner.hidden = true;
      msgEl.textContent = '';

      const q = questions[index];
      const stepInfo = ladder[index];
      drawLadder();

      // Lifelines + Walk away
      lifelinesRow.replaceChildren();
      const b50 = button('50:50', `exam-tab${usedLifelines.fifty ? ' is-used' : ''}`, () => {
        if (usedLifelines.fifty || locked) return;
        usedLifelines.fifty = true;
        const wrongs = 'ABCD'.split('').filter((l) => l !== q.answer).sort(() => Math.random() - 0.5).slice(0, 2);
        wrongs.forEach((l) => hiddenLetters.add(l));
        repaintOptions();
        b50.disabled = true;
      });
      b50.disabled = usedLifelines.fifty;

      const bAud = button('Hỏi khán giả', `exam-tab${usedLifelines.audience ? ' is-used' : ''}`, () => {
        if (usedLifelines.audience || locked) return;
        usedLifelines.audience = true;
        const remain = 'ABCD'.split('').filter((l) => !hiddenLetters.has(l));
        const correctWeight = index < 5 ? 72 : index < 10 ? 54 : 42;
        let rest = 100 - correctWeight;
        const weights = {};
        const wrongList = remain.filter((l) => l !== q.answer);
        wrongList.forEach((l, wi) => {
          if (wi === wrongList.length - 1) weights[l] = rest;
          else {
            const slice = Math.floor(Math.random() * rest);
            weights[l] = slice;
            rest -= slice;
          }
        });
        weights[q.answer] = correctWeight;
        audienceData = weights;
        showHelperBox();
        bAud.disabled = true;
      });
      bAud.disabled = usedLifelines.audience;

      const bExp = button('Gợi ý chuyên gia', `exam-tab${usedLifelines.expert ? ' is-used' : ''}`, () => {
        if (usedLifelines.expert || locked) return;
        usedLifelines.expert = true;
        expertHint = q.hint || `Hãy tập trung vào kiến thức trọng tâm chủ đề "${q.topic || deck.subject}" để loại trừ các phương án nhiễu.`;
        showHelperBox();
        bExp.disabled = true;
      });
      bExp.disabled = usedLifelines.expert;

      const walkBtn = button('Dừng chơi & Bảo toàn', 'focus-btn', () => {
        if (locked) return;
        showEndScreen(false, true, `Bạn chủ động dừng ở Câu ${index + 1} để giữ nguyên mức thưởng hiện có.`);
      });
      walkBtn.disabled = index === 0;
      lifelinesRow.append(b50, bAud, bExp, walkBtn);

      qCard.replaceChildren();
      qCard.append(
        element('span', 'exam-card-pill', `Câu ${index + 1}/${questions.length} · ${stepInfo?.reward || ''} · ${q.topic || ''}`),
        element('h3', 'mill-q-prompt', q.prompt)
      );
      const optGrid = element('div', 'mill-options');
      qCard.append(optGrid);

      const repaintOptions = () => {
        optGrid.replaceChildren();
        q.options.forEach((optText, j) => {
          const letter = 'ABCD'[j];
          const hidden = hiddenLetters.has(letter);
          const ob = button(hidden ? `${letter}. —` : `${letter}. ${optText}`, 'exam-option mill-opt', () => {
            if (locked || hidden) return;
            locked = true;
            stopTimer();
            for (const c of optGrid.children) c.disabled = true;
            const correct = letter === q.answer;
            ob.classList.add(correct ? 'is-correct' : 'is-wrong');
            if (!correct) {
              const rightIdx = 'ABCD'.indexOf(q.answer);
              if (optGrid.children[rightIdx]) optGrid.children[rightIdx].classList.add('is-correct');
              msgEl.textContent = `Sai rồi! Đáp án đúng là ${q.answer}. ${q.hint || ''}`;
              setTimeout(() => {
                if (wrap.isConnected) showEndScreen(false, false, `Dừng bước ở Câu ${index + 1}. Đáp án đúng là ${q.answer}.`);
              }, 1400);
              return;
            }
            msgEl.textContent = `Chính xác — đạt mốc ${stepInfo?.reward || ''}.`;
            setTimeout(() => {
              if (!wrap.isConnected) return;
              index++;
              drawQuestion();
            }, 950);
          });
          ob.disabled = hidden || locked;
          optGrid.append(ob);
        });
      };

      const showHelperBox = () => {
        helperBanner.replaceChildren();
        if (audienceData) {
          helperBanner.append(element('strong', '', 'Ý kiến khán giả:'));
          const bars = element('div', 'mill-aud-bars');
          for (const letter of 'ABCD') {
            if (audienceData[letter] == null) continue;
            const col = element('div', 'mill-aud-col');
            const fill = element('div', 'mill-aud-fill');
            fill.style.height = `${Math.max(8, audienceData[letter])}%`;
            col.append(element('small', '', `${audienceData[letter]}%`), fill, element('strong', '', letter));
            bars.append(col);
          }
          helperBanner.append(bars);
        }
        if (expertHint) {
          helperBanner.append(element('p', '', `Chuyên gia gợi ý: ${expertHint}`));
        }
        helperBanner.hidden = false;
      };

      repaintOptions();

      if (useTimer) {
        clockEl.textContent = `${remainSec}s`;
        roundTimer = setInterval(() => {
          if (!wrap.isConnected) { stopTimer(); return; }
          remainSec--;
          clockEl.textContent = `${Math.max(0, remainSec)}s`;
          if (remainSec <= 0) {
            locked = true;
            stopTimer();
            showEndScreen(false, false, `Hết 30 giây ở Câu ${index + 1}. Đáp án đúng là ${q.answer}.`);
          }
        }, 1000);
      }
    };

    drawQuestion();
  }

  renderSetup();
  return stopTimer;
}
