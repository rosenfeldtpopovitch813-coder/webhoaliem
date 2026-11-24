// Lightweight Question Bank + Matrix Exam Generator (NB / TH / VD / VDC) + Sample Chemistry 12 THPT 2025 exam.

import { mulberry32, hashSeed } from './exam-shuffler.js';

export const COGNITIVE_LEVELS = ['NB', 'TH', 'VD', 'VDC'];

export const SAMPLE_CHEM_EXAM = {
  title: 'ĐỀ MINH HỌA HÓA HỌC 12 · CHUẨN THPT 2025',
  subject: 'Hóa học 12',
  durationMinutes: 50,
  examCode: '101',
  questions: [
    {
      id: 'q1',
      part: 'I',
      prompt: 'Chất nào sau đây là ester được tạo thành từ $\\ce{CH3COOH}$ và $\\ce{C2H5OH}$?',
      options: ['$\\ce{CH3COOC2H5}$', '$\\ce{HCOOC2H5}$', '$\\ce{C2H5COOCH3}$', '$\\ce{CH3COOCH3}$'],
      answer: 'A',
      answerSignal: 'sample',
      explanation: 'Phản ứng ester hóa: $\\ce{CH3COOH + C2H5OH <=>[H2SO4 đặc, t°] CH3COOC2H5 + H2O}$.',
      chapter: 'Ester - Lipid',
      level: 'NB',
      lockOrder: false,
      lockOptions: false,
      warnings: []
    },
    {
      id: 'q2',
      part: 'I',
      prompt: 'Thủy phân hoàn toàn ethyl acetate trong dung dịch $\\ce{NaOH}$ đun nóng thu được muối có công thức là',
      options: ['$\\ce{CH3COONa}$', '$\\ce{HCOONa}$', '$\\ce{C2H5COONa}$', '$\\ce{C2H5ONa}$'],
      answer: 'A',
      answerSignal: 'sample',
      explanation: '$\\ce{CH3COOC2H5 + NaOH ->[t°] CH3COONa + C2H5OH}$.',
      chapter: 'Ester - Lipid',
      level: 'NB',
      lockOrder: false,
      lockOptions: false,
      warnings: []
    },
    {
      id: 'q3',
      part: 'I',
      prompt: 'Carbohydrate nào sau đây thuộc loại disaccharide?',
      options: ['Glucose', 'Fructose', 'Saccharose', 'Tinh bột'],
      answer: 'C',
      answerSignal: 'sample',
      explanation: 'Saccharose ($\\ce{C12H22O11}$) gồm 1 đơn vị $\\alpha$-glucose và 1 đơn vị $\\beta$-fructose.',
      chapter: 'Carbohydrate',
      level: 'NB',
      lockOrder: false,
      lockOptions: false,
      warnings: []
    },
    {
      id: 'q4',
      part: 'I',
      prompt: 'Dung dịch chất nào sau đây làm quỳ tím chuyển sang màu xanh?',
      options: ['Methylamine ($\\ce{CH3NH2}$)', 'Aniline ($\\ce{C6H5NH2}$)', 'Glycine', 'Ethanol'],
      answer: 'A',
      answerSignal: 'sample',
      explanation: 'Methylamine là amine no đơn chức có tính base mạnh hơn $\\ce{NH3}$, làm xanh quỳ tím.',
      chapter: 'Amine - Amino acid',
      level: 'TH',
      lockOrder: false,
      lockOptions: false,
      warnings: []
    },
    {
      id: 'q5',
      part: 'I',
      prompt: 'Cho thế điện cực chuẩn $E^\\circ_{\\ce{Zn^{2+}/Zn}} = -0{,}76\\text{ V}$ và $E^\\circ_{\\ce{Cu^{2+}/Cu}} = +0{,}34\\text{ V}$. Sức điện động chuẩn của pin Galvani $\\ce{Zn - Cu}$ là',
      options: ['$1{,}10\\text{ V}$', '$0{,}42\\text{ V}$', '$-1{,}10\\text{ V}$', '$0{,}76\\text{ V}$'],
      answer: 'A',
      answerSignal: 'sample',
      explanation: '$E^\\circ_{\\text{pin}} = E^\\circ_{\\text{cathode}} - E^\\circ_{\\text{anode}} = 0{,}34 - (-0{,}76) = 1{,}10\\text{ V}$.',
      chapter: 'Pin điện hóa',
      level: 'TH',
      lockOrder: false,
      lockOptions: false,
      warnings: []
    },
    {
      id: 'q6',
      part: 'I',
      prompt: 'Phát biểu nào sau đây đúng khi nói về phản ứng thủy phân chất béo?',
      options: [
        'Thủy phân trong môi trường acid là phản ứng thuận nghịch',
        'Thủy phân trong dung dịch kiềm luôn thu được glycerol',
        'Chất béo nhẹ hơn nước và không tan trong nước',
        'Tất cả các phát biểu trên đều đúng'
      ],
      answer: 'D',
      answerSignal: 'sample',
      explanation: 'Cả 3 tính chất vật lí và hóa học trên đều đúng với triglyceride (chất béo). Câu này tự khóa đảo phương án.',
      chapter: 'Ester - Lipid',
      level: 'TH',
      lockOrder: false,
      lockOptions: true,
      warnings: []
    },
    {
      id: 'q7',
      part: 'II',
      prompt: 'Tiến hành thí nghiệm xà phòng hóa chất béo tristearin ($\\ce{(C17H35COO)3C3H5}$) bằng dung dịch $\\ce{NaOH}$ dư, đun nóng nhẹ. Xét các nhận định sau:',
      options: [
        'Sản phẩm hữu cơ thu được gồm muối $\\ce{C17H35COONa}$ và glycerol.',
        'Phản ứng xà phòng hóa xảy ra thuận nghịch tương tự thủy phân trong môi trường acid.',
        'Thêm dung dịch $\\ce{NaCl}$ bão hòa vào sau phản ứng để tách muối của acid béo nổi lên trên.',
        'Từ $1\\text{ mol}$ tristearin cần dùng tối đa $3\\text{ mol}$ $\\ce{NaOH}$ để phản ứng vừa đủ.'
      ],
      answer: [true, false, true, true],
      answerSignal: 'sample',
      explanation: 'a) Đúng. b) Sai (phản ứng xà phòng hóa xảy ra một chiều). c) Đúng (giảm độ tan muối). d) Đúng (tỉ lệ 1:3).',
      chapter: 'Ester - Lipid',
      level: 'VD',
      lockOrder: false,
      lockOptions: false,
      warnings: []
    },
    {
      id: 'q8',
      part: 'II',
      prompt: 'Xét tính chất hóa học của glucose ($\\ce{C6H12O6}$) trong dung dịch nước:',
      options: [
        'Glucose phản ứng với thuốc thử Tollens tạo lớp bạc sáng bám trên thành ống nghiệm.',
        'Glucose hòa tan $\\ce{Cu(OH)2}$ ở nhiệt độ thường tạo dung dịch màu xanh lam.',
        'Glucose không làm mất màu nước bromine do chỉ tồn tại ở dạng mạch vòng.',
        'Lên men $1\\text{ mol}$ glucose với hiệu suất $100\\%$ thu được $2\\text{ mol}$ ethanol.'
      ],
      answer: [true, true, false, true],
      answerSignal: 'sample',
      explanation: 'a) Đúng. b) Đúng (nhóm -OH liền kề). c) Sai (nhóm -CHO oxi hóa bởi $\\ce{Br2}$). d) Đúng ($\\ce{C6H12O6 -> 2C2H5OH + 2CO2}$).',
      chapter: 'Carbohydrate',
      level: 'VD',
      lockOrder: false,
      lockOptions: false,
      warnings: []
    },
    {
      id: 'q9',
      part: 'III',
      prompt: 'Đun nóng $8{,}8\\text{ gam}$ ethyl acetate ($\\ce{CH3COOC2H5}$, $M = 88$) với dung dịch $\\ce{NaOH}$ dư. Khối lượng muối $\\ce{CH3COONa}$ ($M = 82$) thu được là bao nhiêu gam?',
      options: [],
      answer: '8.2',
      answerSignal: 'sample',
      explanation: '$n_{\\text{ester}} = \\frac{8{,}8}{88} = 0{,}1\\text{ mol} \\Rightarrow m_{\\ce{CH3COONa}} = 0{,}1 \\times 82 = 8{,}2\\text{ g}$.',
      chapter: 'Ester - Lipid',
      level: 'VD',
      lockOrder: false,
      lockOptions: false,
      warnings: []
    },
    {
      id: 'q10',
      part: 'III',
      prompt: 'Lên men $90\\text{ gam}$ glucose ($M = 180$) thành ethanol với hiệu suất $80\\%$. Khối lượng ethanol ($M = 46$) thu được bằng bao nhiêu gam?',
      options: [],
      answer: '36.8',
      answerSignal: 'sample',
      explanation: '$n_{\\text{glucose}} = \\frac{90}{180} = 0{,}5\\text{ mol} \\Rightarrow n_{\\ce{C2H5OH}} = 2 \\times 0{,}5 \\times 0{,}8 = 0{,}8\\text{ mol} \\Rightarrow m = 0{,}8 \\times 46 = 36{,}8\\text{ g}$.',
      chapter: 'Carbohydrate',
      level: 'VDC',
      lockOrder: false,
      lockOptions: false,
      warnings: []
    }
  ]
};

const BANK_STORAGE_KEY = 'hoaliems_exam_module_bank_v1';

export function loadQuestionBank() {
  if (typeof localStorage === 'undefined') return structuredClone(SAMPLE_CHEM_EXAM.questions);
  try {
    const raw = localStorage.getItem(BANK_STORAGE_KEY);
    if (!raw) return structuredClone(SAMPLE_CHEM_EXAM.questions);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : structuredClone(SAMPLE_CHEM_EXAM.questions);
  } catch {
    return structuredClone(SAMPLE_CHEM_EXAM.questions);
  }
}

export function saveQuestionBank(items) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(items));
}

export function mergeIntoQuestionBank(existingBank, newQuestions) {
  const seen = new Set(existingBank.map((q) => `${q.part}::${q.prompt.trim().toLowerCase()}`));
  const merged = [...existingBank];
  let added = 0;

  for (const q of newQuestions) {
    const sig = `${q.part}::${String(q.prompt || '').trim().toLowerCase()}`;
    if (!q.prompt?.trim() || seen.has(sig)) continue;
    seen.add(sig);
    merged.push({
      ...structuredClone(q),
      id: `bank_${Date.now()}_${merged.length + 1}`,
      chapter: q.chapter || 'Chung',
      level: COGNITIVE_LEVELS.includes(q.level) ? q.level : 'TH'
    });
    added++;
  }
  return { bank: merged, added };
}

/**
 * Draw a non-repeating exam from a Question Bank matching requested Matrix specs:
 * matrixRows: [{ part: 'I'|'II'|'III', chapter: 'ALL'|string, level: 'ALL'|'NB'|'TH'|'VD'|'VDC', count: number }]
 */
export function generateExamFromMatrix(bank, matrixRows, { title = 'Đề thi sinh từ Ma trận', seed = Date.now() } = {}) {
  const rng = mulberry32(hashSeed(String(seed)));
  const usedIds = new Set();
  const picked = [];
  const shortages = [];

  for (const row of matrixRows) {
    const want = Math.max(0, Number(row.count) || 0);
    if (!want) continue;

    const candidates = bank.filter((q) => {
      if (usedIds.has(q.id)) return false;
      if (row.part && row.part !== 'ALL' && q.part !== row.part) return false;
      if (row.chapter && row.chapter !== 'ALL' && q.chapter !== row.chapter) return false;
      if (row.level && row.level !== 'ALL' && q.level !== row.level) return false;
      return true;
    });

    // Shuffle candidates deterministically
    const pool = [...candidates];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const chosen = pool.slice(0, want);
    for (const q of chosen) {
      usedIds.add(q.id);
      picked.push({ ...structuredClone(q), warnings: [] });
    }
    if (chosen.length < want) {
      shortages.push(`Phần ${row.part} · ${row.chapter} · ${row.level}: cần ${want}, kho chỉ có ${chosen.length}.`);
    }
  }

  // Sort strictly I -> II -> III
  const partRank = { I: 1, II: 2, III: 3 };
  picked.sort((a, b) => (partRank[a.part] || 9) - (partRank[b.part] || 9));
  picked.forEach((q, idx) => {
    q.id = `q${idx + 1}`;
  });

  return {
    exam: {
      title,
      subject: 'Hóa học',
      durationMinutes: 50,
      examCode: '101',
      questions: picked
    },
    shortages
  };
}
