const SVG_NS = 'http://www.w3.org/2000/svg';

const PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/><path d="M9.5 21v-6h5v6"/>',
  'exam-paper': '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M8.5 11.5h7"/><path d="M8.5 15h4.5"/><circle cx="15.5" cy="15.5" r="1.5"/>',
  whiteboard: '<path d="M12 19l7-7 3 3-7 7-3-3Z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5Z"/><path d="m2 2 7.5 7.5"/><circle cx="11" cy="11" r="1.6"/>',
  'exam-room': '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M11.5 3v18"/><path d="M6 8h3"/><path d="M6 12h3"/><path d="M6 16h2.5"/><circle cx="15" cy="8" r="1.2"/><circle cx="18" cy="8" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/><path d="M14 16h5"/>',
  arena: '<path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2Z"/>',
  handbook: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/><path d="M8.5 7.5h7"/><path d="M8.5 11h5"/>',
  focus: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.6 1.8"/><path d="M9.5 2h5"/><path d="M12 2v3"/>',
  library: '<path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"/><path d="M8 13h8"/>',
  admissions: '<circle cx="12" cy="12" r="9"/><polygon points="15.8 8.2 13.5 13.5 8.2 15.8 10.5 10.5 15.8 8.2"/>',
  ai: '<path d="m12 3 2.1 5.9L20 11l-5.9 2.1L12 19l-2.1-5.9L4 11l5.9-2.1L12 3Z"/><path d="M19 3v3"/><path d="M17.5 4.5h3"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v1a3 3 0 0 0 3 3"/><path d="M17 6h3v1a3 3 0 0 1-3 3"/><path d="M12 14v4"/><path d="M8.5 20h7"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  external: '<path d="M14 4h6v6"/><path d="M10 14 20 4"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>'
};

export function icon(name, size = 18) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('vec-icon');
  svg.innerHTML = PATHS[name] || PATHS['exam-paper'];
  return svg;
}
