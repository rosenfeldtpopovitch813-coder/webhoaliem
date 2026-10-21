export class ReactiveStore {
  constructor(initialState = {}) { this.state = { ...initialState }; this.listeners = new Map(); }
  get(key) { return this.state[key]; }
  getState() { return { ...this.state }; }
  set(key, value) {
    if (Object.is(this.state[key], value)) return;
    this.state[key] = value;
    for (const callback of [...(this.listeners.get(key) || [])]) callback(value, this.getState());
    for (const callback of [...(this.listeners.get('*') || [])]) callback(this.getState());
  }
  subscribe(key, callback) {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key)?.delete(callback);
  }
}
export const AppStore = new ReactiveStore({
  user: null, role: 'student', roleVerified: false, authLoading: true,
  route: '/', activeTab: 'home', theme: 'aurora', focusActive: false,
  timeSynced: false, notice: ''
});
