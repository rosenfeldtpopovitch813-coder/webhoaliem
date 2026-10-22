import { element } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
const modules = [
  ['✦', 'Khảo thí', 'Phòng thi, chấm điểm 3 phần và sổ tay câu sai', '/exam'],
  ['⚡', 'Chem Arena', 'Đấu trường Hóa học realtime', '/arena'],
  ['◈', 'ChemMaker', 'Soạn thảo đề thi và công thức Hóa học', '/chemmaker'],
  ['▦', 'Sổ tay học tập', 'Tra cứu nhanh kiến thức và đồ thị', '/handbook'],
  ['◷', 'Focus Zone', 'Pomodoro và không gian học tập', '/focus'],
  ['☷', 'Cộng đồng & AI', 'Thảo luận và trợ giảng', '/community'],
  ['⌁', 'Nguyện vọng', 'Tổ hợp môn và tư vấn tuyển sinh', '/admissions']
];
export function renderHome() {
  const wrap = element('div', 'space-y-7');
  const hero = element('section', 'hero');
  hero.append(element('div', 'eyebrow', 'HTVVM STUDIO • PHASE 7'), element('h2', 'hero-title', 'Học tập theo cách của bạn.'), element('p', 'hero-subtitle', 'Một không gian cho luyện thi, sáng tạo và tập trung. Khảo thí, Chem Arena, ChemMaker, Focus Zone, tư vấn nguyện vọng và AI Tutor trong một không gian học tập.'));
  wrap.append(hero, element('h3', 'section-heading', 'Không gian học tập'));
  const grid = element('div', 'module-grid');
  for (const [glyph, title, description, path] of modules) {
    const card = element('button', 'module-card'); card.type = 'button';
    card.append(element('span', 'module-icon', glyph), element('strong', 'module-title', title), element('span', 'module-description', description), element('span', 'module-link', 'Khám phá →'));
    card.addEventListener('click', () => navigate(path)); grid.append(card);
  }
  wrap.append(grid); return wrap;
}
