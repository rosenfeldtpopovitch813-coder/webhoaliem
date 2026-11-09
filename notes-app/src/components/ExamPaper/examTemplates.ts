import katex from 'katex';
import { ExamBlock, ExamFigureSource, ExamPaperDocument } from '../../types/board';

export function createDefaultExamPaper(title = 'ĐỀ KIỂM TRA ĐỊNH KỲ'): ExamPaperDocument {
  const fig3dSource: ExamFigureSource = {
    id: 'fig-src-default-3d',
    kind: '3d',
    label: 'Hình chóp S.ABCD',
    src: '',
    aspectRatio: 1.25,
    pointFontSize: 18,
    strokeColor: '#1e293b',
    solid3DConfig: {
      solid: 'pyramid4',
      rx: 22,
      ry: -34,
      showMidpoints: true,
      showSection: true,
      faceColor: '#8b5cf6',
      pointLabels: ['S', 'A', 'B', 'C', 'D', 'M', 'N', 'P']
    }
  };
  fig3dSource.src = renderFigureSourceToDataUrl(fig3dSource);

  const figGraphSource: ExamFigureSource = {
    id: 'fig-src-default-graph',
    kind: 'graph',
    label: 'Đồ thị y = x³ - 3x',
    src: '',
    aspectRatio: 1.35,
    pointFontSize: 15,
    strokeColor: '#2563eb',
    graphFormula: 'x^3 - 3*x',
    graphXMin: -3,
    graphXMax: 3,
    graphYMin: -4,
    graphYMax: 4
  };
  figGraphSource.src = renderFigureSourceToDataUrl(figGraphSource);

  const blocks: ExamBlock[] = [
    {
      id: crypto.randomUUID(),
      type: 'section',
      title: 'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (3,0 điểm)',
      subtitle: 'Thí sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi thí sinh chỉ chọn một phương án.'
    },
    {
      id: crypto.randomUUID(),
      type: 'question',
      questionType: 'mcq',
      prompt: 'Cho hàm số $y = x^3 - 3x$ có đồ thị như hình vẽ bên dưới. Giá trị cực đại của hàm số đã cho bằng:',
      options: ['$2$', '$-2$', '$1$', '$-1$'],
      optionCols: 4,
      correctChoice: 'A',
      solution: 'Từ đồ thị hàm số $y = x^3 - 3x$, hàm số đạt cực đại tại $x = -1$, giá trị cực đại $y_{CĐ} = (-1)^3 - 3(-1) = 2$.',
      figures: [
        {
          id: crypto.randomUUID(),
          sourceId: figGraphSource.id,
          src: figGraphSource.src,
          width: 250,
          align: 'center'
        }
      ]
    },
    {
      id: crypto.randomUUID(),
      type: 'question',
      questionType: 'mcq',
      prompt: 'Cho tích phân $I = \\int_{0}^{1} (3x^2 + 2x) \\, dx$ và giới hạn $L = \\lim_{x \\to 2} \\frac{x^2 - 4}{x - 2}$. Giá trị của $I + L$ bằng:',
      options: ['$6$', '$4$', '$5$', '$8$'],
      optionCols: 4,
      correctChoice: 'A',
      solution: 'Ta có $I = (x^3 + x^2)\\Big|_0^1 = 2$ và $L = \\lim_{x \\to 2}(x + 2) = 4$. Vậy $I + L = 6$.'
    },
    {
      id: crypto.randomUUID(),
      type: 'question',
      questionType: 'mcq',
      prompt: 'Trong phản ứng este hóa: $\\ce{CH3COOH + C2H5OH <=>[$\\text{H}_2\\text{SO}_4\\text{ đặc, } t^\\circ$] CH3COOC2H5 + H2O}$, chất sản phẩm hữu cơ thu được có tên gọi là:',
      options: ['Ethyl acetate', 'Methyl acetate', 'Methyl formate', 'Propyl acetate'],
      optionCols: 2,
      correctChoice: 'A',
      solution: '$\\ce{CH3COOC2H5}$ có tên gọi quốc tế là ethyl ethanoate hay ethyl acetate.'
    },
    {
      id: crypto.randomUUID(),
      type: 'section',
      title: 'PHẦN II. Câu trắc nghiệm đúng sai (4,0 điểm)',
      subtitle: 'Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng (Đ) hoặc sai (S).'
    },
    {
      id: crypto.randomUUID(),
      type: 'question',
      questionType: 'tf',
      prompt: 'Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình bình hành tâm $O$. Gọi $M, N, P$ lần lượt là trung điểm của $SA, SB, SC$ như hình vẽ:',
      statements: [
        { id: crypto.randomUUID(), label: 'a', text: 'Đường thẳng $MN$ song song với mặt phẳng $(ABCD)$.', correct: true },
        { id: crypto.randomUUID(), label: 'b', text: 'Thiết diện tạo bởi mặt phẳng $(MNP)$ với hình chóp là một tam giác.', correct: false },
        { id: crypto.randomUUID(), label: 'c', text: 'Vectơ $\\overrightarrow{SA} + \\overrightarrow{SC} = \\overrightarrow{SB} + \\overrightarrow{SD}$.', correct: true },
        { id: crypto.randomUUID(), label: 'd', text: 'Tỉ số thể tích $\\frac{V_{S.MNP}}{V_{S.ABC}} = \\frac{1}{8}$.', correct: true }
      ],
      solution: 'Vì $M, N, P$ là trung điểm của $SA, SB, SC$ nên mặt phẳng $(MNP)$ cắt $SD$ tại trung điểm $Q$, thiết diện là hình bình hành $MNPQ$.',
      figures: [
        {
          id: crypto.randomUUID(),
          sourceId: fig3dSource.id,
          src: fig3dSource.src,
          width: 270,
          align: 'center'
        }
      ]
    },
    {
      id: crypto.randomUUID(),
      type: 'section',
      title: 'PHẦN III. Câu trả lời ngắn và Tự luận (3,0 điểm)',
      subtitle: 'Thí sinh điền kết quả số hoặc trình bày lời giải chi tiết.'
    },
    {
      id: crypto.randomUUID(),
      type: 'question',
      questionType: 'short',
      points: '1 điểm',
      prompt: 'Giải hệ phương trình $\\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}$ và tính giá trị biểu thức $T = x^2 + y^2$.',
      shortAnswer: '5',
      solution: 'Cộng vế theo vế hai phương trình ta được $3x = 6 \\Rightarrow x = 2 \\Rightarrow y = 1$. Do đó $T = 2^2 + 1^2 = 5$.'
    }
  ];

  return {
    fontFamily: '"Times New Roman", Times, Georgia, serif',
    fontSizePt: 12,
    header: {
      department: 'SỞ GD&ĐT TP. HỒ CHÍ MINH',
      school: 'TRƯỜNG THPT CHUYÊN HTVVM',
      examTitle: title.toUpperCase(),
      subject: 'Môn: TOÁN – HÓA HỌC · Khối 12',
      duration: 'Thời gian làm bài: 50 phút (không kể thời gian phát đề)',
      examCode: '101',
      academicYear: 'NĂM HỌC 2025 – 2026',
      showStudentInfo: true
    },
    blocks,
    figureSources: [fig3dSource, figGraphSource],
    updatedAt: Date.now()
  };
}

export const MATH_TEMPLATES: Array<{ category: string; label: string; preview: string; latex: string }> = [
  { category: 'Cơ bản', label: 'Phân số', preview: 'a / b', latex: '\\frac{a}{b}' },
  { category: 'Cơ bản', label: 'Căn bậc hai', preview: '√x', latex: '\\sqrt{x}' },
  { category: 'Cơ bản', label: 'Căn bậc n', preview: 'ⁿ√x', latex: '\\sqrt[n]{x}' },
  { category: 'Cơ bản', label: 'Lũy thừa & Chỉ số', preview: 'xⁿ_i', latex: 'x_{i}^{n}' },
  { category: 'Đại số', label: 'Hệ 2 phương trình', preview: '{ ax+by=c', latex: '\\begin{cases} ax + by = c \\\\ dx + ey = f \\end{cases}' },
  { category: 'Đại số', label: 'Hệ 3 phương trình', preview: '{ 3 PT', latex: '\\begin{cases} x + y + z = 6 \\\\ 2x - y + z = 3 \\\\ x + 2y - z = 2 \\end{cases}' },
  { category: 'Đại số', label: 'Logarit', preview: 'logₐ(b)', latex: '\\log_{a}(b)' },
  { category: 'Đại số', label: 'Tổ hợp / Nhị thức', preview: 'Cⁿₖ', latex: 'C_{n}^{k}' },
  { category: 'Giải tích', label: 'Tích phân xác định', preview: '∫ᵃᵇ f(x)dx', latex: '\\int_{a}^{b} f(x)\\,dx' },
  { category: 'Giải tích', label: 'Nguyên hàm', preview: '∫ f(x)dx', latex: '\\int f(x)\\,dx' },
  { category: 'Giải tích', label: 'Giới hạn lim', preview: 'lim x→x₀', latex: '\\lim_{x \\to x_0} f(x)' },
  { category: 'Giải tích', label: 'Giới hạn vô cực', preview: 'lim x→+∞', latex: '\\lim_{x \\to +\\infty} \\frac{ax+b}{cx+d}' },
  { category: 'Giải tích', label: 'Tổng Sigma', preview: '∑ k=1..n', latex: '\\sum_{k=1}^{n} a_k' },
  { category: 'Hình học', label: 'Vectơ', preview: 'AB⃗', latex: '\\overrightarrow{AB}' },
  { category: 'Hình học', label: 'Độ dài / Tích vô hướng', preview: '|a⃗| · |b⃗|', latex: '\\left|\\overrightarrow{a}\\right| \\cdot \\left|\\overrightarrow{b}\\right| \\cos\\left(\\overrightarrow{a}, \\overrightarrow{b}\\right)' },
  { category: 'Hình học', label: 'Góc & Tam giác', preview: '△ABC, ∠ABC', latex: '\\triangle ABC, \\quad \\widehat{ABC} = 60^\\circ' },
  { category: 'Hình học', label: 'Vuông góc & Song song', preview: '⊥ , ∥', latex: 'SA \\perp (ABCD), \\quad MN \\parallel (SBC)' },
  { category: 'Ma trận', label: 'Ma trận 2×2', preview: '[a b; c d]', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' }
];

export const CHEMISTRY_TEMPLATES: Array<{ label: string; desc: string; latex: string }> = [
  { label: 'Phản ứng có điều kiện (t°, xt)', desc: 'Mũi tên kèm nhiệt độ/xúc tác', latex: '\\ce{A + B ->[t^\\circ, xt] C + D}' },
  { label: 'Phản ứng thuận nghịch (Este hóa)', desc: 'Hai nửa mũi tên cân bằng', latex: '\\ce{CH3COOH + C2H5OH <=>[$\\text{H}_2\\text{SO}_4\\text{ đặc, } t^\\circ$] CH3COOC2H5 + H2O}' },
  { label: 'Phương trình ion rút gọn', desc: 'Điện tích ion trên đầu', latex: '\\ce{Fe^{2+} + 2OH^- -> Fe(OH)2 v}' },
  { label: 'Phản ứng oxi hóa - khử', desc: 'Fe tác dụng HNO3 loãng', latex: '\\ce{Fe + 4HNO3 -> Fe(NO3)3 + NO ^ + 2H2O}' },
  { label: 'Trùng hợp Polymer', desc: 'Polyethylene từ ethylene', latex: 'n\\,\\text{CH}_2=\\text{CH}_2 \\xrightarrow{t^\\circ, p, xt} \\text{-(CH}_2\\text{-CH}_2\\text{)-}_n' },
  { label: 'Cấu tạo thu gọn Este / Amino acid', desc: 'Glycine - Alanine dipeptide', latex: '\\text{H}_2\\text{N-CH}_2\\text{-CO-NH-CH(CH}_3\\text{)-COOH}' }
];

export const MOLECULE_PRESETS: Record<string, {
  name: string;
  formula: string;
  atoms: Array<{ id: string; el: string; x: number; y: number }>;
  bonds: Array<{ from: string; to: string; order: 1 | 2 | 3 }>;
}> = {
  benzene: {
    name: 'Vòng Benzen (C₆H₆)',
    formula: 'C₆H₆',
    atoms: [
      { id: 'c1', el: 'CH', x: 200, y: 65 },
      { id: 'c2', el: 'CH', x: 278, y: 110 },
      { id: 'c3', el: 'CH', x: 278, y: 200 },
      { id: 'c4', el: 'CH', x: 200, y: 245 },
      { id: 'c5', el: 'CH', x: 122, y: 200 },
      { id: 'c6', el: 'CH', x: 122, y: 110 }
    ],
    bonds: [
      { from: 'c1', to: 'c2', order: 2 },
      { from: 'c2', to: 'c3', order: 1 },
      { from: 'c3', to: 'c4', order: 2 },
      { from: 'c4', to: 'c5', order: 1 },
      { from: 'c5', to: 'c6', order: 2 },
      { from: 'c6', to: 'c1', order: 1 }
    ]
  },
  phenol: {
    name: 'Phenol (C₆H₅OH)',
    formula: 'C₆H₅OH',
    atoms: [
      { id: 'oh', el: 'OH', x: 200, y: 28 },
      { id: 'c1', el: 'C', x: 200, y: 88 },
      { id: 'c2', el: 'CH', x: 270, y: 128 },
      { id: 'c3', el: 'CH', x: 270, y: 208 },
      { id: 'c4', el: 'CH', x: 200, y: 248 },
      { id: 'c5', el: 'CH', x: 130, y: 208 },
      { id: 'c6', el: 'CH', x: 130, y: 128 }
    ],
    bonds: [
      { from: 'oh', to: 'c1', order: 1 },
      { from: 'c1', to: 'c2', order: 2 },
      { from: 'c2', to: 'c3', order: 1 },
      { from: 'c3', to: 'c4', order: 2 },
      { from: 'c4', to: 'c5', order: 1 },
      { from: 'c5', to: 'c6', order: 2 },
      { from: 'c6', to: 'c1', order: 1 }
    ]
  },
  ester: {
    name: 'Ethyl Acetate (CH₃COOC₂H₅)',
    formula: 'CH₃COOC₂H₅',
    atoms: [
      { id: 'a1', el: 'CH₃', x: 75, y: 175 },
      { id: 'a2', el: 'C', x: 155, y: 175 },
      { id: 'a3', el: 'O', x: 155, y: 95 },
      { id: 'a4', el: 'O', x: 230, y: 175 },
      { id: 'a5', el: 'CH₂', x: 300, y: 135 },
      { id: 'a6', el: 'CH₃', x: 365, y: 175 }
    ],
    bonds: [
      { from: 'a1', to: 'a2', order: 1 },
      { from: 'a2', to: 'a3', order: 2 },
      { from: 'a2', to: 'a4', order: 1 },
      { from: 'a4', to: 'a5', order: 1 },
      { from: 'a5', to: 'a6', order: 1 }
    ]
  },
  aminoacid: {
    name: 'Alanine (H₂N-CH(CH₃)-COOH)',
    formula: 'C₃H₇NO₂',
    atoms: [
      { id: 'n1', el: 'H₂N', x: 75, y: 165 },
      { id: 'c1', el: 'CH', x: 165, y: 165 },
      { id: 'me', el: 'CH₃', x: 165, y: 245 },
      { id: 'c2', el: 'C', x: 255, y: 165 },
      { id: 'o1', el: 'O', x: 255, y: 85 },
      { id: 'oh', el: 'OH', x: 335, y: 165 }
    ],
    bonds: [
      { from: 'n1', to: 'c1', order: 1 },
      { from: 'c1', to: 'me', order: 1 },
      { from: 'c1', to: 'c2', order: 1 },
      { from: 'c2', to: 'o1', order: 2 },
      { from: 'c2', to: 'oh', order: 1 }
    ]
  }
};

function convertCeToLatex(ceExpr: string): string {
  let s = ceExpr.trim();
  // Arrows with condition: <=>[$cond$] or ->[cond]
  s = s.replace(/<=>\[\$([^$]+)\$\]/g, '\\xrightleftharpoons{$1}');
  s = s.replace(/<=>\[([^\]]+)\]/g, '\\xrightleftharpoons{\\text{$1}}');
  s = s.replace(/->\[\$([^$]+)\$\]/g, '\\xrightarrow{$1}');
  s = s.replace(/->\[([^\]]+)\]/g, '\\xrightarrow{\\text{$1}}');
  s = s.replace(/<=>/g, '\\rightleftharpoons ');
  s = s.replace(/->/g, '\\rightarrow ');
  s = s.replace(/\s+\^(?=\s|$)/g, '\\uparrow ');
  s = s.replace(/\s+v(?=\s|$)/g, '\\downarrow ');
  // Convert chemical formulas like H2SO4, Fe(OH)2, CH3COOH
  s = s.replace(/([A-Za-z)\]])(\d+)/g, '$1_{$2}');
  return `\\mathrm{${s}}`;
}

function escapeHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderRichExamText(source: string): string {
  if (!source) return '';
  const tokens: Array<[string, string]> = [];
  const stash = (html: string) => {
    const key = `@@EXAMTOKEN_${tokens.length}@@`;
    tokens.push([key, html]);
    return key;
  };

  let text = String(source);

  // Convert standalone \ce{...} outside or inside $...$
  text = text.replace(/\\ce\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_m, inner) => {
    const tex = convertCeToLatex(inner);
    try {
      return stash(katex.renderToString(tex, { throwOnError: false, displayMode: false, strict: 'ignore' }));
    } catch {
      return inner;
    }
  });

  // Render $$...$$ or \[...\] or $...$ or \(...\)
  text = text.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g, (all, b1, b2, i1, i2) => {
    let tex = (b1 ?? b2 ?? i1 ?? i2 ?? '').trim();
    const displayMode = b1 !== undefined || b2 !== undefined;
    tex = tex.replace(/\\ce\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_m: string, inner: string) => convertCeToLatex(inner));
    try {
      return stash(katex.renderToString(tex, { throwOnError: false, displayMode, strict: 'ignore' }));
    } catch {
      return escapeHtml(all);
    }
  });

  let safe = escapeHtml(text);
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  safe = safe.replace(/__([^_]+)__/g, '<u>$1</u>');
  safe = safe.replace(/\r?\n/g, '<br/>');

  for (const [key, html] of tokens) {
    safe = safe.split(key).join(html);
  }
  return safe;
}

/**
 * Parse a single line where the teacher typed "A. ... B. ... C. ... D. ..."
 */
export function parseInlineOptionsLine(line: string): [string, string, string, string] | null {
  const m = line.match(/^\s*A[.:)]\s*(.+?)\s+B[.:)]\s*(.+?)\s+C[.:)]\s*(.+?)\s+D[.:)]\s*(.+)\s*$/i);
  if (!m) return null;
  return [m[1].trim(), m[2].trim(), m[3].trim(), m[4].trim()];
}

/**
 * High-DPI Canvas Renderer for Live-Linked Exam Figures (3D Solids, Function Graphs, Molecules, Freehand Board)
 */
export function renderFigureSourceToDataUrl(source: ExamFigureSource): string {
  if (typeof document === 'undefined') return source.src || '';
  const canvas = document.createElement('canvas');
  const W = 520;
  const H = Math.round(W / (source.aspectRatio || 1.28));
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source.src || '';
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const fontSize = Math.max(11, Math.min(32, source.pointFontSize || 16));
  const strokeColor = source.strokeColor || '#1e293b';

  if (source.kind === '3d' && source.solid3DConfig) {
    const cfg = source.solid3DConfig;
    const rx = (cfg.rx * Math.PI) / 180;
    const ry = (cfg.ry * Math.PI) / 180;
    const project = (x: number, y: number, z: number) => {
      // Rotate around Y then X
      const x1 = x * Math.cos(ry) + z * Math.sin(ry);
      const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
      const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
      const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
      const scale = 128;
      return {
        x: W * 0.5 + x1 * scale,
        y: H * 0.56 - y2 * scale,
        z: z2
      };
    };

    const labels = cfg.pointLabels || ['S', 'A', 'B', 'C', 'D', 'M', 'N', 'P'];
    if (cfg.solid === 'pyramid4' || cfg.solid === 'pyramid3') {
      const S = project(0, 1.15, 0);
      const A = project(-0.95, -0.62, -0.55);
      const B = project(-0.55, -0.62, 0.78);
      const C = project(0.95, -0.62, 0.55);
      const D = project(0.55, -0.62, -0.78);

      const mid = (p1: { x: number; y: number }, p2: { x: number; y: number }, t = 0.5) => ({
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
      });

      const M = mid(S, A, 0.48);
      const N = mid(S, B, 0.48);
      const P = mid(S, C, 0.48);
      const Q = mid(S, D, 0.48);

      // Optional shaded section plane
      if (cfg.showSection) {
        ctx.save();
        ctx.fillStyle = (cfg.faceColor || '#8b5cf6') + '33';
        ctx.beginPath();
        ctx.moveTo(M.x, M.y);
        ctx.lineTo(N.x, N.y);
        ctx.lineTo(P.x, P.y);
        if (cfg.solid === 'pyramid4') ctx.lineTo(Q.x, Q.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      const drawSeg = (p1: { x: number; y: number }, p2: { x: number; y: number }, dashed = false, color = strokeColor, width = 2) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.setLineDash(dashed ? [6, 5] : []);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      };

      if (cfg.solid === 'pyramid4') {
        // Hidden lines: SA, AB, AD, AC, BD
        drawSeg(S, A, true);
        drawSeg(A, B, true);
        drawSeg(A, D, true);
        // Visible lines: SB, SC, SD, BC, CD
        drawSeg(S, B, false);
        drawSeg(S, C, false);
        drawSeg(S, D, false);
        drawSeg(B, C, false);
        drawSeg(C, D, false);
        if (cfg.showSection) {
          drawSeg(M, N, true, cfg.faceColor || '#7c3aed', 2);
          drawSeg(M, Q, true, cfg.faceColor || '#7c3aed', 2);
          drawSeg(N, P, false, cfg.faceColor || '#7c3aed', 2.2);
          drawSeg(P, Q, false, cfg.faceColor || '#7c3aed', 2.2);
        }
      } else {
        drawSeg(A, C, true);
        drawSeg(S, A, false);
        drawSeg(S, B, false);
        drawSeg(S, C, false);
        drawSeg(A, B, false);
        drawSeg(B, C, false);
        if (cfg.showSection) {
          drawSeg(M, P, true, cfg.faceColor || '#7c3aed', 2);
          drawSeg(M, N, false, cfg.faceColor || '#7c3aed', 2.2);
          drawSeg(N, P, false, cfg.faceColor || '#7c3aed', 2.2);
        }
      }

      const drawPt = (p: { x: number; y: number }, name: string, dx: number, dy: number, accent = false) => {
        ctx.save();
        ctx.fillStyle = accent ? (cfg.faceColor || '#7c3aed') : strokeColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `italic bold ${fontSize}px "Times New Roman", serif`;
        ctx.fillText(name, p.x + dx, p.y + dy);
        ctx.restore();
      };

      drawPt(S, labels[0] || 'S', -6, -12);
      drawPt(A, labels[1] || 'A', -20, -4);
      drawPt(B, labels[2] || 'B', -18, 18);
      drawPt(C, labels[3] || 'C', 10, 18);
      if (cfg.solid === 'pyramid4') drawPt(D, labels[4] || 'D', 10, -2);
      if (cfg.showMidpoints || cfg.showSection) {
        drawPt(M, labels[5] || 'M', -22, -4, true);
        drawPt(N, labels[6] || 'N', -20, 12, true);
        drawPt(P, labels[7] || 'P', 10, 4, true);
        if (cfg.solid === 'pyramid4' && cfg.showSection) drawPt(Q, 'Q', 9, -6, true);
      }
    } else {
      // Prism / Cube
      const tL = project(-0.85, 0.8, -0.5);
      const tF = project(-0.45, 0.8, 0.7);
      const tR = project(0.85, 0.8, 0.45);
      const tB = project(0.45, 0.8, -0.75);
      const bL = project(-0.85, -0.75, -0.5);
      const bF = project(-0.45, -0.75, 0.7);
      const bR = project(0.85, -0.75, 0.45);
      const bB = project(0.45, -0.75, -0.75);

      const seg = (p1: { x: number; y: number }, p2: { x: number; y: number }, dashed = false) => {
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.setLineDash(dashed ? [6, 5] : []);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      };
      seg(bL, bF, true);
      seg(bL, bB, true);
      seg(tL, bL, true);
      seg(tL, tF);
      seg(tF, tR);
      seg(tR, tB);
      seg(tB, tL);
      seg(bF, bR);
      seg(bR, bB);
      seg(tF, bF);
      seg(tR, bR);
      seg(tB, bB);

      ctx.font = `italic bold ${fontSize}px "Times New Roman", serif`;
      ctx.fillStyle = strokeColor;
      [
        [tL, "A'", -22, -6],
        [tF, "B'", -18, 16],
        [tR, "C'", 10, 12],
        [tB, "D'", 8, -8],
        [bL, 'A', -20, -4],
        [bF, 'B', -16, 18],
        [bR, 'C', 10, 18],
        [bB, 'D', 10, -2]
      ].forEach(([pt, lb, dx, dy]) => {
        const p = pt as { x: number; y: number };
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(String(lb), p.x + Number(dx), p.y + Number(dy));
      });
    }
  } else if (source.kind === 'graph') {
    const xMin = source.graphXMin ?? -3.5;
    const xMax = source.graphXMax ?? 3.5;
    const yMin = source.graphYMin ?? -4;
    const yMax = source.graphYMax ?? 4;
    const pad = 34;
    const gw = W - pad * 2;
    const gh = H - pad * 2;
    const toPx = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * gw;
    const toPy = (y: number) => pad + ((yMax - y) / (yMax - yMin)) * gh;

    const ox = toPx(0);
    const oy = toPy(0);

    // Subtle grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
      const px = toPx(x);
      ctx.beginPath(); ctx.moveTo(px, pad); ctx.lineTo(px, H - pad); ctx.stroke();
    }
    for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
      const py = toPy(y);
      ctx.beginPath(); ctx.moveTo(pad, py); ctx.lineTo(W - pad, py); ctx.stroke();
    }

    // Axes Oxy
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(pad, oy); ctx.lineTo(W - pad + 8, oy);
    ctx.moveTo(ox, H - pad); ctx.lineTo(ox, pad - 8);
    ctx.stroke();

    // Arrowheads
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(W - pad + 10, oy); ctx.lineTo(W - pad, oy - 4.5); ctx.lineTo(W - pad, oy + 4.5); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ox, pad - 10); ctx.lineTo(ox - 4.5, pad); ctx.lineTo(ox + 4.5, pad); ctx.closePath(); ctx.fill();

    ctx.font = `italic bold ${fontSize}px "Times New Roman", serif`;
    ctx.fillText('x', W - pad + 2, oy + 18);
    ctx.fillText('y', ox + 10, pad - 2);
    ctx.fillText('O', ox - 16, oy + 16);

    // Evaluate formula safely
    const raw = (source.graphFormula || 'x^3 - 3*x')
      .replace(/^\s*y\s*=\s*/i, '')
      .replace(/−/g, '-')
      .replace(/\^/g, '**')
      .replace(/(\d)\s*([a-zA-Z(])/g, '$1*$2');

    let evalFn: (x: number) => number = (x) => x ** 3 - 3 * x;
    try {
      // eslint-disable-next-line no-new-func
      const compiled = new Function('x', `with (Math) { return (${raw}); }`) as (x: number) => number;
      compiled(1);
      evalFn = compiled;
    } catch {
      // Keep cubic default
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, pad, gw, gh);
    ctx.clip();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    let penDown = false;
    const steps = 360;
    for (let i = 0; i <= steps; i++) {
      const x = xMin + ((xMax - xMin) * i) / steps;
      let y = NaN;
      try { y = Number(evalFn(x)); } catch { y = NaN; }
      if (!Number.isFinite(y) || Math.abs(y) > (yMax - yMin) * 4) {
        penDown = false;
        continue;
      }
      const px = toPx(x);
      const py = toPy(y);
      if (!penDown) {
        ctx.moveTo(px, py);
        penDown = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();
  } else if (source.kind === 'molecule' && source.moleculeConfig) {
    const { atoms, bonds } = source.moleculeConfig;
    const atomMap = new Map(atoms.map(a => [a.id, a]));
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';

    for (const b of bonds) {
      const a1 = atomMap.get(b.from);
      const a2 = atomMap.get(b.to);
      if (!a1 || !a2) continue;
      const dx = a2.x - a1.x;
      const dy = a2.y - a1.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      if (b.order === 1) {
        ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.stroke();
      } else if (b.order === 2) {
        for (const offset of [-3.5, 3.5]) {
          ctx.beginPath();
          ctx.moveTo(a1.x + nx * offset, a1.y + ny * offset);
          ctx.lineTo(a2.x + nx * offset, a2.y + ny * offset);
          ctx.stroke();
        }
      } else {
        for (const offset of [-5, 0, 5]) {
          ctx.beginPath();
          ctx.moveTo(a1.x + nx * offset, a1.y + ny * offset);
          ctx.lineTo(a2.x + nx * offset, a2.y + ny * offset);
          ctx.stroke();
        }
      }
    }

    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const a of atoms) {
      const tw = Math.max(24, ctx.measureText(a.el).width + 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(a.x - tw / 2, a.y - fontSize * 0.7, tw, fontSize * 1.4);
      ctx.fillStyle = a.el.startsWith('O') ? '#dc2626' : a.el.includes('N') ? '#2563eb' : strokeColor;
      ctx.fillText(a.el, a.x, a.y);
    }
  } else if (source.kind === 'board' && source.boardStrokes) {
    for (const s of source.boardStrokes) {
      if (s.points.length >= 2) {
        ctx.save();
        ctx.strokeStyle = s.color || strokeColor;
        ctx.lineWidth = s.width || 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
        ctx.restore();
      }
      if (s.label && s.lx !== undefined && s.ly !== undefined) {
        ctx.save();
        ctx.fillStyle = s.color || strokeColor;
        ctx.font = `italic bold ${fontSize}px "Times New Roman", serif`;
        ctx.fillText(s.label, s.lx, s.ly);
        ctx.restore();
      }
    }
  }

  return canvas.toDataURL('image/png');
}
