import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Edit3,
  Eye,
  FileEdit,
  FileText,
  ImagePlus,
  LayoutGrid,
  Lock,
  Merge,
  Pin,
  Plus,
  Scissors,
  SplitSquareVertical,
  Table2,
  Trash2,
  X,
} from './icons';
import type {
  AnswerDetectionSource,
  ExamQuestion,
  ParseResult,
  PdfPagePreview,
  QuestionType,
} from './types';
import { computeParseStats, validateQuestion } from './examFsm';
import { compressImageFileForExam } from './imageCompression';
import {
  pendingExamPaperToParseResult,
  studioQuestionsToHtvvmPayload,
  type HtvvmQuestionPayload,
  type PendingExamPaperPayload,
} from './examAdapter';
import { ExamScanDropzone } from './ExamScanDropzone';
import { MathContent } from './MathContent';
import { PdfCropperModal } from './PdfCropperModal';
import { FullExamEditor } from './FullExamEditor';

const TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Phần I · Trắc nghiệm A–D',
  TRUE_FALSE: 'Phần II · Đúng / Sai (4 ý)',
  SHORT_ANSWER: 'Phần III · Trả lời ngắn',
  MULTIPLE_CHOICE: 'Nhiều đáp án (cần chuyển)',
  ESSAY: 'Tự luận (cần chuyển/xóa)',
};

const SOURCE_BADGES: Record<AnswerDetectionSource, string> = {
  underline: 'Gạch chân',
  color: 'Màu chữ',
  highlight: 'Tô nền',
  bold: 'In đậm',
  asterisk: 'Dấu *',
  answer_table: 'Bảng đáp án',
  inline_text: 'Đ/S nội dòng',
  latex: 'LaTeX \\True',
  manual: 'Thủ công',
};

function extractImageTags(html: string): string[] {
  const urls: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) urls.push(m[1]);
  return urls;
}

function removeImageBySrc(html: string, srcToRemove: string): string {
  const escaped = srcToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`<img[^>]+src=["']${escaped}["'][^>]*>`, 'i'), '').trim();
}

function buildQuickTableHtml(rows: number, cols: number): string {
  const headerCells = Array.from({ length: cols }, (_, c) => `<th>Cột ${c + 1}</th>`).join('');
  const bodyRows = Array.from({ length: Math.max(1, rows - 1) }, (_, r) => {
    const tds = Array.from({ length: cols }, (_, c) => `<td>Ô ${r + 1}.${c + 1}</td>`).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `<div class="exam-table-wrap"><table class="exam-table"><tbody><tr>${headerCells}</tr>${bodyRows}</tbody></table></div>`;
}

export interface StudioMountCallbacks {
  initialPendingPaper?: PendingExamPaperPayload | null;
  onDetectedTitle?: (detectedTitle: string) => void;
  onCountsChange?: (counts: { I: number; II: number; III: number }) => void;
  onPublishPayload: (data: {
    questions: HtvvmQuestionPayload[];
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  }) => Promise<void>;
}

const ExamUnifiedStudioApp: React.FC<StudioMountCallbacks> = ({
  initialPendingPaper,
  onDetectedTitle,
  onCountsChange,
  onPublishPayload,
}) => {
  const [parseResult, setParseResult] = useState<ParseResult | null>(() => {
    if (initialPendingPaper && ((initialPendingPaper.questions?.length ?? 0) > 0 || initialPendingPaper.rawExamText?.trim())) {
      return pendingExamPaperToParseResult(initialPendingPaper);
    }
    return null;
  });
  const [questions, setQuestions] = useState<ExamQuestion[]>(() => parseResult?.questions ?? []);
  const [pdfPages, setPdfPages] = useState<PdfPagePreview[]>(() => parseResult?.pdfPages ?? []);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [studioMode, setStudioMode] = useState<'cards' | 'full_editor'>('cards');
  const [showRawModal, setShowRawModal] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const hiddenImgInputRef = useRef<HTMLInputElement>(null);
  const pendingImgTargetRef = useRef<{
    qId: string;
    field: 'stem' | 'option' | 'explanation';
    optId?: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2400);
  };

  useEffect(() => {
    if (parseResult?.title) {
      onDetectedTitle?.(parseResult.title);
    }
  }, [parseResult?.title]);

  const counts = useMemo(
    () => ({
      I: questions.filter((q) => q.type === 'SINGLE_CHOICE').length,
      II: questions.filter((q) => q.type === 'TRUE_FALSE').length,
      III: questions.filter((q) => q.type === 'SHORT_ANSWER').length,
    }),
    [questions]
  );

  useEffect(() => {
    onCountsChange?.(counts);
  }, [counts.I, counts.II, counts.III]);

  const stats = useMemo(() => {
    const warningCount = questions.filter((q) => q.warnings.length > 0).length;
    const readyCount = questions.length - warningCount;
    const imageCount = questions.reduce((acc, q) => {
      const stemImgs = extractImageTags(q.stem).length + (q.stemCropImage ? 1 : 0);
      const optImgs = q.options.reduce((s, o) => s + extractImageTags(o.content).length + (o.cropImage ? 1 : 0), 0);
      return acc + stemImgs + optImgs + extractImageTags(q.explanation).length;
    }, 0);
    const tableCount = questions.reduce((acc, q) => {
      const cnt = (s: string) => (s.match(/<table\b/gi) || []).length;
      return acc + cnt(q.stem) + cnt(q.explanation) + q.options.reduce((s, o) => s + cnt(o.content), 0);
    }, 0);
    return { warningCount, readyCount, imageCount, tableCount };
  }, [questions]);

  const loadParseResult = (res: ParseResult) => {
    setParseResult(res);
    setQuestions(res.questions);
    setPdfPages(res.pdfPages ?? []);
    setEditingId(null);
    setStudioMode('cards');
    setPublishError(null);
    if (res.title) onDetectedTitle?.(res.title);
  };

  const handleStartBlank = () => {
    const firstQ: ExamQuestion = {
      id: `q_${Math.random().toString(36).slice(2, 9)}`,
      index: 1,
      partIndex: 1,
      localIndex: 1,
      partTitle: 'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn',
      type: 'SINGLE_CHOICE',
      stem: '',
      options: ['A', 'B', 'C', 'D'].map((l, i) => ({
        id: `opt_${Math.random().toString(36).slice(2, 8)}`,
        label: l,
        content: `Phương án ${l}`,
        isCorrect: i === 0,
        detectionSource: i === 0 ? 'manual' : undefined,
      })),
      acceptedAnswers: [],
      explanation: '',
      points: 0.25,
      isFixedPosition: false,
      lockOptionOrder: false,
      warnings: ['Nội dung câu hỏi đang trống'],
    };
    loadParseResult({
      title: '',
      sourceFileName: 'Soạn thủ công',
      sourceFormat: 'text',
      questions: [firstQ],
      stats: computeParseStats([firstQ], 0, 0, 0),
      rawPreviewText: '',
      parseDurationMs: 1,
    });
    setEditingId(firstQ.id);
  };

  const mutateQuestion = (qId: string, updater: (q: ExamQuestion) => ExamQuestion) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const next = updater(q);
        return { ...next, warnings: validateQuestion(next) };
      })
    );
  };

  const insertImageToTarget = async (
    target: { qId: string; field: 'stem' | 'option' | 'explanation'; optId?: string },
    file: File
  ) => {
    try {
      const url = await compressImageFileForExam(file, 260000);
      const imgTag = `<img src="${url}" alt="Hình minh họa" />`;
      mutateQuestion(target.qId, (q) => {
        if (target.field === 'stem') {
          return { ...q, stem: q.stem ? `${q.stem}<br/>${imgTag}` : imgTag };
        }
        if (target.field === 'explanation') {
          return { ...q, explanation: q.explanation ? `${q.explanation}<br/>${imgTag}` : imgTag };
        }
        return {
          ...q,
          options: q.options.map((o) =>
            o.id === target.optId ? { ...o, content: o.content ? `${o.content}<br/>${imgTag}` : imgTag } : o
          ),
        };
      });
      showToast('Đã đính kèm hình ảnh.');
    } catch (err) {
      showToast((err as Error).message || 'Không thể chèn ảnh.');
    }
  };

  const triggerImagePicker = (qId: string, field: 'stem' | 'option' | 'explanation', optId?: string) => {
    pendingImgTargetRef.current = { qId, field, optId };
    hiddenImgInputRef.current?.click();
  };

  const handlePasteImage = async (
    e: React.ClipboardEvent,
    qId: string,
    field: 'stem' | 'option' | 'explanation',
    optId?: string
  ) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imgItem = items.find((it) => it.type.startsWith('image/'));
    if (!imgItem) return;
    const file = imgItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    await insertImageToTarget({ qId, field, optId }, file);
  };

  const toggleOptionCorrect = (qId: string, optId: string) => {
    mutateQuestion(qId, (q) => ({
      ...q,
      type: q.type === 'MULTIPLE_CHOICE' ? 'SINGLE_CHOICE' : q.type,
      options: q.options.map((o) => ({
        ...o,
        isCorrect: o.id === optId,
        detectionSource: o.id === optId ? 'manual' : undefined,
      })),
    }));
  };

  const setTrueFalseValue = (qId: string, optId: string, val: boolean) => {
    mutateQuestion(qId, (q) => ({
      ...q,
      options: q.options.map((o) =>
        o.id === optId ? { ...o, isCorrect: val, detectionSource: 'manual' } : o
      ),
    }));
  };

  const changeQuestionType = (qId: string, nextType: QuestionType) => {
    mutateQuestion(qId, (q) => {
      let options = [...q.options];
      if (nextType === 'SINGLE_CHOICE') {
        const labels = ['A', 'B', 'C', 'D'];
        options = labels.map((l, idx) => ({
          id: options[idx]?.id ?? `opt_${Math.random().toString(36).slice(2, 8)}`,
          label: l,
          content: options[idx]?.content || `Phương án ${l}`,
          cropImage: options[idx]?.cropImage,
          isCorrect: idx === 0 && !options.some((x) => x.isCorrect) ? true : Boolean(options[idx]?.isCorrect),
          detectionSource: 'manual',
        }));
        const firstCorrect = options.findIndex((o) => o.isCorrect);
        options = options.map((o, i) => ({ ...o, isCorrect: i === (firstCorrect >= 0 ? firstCorrect : 0) }));
      } else if (nextType === 'TRUE_FALSE') {
        const labels = ['a', 'b', 'c', 'd'];
        options = labels.map((l, idx) => ({
          id: options[idx]?.id ?? `opt_${Math.random().toString(36).slice(2, 8)}`,
          label: l,
          content: options[idx]?.content || `Nhận định ${l}`,
          cropImage: options[idx]?.cropImage,
          isCorrect: Boolean(options[idx]?.isCorrect),
          detectionSource: 'manual',
        }));
      }
      const nextPartIndex = nextType === 'TRUE_FALSE' ? 2 : nextType === 'SHORT_ANSWER' ? 3 : 1;
      return { ...q, type: nextType, partIndex: nextPartIndex, options };
    });
  };

  const addQuestion = (qType: 'SINGLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' = 'SINGLE_CHOICE') => {
    const newQ: ExamQuestion = {
      id: `q_${Math.random().toString(36).slice(2, 9)}`,
      index: questions.length + 1,
      partIndex: qType === 'TRUE_FALSE' ? 2 : qType === 'SHORT_ANSWER' ? 3 : 1,
      type: qType,
      stem: '',
      options:
        qType === 'SINGLE_CHOICE'
          ? ['A', 'B', 'C', 'D'].map((l, i) => ({
              id: `opt_${Math.random().toString(36).slice(2, 8)}`,
              label: l,
              content: `Phương án ${l}`,
              isCorrect: i === 0,
              detectionSource: i === 0 ? 'manual' : undefined,
            }))
          : qType === 'TRUE_FALSE'
            ? ['a', 'b', 'c', 'd'].map((l) => ({
                id: `opt_${Math.random().toString(36).slice(2, 8)}`,
                label: l,
                content: `Nhận định ${l}`,
                isCorrect: true,
                detectionSource: 'manual',
              }))
            : [],
      acceptedAnswers: qType === 'SHORT_ANSWER' ? ['0'] : [],
      explanation: '',
      points: qType === 'TRUE_FALSE' ? 1 : 0.25,
      isFixedPosition: false,
      lockOptionOrder: false,
      warnings: ['Nội dung câu hỏi đang trống'],
    };
    setQuestions((prev) => [...prev, newQ]);
    setEditingId(newQ.id);
  };

  const removeQuestion = (qId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== qId).map((q, idx) => ({ ...q, index: idx + 1 })));
  };

  const padOptionsToFour = (qId: string) => {
    mutateQuestion(qId, (q) => {
      const isTF = q.type === 'TRUE_FALSE';
      const labels = isTF ? ['a', 'b', 'c', 'd'] : ['A', 'B', 'C', 'D'];
      const nextOpts = labels.map((lbl, idx) => ({
        id: q.options[idx]?.id ?? `opt_${Math.random().toString(36).slice(2, 8)}`,
        label: lbl,
        content: q.options[idx]?.content || (isTF ? `Nhận định ${lbl}` : `Phương án ${lbl}`),
        cropImage: q.options[idx]?.cropImage,
        isCorrect: Boolean(q.options[idx]?.isCorrect),
        detectionSource: q.options[idx]?.detectionSource ?? (isTF ? 'manual' : undefined),
      }));
      return { ...q, options: nextOpts };
    });
    showToast('Đã chuẩn hóa đủ 4 phương án.');
  };

  const mergeWithNextQuestion = (qIdx: number) => {
    if (qIdx < 0 || qIdx >= questions.length - 1) return;
    setQuestions((prev) => {
      const curr = prev[qIdx];
      const next = prev[qIdx + 1];
      const merged: ExamQuestion = {
        ...curr,
        stem: [curr.stem, next.stem].filter(Boolean).join('<br/>'),
        options: [...curr.options, ...next.options],
        explanation: [curr.explanation, next.explanation].filter(Boolean).join('<br/>'),
      };
      merged.warnings = validateQuestion(merged);
      const out = [...prev.slice(0, qIdx), merged, ...prev.slice(qIdx + 2)];
      return out.map((q, i) => ({ ...q, index: i + 1 }));
    });
    showToast(`Đã gộp Câu ${qIdx + 2} vào Câu ${qIdx + 1}.`);
  };

  const splitQuestionBelow = (qIdx: number) => {
    const curr = questions[qIdx];
    if (!curr) return;
    const stemParts = curr.stem.split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);
    let keepStem = curr.stem;
    let movedStem = '';
    if (stemParts.length >= 2) {
      movedStem = stemParts.pop()!;
      keepStem = stemParts.join('<br/>');
    }
    const newId = `q_${Math.random().toString(36).slice(2, 9)}`;
    setQuestions((prev) => {
      const updatedCurr: ExamQuestion = { ...prev[qIdx], stem: keepStem };
      updatedCurr.warnings = validateQuestion(updatedCurr);
      const newQ: ExamQuestion = {
        id: newId,
        index: qIdx + 2,
        partIndex: curr.partIndex,
        partTitle: curr.partTitle,
        type: curr.type === 'TRUE_FALSE' ? 'TRUE_FALSE' : curr.type === 'SHORT_ANSWER' ? 'SHORT_ANSWER' : 'SINGLE_CHOICE',
        stem: movedStem,
        options:
          curr.type === 'TRUE_FALSE'
            ? ['a', 'b', 'c', 'd'].map((l) => ({
                id: `opt_${Math.random().toString(36).slice(2, 8)}`,
                label: l,
                content: `Nhận định ${l}`,
                isCorrect: false,
                detectionSource: 'manual',
              }))
            : curr.type === 'SHORT_ANSWER'
              ? []
              : ['A', 'B', 'C', 'D'].map((l, i) => ({
                  id: `opt_${Math.random().toString(36).slice(2, 8)}`,
                  label: l,
                  content: `Phương án ${l}`,
                  isCorrect: i === 0,
                  detectionSource: i === 0 ? 'manual' : undefined,
                })),
        acceptedAnswers: curr.type === 'SHORT_ANSWER' ? ['0'] : [],
        explanation: '',
        points: curr.points,
        isFixedPosition: false,
        lockOptionOrder: false,
        warnings: [],
      };
      newQ.warnings = validateQuestion(newQ);
      const out = [...prev.slice(0, qIdx), updatedCurr, newQ, ...prev.slice(qIdx + 1)];
      return out.map((q, i) => ({ ...q, index: i + 1 }));
    });
    setEditingId(newId);
  };

  const moveImageToAdjacentQuestion = (qIdx: number, imgSrc: string, dir: -1 | 1) => {
    const targetIdx = qIdx + dir;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    setQuestions((prev) => {
      const srcQ = prev[qIdx];
      const dstQ = prev[targetIdx];
      const imgTag = `<img src="${imgSrc}" alt="Hình minh họa" />`;
      const cleanedSrc = removeImageBySrc(srcQ.stem, imgSrc);
      const nextDst = dir === 1 ? (dstQ.stem ? `${imgTag}<br/>${dstQ.stem}` : imgTag) : (dstQ.stem ? `${dstQ.stem}<br/>${imgTag}` : imgTag);
      return prev.map((q, i) => {
        if (i === qIdx) {
          const u = { ...q, stem: cleanedSrc };
          return { ...u, warnings: validateQuestion(u) };
        }
        if (i === targetIdx) {
          const u = { ...q, stem: nextDst };
          return { ...u, warnings: validateQuestion(u) };
        }
        return q;
      });
    });
  };

  const handlePublish = async () => {
    setPublishError(null);
    setIsPublishing(true);
    try {
      const { payload } = await studioQuestionsToHtvvmPayload(questions);
      await onPublishPayload({
        questions: payload,
        shuffleQuestions,
        shuffleOptions,
      });
    } catch (err) {
      setPublishError((err as Error).message || 'Không thể lưu đề thi.');
    } finally {
      setIsPublishing(false);
    }
  };

  if (!parseResult) {
    return <ExamScanDropzone onParsed={loadParseResult} onStartBlank={handleStartBlank} />;
  }

  return (
    <div className="exu-stack">
      <input
        ref={hiddenImgInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          const target = pendingImgTargetRef.current;
          if (f && target) void insertImageToTarget(target, f);
          e.target.value = '';
        }}
      />

      {toastMsg && (
        <div className="exu-toast">
          <CheckCircle2 size={15} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Studio Control Bar */}
      <div className="exu-toolbar-card is-wrap">
        <div className="exu-row-actions">
          <div className="exu-seg-group">
            <button
              type="button"
              onClick={() => setStudioMode('cards')}
              className={`exu-seg-btn ${studioMode === 'cards' ? 'is-active' : ''}`}
            >
              <LayoutGrid size={14} />
              Thẻ từng câu
            </button>
            <button
              type="button"
              onClick={() => setStudioMode('full_editor')}
              className={`exu-seg-btn ${studioMode === 'full_editor' ? 'is-active' : ''}`}
            >
              <FileEdit size={14} />
              Soạn toàn đề &amp; Đáp án nhanh
            </button>
          </div>

          <span className="exu-stat-pill">
            <FileText size={13} />
            {parseResult.sourceFileName}
          </span>
          <span className="exu-stat-pill exu-tabular">
            {questions.length} câu ({counts.I} · {counts.II} · {counts.III})
          </span>
          {stats.imageCount > 0 && <span className="exu-stat-pill">{stats.imageCount} hình</span>}
          {stats.tableCount > 0 && <span className="exu-stat-pill">{stats.tableCount} bảng</span>}
          <span className={`exu-stat-pill ${stats.warningCount > 0 ? 'is-warn' : 'is-ok'}`}>
            {stats.warningCount > 0
              ? `${stats.warningCount} câu cần soát`
              : `Đủ đáp án ${questions.length}/${questions.length} câu`}
          </span>
        </div>

        <div className="exu-row-actions">
          {pdfPages.length > 0 && pdfPages.some((p) => p.boxes.length > 0) && (
            <button
              type="button"
              onClick={() => setShowCropper(true)}
              className="exam-tab exu-btn-inline"
            >
              <Scissors size={14} />
              Chỉnh vùng cắt PDF
            </button>
          )}
          {parseResult.rawPreviewText && (
            <button
              type="button"
              onClick={() => setShowRawModal(true)}
              className="exam-tab exu-btn-inline"
            >
              <Eye size={14} />
              Văn bản gốc
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setParseResult(null);
              setQuestions([]);
              setPdfPages([]);
            }}
            className="exam-tab"
          >
            Đổi tệp đề khác
          </button>
          <button
            type="button"
            disabled={isPublishing || questions.length === 0}
            onClick={handlePublish}
            className="primary-btn exu-btn-inline"
          >
            <Check size={15} />
            {isPublishing ? 'Đang mở phòng…' : 'Tạo phòng thi Kiểu 2 →'}
          </button>
        </div>
      </div>

      {publishError && (
        <div className="exu-alert is-error">
          <AlertTriangle size={16} />
          <span>{publishError}</span>
        </div>
      )}

      {studioMode === 'full_editor' ? (
        <FullExamEditor
          questions={questions}
          examTitle={parseResult.title}
          onApplyQuestions={(nextQs, msg) => {
            setQuestions(nextQs);
            if (msg) showToast(msg);
          }}
          onSwitchToCards={() => setStudioMode('cards')}
        />
      ) : (
        <div className="exu-studio-grid">
          <div className="exu-questions-col">
            {questions.map((q, idx) => {
              const isEditing = editingId === q.id;
              const prevPart = idx > 0 ? questions[idx - 1].partTitle : undefined;
              const showPartHeader = q.partTitle && q.partTitle !== prevPart;
              const stemImages = extractImageTags(q.stem);

              return (
                <React.Fragment key={q.id}>
                  {showPartHeader && <div className="exu-part-banner">{q.partTitle}</div>}

                  <article
                    id={`exu-q-${q.id}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const imgFile = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
                      if (imgFile) {
                        e.preventDefault();
                        void insertImageToTarget({ qId: q.id, field: 'stem' }, imgFile);
                      }
                    }}
                    className={`exu-q-card ${q.warnings.length > 0 ? 'has-warning' : ''}`}
                  >
                    <div className="exu-q-card-head">
                      <div className="exu-row-actions">
                        <span className="exu-q-num exu-tabular">Câu {q.index}</span>
                        <select
                          value={q.type}
                          onChange={(e) => changeQuestionType(q.id, e.target.value as QuestionType)}
                          className="exam-input exu-select-compact"
                        >
                          {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                            <option key={t} value={t}>
                              {TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="exu-row-actions">
                        <button
                          type="button"
                          title="Đính kèm hình vào câu hỏi (hoặc kéo-thả / Ctrl+V ảnh)"
                          onClick={() => triggerImagePicker(q.id, 'stem')}
                          className="exam-mini-tool exu-btn-inline"
                        >
                          <ImagePlus size={13} /> Ảnh
                        </button>
                        <button
                          type="button"
                          title="Chèn bảng dữ liệu 3×3"
                          onClick={() => {
                            const tbl = buildQuickTableHtml(3, 3);
                            mutateQuestion(q.id, (curr) => ({
                              ...curr,
                              stem: curr.stem ? `${curr.stem}${tbl}` : tbl,
                            }));
                            setEditingId(q.id);
                          }}
                          className="exam-mini-tool exu-btn-inline"
                        >
                          <Table2 size={13} /> Bảng
                        </button>
                        <button
                          type="button"
                          title="Ghim cố định vị trí câu khi trộn đề"
                          onClick={() =>
                            mutateQuestion(q.id, (curr) => ({
                              ...curr,
                              isFixedPosition: !curr.isFixedPosition,
                            }))
                          }
                          className={`exu-icon-btn ${q.isFixedPosition ? 'is-active' : ''}`}
                        >
                          <Pin size={13} />
                        </button>
                        {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && (
                          <button
                            type="button"
                            title="Khóa thứ tự đáp án A–D ở câu này"
                            onClick={() =>
                              mutateQuestion(q.id, (curr) => ({
                                ...curr,
                                lockOptionOrder: !curr.lockOptionOrder,
                              }))
                            }
                            className={`exu-icon-btn ${q.lockOptionOrder ? 'is-active' : ''}`}
                          >
                            <Lock size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Tách thành 2 câu"
                          onClick={() => splitQuestionBelow(idx)}
                          className="exu-icon-btn"
                        >
                          <SplitSquareVertical size={13} />
                        </button>
                        {idx < questions.length - 1 && (
                          <button
                            type="button"
                            title={`Gộp Câu ${q.index + 1} vào câu này`}
                            onClick={() => mergeWithNextQuestion(idx)}
                            className="exu-icon-btn"
                          >
                            <Merge size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingId(isEditing ? null : q.id)}
                          className={`exam-mini-tool exu-btn-inline ${isEditing ? 'is-active' : ''}`}
                        >
                          <Edit3 size={13} /> {isEditing ? 'Xong' : 'Sửa'}
                        </button>
                        <button
                          type="button"
                          title="Xóa câu này"
                          onClick={() => removeQuestion(q.id)}
                          className="exu-icon-btn is-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {q.warnings.length > 0 && (
                      <div className="exu-q-warning-strip">
                        <AlertTriangle size={13} />
                        <span>{q.warnings.join(' · ')}</span>
                        {(q.type === 'SINGLE_CHOICE' || q.type === 'TRUE_FALSE') && q.options.length !== 4 && (
                          <button
                            type="button"
                            onClick={() => padOptionsToFour(q.id)}
                            className="exam-mini-tool"
                          >
                            Chuẩn hóa đủ 4 ý
                          </button>
                        )}
                      </div>
                    )}

                    <div className="exu-q-card-body">
                      {isEditing ? (
                        <div className="exu-stack-sm">
                          <label className="exu-field-label">
                            Nội dung đề bài (hỗ trợ LaTeX <code>$...$</code>, <code>\ce&#123;...&#125;</code>, bảng HTML, dán ảnh Ctrl+V)
                          </label>
                          <textarea
                            value={q.stem}
                            onPaste={(e) => void handlePasteImage(e, q.id, 'stem')}
                            onChange={(e) => mutateQuestion(q.id, (curr) => ({ ...curr, stem: e.target.value }))}
                            rows={4}
                            className="exam-input exu-mono-textarea"
                          />
                          {stemImages.length > 0 && (
                            <div className="exu-img-strip">
                              {stemImages.map((src, i) => (
                                <div key={i} className="exu-img-thumb-card">
                                  <img src={src} alt={`Hình ${i + 1}`} />
                                  <div className="exu-row-actions">
                                    {idx > 0 && (
                                      <button
                                        type="button"
                                        title="Chuyển lên câu trên"
                                        onClick={() => moveImageToAdjacentQuestion(idx, src, -1)}
                                        className="exu-icon-btn"
                                      >
                                        <ArrowUp size={12} />
                                      </button>
                                    )}
                                    {idx < questions.length - 1 && (
                                      <button
                                        type="button"
                                        title="Chuyển xuống câu dưới"
                                        onClick={() => moveImageToAdjacentQuestion(idx, src, 1)}
                                        className="exu-icon-btn"
                                      >
                                        <ArrowDown size={12} />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      title="Gỡ ảnh"
                                      onClick={() =>
                                        mutateQuestion(q.id, (curr) => ({
                                          ...curr,
                                          stem: removeImageBySrc(curr.stem, src),
                                        }))
                                      }
                                      className="exu-icon-btn is-danger"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="exu-live-preview-box">
                            <small className="exu-section-label">Xem trước hiển thị</small>
                            <MathContent content={q.stem} />
                          </div>
                        </div>
                      ) : q.stemCropImage ? (
                        <div className="exu-crop-preview-wrap">
                          <img src={q.stemCropImage} alt={`Câu ${q.index}`} className="exu-crop-stem-img" />
                        </div>
                      ) : (
                        <MathContent content={q.stem} className="exu-stem-view" />
                      )}

                      {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && (
                        <div className="exu-mc-grid">
                          {q.options.map((opt) => (
                            <div
                              key={opt.id}
                              onClick={() => !isEditing && toggleOptionCorrect(q.id, opt.id)}
                              className={`exu-opt-card ${opt.isCorrect ? 'is-correct' : ''} ${!isEditing ? 'is-clickable' : ''}`}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleOptionCorrect(q.id, opt.id);
                                }}
                                className={`exu-opt-badge ${opt.isCorrect ? 'is-correct' : ''}`}
                              >
                                {opt.label}
                              </button>
                              <div className="exu-opt-body">
                                {isEditing ? (
                                  <div className="exu-row-actions">
                                    <input
                                      type="text"
                                      value={opt.content}
                                      placeholder={`Nội dung phương án ${opt.label}…`}
                                      onPaste={(e) => void handlePasteImage(e, q.id, 'option', opt.id)}
                                      onChange={(e) =>
                                        mutateQuestion(q.id, (curr) => ({
                                          ...curr,
                                          options: curr.options.map((o) =>
                                            o.id === opt.id ? { ...o, content: e.target.value } : o
                                          ),
                                        }))
                                      }
                                      className="exam-input"
                                    />
                                    <button
                                      type="button"
                                      title="Đính kèm ảnh cho phương án"
                                      onClick={() => triggerImagePicker(q.id, 'option', opt.id)}
                                      className="exu-icon-btn"
                                    >
                                      <ImagePlus size={13} />
                                    </button>
                                  </div>
                                ) : opt.cropImage ? (
                                  <img src={opt.cropImage} alt={opt.label} className="exu-crop-opt-img" />
                                ) : (
                                  <MathContent content={opt.content} />
                                )}
                                {opt.isCorrect && opt.detectionSource && (
                                  <small className="exu-source-tag">
                                    <Check size={11} /> {SOURCE_BADGES[opt.detectionSource]}
                                  </small>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {q.type === 'TRUE_FALSE' && (
                        <div className="exu-tf-stack">
                          {q.options.map((opt) => (
                            <div key={opt.id} className="exu-tf-studio-row">
                              <div className="exu-tf-studio-text">
                                <strong className="exu-tf-letter">{opt.label})</strong>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={opt.content}
                                    placeholder={`Nội dung ý ${opt.label})…`}
                                    onPaste={(e) => void handlePasteImage(e, q.id, 'option', opt.id)}
                                    onChange={(e) =>
                                      mutateQuestion(q.id, (curr) => ({
                                        ...curr,
                                        options: curr.options.map((o) =>
                                          o.id === opt.id ? { ...o, content: e.target.value } : o
                                        ),
                                      }))
                                    }
                                    className="exam-input"
                                  />
                                ) : opt.cropImage ? (
                                  <img src={opt.cropImage} alt={opt.label} className="exu-crop-opt-img" />
                                ) : (
                                  <MathContent content={opt.content} />
                                )}
                              </div>
                              <div className="exu-tf-toggle-pair">
                                <button
                                  type="button"
                                  onClick={() => setTrueFalseValue(q.id, opt.id, true)}
                                  className={`exam-omr-mini-tf ${opt.isCorrect && opt.detectionSource ? 'is-true' : ''}`}
                                >
                                  Đúng
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTrueFalseValue(q.id, opt.id, false)}
                                  className={`exam-omr-mini-tf ${!opt.isCorrect && opt.detectionSource ? 'is-false' : ''}`}
                                >
                                  Sai
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {q.type === 'SHORT_ANSWER' && (
                        <div className="exu-short-box">
                          <label className="exu-field-label">
                            Đáp số chuẩn (phân cách nhiều cách làm tròn bằng dấu <code>;</code>, tự nhận cả dấu phẩy và chấm):
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={q.acceptedAnswers.join('; ')}
                            onChange={(e) => {
                              const vals = e.target.value
                                .split(';')
                                .map((s) => s.trim())
                                .filter(Boolean);
                              mutateQuestion(q.id, (curr) => ({ ...curr, acceptedAnswers: vals }));
                            }}
                            placeholder="VD: 12,5 hoặc 4,83; 4,8"
                            className="exam-input exu-short-input"
                          />
                        </div>
                      )}

                      {(q.explanation || isEditing) && (
                        <div className="exu-exp-box">
                          <div className="exu-exp-head">
                            <span className="exu-section-label">Lời giải chi tiết (hiển thị sau khi nộp bài)</span>
                            {isEditing && (
                              <button
                                type="button"
                                onClick={() => triggerImagePicker(q.id, 'explanation')}
                                className="exam-mini-tool exu-btn-inline"
                              >
                                <ImagePlus size={12} /> Ảnh lời giải
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <textarea
                              value={q.explanation}
                              onPaste={(e) => void handlePasteImage(e, q.id, 'explanation')}
                              onChange={(e) =>
                                mutateQuestion(q.id, (curr) => ({ ...curr, explanation: e.target.value }))
                              }
                              rows={2}
                              placeholder="Nhập lời giải chi tiết (hỗ trợ $...$, \ce{...}, dán ảnh)…"
                              className="exam-input exu-mono-textarea"
                            />
                          ) : (
                            <MathContent content={q.explanation} />
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                </React.Fragment>
              );
            })}

            <div className="exu-add-bar">
              <button type="button" onClick={() => addQuestion('SINGLE_CHOICE')} className="exam-tab exu-btn-inline">
                <Plus size={14} /> Thêm câu Phần I (A–D)
              </button>
              <button type="button" onClick={() => addQuestion('TRUE_FALSE')} className="exam-tab exu-btn-inline">
                <Plus size={14} /> Thêm câu Phần II (Đúng/Sai)
              </button>
              <button type="button" onClick={() => addQuestion('SHORT_ANSWER')} className="exam-tab exu-btn-inline">
                <Plus size={14} /> Thêm câu Phần III (Trả lời ngắn)
              </button>
            </div>
          </div>

          <aside className="exu-side-col">
            <div className="exu-card exu-sticky-panel exu-stack-sm">
              <div className="exu-section-label">
                Bản đồ soát câu ({stats.readyCount}/{questions.length} sẵn sàng)
              </div>
              <div className="exu-nav-grid">
                {questions.map((q) => {
                  const hasWarn = q.warnings.length > 0;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() =>
                        document.getElementById(`exu-q-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                      className={`exu-nav-cell exu-tabular ${hasWarn ? 'is-warn' : 'is-ready'}`}
                    >
                      {q.index}
                    </button>
                  );
                })}
              </div>

              <div className="exu-divider" />

              <div className="exu-section-label">Tùy chọn trộn đề theo lượt thi</div>
              <label className="exu-check-row">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                />
                <span>Đảo thứ tự câu hỏi trong từng phần (trừ câu ghim)</span>
              </label>
              <label className="exu-check-row">
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                />
                <span>Đảo thứ tự đáp án A, B, C, D của Phần I</span>
              </label>

              <div className="exu-divider" />

              <button
                type="button"
                disabled={isPublishing || questions.length === 0}
                onClick={handlePublish}
                className="primary-btn exu-full-btn"
              >
                {isPublishing ? 'Đang tạo phòng thi…' : 'Lưu & Mở phòng thi Kiểu 2 →'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {showRawModal && (
        <div className="exu-modal-backdrop" role="dialog" aria-modal="true" aria-label="Văn bản trích xuất gốc">
          <div className="exu-modal-dialog">
            <div className="exu-modal-head">
              <strong className="exu-modal-title">Văn bản trích xuất gốc — {parseResult.sourceFileName}</strong>
              <button type="button" onClick={() => setShowRawModal(false)} className="exu-icon-btn" aria-label="Đóng">
                <X size={16} />
              </button>
            </div>
            <pre className="exu-raw-pre">{parseResult.rawPreviewText}</pre>
          </div>
        </div>
      )}

      {showCropper && pdfPages.length > 0 && (
        <PdfCropperModal
          pages={pdfPages}
          questions={questions}
          onApply={(updatedQs, updatedPages) => {
            setQuestions(updatedQs);
            setPdfPages(updatedPages);
            setShowCropper(false);
            showToast('Đã cập nhật vùng cắt PDF.');
          }}
          onClose={() => setShowCropper(false)}
        />
      )}
    </div>
  );
};

export function mountExamUnifiedStudio(
  host: HTMLElement,
  callbacks: StudioMountCallbacks
): () => void {
  const root: Root = createRoot(host);
  root.render(<ExamUnifiedStudioApp {...callbacks} />);
  return () => {
    try {
      root.unmount();
    } catch {
      /* ignore unmount error */
    }
  };
}
