export class MonotonicClock {
  constructor({ wallNow = () => Date.now(), monotonicNow = () => performance.now() } = {}) {
    this.wallNow = wallNow;
    this.monotonicNow = monotonicNow;
    this.clientInitWallTime = wallNow();
    this.clientInitPerfTime = monotonicNow();
    this.serverOffset = 0;
    this.isSynced = false;
  }
  async syncWithServer(fetchFn = fetch) {
    try {
      const t0 = this.monotonicNow();
      const res = await fetchFn('/api/time', { cache: 'no-store' });
      if (res.ok === false) throw new Error(`HTTP ${res.status}`);
      const { serverTime } = await res.json();
      if (!Number.isFinite(serverTime)) throw new Error('Invalid server time');
      const t1 = this.monotonicNow();
      const latency = (t1 - t0) / 2;
      const currentMonotonic = this.clientInitWallTime + (t1 - this.clientInitPerfTime);
      this.serverOffset = serverTime + latency - currentMonotonic;
      this.isSynced = true;
      return true;
    } catch (error) {
      this.isSynced = false;
      console.warn('Không thể đồng bộ thời gian máy chủ:', error);
      return false;
    }
  }
  now() { return Math.round(this.clientInitWallTime + (this.monotonicNow() - this.clientInitPerfTime) + this.serverOffset); }
}
export const AppClock = new MonotonicClock();
