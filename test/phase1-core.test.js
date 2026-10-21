import test from 'node:test';
import assert from 'node:assert/strict';
import { getVNDayIndex, getVNDateString, mergeStudyIntervals } from '../shared/time-utils.js';
import { AppStore } from '../src/core/store.js';
import { MonotonicClock } from '../src/core/clock.js';

// ============================================================================
// 1. KIỂM THỬ MÚI GIỜ VIỆT NAM (UTC+7) & RANH GIỚI NỬA ĐÊM (STREAK LOGIC)
// ============================================================================
test('Time Utils - Chuyển đổi đúng ngày theo múi giờ Việt Nam (UTC+7)', async (t) => {
  await t.test('Xử lý đúng ranh giới 00:00:00 giờ Việt Nam (tức 17:00:00 UTC ngày hôm trước)', () => {
    const beforeMidnightVN = Date.UTC(2026, 9, 20, 16, 59, 59, 999);
    const exactMidnightVN = Date.UTC(2026, 9, 20, 17, 0, 0, 0);

    assert.equal(getVNDateString(beforeMidnightVN), '2026-10-20');
    assert.equal(getVNDateString(exactMidnightVN), '2026-10-21');

    const dayIndexBefore = getVNDayIndex(beforeMidnightVN);
    const dayIndexAfter = getVNDayIndex(exactMidnightVN);
    assert.equal(dayIndexAfter - dayIndexBefore, 1);
  });

  await t.test('Học lúc 01:00 sáng và 23:00 đêm cùng ngày giờ VN phải có cùng DayIndex', () => {
    const morningVN = Date.UTC(2026, 9, 20, 18, 0, 0);
    const nightVN = Date.UTC(2026, 9, 21, 16, 0, 0);

    assert.equal(getVNDayIndex(morningVN), getVNDayIndex(nightVN));
    assert.equal(getVNDateString(morningVN), '2026-10-21');
    assert.equal(getVNDateString(nightVN), '2026-10-21');
  });
});

// ============================================================================
// 2. KIỂM THỬ THUẬT TOÁN GỘP KHOẢNG THỜI GIAN (CHỐNG MỞ NHIỀU TAB CÀY GIỜ)
// ============================================================================
test('Interval Merging - Gộp khoảng thời gian học chống nhân bản tab', async (t) => {
  await t.test('Gộp 2 tab mở chồng lấn một phần: [10, 30] và [20, 45] -> [10, 45]', () => {
    const raw = [[20, 45], [10, 30]];
    const merged = mergeStudyIntervals(raw);
    assert.deepEqual(merged, [[10, 45]]);
  });

  await t.test('Gộp trường hợp tab nhỏ nằm trọn bên trong tab lớn: [0, 60] và [15, 30] -> [0, 60]', () => {
    const raw = [[0, 60], [15, 30], [20, 25]];
    const merged = mergeStudyIntervals(raw);
    assert.deepEqual(merged, [[0, 60]]);
  });

  await t.test('Nối liền 2 khoảng chạm đầu mút: [10, 20] và [20, 35] -> [10, 35]', () => {
    const raw = [[10, 20], [20, 35]];
    const merged = mergeStudyIntervals(raw);
    assert.deepEqual(merged, [[10, 35]]);
  });

  await t.test('Giữ nguyên các khoảng thời gian học tách biệt hoàn toàn', () => {
    const raw = [[10, 20], [30, 40], [50, 60]];
    const merged = mergeStudyIntervals(raw);
    assert.deepEqual(merged, [[10, 20], [30, 40], [50, 60]]);
  });

  await t.test('Lọc bỏ các khoảng dữ liệu rác / gian lận (end <= start, NaN, null)', () => {
    const corrupted = [
      [50, 20],
      [30, 30],
      [NaN, 100],
      [null, undefined],
      [10, 40]
    ];
    const merged = mergeStudyIntervals(corrupted);
    assert.deepEqual(merged, [[10, 40]]);
  });
});

// ============================================================================
// 3. KIỂM THỬ REACTIVE STORE & MONOTONIC CLOCK
// ============================================================================
test('ReactiveStore & MonotonicClock - Quản lý trạng thái và đồng bộ giờ chuẩn', async (t) => {
  await t.test('Chỉ thông báo (notify) khi giá trị thực sự thay đổi', () => {
    let callCount = 0;
    let latestTab = '';

    const unsubscribe = AppStore.subscribe('activeTab', (newVal) => {
      callCount++;
      latestTab = newVal;
    });

    AppStore.set('activeTab', 'arena');
    assert.equal(callCount, 1);
    assert.equal(latestTab, 'arena');

    AppStore.set('activeTab', 'arena');
    assert.equal(callCount, 1);

    unsubscribe();
    AppStore.set('activeTab', 'home');
    assert.equal(callCount, 1);
    assert.equal(AppStore.get('activeTab'), 'home');
  });

  await t.test('MonotonicClock bù trừ đúng khi đồng hồ máy tính bị chỉnh lệch 1 tiếng', async () => {
    const clock = new MonotonicClock();
    const fakeServerTime = Date.now() + 3600 * 1000; // Giả sử máy người dùng đang chạy chậm hơn Server 1 tiếng
    
    await clock.syncWithServer(async () => ({
      json: async () => ({ serverTime: fakeServerTime })
    }));

    assert.equal(clock.isSynced, true);
    const diff = Math.abs(clock.now() - fakeServerTime);
    assert.ok(diff < 50, `Sai số quá lớn: ${diff}ms`);
  });
});
