import { ELEMENTS, ELEMENT_RECORDS, IR_BANDS, estimateShells, shellsFromConfiguration, loadPeriodicMetadata, loadElementImage } from '../../../shared/chem-data.js';
import { compileExpression, sampleGraph } from '../../../shared/graph-math.js';
import { element, button } from '../../core/dom.js';

export function renderHandbook() {
  const root = element('div', 'handbook-root'), hero = element('div', 'hero exam-hero');
  hero.append(element('div', 'eyebrow', 'SỔ TAY HỌC TẬP'), element('h1', 'hero-title', 'Sổ tay khoa học & Máy vẽ đồ thị'), element('p', 'hero-subtitle', 'Tra cứu đủ 118 nguyên tố, xem mô hình nguyên tử và ảnh mẫu thực tế, tra phổ hồng ngoại IR và vẽ nhiều hàm số với trục tuỳ chỉnh.'));
  const tabs = element('div', 'exam-tabs'), panel = element('section', 'exam-panel'); root.append(hero, tabs, panel);
  const names = [['element', 'Bảng tuần hoàn'], ['ir', 'Phổ hồng ngoại IR'], ['graph', 'Máy vẽ đồ thị']];
  let elementModal = null;
  for (const [id, name] of names) tabs.append(button(name, 'exam-tab', () => show(id)));
  function show(name) { if (elementModal) { elementModal.remove(); elementModal = null; } panel.replaceChildren(); if (name === 'element') elementTab(); if (name === 'ir') irTab(); if (name === 'graph') graphTab(); for (const b of tabs.children) b.classList.toggle('selected', b.textContent === names.find(x => x[0] === name)[1]); }

  function elementTab() {
    panel.append(element('h2', 'exam-heading', 'Bảng tuần hoàn 118 nguyên tố'));
    const toolbar = element('div', 'element-toolbar'), filter = document.createElement('input'); filter.className = 'exam-input'; filter.placeholder = 'Tìm tên, ký hiệu hoặc số hiệu nguyên tử…'; filter.setAttribute('aria-label', 'Tìm nguyên tố');
    const count = element('span', 'element-count', '118 nguyên tố'); toolbar.append(filter, count);
    const grid = element('div', 'element-grid'), selectedLine = element('p', 'exam-message', 'Chọn một nguyên tố để xem cấu hình electron, mô hình Rutherford và ảnh mẫu thực tế.');
    const sourceNote = element('p', 'exam-message', 'Dữ liệu nguyên tố: StaticData / Periodic-Table-JSON. Ảnh mẫu và ảnh minh hoạ được lấy từ Wikimedia Commons hoặc trang Wikipedia tương ứng khi có mạng.');
    const dataSource = document.createElement('a'); dataSource.href = 'https://staticdata.dev/datasets/periodic-table/'; dataSource.target = '_blank'; dataSource.rel = 'noopener noreferrer'; dataSource.textContent = 'Nguồn bộ dữ liệu 118 nguyên tố ↗'; dataSource.className = 'element-source-link';
    panel.append(toolbar, grid, selectedLine, sourceNote, dataSource);
    const modal = element('div', 'element-modal-backdrop'); modal.hidden = true;
    const dialog = element('section', 'element-modal-dialog'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', 'Chi tiết nguyên tố'); dialog.tabIndex = -1;
    const modalTop = element('div', 'element-modal-top'); modalTop.append(element('span', '', 'CHI TIẾT NGUYÊN TỐ'));
    const closeModal = () => { modal.hidden = true; };
    modalTop.append(button('Đóng ✕', 'element-modal-close', closeModal));
    const detail = element('section', 'element-detail element-detail-empty', 'Thông tin nguyên tố sẽ hiện ở đây.');
    dialog.append(modalTop, detail); modal.append(dialog); root.append(modal); elementModal = modal;
    modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
    const tiles = [];
    for (const row of ELEMENT_RECORDS) {
      const b = button('', `element-tile category-${row.category.replace(/[^a-z0-9]+/gi, '-')}`, () => { selectElement(row, detail, grid, modal); modal.hidden = false; dialog.focus(); });
      b.style.gridColumn = String(row.col); b.style.gridRow = String(row.row); b.dataset.search = `${row.z} ${row.symbol} ${row.name} ${row.category}`.toLowerCase();
      b.append(element('small', '', String(row.z)), element('strong', '', row.symbol), element('small', 'element-tile-name', row.name)); grid.append(b); tiles.push(b);
    }
    filter.addEventListener('input', () => { const query = filter.value.trim().toLowerCase(); let shown = 0; for (const tile of tiles) { const visible = tile.dataset.search.includes(query); tile.hidden = !visible; if (visible) shown++; } count.textContent = `${shown}/118 nguyên tố`; });
  }

  async function selectElement(row, detail, grid, modal) {
    for (const tile of grid.querySelectorAll('.element-tile')) tile.classList.toggle('chosen', Number(tile.querySelector('small')?.textContent) === row.z);
    detail.classList.remove('element-detail-empty'); detail.replaceChildren();
    const headline = element('div', 'element-detail-head'), number = element('span', 'element-number', `Z = ${row.z}`), nameBox = element('div', 'element-detail-name'), title = element('h3', '', `${row.name} (${row.symbol})`), subtitle = element('p', '', `${row.category} · Trạng thái chuẩn: ${row.phase}`);
    nameBox.append(title, subtitle); headline.append(number, nameBox); detail.append(headline);
    const info = element('div', 'element-facts'); const mass = row.mass; const neutrons = Math.max(0, Math.round(mass) - row.z);
    const facts = [['Số proton', String(row.z)], ['Số electron (nguyên tử trung hoà)', String(row.z)], ['Số neutron ước tính', `${neutrons}*`], ['Nguyên tử khối tương đối', String(mass)], ['Chu kì', String(row.period)], ['Nhóm', row.row >= 8 ? 'Khối f' : String(row.group)]];
    for (const [label, value] of facts) { const card = element('div', 'element-fact'); card.append(element('small', '', label), element('strong', '', value)); info.append(card); }
    detail.append(info);
    const lower = element('div', 'element-detail-grid'), modelCard = element('article', 'element-visual-card'), specimenCard = element('article', 'element-visual-card');
    modelCard.append(element('h4', '', 'Mô hình Rutherford'), element('p', 'element-visual-note', 'Hạt nhân ở tâm, electron chuyển động xung quanh — sơ đồ minh hoạ, không theo tỉ lệ.'));
    const modelSlot = element('div', 'atom-model-slot'); modelCard.append(modelSlot);
    modelCard.append(element('p', 'element-visual-note', 'Các vòng biểu diễn lớp electron để dễ quan sát; không phải quỹ đạo chính xác của electron.'));
    specimenCard.append(element('h4', '', 'Hình dạng thực tế / mẫu nguyên tố'), element('p', 'element-visual-note', 'Ảnh mẫu sẽ tải từ nguồn tham khảo khi có kết nối mạng. Với nguyên tố tổng hợp, ảnh có thể là minh hoạ hoặc không có mẫu vĩ mô.'));
    const imageSlot = element('div', 'element-specimen-slot'); imageSlot.append(element('div', 'element-image-loading', 'Đang tải ảnh mẫu…')); specimenCard.append(imageSlot);
    lower.append(modelCard, specimenCard); detail.append(lower);
    const configLine = element('div', 'element-config-line', `Phân bố electron theo lớp (ước tính): ${estimateShells(row.z).join(' – ')}`); detail.append(configLine);
    const caution = element('p', 'element-footnote', '* Số neutron dùng số khối gần đúng từ nguyên tử khối; đồng vị khác nhau có thể có số neutron khác nhau.'); detail.append(caution);
    modelSlot.replaceChildren(buildAtomSvg(estimateShells(row.z), row.z, neutrons));
    try {
      const [sourceMap, imageInfo] = await Promise.all([loadPeriodicMetadata(), loadElementImage(row.name)]);
      // Ignore an outdated async result if the learner picked another element meanwhile.
      if (detail.querySelector('.element-detail-name h3')?.textContent !== `${row.name} (${row.symbol})`) return;
      const metadata = sourceMap.get(row.z);
      if (metadata?.electronConfiguration) {
        const shells = shellsFromConfiguration(metadata.electronConfiguration, row.z);
        modelSlot.replaceChildren(buildAtomSvg(shells, row.z, neutrons));
        configLine.textContent = `Cấu hình electron: ${metadata.electronConfiguration} · Phân bố theo lớp: ${shells.join(' – ')}`;
      }
      imageSlot.replaceChildren();
      if (imageInfo.image) {
        const link = document.createElement('a'); link.href = imageInfo.page; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.className = 'element-specimen-link'; link.title = 'Mở trang nguồn ảnh';
        const img = document.createElement('img'); img.src = imageInfo.image; img.alt = `Ảnh mẫu hoặc hình ảnh minh hoạ cho nguyên tố ${row.name}`; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => { link.replaceChildren(); imageFallback(link, row); }, { once: true }); link.append(img); imageSlot.append(link);
        imageSlot.append(element('small', 'element-image-caption', imageInfo.description || imageInfo.title || `Ảnh tham khảo của ${row.name}`));
        if (imageInfo.attribution) imageSlot.append(element('small', 'element-image-attribution', imageInfo.attribution));
        const sourceLink = document.createElement('a'); sourceLink.href = imageInfo.page; sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer'; sourceLink.className = 'element-source-link'; sourceLink.textContent = 'Nguồn ảnh / thông tin ↗'; imageSlot.append(sourceLink);
      } else imageFallback(imageSlot, row);
    } catch {
      if (detail.querySelector('.element-detail-name h3')?.textContent === `${row.name} (${row.symbol})`) { imageSlot.replaceChildren(); imageFallback(imageSlot, row); }
    }
  }

  function imageFallback(container, row) {
    container.replaceChildren(); const fallback = element('div', `element-specimen-fallback specimen-${row.category.replace(/[^a-z0-9]+/gi, '-')}`);
    fallback.append(element('span', 'specimen-symbol', row.symbol), element('strong', '', row.name), element('small', '', 'Không tải được ảnh trực tiếp'));
    const link = document.createElement('a'); link.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(row.name.replaceAll(' ', '_'))}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.className = 'element-source-link'; link.textContent = 'Mở nguồn để xem ảnh thực tế ↗';
    container.append(fallback, link);
  }

  function buildAtomSvg(shells, z, neutrons) {
    const ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 360 280'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `Mô hình nguyên tử minh hoạ ${z} proton, ${z} electron`); svg.classList.add('atom-model-svg');
    const add = (tag, attrs, text = '') => { const n = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, String(value)); if (text) n.textContent = text; svg.append(n); return n; };
    const cx = 180, cy = 132, maxR = Math.min(112, 20 + Math.max(1, shells.length) * 13.4);
    (shells.length ? shells : [z]).forEach((electrons, shellIndex) => {
      const r = 22 + shellIndex * (maxR - 22) / Math.max(1, shells.length - 1);
      add('ellipse', { cx, cy, rx: r, ry: r * .78, fill: 'none', stroke: 'currentColor', 'stroke-opacity': .25, 'stroke-width': 1.2 });
      const count = Math.max(0, Math.round(electrons || 0));
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i / Math.max(count, 1)) + shellIndex * .43;
        const x = cx + r * Math.cos(angle), y = cy + r * .78 * Math.sin(angle);
        add('circle', { cx: x.toFixed(2), cy: y.toFixed(2), r: count > 24 ? 2.3 : 3.2, fill: '#32b8ff', stroke: '#d9f4ff', 'stroke-width': .8 });
      }
    });
    // Compact symbolic nucleus. Dot counts are illustrative; exact counts are written beneath it.
    const dotCount = Math.min(24, Math.max(4, Math.round(Math.sqrt(z + neutrons) * 2.2)));
    for (let i = 0; i < dotCount; i++) {
      const angle = i * 2.39996, radius = 2 + 14 * Math.sqrt((i + .5) / dotCount);
      const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
      add('circle', { cx: x.toFixed(2), cy: y.toFixed(2), r: 4.1, fill: i % 2 ? '#8c98a9' : '#f06c68', stroke: '#fff', 'stroke-width': .45 });
    }
    add('text', { x: 180, y: 260, 'text-anchor': 'middle', fill: 'currentColor', 'font-size': 11 }, `Hạt nhân: ${z} p⁺ · khoảng ${neutrons} n⁰`);
    add('circle', { cx: 24, cy: 22, r: 4, fill: '#32b8ff' }); add('text', { x: 34, y: 26, fill: 'currentColor', 'font-size': 10 }, 'electron');
    add('circle', { cx: 24, cy: 42, r: 4, fill: '#f06c68' }); add('text', { x: 34, y: 46, fill: 'currentColor', 'font-size': 10 }, 'proton');
    add('circle', { cx: 24, cy: 62, r: 4, fill: '#8c98a9' }); add('text', { x: 34, y: 66, fill: 'currentColor', 'font-size': 10 }, 'neutron');
    return svg;
  }

  function irTab() {
    panel.append(element('h2', 'exam-heading', 'Dải hấp thụ IR điển hình')); const filter = document.createElement('input'); filter.className = 'exam-input'; filter.placeholder = 'Tìm nhóm chức hoặc số sóng (cm⁻¹)'; const list = element('div', 'ir-list');
    const paint = () => { list.replaceChildren(); const term = filter.value.toLowerCase(); for (const [group, band, note] of IR_BANDS) { if (![group, band, note].join(' ').toLowerCase().includes(term)) continue; const row = element('div', 'ir-row'); row.append(element('strong', '', group), element('span', '', band + ' cm⁻¹'), element('small', '', note)); list.append(row); } };
    filter.addEventListener('input', paint); panel.append(filter, list, element('p', 'exam-message', 'Dải IR là giá trị tham khảo: vị trí thực tế phụ thuộc mẫu, dung môi và môi trường liên kết.')); paint();
  }

  function graphTab() {
    panel.append(element('h2', 'exam-heading', 'Máy vẽ đồ thị nâng cao'));
    panel.append(element('p', 'exam-message', 'Vẽ nhiều hàm cùng lúc; hỗ trợ nhân ẩn như 2x và x(x−1), hàm lượng giác, log, mũ, căn, giá trị tuyệt đối, min/max. Mỗi dòng là một hàm; không thực thi JavaScript.'));
    const form = element('div', 'graph-workspace'), side = element('div', 'graph-sidebar'), canvasColumn = element('div', 'graph-stage');
    const expressionsLabel = element('label', 'graph-field-label', 'Hàm số (mỗi dòng một hàm)'); const expressions = document.createElement('textarea'); expressions.className = 'exam-input graph-expressions'; expressions.setAttribute('aria-label', 'Các hàm số'); expressions.value = 'x^2\nsin(x)\ncos(x)'; expressionsLabel.append(expressions); side.append(expressionsLabel);
    const presets = element('div', 'graph-preset-group'); presets.append(element('div', 'graph-field-label', 'Mẫu nhanh'));
    const presetData = [['Parabol', 'x^2'], ['Bậc ba', '0.2x^3-2x'], ['Lượng giác', 'sin(x)\ncos(x)\ntan(x)'], ['Hữu tỉ', '1/(x-1)\n(x^2-1)/(x+1)'], ['Mũ – log', 'exp(x/3)\nln(abs(x)+1)'], ['Đường tròn', 'sqrt(9-x^2)\n-sqrt(9-x^2)']];
    for (const [label, value] of presetData) presets.append(button(label, 'graph-preset', () => { expressions.value = value; if (label === 'Đường tròn') setRange(-4, 4, -4, 4); else if (label === 'Mũ – log') setRange(-6, 6, -3, 8); else setRange(-10, 10, -10, 10); draw(); })); side.append(presets);
    const ranges = element('div', 'graph-range-grid'); const rangeInputs = {};
    for (const [key, label, value] of [['minX','x nhỏ nhất',-10],['maxX','x lớn nhất',10],['minY','y nhỏ nhất',-10],['maxY','y lớn nhất',10]]) {
      const wrapper = element('label', 'graph-field-label', label); const input = document.createElement('input'); input.className = 'exam-input graph-range-input'; input.type = 'number'; input.step = 'any'; input.value = String(value); input.dataset.axis = key; rangeInputs[key] = input; wrapper.append(input); ranges.append(wrapper);
    }
    side.append(ranges);
    const actionRow = element('div', 'graph-actions'); actionRow.append(button('Vẽ lại', 'primary-btn', draw), button('Đặt lại khung', 'exam-tab', () => { setRange(-10, 10, -10, 10); draw(); })); side.append(actionRow);
    const nav = element('div', 'graph-nav-controls'); nav.append(button('＋ Phóng to', 'exam-tab', () => scaleRange(.75)), button('− Thu nhỏ', 'exam-tab', () => scaleRange(1.33)), button('←', 'exam-tab', () => panRange(-.18, 0)), button('→', 'exam-tab', () => panRange(.18, 0)), button('↑', 'exam-tab', () => panRange(0, .18)), button('↓', 'exam-tab', () => panRange(0, -.18))); side.append(nav);
    const canvas = document.createElement('canvas'); canvas.className = 'graph-canvas'; canvas.width = 1440; canvas.height = 820; canvas.setAttribute('aria-label', 'Đồ thị hàm số với trục toạ độ');
    const legend = element('div', 'graph-legend'), valueTable = element('div', 'graph-values'); const msg = element('div', 'exam-message graph-status', 'Sẵn sàng vẽ.');
    canvasColumn.append(canvas, legend, valueTable, msg); form.append(side, canvasColumn); panel.append(form);
    const colors = ['#20a4f3','#f08c32','#37b878','#c477ef','#e45a76','#00a6a6','#d2b21b','#7085ef'];
    function getRange() { return Object.fromEntries(Object.entries(rangeInputs).map(([key, input]) => [key, Number(input.value)])); }
    function setRange(minX, maxX, minY, maxY) { for (const [key, value] of Object.entries({minX,maxX,minY,maxY})) rangeInputs[key].value = String(Number(value.toPrecision(10))); }
    function scaleRange(factor) { const r = getRange(), cx=(r.minX+r.maxX)/2, cy=(r.minY+r.maxY)/2, dx=(r.maxX-r.minX)*factor/2, dy=(r.maxY-r.minY)*factor/2; setRange(cx-dx,cx+dx,cy-dy,cy+dy); draw(); }
    function panRange(px, py) { const r=getRange(), dx=(r.maxX-r.minX)*px, dy=(r.maxY-r.minY)*py; setRange(r.minX+dx,r.maxX+dx,r.minY+dy,r.maxY+dy); draw(); }
    for (const input of Object.values(rangeInputs)) input.addEventListener('change', draw);
    expressions.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); draw(); } });
    function draw() {
      const r = getRange();
      if (![r.minX,r.maxX,r.minY,r.maxY].every(Number.isFinite) || r.maxX <= r.minX || r.maxY <= r.minY) { msg.textContent = 'Giới hạn trục không hợp lệ: giá trị lớn nhất phải lớn hơn giá trị nhỏ nhất.'; return; }
      const ctx = canvas.getContext('2d'), w=canvas.width, h=canvas.height; const styles=getComputedStyle(document.body); const textColor=styles.getPropertyValue('--text').trim() || '#fff'; const bg=styles.getPropertyValue('--panel-2').trim() || '#172139';
      ctx.clearRect(0,0,w,h); ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
      const tx = x => (x-r.minX)/(r.maxX-r.minX)*w, ty = y => (r.maxY-y)/(r.maxY-r.minY)*h;
      const niceStep = span => { const raw=span/10, pow=10**Math.floor(Math.log10(raw)), norm=raw/pow; return (norm<1.5?1:norm<3.5?2:norm<7.5?5:10)*pow; };
      const xStep=niceStep(r.maxX-r.minX), yStep=niceStep(r.maxY-r.minY); ctx.lineWidth=1; ctx.font='19px system-ui'; ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.strokeStyle=textColor; ctx.globalAlpha=.13;
      const startX=Math.ceil(r.minX/xStep)*xStep; for(let x=startX;x<=r.maxX && x<startX+500*xStep;x+=xStep){ const px=tx(x); ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,h);ctx.stroke(); }
      const startY=Math.ceil(r.minY/yStep)*yStep; for(let y=startY;y<=r.maxY && y<startY+500*yStep;y+=yStep){ const py=ty(y);ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(w,py);ctx.stroke(); }
      ctx.globalAlpha=.8; ctx.lineWidth=2.2; ctx.strokeStyle=textColor;
      if(r.minX<=0 && r.maxX>=0){ctx.beginPath();ctx.moveTo(tx(0),0);ctx.lineTo(tx(0),h);ctx.stroke();} if(r.minY<=0 && r.maxY>=0){ctx.beginPath();ctx.moveTo(0,ty(0));ctx.lineTo(w,ty(0));ctx.stroke();}
      ctx.fillStyle=textColor;ctx.globalAlpha=.85;ctx.font='17px system-ui';ctx.textAlign='center';ctx.textBaseline='top';
      for(let x=startX;x<=r.maxX && x<startX+500*xStep;x+=xStep){if(Math.abs(x)<1e-10)continue;ctx.fillText(Number(x.toPrecision(5)).toString(),tx(x)+3,(r.minY<=0&&r.maxY>=0)?Math.min(h-23,Math.max(4,ty(0)+5)):h-23);}
      ctx.textAlign='left';ctx.textBaseline='middle'; for(let y=startY;y<=r.maxY && y<startY+500*yStep;y+=yStep){if(Math.abs(y)<1e-10)continue;const py=ty(y);ctx.fillText(Number(y.toPrecision(5)).toString(),(r.minX<=0&&r.maxX>=0)?Math.min(w-58,Math.max(5,tx(0)+7)):5,py-2);}
      ctx.globalAlpha=1;
      const sourceLines=expressions.value.split(/\n|;/).map(s=>s.trim()).filter(Boolean).slice(0,8); const validFns=[], errors=[];
      sourceLines.forEach((source,index)=>{try{validFns.push({source, fn:compileExpression(source), color:colors[index%colors.length]});}catch(error){errors.push(`Dòng ${index+1}: ${error.message}`);}});
      for(const entry of validFns){ctx.strokeStyle=entry.color;ctx.lineWidth=4.2;ctx.lineJoin='round';ctx.lineCap='round';for(const path of sampleGraph(entry.fn,{...r,width:w,height:h,steps:5200})){ctx.beginPath();path.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}}
      legend.replaceChildren(); for(const entry of validFns){const item=element('div','graph-legend-item');item.append(element('i','', ''),element('span','',entry.source));item.firstElementChild.style.background=entry.color;legend.append(item);}
      valueTable.replaceChildren();
      if(validFns.length){const title=element('h4','','Giá trị tham khảo trên khung hiện tại');valueTable.append(title);const table=document.createElement('table');table.className='graph-value-table';const head=document.createElement('tr');head.append(element('th','','Hàm'));const xs=[r.minX,(r.minX*3+r.maxX)/4,(r.minX+r.maxX)/2,(r.minX+r.maxX*3)/4,r.maxX];for(const x of xs)head.append(element('th','',Number(x.toPrecision(4)).toString()));table.append(head);for(const entry of validFns){const tr=document.createElement('tr');tr.append(element('td','',entry.source));for(const x of xs){let y;try{y=entry.fn(x);}catch{y=NaN;}tr.append(element('td','',Number.isFinite(y)?Number(y.toPrecision(5)).toString():'—'));}table.append(tr);}valueTable.append(table);}
      const count=validFns.length; msg.textContent=`Đã vẽ ${count} hàm · x ∈ [${r.minX}, ${r.maxX}] · y ∈ [${r.minY}, ${r.maxY}] · lấy mẫu dày 5.200 điểm/hàm.${errors.length?' '+errors.join(' '):''}`;
      if(errors.length) msg.classList.add('graph-status-warning'); else msg.classList.remove('graph-status-warning');
    }
    canvas.style.cursor = 'grab';
    let drag = null;
    canvas.addEventListener('pointerdown', event => { if (event.button !== 0) return; drag = { x: event.clientX, y: event.clientY, range: getRange() }; canvas.style.cursor = 'grabbing'; canvas.setPointerCapture?.(event.pointerId); });
    canvas.addEventListener('pointermove', event => { if (!drag) return; const rect = canvas.getBoundingClientRect(); const dx=(event.clientX-drag.x)/rect.width*(drag.range.maxX-drag.range.minX), dy=(event.clientY-drag.y)/rect.height*(drag.range.maxY-drag.range.minY); setRange(drag.range.minX-dx,drag.range.maxX-dx,drag.range.minY+dy,drag.range.maxY+dy); draw(); });
    const stopDrag = () => { drag = null; canvas.style.cursor = 'grab'; }; canvas.addEventListener('pointerup', stopDrag); canvas.addEventListener('pointercancel', stopDrag); canvas.addEventListener('wheel', event => { if (!event.ctrlKey) return; event.preventDefault(); scaleRange(event.deltaY < 0 ? .85 : 1.18); }, { passive: false });
    const exportButton=button('Xuất PNG','exam-tab',()=>{const a=document.createElement('a');a.download='do-thi-htvvm.png';a.href=canvas.toDataURL('image/png');a.click();}); side.append(exportButton); draw();
  }
  show('element'); return root;
}
