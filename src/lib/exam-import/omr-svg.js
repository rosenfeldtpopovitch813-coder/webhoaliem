// Client-side Vector SVG OMR Answer Sheet generator (chuẩn BGD THPT 2025 A4).
// Inspired by Azota's 129 KB SVG sheet architecture: crisp vector printing + fiducial markers, zero server load.

import { escapeHtml } from './math-render.js';

/**
 * Render an A4 portrait (794 x 1123 viewBox) Vector SVG OMR Answer Sheet for THPT 2025 exams.
 */
export function generateOmrSvg({
  title = 'PHIẾU TRẢ LỜI TRẮC NGHIỆM',
  subtitle = 'Chuẩn cấu trúc đề thi tốt nghiệp THPT 2025 (Phần I · II · III)',
  subject = 'Hóa học',
  part1Count = 18,
  part2Count = 4,
  part3Count = 6,
  codeDigits = 3
} = {}) {
  const W = 794;
  const H = 1123;
  const p1 = Math.max(4, Math.min(40, Number(part1Count) || 18));
  const p2 = Math.max(0, Math.min(8, Number(part2Count) || 4));
  const p3 = Math.max(0, Math.min(6, Number(part3Count) || 6));
  const cDigits = codeDigits === 4 ? 4 : 3;

  const els = [];

  // Background + outer page border + 4 corner fiducial alignment squares
  els.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
  els.push(`<rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="#18211E" stroke-width="1.2"/>`);
  for (const [fx, fy] of [[28, 28], [W - 44, 28], [28, H - 44], [W - 44, H - 44]]) {
    els.push(`<rect x="${fx}" y="${fy}" width="16" height="16" fill="#111827"/>`);
  }

  // Title banner
  els.push(`<text x="${W / 2}" y="58" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="18" font-weight="700" fill="#111827">${escapeHtml(title)}</text>`);
  els.push(`<text x="${W / 2}" y="77" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="10.5" fill="#475569">${escapeHtml(subtitle)} · Môn: ${escapeHtml(subject)}</text>`);

  // Left: Student info box
  els.push(`<rect x="40" y="96" width="380" height="224" rx="4" fill="#faf9f6" stroke="#334155" stroke-width="1"/>`);
  const infoLines = [
    '1. Kỳ thi: ...............................................................',
    '2. Hội đồng / Trường: ..............................................',
    '3. Phòng thi: ......................   Ngày thi: ..../..../202...',
    '4. Họ và tên thí sinh: .............................................',
    '5. Lớp: ...................................................................',
    '6. Chữ ký thí sinh: ........................  Giám thị: ..........'
  ];
  infoLines.forEach((line, idx) => {
    els.push(`<text x="52" y="${124 + idx * 27}" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="11" fill="#1e293b">${escapeHtml(line)}</text>`);
  });
  els.push(`<text x="52" y="294" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="9.5" font-style="italic" fill="#64748b">• Dùng bút chì đen tô kín ô tròn tương ứng SBD, Mã đề và đáp án.</text>`);
  els.push(`<text x="52" y="309" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="9.5" font-style="italic" fill="#64748b">• Giữ phiếu phẳng, không gấp hoặc viết đè lên 4 ô định vị đen ở góc.</text>`);

  // Middle: SBD 6-digit bubble grid
  const drawDigitGrid = (x0, y0, cols, label) => {
    const colW = 22;
    const rowH = 17.5;
    const boxW = cols * colW + 24;
    const boxH = 224;
    els.push(`<rect x="${x0}" y="${y0}" width="${boxW}" height="${boxH}" rx="4" fill="#ffffff" stroke="#334155" stroke-width="1"/>`);
    els.push(`<text x="${x0 + boxW / 2}" y="${y0 + 16}" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#111827">${escapeHtml(label)}</text>`);
    // Top write-in squares
    for (let c = 0; c < cols; c++) {
      const cx = x0 + 18 + c * colW;
      els.push(`<rect x="${cx - 8}" y="${y0 + 23}" width="16" height="18" fill="none" stroke="#334155" stroke-width="0.9"/>`);
    }
    // 0..9 bubbles
    for (let d = 0; d <= 9; d++) {
      const cy = y0 + 54 + d * rowH;
      els.push(`<text x="${x0 + 6}" y="${cy + 3.5}" font-family="JetBrains Mono, monospace" font-size="9" fill="#475569">${d}</text>`);
      for (let c = 0; c < cols; c++) {
        const cx = x0 + 18 + c * colW;
        els.push(`<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="#1e293b" stroke-width="0.9"/>`);
        els.push(`<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-family="Arial, sans-serif" font-size="7.5" fill="#64748b">${d}</text>`);
      }
    }
    return boxW;
  };

  const sbdW = drawDigitGrid(434, 96, 6, '7. Số báo danh');
  drawDigitGrid(434 + sbdW + 14, 96, cDigits, '8. Mã đề');

  // PART I: Multiple choice (4 columns x 10 rows max)
  const p1Top = 338;
  const p1Rows = Math.ceil(p1 / 4);
  const p1BoxH = 38 + Math.max(5, p1Rows) * 24;
  els.push(`<rect x="40" y="${p1Top}" width="${W - 80}" height="${p1BoxH}" rx="4" fill="#ffffff" stroke="#334155" stroke-width="1"/>`);
  els.push(`<rect x="40" y="${p1Top}" width="${W - 80}" height="24" rx="4" fill="#eef4f1" stroke="#334155" stroke-width="1"/>`);
  els.push(`<text x="52" y="${p1Top + 16}" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="11" font-weight="700" fill="#17382C">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (${p1} câu)</text>`);

  const colBlockW = (W - 96) / 4;
  const perCol = Math.ceil(p1 / 4);
  for (let col = 0; col < 4; col++) {
    const startQ = col * perCol + 1;
    const endQ = Math.min(p1, (col + 1) * perCol);
    if (startQ > p1) break;
    const bx = 52 + col * colBlockW;
    // Column letter headers
    ['A', 'B', 'C', 'D'].forEach((ch, li) => {
      els.push(`<text x="${bx + 42 + li * 28}" y="${p1Top + 38}" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="9.5" font-weight="700" fill="#334155">${ch}</text>`);
    });
    for (let q = startQ; q <= endQ; q++) {
      const r = q - startQ;
      const cy = p1Top + 56 + r * 23;
      els.push(`<text x="${bx + 20}" y="${cy + 3.5}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" font-weight="600" fill="#1e293b">${q}</text>`);
      ['A', 'B', 'C', 'D'].forEach((ch, li) => {
        const cx = bx + 42 + li * 28;
        els.push(`<circle cx="${cx}" cy="${cy}" r="7.2" fill="none" stroke="#1e293b" stroke-width="0.95"/>`);
        els.push(`<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" fill="#64748b">${ch}</text>`);
      });
    }
  }

  // PART II: True/False blocks
  const p2Top = p1Top + p1BoxH + 14;
  const p2BoxH = p2 > 0 ? 156 : 0;
  if (p2 > 0) {
    els.push(`<rect x="40" y="${p2Top}" width="${W - 80}" height="${p2BoxH}" rx="4" fill="#ffffff" stroke="#334155" stroke-width="1"/>`);
    els.push(`<rect x="40" y="${p2Top}" width="${W - 80}" height="24" rx="4" fill="#eef4f1" stroke="#334155" stroke-width="1"/>`);
    els.push(`<text x="52" y="${p2Top + 16}" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="11" font-weight="700" fill="#17382C">PHẦN II. Câu trắc nghiệm đúng sai (${p2} câu · mỗi câu 4 ý a, b, c, d)</text>`);

    const colsP2 = Math.min(4, p2);
    const cardW = (W - 104) / colsP2;
    for (let idx = 0; idx < p2; idx++) {
      const rowBlock = Math.floor(idx / 4);
      const colBlock = idx % 4;
      const x = 52 + colBlock * cardW;
      const y = p2Top + 34 + rowBlock * 116;
      if (y + 100 > p2Top + p2BoxH) break;
      els.push(`<rect x="${x}" y="${y}" width="${cardW - 10}" height="110" rx="3" fill="#faf9f6" stroke="#cbd5e1" stroke-width="0.9"/>`);
      els.push(`<text x="${x + 10}" y="${y + 17}" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#111827">Câu ${idx + 1}</text>`);
      els.push(`<text x="${x + 76}" y="${y + 17}" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="9.5" font-weight="700" fill="#15803d">Đúng</text>`);
      els.push(`<text x="${x + 124}" y="${y + 17}" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="9.5" font-weight="700" fill="#b91c1c">Sai</text>`);
      ['a)', 'b)', 'c)', 'd)'].forEach((lbl, si) => {
        const cy = y + 36 + si * 21;
        els.push(`<text x="${x + 18}" y="${cy + 3.5}" font-family="JetBrains Mono, monospace" font-size="10" font-weight="600" fill="#1e293b">${lbl}</text>`);
        els.push(`<circle cx="${x + 76}" cy="${cy}" r="7" fill="none" stroke="#1e293b" stroke-width="0.95"/>`);
        els.push(`<text x="${x + 76}" y="${cy + 3}" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" fill="#64748b">Đ</text>`);
        els.push(`<circle cx="${x + 124}" cy="${cy}" r="7" fill="none" stroke="#1e293b" stroke-width="0.95"/>`);
        els.push(`<text x="${x + 124}" y="${cy + 3}" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" fill="#64748b">S</text>`);
      });
    }
  }

  // PART III: Short-answer numeric grids (up to 6 questions, 4 character columns each: -, ,, 0..9)
  const p3Top = p2Top + (p2BoxH ? p2BoxH + 14 : 0);
  const p3BoxH = Math.max(255, H - p3Top - 42);
  if (p3 > 0) {
    els.push(`<rect x="40" y="${p3Top}" width="${W - 80}" height="${p3BoxH}" rx="4" fill="#ffffff" stroke="#334155" stroke-width="1"/>`);
    els.push(`<rect x="40" y="${p3Top}" width="${W - 80}" height="24" rx="4" fill="#eef4f1" stroke="#334155" stroke-width="1"/>`);
    els.push(`<text x="52" y="${p3Top + 16}" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="11" font-weight="700" fill="#17382C">PHẦN III. Câu trắc nghiệm trả lời ngắn (${p3} câu · tô dấu âm, dấu phẩy và chữ số từ trái sang phải)</text>`);

    const boxCount = Math.min(6, p3);
    const slotW = (W - 96) / boxCount;
    const symbols = ['-', ',', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const rowStep = Math.min(18.5, (p3BoxH - 68) / symbols.length);

    for (let q = 0; q < boxCount; q++) {
      const sx = 48 + q * slotW;
      const innerW = slotW - 8;
      els.push(`<rect x="${sx}" y="${p3Top + 32}" width="${innerW}" height="${p3BoxH - 42}" rx="3" fill="#faf9f6" stroke="#cbd5e1" stroke-width="0.85"/>`);
      els.push(`<text x="${sx + innerW / 2}" y="${p3Top + 47}" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="10" font-weight="700" fill="#111827">Câu ${q + 1}</text>`);

      const colStep = (innerW - 22) / 4;
      for (let c = 0; c < 4; c++) {
        const cx = sx + 22 + c * colStep + colStep / 2;
        els.push(`<rect x="${cx - 7.5}" y="${p3Top + 52}" width="15" height="15" fill="#ffffff" stroke="#334155" stroke-width="0.85"/>`);
      }

      symbols.forEach((sym, si) => {
        const cy = p3Top + 79 + si * rowStep;
        els.push(`<text x="${sx + 10}" y="${cy + 3}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="600" fill="#475569">${sym}</text>`);
        for (let c = 0; c < 4; c++) {
          // '-' only valid in col 0, ',' only valid in cols 1..2
          if (sym === '-' && c > 0) continue;
          if (sym === ',' && (c === 0 || c === 3)) continue;
          const cx = sx + 22 + c * colStep + colStep / 2;
          els.push(`<circle cx="${cx}" cy="${cy}" r="5.5" fill="none" stroke="#1e293b" stroke-width="0.85"/>`);
          els.push(`<text x="${cx}" y="${cy + 2.6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="6.8" fill="#64748b">${sym}</text>`);
        }
      });
    }
  }

  els.push(`<text x="${W / 2}" y="${H - 25}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" fill="#64748b">WEB HOÁ LIEMS · HTVVM EXAM MODULE · VECTOR OMR THPT 2025 (A4)</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Phiếu tô trắc nghiệm THPT 2025">${els.join('')}</svg>`;
}
