// Exact HTVVM Studio THPT 2025 grading engine + mistake-practice extractor + main-web exporters.
// Mirrors webhoaliem-main/shared/exam-grading.js with added explanation support.

export const PART2_WEIGHTS = Object.freeze([0, 10, 25, 50, 100]);

export function normalizeShort(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizeChoice(value) {
  return typeof value === 'string' && /^[ABCD]$/i.test(value.trim()) ? value.trim().toUpperCase() : null;
}

export function normalizeTF(value) {
  return value === true || value === false ? value : null;
}

/**
 * Strip secret answers & explanations before sending public questions to students.
 */
export function publicQuestions(questions) {
  return questions.map(({ answer, tolerance, explanation, answerSignal, ...rest }) => ({ ...rest }));
}

/**
 * Grade an exam using official THPT 2025 weights (Part I: 0.25, Part II: 0.1/0.25/0.5/1.0, Part III: 0.25),
 * normalized cleanly to a 10-point scale, preserving explanations for post-submit review.
 */
export function gradeExam(questions, submitted = {}) {
  const details = [];
  let earned = 0;
  let possible = 0;

  for (const q of questions) {
    const raw = submitted && typeof submitted === 'object' ? submitted[q.id] : null;
    const max = q.part === 'I' ? 25 : q.part === 'II' ? 100 : 25;
    let points = 0;
    let correct = false;

    if (q.part === 'I') {
      correct = normalizeChoice(raw) === normalizeChoice(q.answer);
      points = correct ? max : 0;
    } else if (q.part === 'II') {
      const ans = Array.isArray(q.answer) ? q.answer : [true, true, true, true];
      const count = Array.isArray(raw)
        ? ans.reduce((n, expected, idx) => n + (normalizeTF(raw[idx]) === expected ? 1 : 0), 0)
        : 0;
      points = PART2_WEIGHTS[count] || 0;
      correct = count === 4;
    } else {
      const expected = normalizeShort(q.answer);
      const val = normalizeShort(raw);
      correct = expected !== null && val !== null && Math.abs(val - expected) <= (q.tolerance ?? 0.0001);
      points = correct ? max : 0;
    }

    earned += points;
    possible += max;
    details.push({
      id: q.id,
      part: q.part,
      earned: points,
      possible: max,
      correct,
      answer: q.answer,
      response: raw ?? null,
      prompt: q.prompt,
      explanation: q.explanation || ''
    });
  }

  const score = possible ? Math.round((earned / possible) * 1000) / 100 : 0;
  return {
    score,
    earnedHundredths: earned,
    possibleHundredths: possible,
    details,
    total: questions.length,
    fullyCorrect: details.filter((d) => d.correct).length,
    mistakeIds: details.filter((d) => !d.correct).map((d) => d.id)
  };
}

/**
 * Extract only the questions the student answered incorrectly (Azota /training-mistake pattern).
 */
export function buildMistakePracticeExam(exam, gradeResult) {
  const wrongSet = new Set(gradeResult.mistakeIds || []);
  const wrongQuestions = exam.questions
    .filter((q) => wrongSet.has(q.id))
    .map((q, idx) => ({ ...structuredClone(q), id: `m${idx + 1}`, sourceId: q.id }));
  return {
    ...exam,
    title: `Luyện lại câu sai · ${exam.title}`,
    isMistakePractice: true,
    questions: wrongQuestions
  };
}

/**
 * Export directly to HTVVM Studio Online Exam Room format (compatible with webhoaliem-main/api/exam.js).
 */
export function toHtvvmOnlineExamPayload(exam) {
  return {
    title: exam.title || 'Đề thi mới',
    subject: exam.subject || 'Hóa học',
    durationMinutes: Number(exam.durationMinutes) || 50,
    questions: exam.questions.map((q) => {
      const firstImg = q.image || q.images?.[0] || '';
      const base = {
        part: q.part,
        prompt: q.prompt,
        ...(firstImg ? { image: firstImg } : {}),
        ...(q.explanation ? { explanation: q.explanation } : {})
      };
      if (q.part === 'I') {
        return { ...base, options: q.options.slice(0, 4), answer: q.answer || 'A' };
      }
      if (q.part === 'II') {
        return {
          ...base,
          options: q.options.slice(0, 4),
          answer: (q.answer || [true, true, true, true]).map((v) => Boolean(v))
        };
      }
      return {
        ...base,
        answer: normalizeShort(q.answer) ?? 0,
        tolerance: q.tolerance ?? 0.0001
      };
    })
  };
}

/**
 * Export directly to HTVVM Studio ExamPaperStudio format (compatible with notes-app/src/types/board.ts ExamPaperDocument).
 */
export function toHtvvmExamPaperDocument(exam) {
  const blocks = [];
  const partHeaders = {
    I: { title: 'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn', subtitle: 'Thí sinh trả lời từ câu 1 đến hết phần I. Mỗi câu hỏi thí sinh chỉ chọn một phương án.' },
    II: { title: 'PHẦN II. Câu trắc nghiệm đúng sai', subtitle: 'Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.' },
    III: { title: 'PHẦN III. Câu trắc nghiệm trả lời ngắn', subtitle: 'Thí sinh điền kết quả số vào ô trả lời.' }
  };

  for (const part of ['I', 'II', 'III']) {
    const group = exam.questions.filter((q) => q.part === part);
    if (!group.length) continue;
    blocks.push({
      id: `sec-${part}`,
      type: 'section',
      title: partHeaders[part].title,
      subtitle: partHeaders[part].subtitle
    });
    for (const q of group) {
      const allImgs = Array.isArray(q.images) && q.images.length ? q.images : (q.image ? [q.image] : []);
      const figures = allImgs.map((src, fIdx) => ({
        id: `fig-${q.id}-${fIdx + 1}`,
        sourceId: `src-${q.id}-${fIdx + 1}`,
        src,
        width: 320,
        align: 'center',
        layout: 'break-center'
      }));
      if (part === 'I') {
        blocks.push({
          id: q.id,
          type: 'question',
          questionType: 'mcq',
          prompt: q.prompt,
          options: q.options.slice(0, 4),
          optionCols: 2,
          correctChoice: q.answer || '',
          solution: q.explanation || '',
          figures
        });
      } else if (part === 'II') {
        blocks.push({
          id: q.id,
          type: 'question',
          questionType: 'tf',
          prompt: q.prompt,
          statements: ['a', 'b', 'c', 'd'].map((label, idx) => ({
            id: `${q.id}-${label}`,
            label,
            text: q.options[idx] || '',
            correct: Array.isArray(q.answer) ? q.answer[idx] : null
          })),
          solution: q.explanation || '',
          figures
        });
      } else {
        blocks.push({
          id: q.id,
          type: 'question',
          questionType: 'short',
          prompt: q.prompt,
          shortAnswer: String(q.answer ?? ''),
          solution: q.explanation || '',
          figures
        });
      }
    }
  }

  return {
    fontFamily: '"Times New Roman", Times, Georgia, serif',
    fontSizePt: 12,
    header: {
      department: 'SỞ GIÁO DỤC VÀ ĐÀO TẠO',
      school: 'WEB HOÁ LIEMS · HTVVM STUDIO',
      examTitle: exam.title || 'ĐỀ KIỂM TRA ĐỊNH KỲ',
      subject: `Môn: ${exam.subject || 'Hóa học'}`,
      duration: `Thời gian làm bài: ${exam.durationMinutes || 50} phút`,
      examCode: String(exam.examCode || '101'),
      academicYear: 'Năm học 2025 - 2026',
      showStudentInfo: true,
      showFooter: true,
      showPageNumbers: true
    },
    blocks,
    figureSources: [],
    updatedAt: Date.now()
  };
}
