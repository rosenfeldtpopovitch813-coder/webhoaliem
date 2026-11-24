import { element, button } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { navigate } from '../../core/router.js';
import { auth } from '../../core/firebase.js';
import { AppStore } from '../../core/store.js';
import {
  COUNTDOWN_UNITS,
  computeEventCountdown,
  getNextStreakMilestone,
  getReachedStreakMilestone,
  isStreakMilestone,
  titleFor
} from '../../../shared/study-core.js';

const modules = [
  ['exam-paper', 'Soạn đề', 'Gõ đề trực tiếp, tùy chỉnh phông chữ, màu sắc, công thức Toán/Hóa, xuất .docx & PDF', '/exam-paper'],
  ['whiteboard', 'Bảng vẽ Mực', 'Bảng viết tay, dựng hình không gian, vẽ đồ thị và ghi chú lên PDF', '/whiteboard'],
  ['exam-room', 'Phòng thi trực tuyến', 'Đề bên trái, phiếu OMR bên phải, chấm điểm tự động', '/exam'],
  ['arena', 'Đấu trường học tập', 'Đối kháng theo vòng, ôn Tiếng Anh, Ai là Triệu Phú và Đấu trường 100', '/arena'],
  ['flask', 'Mô hình thí nghiệm', 'Chọn môn học, xem cơ sở lý thuyết 6 mục và thực hành mô phỏng 3D tương tác', '/experiments'],
  ['handbook', 'Sổ tay học tập', 'Bảng tuần hoàn, phổ IR và vẽ đồ thị hàm số', '/handbook'],
  ['focus', 'Góc tập trung', 'Đồng hồ Pomodoro, thống kê giờ học và nhạc tập trung', '/focus'],
  ['library', 'Thư viện học liệu', 'Kho tài liệu, đề cương và bài giảng chọn lọc', '/library'],
  ['admissions', 'Nguyện vọng', 'So sánh tổ hợp và tính điểm xét tuyển đại học', '/admissions']
];

const fmt = seconds => {
  const sec = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(sec / 3600)} giờ ${Math.floor((sec % 3600) / 60)} phút`;
};

const EVENTS_STORAGE_KEY = 'htvvm-countdown-events-v1';
const ACTIVE_EVENT_KEY = 'htvvm-countdown-active-id-v1';
const UNITS_STORAGE_KEY = 'htvvm-countdown-units-v1';

const UNIT_LABELS = {
  years: 'Năm',
  months: 'Tháng',
  days: 'Ngày',
  hours: 'Giờ',
  minutes: 'Phút',
  seconds: 'Giây'
};

function createDefaultEvents() {
  const now = new Date();
  const nextYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  const target = new Date(nextYear, 5, 27, 7, 30, 0);
  if (target.getTime() <= Date.now() + 86400000) {
    target.setFullYear(target.getFullYear() + 1);
  }
  return [
    {
      id: 'evt-default-thpt',
      title: `Kỳ thi Tốt nghiệp THPT ${target.getFullYear()}`,
      year: target.getFullYear(),
      month: target.getMonth() + 1,
      day: target.getDate(),
      hour: 7,
      minute: 30,
      targetMs: target.getTime()
    }
  ];
}

function loadSavedEvents() {
  try {
    const raw = JSON.parse(localStorage.getItem(EVENTS_STORAGE_KEY) || 'null');
    if (Array.isArray(raw) && raw.length) {
      const valid = raw
        .filter(e => e && typeof e.title === 'string' && Number.isFinite(Number(e.targetMs)))
        .map(e => ({
          id: String(e.id || `evt-${Date.now()}`),
          title: String(e.title).slice(0, 90),
          year: Number(e.year) || new Date(Number(e.targetMs)).getFullYear(),
          month: Number(e.month) || (new Date(Number(e.targetMs)).getMonth() + 1),
          day: Number(e.day) || new Date(Number(e.targetMs)).getDate(),
          hour: Number.isFinite(Number(e.hour)) ? Number(e.hour) : 7,
          minute: Number.isFinite(Number(e.minute)) ? Number(e.minute) : 30,
          targetMs: Number(e.targetMs)
        }));
      if (valid.length) return valid;
    }
  } catch {}
  return createDefaultEvents();
}

function saveEventsToStorage(events, activeId) {
  try {
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    if (activeId) localStorage.setItem(ACTIVE_EVENT_KEY, activeId);
  } catch {}
}

function loadEnabledUnits() {
  try {
    const raw = JSON.parse(localStorage.getItem(UNITS_STORAGE_KEY) || 'null');
    if (Array.isArray(raw)) {
      const filtered = COUNTDOWN_UNITS.filter(u => raw.includes(u));
      if (filtered.length) return filtered;
    }
  } catch {}
  return [...COUNTDOWN_UNITS];
}

function saveEnabledUnits(units) {
  try {
    localStorage.setItem(UNITS_STORAGE_KEY, JSON.stringify(units));
  } catch {}
}

function renderCelebrationCanvasPng({ studentName, streakDays, totalSeconds, todaySeconds, rankTitle }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(0, 0, 1200, 720);
  grad.addColorStop(0, '#071126');
  grad.addColorStop(0.52, '#131c38');
  grad.addColorStop(1, '#1e163b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 720);

  const glow = ctx.createRadialGradient(600, 210, 30, 600, 210, 440);
  glow.addColorStop(0, 'rgba(245, 158, 11, 0.28)');
  glow.addColorStop(0.6, 'rgba(45, 212, 191, 0.12)');
  glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1200, 720);

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, 1128, 648);
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(48, 48, 1104, 624);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#5eead4';
  ctx.font = '800 20px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText('HTVVM STUDIO · CHỨNG NHẬN CỘT MỐC CHUỖI HỌC TẬP', 600, 105);

  ctx.beginPath();
  ctx.arc(600, 195, 58, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fbbf24';
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 44px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText(`${streakDays}`, 600, 210);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 48px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText(`CHUỖI ${streakDays} NGÀY HỌC LIÊN TIẾP!`, 600, 310);

  ctx.fillStyle = '#fde68a';
  ctx.font = '800 32px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText(studentName || 'Học viên HTVVM', 600, 370);

  const cards = [
    ['CHUỖI NGÀY ĐẠT MỐC', `${streakDays} ngày liên tiếp`],
    ['TỔNG THỜI GIAN HỌC', fmt(totalSeconds)],
    ['HÔM NAY & RANK NGÀY', `${fmt(todaySeconds)} · ${rankTitle}`]
  ];
  cards.forEach(([label, val], idx) => {
    const x = 95 + idx * 345;
    const y = 430;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fillRect(x, y, 320, 125);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, 320, 125);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 15px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText(label, x + 160, y + 44);

    ctx.fillStyle = '#5eead4';
    ctx.font = '800 22px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText(val, x + 160, y + 88);
  });

  const dateStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 17px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText(`Xác lập ngày ${dateStr} trên HTVVM Studio — Kiên trì mỗi ngày tạo nên bứt phá.`, 600, 628);

  return canvas;
}

export function renderHome() {
  const wrap = element('div', 'home-page');
  const hero = element('section', 'hero home-hero');
  hero.append(
    element('h2', 'hero-title', 'Luyện thi & Học tập trực tuyến'),
    element('p', 'hero-subtitle', 'Soạn đề, làm bài kiểm tra tính giờ, tra cứu bảng tuần hoàn, theo dõi giờ học và đếm ngược mục tiêu.')
  );
  wrap.append(hero);

  // ============================================================================
  // 1. EVENT CALENDAR & 3D FLIP COUNTDOWN CLOCK
  // ============================================================================
  let savedEvents = loadSavedEvents();
  let activeEventId = (() => {
    try {
      const id = localStorage.getItem(ACTIVE_EVENT_KEY);
      if (id && savedEvents.some(e => e.id === id)) return id;
    } catch {}
    return savedEvents[0]?.id || '';
  })();
  let enabledUnits = loadEnabledUnits();
  let calendarCursor = (() => {
    const act = savedEvents.find(e => e.id === activeEventId) || savedEvents[0];
    return act ? new Date(act.year, act.month - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  })();

  const countdownSection = element('section', 'home-countdown-panel');
  const countdownGrid = element('div', 'home-countdown-layout');
  const clockPane = element('div', 'home-flip-pane');
  const calendarPane = element('div', 'home-calendar-pane');
  countdownGrid.append(clockPane, calendarPane);
  countdownSection.append(countdownGrid);
  wrap.append(countdownSection);

  const clockHead = element('div', 'home-flip-header');
  const clockTitleWrap = element('div', 'home-flip-title-wrap');
  const clockBadge = element('span', 'home-flip-kicker', 'ĐỒNG HỒ LẬT ĐẾM NGƯỢC SỰ KIỆN');
  const clockEventTitle = element('h3', 'section-heading home-flip-event-name', '');
  const clockEventMeta = element('p', 'home-board-subtitle', '');
  clockTitleWrap.append(clockBadge, clockEventTitle, clockEventMeta);
  clockHead.append(clockTitleWrap);

  const eventPillsBar = element('div', 'home-event-pills');
  const unitBar = element('div', 'home-unit-filter-bar');
  const unitBarLabel = element('span', 'home-unit-filter-label', 'Đơn vị tính:');
  const unitChipsWrap = element('div', 'home-unit-chips');
  unitBar.append(unitBarLabel, unitChipsWrap);

  const flipCardsRow = element('div', 'flip-clock-grid');
  const previousFlipValues = {};

  function rebuildUnitChips() {
    unitChipsWrap.replaceChildren();
    for (const unit of COUNTDOWN_UNITS) {
      const isOn = enabledUnits.includes(unit);
      const chip = button(
        UNIT_LABELS[unit],
        `home-unit-chip${isOn ? ' is-active' : ''}`,
        () => {
          if (isOn && enabledUnits.length <= 1) return;
          enabledUnits = isOn
            ? enabledUnits.filter(u => u !== unit)
            : COUNTDOWN_UNITS.filter(u => u === unit || enabledUnits.includes(u));
          saveEnabledUnits(enabledUnits);
          rebuildUnitChips();
          updateFlipClockDom(true);
        }
      );
      chip.title = `Bật/tắt đơn vị ${UNIT_LABELS[unit]} (tự động cộng dồn sang đơn vị nhỏ hơn khi tắt)`;
      unitChipsWrap.append(chip);
    }
    const presetDaysBtn = button('Ngày·Giờ·Phút·Giây', 'home-unit-chip is-preset', () => {
      enabledUnits = ['days', 'hours', 'minutes', 'seconds'];
      saveEnabledUnits(enabledUnits);
      rebuildUnitChips();
      updateFlipClockDom(true);
    });
    const presetAllBtn = button('Đầy đủ', 'home-unit-chip is-preset', () => {
      enabledUnits = [...COUNTDOWN_UNITS];
      saveEnabledUnits(enabledUnits);
      rebuildUnitChips();
      updateFlipClockDom(true);
    });
    unitChipsWrap.append(presetDaysBtn, presetAllBtn);
  }

  function rebuildEventPills() {
    eventPillsBar.replaceChildren();
    savedEvents.forEach(ev => {
      const pill = element('div', `home-event-pill${ev.id === activeEventId ? ' is-active' : ''}`);
      const selectBtn = button(ev.title, 'home-event-pill-btn', () => {
        activeEventId = ev.id;
        saveEventsToStorage(savedEvents, activeEventId);
        calendarCursor = new Date(ev.year, ev.month - 1, 1);
        rebuildEventPills();
        renderCalendarWidget();
        updateFlipClockDom(true);
      });
      pill.append(selectBtn);
      if (savedEvents.length > 1) {
        const delBtn = button('✕', 'home-event-pill-del', () => {
          savedEvents = savedEvents.filter(item => item.id !== ev.id);
          if (activeEventId === ev.id) activeEventId = savedEvents[0]?.id || '';
          saveEventsToStorage(savedEvents, activeEventId);
          rebuildEventPills();
          renderCalendarWidget();
          updateFlipClockDom(true);
        });
        delBtn.title = 'Xóa sự kiện này';
        pill.append(delBtn);
      }
      eventPillsBar.append(pill);
    });
  }

  function updateFlipClockDom(forceRebuild = false) {
    const activeEvent = savedEvents.find(e => e.id === activeEventId) || savedEvents[0];
    if (!activeEvent) return;
    clockEventTitle.textContent = activeEvent.title;
    const pad2 = n => String(n).padStart(2, '0');
    clockEventMeta.textContent = `Mục tiêu: ${pad2(activeEvent.day)}/${pad2(activeEvent.month)}/${activeEvent.year} lúc ${pad2(activeEvent.hour)}:${pad2(activeEvent.minute)}`;

    const cd = computeEventCountdown(activeEvent.targetMs, Date.now(), enabledUnits);
    if (forceRebuild || flipCardsRow.children.length !== cd.activeUnits.length) {
      flipCardsRow.replaceChildren();
      for (const unit of cd.activeUnits) {
        const rawVal = cd.values[unit] ?? 0;
        const formatted = rawVal >= 100 ? String(rawVal) : String(rawVal).padStart(2, '0');
        previousFlipValues[unit] = formatted;

        const cardWrap = element('div', 'flip-clock-unit');
        cardWrap.dataset.unit = unit;
        const card = element('div', 'flip-clock-card');
        const topHalf = element('div', 'flip-card-top', formatted);
        const bottomHalf = element('div', 'flip-card-bottom', formatted);
        const divider = element('div', 'flip-card-hinge');
        card.append(topHalf, divider, bottomHalf);
        const label = element('span', 'flip-clock-label', UNIT_LABELS[unit]);
        cardWrap.append(card, label);
        flipCardsRow.append(cardWrap);
      }
      return;
    }

    for (const unit of cd.activeUnits) {
      const rawVal = cd.values[unit] ?? 0;
      const formatted = rawVal >= 100 ? String(rawVal) : String(rawVal).padStart(2, '0');
      const unitEl = flipCardsRow.querySelector(`[data-unit="${unit}"]`);
      if (!unitEl) continue;
      const card = unitEl.querySelector('.flip-clock-card');
      const topHalf = unitEl.querySelector('.flip-card-top');
      const bottomHalf = unitEl.querySelector('.flip-card-bottom');
      if (previousFlipValues[unit] !== formatted) {
        previousFlipValues[unit] = formatted;
        if (topHalf) topHalf.textContent = formatted;
        if (bottomHalf) bottomHalf.textContent = formatted;
        if (card) {
          card.classList.remove('is-flipping');
          void card.offsetWidth;
          card.classList.add('is-flipping');
        }
      }
    }
  }

  clockPane.append(clockHead, eventPillsBar, unitBar, flipCardsRow);

  // Interactive Monthly Calendar & Event Form
  const calHeader = element('div', 'home-cal-header');
  const calMonthTitle = element('strong', 'home-cal-month-title', '');
  const calPrevBtn = button('‹', 'focus-btn is-sm', () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
    renderCalendarWidget();
  });
  const calNextBtn = button('›', 'focus-btn is-sm', () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
    renderCalendarWidget();
  });
  calHeader.append(calPrevBtn, calMonthTitle, calNextBtn);

  const calWeekdays = element('div', 'home-cal-weekdays');
  ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].forEach(d => calWeekdays.append(element('span', '', d)));
  const calDaysGrid = element('div', 'home-cal-days');

  const formWrap = element('form', 'home-event-form');
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'exam-input home-event-input';
  nameInput.placeholder = 'Tên sự kiện (VD: Thi THPT Quốc gia, Kiểm tra Học kỳ…)';
  nameInput.required = true;

  const dateRow = element('div', 'home-event-datetime-row');
  const dayInput = document.createElement('input');
  dayInput.type = 'number'; dayInput.min = '1'; dayInput.max = '31'; dayInput.className = 'exam-input'; dayInput.placeholder = 'Ngày';
  const monthInput = document.createElement('input');
  monthInput.type = 'number'; monthInput.min = '1'; monthInput.max = '12'; monthInput.className = 'exam-input'; monthInput.placeholder = 'Tháng';
  const yearInput = document.createElement('input');
  yearInput.type = 'number'; yearInput.min = '2025'; yearInput.max = '2100'; yearInput.className = 'exam-input'; yearInput.placeholder = 'Năm';
  const hourInput = document.createElement('input');
  hourInput.type = 'number'; hourInput.min = '0'; hourInput.max = '23'; hourInput.className = 'exam-input'; hourInput.placeholder = 'Giờ';
  const minInput = document.createElement('input');
  minInput.type = 'number'; minInput.min = '0'; minInput.max = '59'; minInput.className = 'exam-input'; minInput.placeholder = 'Phút';

  const initEv = savedEvents.find(e => e.id === activeEventId) || savedEvents[0];
  if (initEv) {
    dayInput.value = String(initEv.day);
    monthInput.value = String(initEv.month);
    yearInput.value = String(initEv.year);
    hourInput.value = String(initEv.hour);
    minInput.value = String(initEv.minute);
  }

  const addEventBtn = button('+ Đánh dấu sự kiện lên lịch', 'primary-btn home-event-submit', null);
  addEventBtn.type = 'submit';
  dateRow.append(
    element('label', 'home-dt-field', 'Ngày'),
    element('label', 'home-dt-field', 'Tháng'),
    element('label', 'home-dt-field', 'Năm'),
    element('label', 'home-dt-field', 'Giờ'),
    element('label', 'home-dt-field', 'Phút')
  );
  dateRow.children[0].append(dayInput);
  dateRow.children[1].append(monthInput);
  dateRow.children[2].append(yearInput);
  dateRow.children[3].append(hourInput);
  dateRow.children[4].append(minInput);

  formWrap.append(nameInput, dateRow, addEventBtn);
  formWrap.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = nameInput.value.trim() || 'Sự kiện mục tiêu';
    const y = Math.max(2024, Math.min(2100, Number(yearInput.value) || new Date().getFullYear()));
    const m = Math.max(1, Math.min(12, Number(monthInput.value) || 1));
    const maxD = new Date(y, m, 0).getDate();
    const d = Math.max(1, Math.min(maxD, Number(dayInput.value) || 1));
    const hr = Math.max(0, Math.min(23, Number(hourInput.value) || 0));
    const mn = Math.max(0, Math.min(59, Number(minInput.value) || 0));
    const targetMs = new Date(y, m - 1, d, hr, mn, 0).getTime();
    const created = {
      id: `evt-${Date.now()}`,
      title,
      year: y,
      month: m,
      day: d,
      hour: hr,
      minute: mn,
      targetMs
    };
    savedEvents = [created, ...savedEvents];
    activeEventId = created.id;
    nameInput.value = '';
    calendarCursor = new Date(y, m - 1, 1);
    saveEventsToStorage(savedEvents, activeEventId);
    rebuildEventPills();
    renderCalendarWidget();
    updateFlipClockDom(true);
  });

  function renderCalendarWidget() {
    const y = calendarCursor.getFullYear();
    const m = calendarCursor.getMonth();
    calMonthTitle.textContent = `Tháng ${m + 1} / ${y}`;
    calDaysGrid.replaceChildren();

    const firstDay = new Date(y, m, 1).getDay();
    const leadBlank = (firstDay + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const now = new Date();
    const selectedDay = Number(dayInput.value);
    const selectedMonth = Number(monthInput.value);
    const selectedYear = Number(yearInput.value);

    for (let i = 0; i < leadBlank; i++) {
      calDaysGrid.append(element('span', 'home-cal-day is-empty', ''));
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const matchedEvent = savedEvents.find(ev => ev.year === y && ev.month === m + 1 && ev.day === d);
      const isToday = now.getFullYear() === y && now.getMonth() === m && now.getDate() === d;
      const isPicked = selectedYear === y && selectedMonth === m + 1 && selectedDay === d;
      const dayBtn = button(
        String(d),
        `home-cal-day${isToday ? ' is-today' : ''}${matchedEvent ? ' has-event' : ''}${isPicked ? ' is-selected' : ''}`,
        () => {
          dayInput.value = String(d);
          monthInput.value = String(m + 1);
          yearInput.value = String(y);
          if (matchedEvent) {
            activeEventId = matchedEvent.id;
            saveEventsToStorage(savedEvents, activeEventId);
            rebuildEventPills();
            updateFlipClockDom(true);
          }
          renderCalendarWidget();
        }
      );
      if (matchedEvent) dayBtn.title = `Sự kiện: ${matchedEvent.title}`;
      calDaysGrid.append(dayBtn);
    }
  }

  calendarPane.append(calHeader, calWeekdays, calDaysGrid, formWrap);
  rebuildUnitChips();
  rebuildEventPills();
  renderCalendarWidget();
  updateFlipClockDom(true);

  const flipTimerId = window.setInterval(() => {
    if (!wrap.isConnected) {
      window.clearInterval(flipTimerId);
      return;
    }
    updateFlipClockDom(false);
  }, 1000);

  // ============================================================================
  // 2. LEADERBOARD (TOP 3 + MY POSITION + FULL POPUP) & STREAK CELEBRATION
  // ============================================================================
  const boardPanel = element('section', 'home-leaderboard-panel');
  const boardHeader = element('div', 'home-board-header');
  const boardTitle = element('div', 'home-board-title');
  const boardIcon = element('span', 'home-board-icon');
  boardIcon.append(icon('trophy', 22));
  boardTitle.append(boardIcon, element('div', '', ''));
  const boardSubtitle = element('p', 'home-board-subtitle', 'Giờ học & Rank tính theo 1 ngày · Chuỗi tính số ngày & tổng giờ học.');
  boardTitle.lastChild.append(element('h3', 'section-heading', 'Bảng xếp hạng'), boardSubtitle);
  const refresh = button('Làm mới', 'focus-btn', () => loadBoard());
  boardHeader.append(boardTitle, refresh);

  const boardToolbar = element('div', 'home-board-toolbar');
  const boardTabs = element('div', 'home-board-tabs');
  let activeBoardTab = 'study'; // 'study' | 'streak'
  const tabStudyBtn = button('Giờ học hôm nay', 'home-board-tab is-active', () => switchBoardTab('study'));
  const tabStreakBtn = button('', 'home-board-tab', () => switchBoardTab('streak'));
  tabStreakBtn.append(icon('flame', 14), document.createTextNode(' Chuỗi học'));
  boardTabs.append(tabStudyBtn, tabStreakBtn);

  const shareWrap = element('label', 'home-board-optin');
  const shareToggle = document.createElement('input');
  shareToggle.type = 'checkbox';
  shareWrap.append(shareToggle, document.createTextNode(' Hiện tôi trên BXH'));
  boardToolbar.append(boardTabs, shareWrap);

  const myStreakBanner = element('div', 'home-board-my-streak');
  myStreakBanner.hidden = true;
  const board = element('div', 'home-board-list');
  const boardFooterActions = element('div', 'home-board-footer-actions');
  boardPanel.append(boardHeader, boardToolbar, myStreakBanner, board, boardFooterActions);

  let cachedBoardData = null;
  function switchBoardTab(nextTab) {
    activeBoardTab = nextTab;
    tabStudyBtn.classList.toggle('is-active', nextTab === 'study');
    tabStreakBtn.classList.toggle('is-active', nextTab === 'streak');
    renderBoardRows();
  }

  function createLeaderboardRowEl(row, rankNumber, tabMode, isCurrentUser = false) {
    const line = element(
      'div',
      `home-board-row${rankNumber <= 3 ? ` top-${rankNumber}` : ''}${isCurrentUser ? ' is-me' : ''}`
    );
    const rank = element('span', 'home-board-rank', String(rankNumber));
    const details = element('div', 'home-board-person');
    const dailyTitle = titleFor(Number(row.todaySeconds) || 0);
    const nameLine = element('strong', '', `${row.name || 'Người học'}${isCurrentUser ? ' (Bạn)' : ''}`);
    const subText = tabMode === 'streak'
      ? `Tổng ${fmt(row.totalSeconds)} · Kỷ lục ${row.bestStreak || row.streak || 1} ngày · Rank hôm nay: ${dailyTitle}`
      : `Rank hôm nay: ${dailyTitle}${row.streak ? ` · Chuỗi ${row.streak} ngày (Tổng ${fmt(row.totalSeconds)})` : ''}`;
    details.append(nameLine, element('small', '', subText));
    const metric = tabMode === 'streak'
      ? `${row.streak || 0} ngày · ${fmt(row.totalSeconds)}`
      : fmt(Number(row.todaySeconds) || 0);
    line.append(rank, details, element('strong', 'home-board-time', metric));
    return line;
  }

  function openFullLeaderboardModal() {
    if (!cachedBoardData) return;
    const overlay = element('div', 'home-modal-backdrop');
    const modal = element('section', 'home-modal-dialog');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    let modalTab = activeBoardTab;

    const head = element('div', 'home-modal-head');
    head.append(
      element('h3', 'section-heading', 'Toàn bộ Bảng xếp hạng'),
      button('Đóng ✕', 'focus-btn is-sm', () => overlay.remove())
    );

    const tabsBar = element('div', 'home-board-tabs');
    const mStudyBtn = button('Giờ học hôm nay (1 ngày)', `home-board-tab${modalTab === 'study' ? ' is-active' : ''}`, () => {
      modalTab = 'study';
      mStudyBtn.classList.add('is-active');
      mStreakBtn.classList.remove('is-active');
      paintModalList();
    });
    const mStreakBtn = button('Chuỗi học (Ngày & Tổng giờ)', `home-board-tab${modalTab === 'streak' ? ' is-active' : ''}`, () => {
      modalTab = 'streak';
      mStreakBtn.classList.add('is-active');
      mStudyBtn.classList.remove('is-active');
      paintModalList();
    });
    tabsBar.append(mStudyBtn, mStreakBtn);

    const listContainer = element('div', 'home-modal-list');
    function paintModalList() {
      listContainer.replaceChildren();
      const currentUid = auth?.currentUser?.uid || cachedBoardData?.uid || '';
      const rows = modalTab === 'streak' ? (cachedBoardData.streakRows || []) : (cachedBoardData.rows || []);
      if (!rows.length) {
        listContainer.append(element('p', 'home-board-empty', 'Chưa có thành viên nào trong danh sách này.'));
        return;
      }
      rows.forEach((r, idx) => {
        listContainer.append(createLeaderboardRowEl(r, idx + 1, modalTab, Boolean(currentUid && r.uid === currentUid)));
      });
    }

    paintModalList();
    modal.append(head, tabsBar, listContainer);
    overlay.append(modal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    window.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        window.removeEventListener('keydown', onEsc);
      }
    });
    document.body.append(overlay);
  }

  function openStreakCelebrationModal(statsInput = {}) {
    const user = auth?.currentUser;
    const studentName = user?.displayName || 'Học viên HTVVM';
    const streakDays = Math.max(0, Math.floor(Number(statsInput.streak) || 0));
    const milestoneDays = isStreakMilestone(streakDays)
      ? streakDays
      : (getReachedStreakMilestone(streakDays) || streakDays || 3);
    const totalSeconds = Math.max(0, Math.floor(Number(statsInput.totalSeconds) || 0));
    const todaySeconds = Math.max(0, Math.floor(Number(statsInput.todaySeconds) || 0));
    const rankTitle = titleFor(todaySeconds);

    const overlay = element('div', 'home-modal-backdrop streak-celebration-backdrop');
    const card = element('section', 'streak-celebration-modal');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');

    const kicker = element('span', 'streak-celebration-kicker', 'CHÚC MỪNG CỘT MỐC CHUỖI HỌC TẬP');
    const badge = element('div', 'streak-celebration-badge');
    badge.append(icon('flame', 34), element('strong', '', `${milestoneDays}`));
    const title = element('h2', 'streak-celebration-title', `Chuỗi ${milestoneDays} Ngày Học Liên Tiếp!`);
    const sub = element('p', 'streak-celebration-subtitle', `${studentName} đã duy trì kỷ luật tuyệt vời trên HTVVM Studio.`);

    const metricsGrid = element('div', 'streak-celebration-metrics');
    for (const [mLabel, mVal] of [
      ['Cột mốc chuỗi', `${milestoneDays} ngày`],
      ['Tổng thời gian học', fmt(totalSeconds)],
      ['Hôm nay & Rank ngày', `${fmt(todaySeconds)} · ${rankTitle}`]
    ]) {
      const box = element('div', 'streak-celebration-metric');
      box.append(element('small', '', mLabel), element('strong', '', mVal));
      metricsGrid.append(box);
    }

    const captureStatus = element('p', 'streak-capture-status', '');
    const actionsRow = element('div', 'streak-celebration-actions');
    const captureBtn = button('📸 Chụp màn hình kỷ niệm (Tải PNG)', 'primary-btn', async () => {
      const canvas = renderCelebrationCanvasPng({
        studentName,
        streakDays: milestoneDays,
        totalSeconds,
        todaySeconds,
        rankTitle
      });
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `chuoi-hoc-${milestoneDays}-ngay-htvvm.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      try {
        canvas.toBlob(async (blob) => {
          if (blob && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            captureStatus.textContent = '✓ Đã tải ảnh PNG và chép vào Clipboard để bạn dán chia sẻ ngay!';
          } else {
            captureStatus.textContent = '✓ Đã tải ảnh chụp màn hình chứng nhận (.png) về máy!';
          }
        }, 'image/png');
      } catch {
        captureStatus.textContent = '✓ Đã tải ảnh chụp màn hình chứng nhận (.png) về máy!';
      }
    });
    const closeBtn = button('Đóng', 'focus-btn', () => overlay.remove());
    actionsRow.append(captureBtn, closeBtn);

    card.append(kicker, badge, title, sub, metricsGrid, captureStatus, actionsRow);
    overlay.append(card);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.append(overlay);
  }

  let alive = true;
  const unsubscribeUser = AppStore.subscribe('user', () => { if (alive) { loadBoard(); loadExamProgress(); } });
  const unsubscribeStats = AppStore.subscribe('studyStats', (stats) => { if (alive && stats) paintMyBanner(stats); });
  const watcher = new MutationObserver(() => {
    if (!wrap.isConnected) {
      alive = false;
      window.clearInterval(flipTimerId);
      unsubscribeUser();
      unsubscribeStats();
      watcher.disconnect();
    }
  });
  watcher.observe(document.getElementById('main-content') || document.body, { childList: true });

  const examProgress = element('section', 'home-exam-stats-panel');
  const examProgressHeader = element('div', 'home-exam-stats-header');
  const examProgressTitle = element('div', '');
  examProgressTitle.append(element('h3', 'section-heading', 'Tiến trình luyện thi'), element('p', 'home-board-subtitle', 'Tổng hợp các lượt thi đã nộp trên máy chủ.'));
  const examOpen = button('Mở phòng thi', 'primary-btn', () => navigate('/exam'));
  examProgressHeader.append(examProgressTitle, examOpen);
  const examProgressBody = element('div', 'home-exam-stats-body');
  examProgress.append(examProgressHeader, examProgressBody);
  const dashboardGrid = element('div', 'home-dashboard-grid');
  dashboardGrid.append(examProgress, boardPanel);
  wrap.append(dashboardGrid, element('h3', 'section-heading', 'Không gian học tập'));

  const grid = element('div', 'module-grid');
  for (const [iconName, title, description, path] of modules) {
    const card = element('button', 'module-card'); card.type = 'button';
    const modIcon = element('span', 'module-icon');
    modIcon.append(icon(iconName, 22));
    card.append(modIcon, element('strong', 'module-title', title), element('span', 'module-description', description), element('span', 'module-link', 'Mở mục'));
    card.addEventListener('click', () => navigate(path)); grid.append(card);
  }
  wrap.append(grid);

  shareToggle.addEventListener('change', async () => {
    const user = auth?.currentUser;
    if (!user) {
      shareToggle.checked = false;
      return;
    }
    shareToggle.disabled = true;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/study-tracker', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sharing', enabled: shareToggle.checked }),
        cache: 'no-store'
      });
      if (res.ok) await loadBoard();
    } finally {
      if (alive) shareToggle.disabled = false;
    }
  });

  function renderBoardRows() {
    board.replaceChildren();
    boardFooterActions.replaceChildren();
    if (!cachedBoardData) return;
    const list = activeBoardTab === 'streak' ? (cachedBoardData.streakRows || []) : (cachedBoardData.rows || []);
    const currentUid = auth?.currentUser?.uid || cachedBoardData.uid || '';
    const myStats = cachedBoardData.myStats || AppStore.get('studyStats') || {};

    if (!list.length) {
      const emptyMsg = activeBoardTab === 'streak'
        ? 'Chưa có thành viên bật chia sẻ chuỗi học. Hãy tick "Hiện tôi trên BXH" để góp mặt!'
        : 'Chưa có người bật chia sẻ thời gian học hôm nay. Bạn có thể bật chia sẻ tại đây hoặc trong Góc tập trung.';
      board.append(element('p', 'home-board-empty', emptyMsg));
      return;
    }

    // 1. Only show Top 3 on the main Overview panel
    const top3 = list.slice(0, 3);
    top3.forEach((row, index) => {
      const isMe = Boolean(currentUid && row.uid === currentUid);
      board.append(createLeaderboardRowEl(row, index + 1, activeBoardTab, isMe));
    });

    // 2. Always show current user's own position below Top 3 if not already inside Top 3
    const myIdx = currentUid ? list.findIndex(r => r.uid === currentUid) : -1;
    if (currentUid && myIdx >= 3) {
      const sep = element('div', 'home-board-my-divider', 'Vị trí của bạn trên Bảng xếp hạng');
      const myRow = createLeaderboardRowEl(list[myIdx], myIdx + 1, activeBoardTab, true);
      board.append(sep, myRow);
    } else if (currentUid && myIdx < 0) {
      const sep = element('div', 'home-board-my-divider', 'Vị trí của bạn (Chưa bật hiển thị công khai trên BXH)');
      const selfRowObj = {
        uid: currentUid,
        name: auth?.currentUser?.displayName || 'Bạn',
        todaySeconds: Number(myStats.todaySeconds) || 0,
        totalSeconds: Number(myStats.totalSeconds) || 0,
        streak: Number(myStats.streak) || 0,
        bestStreak: Number(myStats.bestStreak) || 0
      };
      const myRow = createLeaderboardRowEl(selfRowObj, list.length + 1, activeBoardTab, true);
      myRow.querySelector('.home-board-rank').textContent = '—';
      board.append(sep, myRow);
    }

    // 3. "Xem thêm" button to open full leaderboard popup
    const viewAllBtn = button(
      `Xem thêm toàn bộ BXH (${list.length} học viên)`,
      'focus-btn home-board-view-all-btn',
      () => openFullLeaderboardModal()
    );
    boardFooterActions.append(viewAllBtn);
  }

  function paintMyBanner(my = {}) {
    if (!auth?.currentUser) {
      myStreakBanner.hidden = true;
      return;
    }
    const storeStats = AppStore.get('studyStats') || {};
    const studyStreak = Number.isFinite(Number(my.streak)) ? Number(my.streak) : (Number(storeStats.streak) || 0);
    const bestStudyStreak = Math.max(Number(my.bestStreak) || 0, Number(storeStats.bestStreak) || 0, studyStreak);
    const totalSec = Number.isFinite(Number(my.totalSeconds)) ? Number(my.totalSeconds) : (Number(storeStats.totalSeconds) || 0);
    const todaySec = Number.isFinite(Number(my.todaySeconds)) ? Number(my.todaySeconds) : (Number(storeStats.todaySeconds) || 0);
    const todayRank = titleFor(todaySec);
    const nextMilestone = getNextStreakMilestone(studyStreak);
    const reachedMilestone = getReachedStreakMilestone(studyStreak);

    myStreakBanner.hidden = false;
    const certBtn = button(
      reachedMilestone ? `🎉 Mốc ${reachedMilestone} ngày` : '🎉 Xem mốc chuỗi',
      'focus-btn is-sm home-streak-cert-btn',
      () => openStreakCelebrationModal({ streak: studyStreak, totalSeconds: totalSec, todaySeconds: todaySec })
    );
    certBtn.title = 'Mở màn hình chúc mừng cột mốc chuỗi học và chụp ảnh PNG kỷ niệm';

    myStreakBanner.replaceChildren(
      icon('flame', 15),
      element('span', '', 'Chuỗi học của bạn: '),
      element('strong', '', `${studyStreak} ngày · Tổng ${fmt(totalSec)}`),
      element('small', '', `(Hôm nay ${fmt(todaySec)} · Rank ngày: ${todayRank} · Kỷ lục ${bestStudyStreak} ngày · Mốc kế: ${nextMilestone} ngày)`),
      certBtn
    );

    // Auto-show celebration screen once when hitting an exact milestone day (3, 10, 30, 100, 200, 300, 400, 500...)
    const uid = auth.currentUser.uid;
    if (uid && isStreakMilestone(studyStreak)) {
      const seenKey = `htvvm-streak-milestone-seen:${uid}:${studyStreak}`;
      let alreadySeen = false;
      try { alreadySeen = localStorage.getItem(seenKey) === '1'; } catch {}
      if (!alreadySeen) {
        try { localStorage.setItem(seenKey, '1'); } catch {}
        openStreakCelebrationModal({ streak: studyStreak, totalSeconds: totalSec, todaySeconds: todaySec });
      }
    }
  }

  async function loadBoard() {
    if (!alive) return;
    refresh.disabled = true; refresh.textContent = 'Đang tải…';
    board.replaceChildren(element('p', 'focus-muted', 'Đang tải bảng xếp hạng…'));
    try {
      const user = auth?.currentUser;
      if (!user) {
        cachedBoardData = null;
        myStreakBanner.hidden = true;
        shareToggle.checked = false;
        shareToggle.disabled = true;
        boardFooterActions.replaceChildren();
        board.replaceChildren(element('p', 'home-board-empty', 'Đăng nhập Google để theo dõi giờ học, chuỗi học và xem bảng xếp hạng.'));
        return;
      }
      shareToggle.disabled = false;
      const token = await user.getIdToken();
      const response = await fetch('/api/leaderboards', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!alive) return;
      if (!response.ok) throw new Error(data.error || 'Không tải được bảng xếp hạng.');
      cachedBoardData = data;
      const my = data.myStats || {};
      shareToggle.checked = Boolean(my.sharing);
      paintMyBanner(my);
      renderBoardRows();
    } catch (error) {
      if (alive) board.replaceChildren(element('p', 'home-board-empty', error.message || 'Không tải được bảng xếp hạng.'));
    } finally { if (alive) { refresh.disabled = false; refresh.textContent = 'Làm mới'; } }
  }

  async function loadExamProgress() {
    if (!alive) return;
    examProgressBody.replaceChildren(element('p', 'home-board-empty', 'Đang tải thống kê luyện thi…'));
    const user = auth?.currentUser;
    if (!user) {
      examProgressBody.replaceChildren(element('p', 'home-board-empty', 'Đăng nhập Google để lưu và xem lịch sử thi đồng bộ.'));
      return;
    }
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/exam?action=history', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!alive) return;
      if (!response.ok) throw new Error(data.error || 'Không tải được tiến trình luyện thi.');
      const stats = data.summary || {}, history = data.history || [];
      const cards = element('div', 'home-exam-stats-cards');
      for (const [label, value] of [['Lượt thi', stats.total ?? history.length], ['Điểm TB', `${Number(stats.averageScore || 0).toFixed(2)}/10`], ['Cao nhất', `${Number(stats.bestScore || 0).toFixed(2)}/10`]]) {
        const card = element('article', 'home-exam-stat'); card.append(element('small', '', label), element('strong', '', String(value))); cards.append(card);
      }
      examProgressBody.replaceChildren(cards);
      if (!history.length) examProgressBody.append(element('p', 'home-board-empty', 'Chưa có bài thi nào được nộp. Vào Phòng thi để bắt đầu.'));
      for (const record of history.slice(0, 3)) {
        const row = element('div', 'home-exam-recent');
        const info = element('div', 'home-exam-recent-info');
        info.append(element('strong', '', record.examTitle || record.examId), element('small', '', record.submittedAt ? new Date(record.submittedAt).toLocaleDateString('vi-VN') : ''));
        row.append(info, element('strong', 'home-exam-recent-score', `${Number(record.score || 0).toFixed(2)}/10`)); examProgressBody.append(row);
      }
    } catch (error) {
      if (alive) examProgressBody.replaceChildren(element('p', 'home-board-empty', error.message || 'Không tải được tiến trình luyện thi.'));
    }
  }
  loadBoard();
  loadExamProgress();
  return wrap;
}
