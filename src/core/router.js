import { AppStore } from './store.js';
export const ROUTES = Object.freeze({
  '/': { title: 'Tổng quan', module: 'home' },
  '/exam-paper': { title: 'Soạn đề', module: 'exam-paper' },
  '/whiteboard': { title: 'Bảng vẽ Mực', module: 'whiteboard' },
  '/exam': { title: 'Phòng thi', module: 'exam-room' },
  '/arena': { title: 'Đấu trường học tập', module: 'arena' },
  '/experiments': { title: 'Mô hình thí nghiệm', module: 'experiments' },
  '/handbook': { title: 'Sổ tay', module: 'handbook' },
  '/focus': { title: 'Góc tập trung', module: 'focus-zone' },
  '/community': { title: 'Trợ lý AI', module: 'community-ai' },
  '/admissions': { title: 'Nguyện vọng', module: 'admissions' },
  '/library': { title: 'Thư viện học liệu', module: 'library' }
});

export function extractExamRoomIdFromLocation(pathname = typeof location !== 'undefined' ? location.pathname : '', search = typeof location !== 'undefined' ? location.search : '') {
  const pathMatch = /^\/exam\/([A-Za-z0-9]{12})\/?$/i.exec(String(pathname || ''));
  if (pathMatch) return pathMatch[1].toUpperCase();
  try {
    const params = new URLSearchParams(String(search || ''));
    const raw = (params.get('room') || params.get('id') || params.get('exam') || '').trim();
    if (/^[A-Za-z0-9]{12}$/.test(raw)) return raw.toUpperCase();
  } catch { /* ignore */ }
  return '';
}

export function resolveRoute(pathname) {
  const raw = String(pathname || '/').split(/[?#]/)[0];
  const normalized = (raw.replace(/\/+$/, '') || '/');
  const directExamMatch = /^\/exam\/([A-Za-z0-9]{12})$/i.exec(normalized);
  if (directExamMatch) {
    return { ...ROUTES['/exam'], path: '/exam', roomId: directExamMatch[1].toUpperCase(), status: 200 };
  }
  const route = ROUTES[normalized];
  if (!route) return { status: 404, path: normalized, title: 'Không tìm thấy', module: 'placeholder' };
  return { ...route, path: normalized, status: 200 };
}

export function navigate(path) {
  if (AppStore.get('examLockdown') && path !== '/exam') {
    AppStore.set('notice', 'Đang trong phòng thi khóa bảo mật — bạn cần Nộp bài mới được thoát ra ngoài.');
    return;
  }
  const rawPath = String(path || '/');
  const cleanPathname = rawPath.split(/[?#]/)[0];
  const resolved = resolveRoute(cleanPathname);
  const target = resolved.status === 200 ? rawPath : '/';
  if (`${location.pathname}${location.search}` !== target) history.pushState({}, '', target);
  AppStore.set('route', resolved.status === 200 ? resolved.path : '/');
}

export function startRouter() {
  const listener = () => {
    if (AppStore.get('examLockdown')) {
      if (location.pathname !== '/exam') history.pushState({ examLockdown: true }, '', '/exam');
      return;
    }
    const resolved = resolveRoute(location.pathname);
    AppStore.set('route', resolved.status === 200 ? resolved.path : location.pathname);
  };
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
  if (route.module === 'exam-paper') { const mod = await import('../modules/exam-paper/index.js'); return mod.renderExamPaperApp(); }
  if (route.module === 'whiteboard') { const mod = await import('../modules/whiteboard/index.js'); return mod.renderWhiteboardApp(); }
  if (route.module === 'arena') { const mod = await import('../modules/arena/index.js'); return mod.renderArena(); }
  if (route.module === 'experiments') { const mod = await import('../modules/experiments/index.js'); return mod.renderExperiments(); }
  if (route.module === 'exam-room') { const mod = await import('../modules/exam-room/index.js'); return mod.renderExam(); }
  if (route.module === 'focus-zone') { const mod = await import('../modules/focus-zone/index.js'); return mod.renderFocus(); }
  if (route.module === 'handbook') { const mod = await import('../modules/handbook/index.js'); return mod.renderHandbook(); }
  if (route.module === 'admissions') { const mod = await import('../modules/admissions/index.js'); return mod.renderAdmissions(); }
  if (route.module === 'community-ai') { const mod = await import('../modules/community-ai/index.js'); return mod.renderCommunityAI(); }
  if (route.module === 'library') { const mod = await import('../modules/library/index.js'); return mod.renderLibrary(); }
  const mod = await import('../modules/placeholder/index.js');
  return mod.renderPlaceholder(route);
}
