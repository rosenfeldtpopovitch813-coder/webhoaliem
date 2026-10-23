import { AppStore } from './store.js';
export const ROUTES = Object.freeze({
  '/': { title: 'Tổng quan', module: 'home' },
  '/exam': { title: 'Phòng thi', module: 'exam-room' },
  '/arena': { title: 'Chem Arena', module: 'chem-arena' },
  '/chemmaker': { title: 'ChemMaker', module: 'chemmaker' },
  '/handbook': { title: 'Sổ tay', module: 'handbook' },
  '/focus': { title: 'Góc tập trung', module: 'focus-zone' },
  '/community': { title: 'Trợ lý AI', module: 'community-ai' },
  '/admissions': { title: 'Nguyện vọng', module: 'admissions' },
  '/library': { title: 'Thư viện học liệu', module: 'library' }
});
export function resolveRoute(pathname) {
  const normalized = (pathname.replace(/\/+$/, '') || '/');
  const route = ROUTES[normalized];
  if (!route) return { status: 404, path: normalized, title: 'Không tìm thấy', module: 'placeholder' };
  return { ...route, path: normalized, status: 200 };
}
export function navigate(path) {
  if (!Object.hasOwn(ROUTES, path)) path = '/';
  if (location.pathname !== path) history.pushState({}, '', path);
  AppStore.set('route', path);
}
export function startRouter() {
  const listener = () => AppStore.set('route', location.pathname);
  window.addEventListener('popstate', listener);
  listener();
  return () => window.removeEventListener('popstate', listener);
}
export async function loadRouteView(route) {
  if (route.status !== 200) {
    const mod = await import('../modules/placeholder/index.js');
    return mod.renderPlaceholder(route);
  }
  if (route.module === 'home') {
    const mod = await import('../modules/home/index.js');
    return mod.renderHome();
  }
  if (route.module === 'chem-arena') { const mod = await import('../modules/chem-arena/index.js'); return mod.renderArena(); }
  if (route.module === 'exam-room') { const mod = await import('../modules/exam-room/index.js'); return mod.renderExam(); }
  if (route.module === 'chemmaker') { const mod = await import('../modules/chemmaker/index.js'); return mod.renderChemMaker(); }
  if (route.module === 'focus-zone') { const mod = await import('../modules/focus-zone/index.js'); return mod.renderFocus(); }
  if (route.module === 'handbook') { const mod = await import('../modules/handbook/index.js'); return mod.renderHandbook(); }
  if (route.module === 'admissions') { const mod = await import('../modules/admissions/index.js'); return mod.renderAdmissions(); }
  if (route.module === 'community-ai') { const mod = await import('../modules/community-ai/index.js'); return mod.renderCommunityAI(); }
  if (route.module === 'library') { const mod = await import('../modules/library/index.js'); return mod.renderLibrary(); }
  const mod = await import('../modules/placeholder/index.js');
  return mod.renderPlaceholder(route);
}
