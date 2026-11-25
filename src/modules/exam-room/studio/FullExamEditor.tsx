import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileEdit,
  Image as ImageIcon,
  ListChecks,
  RefreshCw,
  Table2,
  Trash2,
} from './icons';
import type { ExamQuestion, QuestionType } from './types';
import { applyBulkAnswerKeyText, distributeExamPoints, validateQuestion } from './examFsm';
import { parsePlainTextExam } from './latexParser';
import { sanitizeExamHtml } from './MathContent';

interface FullExamEditorProps {
  questions: ExamQuestion[];
  examTitle: string;
  onApplyQuestions: (nextQuestions: ExamQuestion[], toastMessage?: string) => void;
  onSwitchToCards: () => void;
}

interface MediaRegistry {
  images: Map<string, string>;
  tables: Map<string, string>;
}

const TYPE_SHORT: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Phần I · A–D',
  MULTIPLE_CHOICE: 'Nhiều ĐA',
  TRUE_FALSE: 'Phần II · Đ/S',
  SHORT_ANSWER: 'Phần III · Số',
  ESSAY: 'Tự luận',
};

function htmlToEditorText(html: string, reg: MediaRegistry): string {
  if (!html) return '';
  let out = html;

  out = out.replace(
    /<div[^>]*class=["'][^"']*exam-table-wrap[^"']*["'][^>]*>[\s\S]*?<\/table>\s*<\/div>|<table\b[\s\S]*?<\/table>/gi,
    (tbl) => {
      const key = `TBL_${reg.tables.size + 1}`;
      reg.tables.set(key, tbl);
      return `\n[[TABLE:${key}]]\n`;
    }
  );

  out = out.replace(/<img\b[^>]+src=["']([^"']+)["'][^>]*\/?>/gi, (fullTag, src: string) => {
    if (/^https:\/\//i.test(src)) {
      return `\n[[IMG:${src}]]\n`;
    }
    const key = `IMG_${reg.images.size + 1}`;
    reg.images.set(key, fullTag);
    return `\n[[IMG:${key}]]\n`;
  });

  out = out
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<\/?(?:p|div|span|strong|b|em|i|u)[^>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function serializeExamToFullText(questions: ExamQuestion[]): { text: string; registry: MediaRegistry } {
  const registry: MediaRegistry = {
    images: new Map(),
    tables: new Map(),
  };

  const lines: string[] = [];
  let lastPartTitle: string | undefined;

  for (const q of questions) {
    if (q.partTitle && q.partTitle !== lastPartTitle) {
      if (lines.length > 0) lines.push('');
      lines.push(q.partTitle);
      lastPartTitle = q.partTitle;
    }

    const stemParts: string[] = [];
    if (q.stemCropImage && !q.stem.includes(q.stemCropImage)) {
      const key = `IMG_${registry.images.size + 1}`;
      registry.images.set(key, `<img src="${q.stemCropImage}" alt="Hình câu hỏi" />`);
      stemParts.push(`[[IMG:${key}]]`);
    }
    const stemTxt = htmlToEditorText(q.stem, registry);
    if (stemTxt) stemParts.push(stemTxt);

    const qNum = q.localIndex ?? q.index;
    lines.push(`Câu ${qNum}. ${stemParts.join('\n').trim()}`);

    if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
      for (const opt of q.options) {
        const star = opt.isCorrect ? '*' : '';
        const optTxt = htmlToEditorText(opt.content, registry);
        lines.push(`${star}${opt.label}. ${optTxt.replace(/\n+/g, ' ')}`);
      }
    } else if (q.type === 'TRUE_FALSE') {
      for (const opt of q.options) {
        const optTxt = htmlToEditorText(opt.content, registry).replace(/\n+/g, ' ');
        const flag = opt.detectionSource ? (opt.isCorrect ? ' [Đ]' : ' [S]') : '';
        lines.push(`${opt.label}) ${optTxt}${flag}`);
      }
    } else if (q.type === 'SHORT_ANSWER') {
      lines.push(q.acceptedAnswers.length > 0 ? `Đáp án: ${q.acceptedAnswers[0]}` : 'Đáp án: ........................');
    }

    if (q.explanation.trim()) {
      lines.push(`Lời giải: ${htmlToEditorText(q.explanation, registry)}`);
    }

    lines.push('');
  }

  return { text: lines.join('\n').trim(), registry };
}

function restoreMediaTokensAndSanitize(html: string, reg: MediaRegistry): string {
  let out = html;
  out = out.replace(/\[\[TABLE:(TBL_\d+)\]\]/g, (_m, key: string) => reg.tables.get(key) ?? '');
  out = out.replace(/<img\b[^>]+src=["'](IMG_\d+)["'][^>]*\/?>/gi, (_m, key: string) => reg.images.get(key) ?? '');
  out = out.replace(/\[\[IMG:([^\]]+)\]\]/g, (_m, token: string) => {
    const trimmed = token.trim();
    if (reg.images.has(trimmed)) return reg.images.get(trimmed)!;
    return `<img src="${trimmed}" alt="Hình minh họa" />`;
  });
  out = out.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br/><br/>');
  return sanitizeExamHtml(out);
}

function parseFullTextWithRegistry(rawText: string, examTitle: string, reg: MediaRegistry): ExamQuestion[] {
  const parsed = parsePlainTextExam(rawText, `${examTitle || 'de-thi'}.txt`);
  return parsed.questions.map((q) => {
    const restored: ExamQuestion = {
      ...q,
      stem: restoreMediaTokensAndSanitize(q.stem, reg),
      explanation: restoreMediaTokensAndSanitize(q.explanation, reg),
      options: q.options.map((o) => ({
        ...o,
        content: restoreMediaTokensAndSanitize(o.content, reg),
      })),
    };
    return { ...restored, warnings: validateQuestion(restored) };
  });
}

export const FullExamEditor: React.FC<FullExamEditorProps> = ({
  questions,
  examTitle,
  onApplyQuestions,
  onSwitchToCards,
}) => {
  const [subTab, setSubTab] = useState<'document' | 'bulk'>('document');
  const initialSerialized = useMemo(() => serializeExamToFullText(questions), [questions]);
  const [docText, setDocText] = useState<string>(initialSerialized.text);
  const [registry, setRegistry] = useState<MediaRegistry>(initialSerialized.registry);

  const syncFromCurrentQuestions = () => {
    const fresh = serializeExamToFullText(questions);
    setDocText(fresh.text);
    setRegistry(fresh.registry);
  };

  const livePreview = useMemo(() => {
    if (!docText.trim()) return [];
    return parseFullTextWithRegistry(docText, examTitle, registry);
  }, [docText, examTitle, registry]);

  const previewStats = useMemo(() => {
    const mc = livePreview.filter((q) => q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE').length;
    const tf = livePreview.filter((q) => q.type === 'TRUE_FALSE').length;
    const sa = livePreview.filter((q) => q.type === 'SHORT_ANSWER').length;
    const warns = livePreview.filter((q) => q.warnings.length > 0).length;
    return { mc, tf, sa, warns };
  }, [livePreview]);

  const handleApplyDocument = () => {
    if (livePreview.length === 0) return;
    const withPoints = distributeExamPoints(livePreview, 10).map((q) => ({
      ...q,
      warnings: validateQuestion(q),
    }));
    onApplyQuestions(withPoints, `Đã cập nhật toàn bộ đề (${withPoints.length} câu).`);
    onSwitchToCards();
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState<QuestionType>('SINGLE_CHOICE');
  const [answerKeyScope, setAnswerKeyScope] = useState<'auto' | 'MC' | 'TRUE_FALSE' | 'SHORT_ANSWER'>('auto');
  const [answerKeyText, setAnswerKeyText] = useState('');

  const bulkAnswerPreview = useMemo(() => {
    if (!answerKeyText.trim()) return { questions, matchedCount: 0 };
    return applyBulkAnswerKeyText(questions, answerKeyText, answerKeyScope, 'answer_table');
  }, [questions, answerKeyText, answerKeyScope]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    const deletedCount = selectedIds.size;
    const next = questions
      .filter((q) => !selectedIds.has(q.id))
      .map((q, idx) => ({ ...q, index: idx + 1 }));
    setSelectedIds(new Set());
    onApplyQuestions(next, `Đã xóa ${deletedCount} câu hỏi.`);
  };

  const handleBulkChangeType = () => {
    if (selectedIds.size === 0) return;
    const next = questions.map((q) => {
      if (!selectedIds.has(q.id)) return q;
      let opts = q.options;
      if (bulkType === 'SINGLE_CHOICE' && opts.length === 0) {
        opts = ['A', 'B', 'C', 'D'].map((l, idx) => ({
          id: `opt_${Math.random().toString(36).slice(2, 8)}`,
          label: l,
          content: `Phương án ${l}`,
          isCorrect: idx === 0,
          detectionSource: idx === 0 ? 'manual' : undefined,
        }));
      } else if (bulkType === 'TRUE_FALSE') {
        const labels = ['a', 'b', 'c', 'd'];
        opts =
          opts.length === 0
            ? labels.map((l) => ({
                id: `opt_${Math.random().toString(36).slice(2, 8)}`,
                label: l,
                content: `Nhận định ${l}`,
                isCorrect: false,
                detectionSource: 'manual',
              }))
            : opts.slice(0, 4).map((o, i) => ({ ...o, label: labels[i] ?? o.label.toLowerCase(), detectionSource: o.detectionSource ?? 'manual' }));
      }
      const updated = { ...q, type: bulkType, options: opts };
      return { ...updated, warnings: validateQuestion(updated) };
    });
    onApplyQuestions(next, `Đã chuyển ${selectedIds.size} câu sang ${TYPE_SHORT[bulkType]}.`);
  };

  const handleRenumberAll = () => {
    const partCounters = new Map<number, number>();
    const next = questions.map((q, idx) => {
      const pIdx = q.partIndex ?? 1;
      const loc = (partCounters.get(pIdx) ?? 0) + 1;
      partCounters.set(pIdx, loc);
      return { ...q, index: idx + 1, localIndex: loc };
    });
    onApplyQuestions(next, 'Đã đánh lại số thứ tự câu hỏi.');
  };

  const handleMoveQuestion = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const copy = [...questions];
    [copy[idx], copy[targetIdx]] = [copy[targetIdx], copy[idx]];
    onApplyQuestions(copy.map((q, i) => ({ ...q, index: i + 1 })));
  };

  const handleApplyBulkAnswerKeys = () => {
    if (bulkAnswerPreview.matchedCount === 0) return;
    onApplyQuestions(
      bulkAnswerPreview.questions,
      `Đã khớp đáp án cho ${bulkAnswerPreview.matchedCount} câu hỏi.`
    );
    setAnswerKeyText('');
  };

  return (
    <div className="exu-stack">
      <div className="exu-toolbar-card">
        <div className="exu-seg-group">
          <button
            type="button"
            onClick={() => {
              syncFromCurrentQuestions();
              setSubTab('document');
            }}
            className={`exu-seg-btn ${subTab === 'document' ? 'is-active' : ''}`}
          >
            <FileEdit size={14} />
            Soạn văn bản toàn đề
          </button>
          <button
            type="button"
            onClick={() => setSubTab('bulk')}
            className={`exu-seg-btn ${subTab === 'bulk' ? 'is-active' : ''}`}
          >
            <ListChecks size={14} />
            Dán bảng đáp án &amp; Thao tác hàng loạt
          </button>
        </div>
        <span className="exu-muted-hint">
          Hình &amp; bảng giữ nguyên qua thẻ <code>[[IMG:...]]</code> · <code>[[TABLE:...]]</code>
        </span>
      </div>

      {subTab === 'document' ? (
        <div className="exu-editor-split">
          <div className="exu-card">
            <div className="exu-card-head">
              <div>
                <strong>Biên tập liên tục từ đầu đến cuối</strong>
                <p className="exu-card-sub">
                  Đánh dấu đáp án đúng bằng <code>*A.</code>, Đúng–Sai bằng <code>[Đ]</code> / <code>[S]</code>, Trả lời ngắn bằng <code>Đáp án: 12,5</code>.
                </p>
              </div>
              <div className="exu-row-actions">
                <button type="button" onClick={syncFromCurrentQuestions} className="exam-tab exu-btn-inline">
                  <RefreshCw size={13} />
                  Nạp lại từ thẻ
                </button>
                <button
                  type="button"
                  disabled={livePreview.length === 0}
                  onClick={handleApplyDocument}
                  className="primary-btn exu-btn-inline"
                >
                  <Check size={14} />
                  Áp dụng ({livePreview.length} câu)
                </button>
              </div>
            </div>
            <textarea
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              rows={24}
              spellCheck={false}
              className="exam-input exu-full-textarea"
              placeholder={'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn\nCâu 1. Nội dung câu hỏi...\n*A. Đáp án đúng\nB. Phương án B\nC. Phương án C\nD. Phương án D'}
            />
          </div>

          <div className="exu-card exu-sticky-panel">
            <div className="exu-card-head">
              <div>
                <strong>Cấu trúc nhận diện trực tiếp</strong>
                <div className="exu-chip-row">
                  <span className="exu-stat-pill">PI: {previewStats.mc}</span>
                  <span className="exu-stat-pill">PII: {previewStats.tf}</span>
                  <span className="exu-stat-pill">PIII: {previewStats.sa}</span>
                  <span className={`exu-stat-pill ${previewStats.warns > 0 ? 'is-warn' : 'is-ok'}`}>
                    {previewStats.warns > 0 ? `${previewStats.warns} cần soát` : 'Đủ đáp án'}
                  </span>
                </div>
              </div>
              <strong className="exu-tabular">{livePreview.length} câu</strong>
            </div>

            <div className="exu-preview-scroll">
              {livePreview.length === 0 ? (
                <p className="exam-message">Mỗi câu hỏi bắt đầu bằng <code>Câu 1.</code>, <code>Câu 2.</code>…</p>
              ) : (
                livePreview.map((q) => {
                  const hasImg = /<img\b/i.test(q.stem) || q.options.some((o) => /<img\b/i.test(o.content));
                  const hasTbl = /<table\b/i.test(q.stem);
                  const plainStem = q.stem.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                  return (
                    <div key={q.id} className="exu-preview-item">
                      <div className="exu-preview-item-top">
                        <div className="exu-row-actions">
                          <span className="exu-q-num exu-tabular">Câu {q.index}</span>
                          <span className="exu-type-tag">{TYPE_SHORT[q.type]}</span>
                          {hasImg && <ImageIcon size={13} />}
                          {hasTbl && <Table2 size={13} />}
                        </div>
                        {q.warnings.length > 0 ? (
                          <span className="exu-warn-inline">
                            <AlertTriangle size={12} /> {q.warnings[0]}
                          </span>
                        ) : (
                          <CheckCircle2 size={14} className="exu-ok-icon" />
                        )}
                      </div>
                      <p className="exu-preview-stem">{plainStem || '(Hình minh họa / bảng)'}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="exu-stack">
          <div className="exu-card">
            <div className="exu-card-head">
              <div className="exu-modal-title-wrap">
                <span className="exu-icon-chip">
                  <ClipboardCheck size={16} />
                </span>
                <div>
                  <strong>Dán bảng đáp án nhanh (khớp theo Phần I / II / III)</strong>
                  <p className="exu-card-sub">
                    Hỗ trợ: <code>1B 2C 3A…</code>, <code>PHẦN II: Câu 1: Đ-S-S-S</code>, <code>PHẦN III: Câu 1: 44</code>.
                  </p>
                </div>
              </div>
              <div className="exu-row-actions">
                <select
                  value={answerKeyScope}
                  onChange={(e) => setAnswerKeyScope(e.target.value as typeof answerKeyScope)}
                  className="exam-input exu-select-compact"
                >
                  <option value="auto">Tự động theo Phần I / II / III</option>
                  <option value="MC">Chỉ Phần I (A–D)</option>
                  <option value="TRUE_FALSE">Chỉ Phần II (Đ/S)</option>
                  <option value="SHORT_ANSWER">Chỉ Phần III (Số)</option>
                </select>
                <button
                  type="button"
                  disabled={bulkAnswerPreview.matchedCount === 0}
                  onClick={handleApplyBulkAnswerKeys}
                  className="primary-btn exu-btn-inline"
                >
                  <Check size={14} />
                  Gán đáp án ({bulkAnswerPreview.matchedCount} câu)
                </button>
              </div>
            </div>
            <textarea
              value={answerKeyText}
              onChange={(e) => setAnswerKeyText(e.target.value)}
              rows={4}
              className="exam-input exu-mono-textarea"
              placeholder={
                'PHẦN I: 1.B 2.C 3.A 4.B 5.D 6.A 7.C 8.A 9.B 10.C 11.D 12.B\nPHẦN II: Câu 1: Đ-S-S-S | Câu 2: S-S-Đ-S | Câu 3: Đ-S-Đ-S | Câu 4: Đ-Đ-S-Đ\nPHẦN III: Câu 1: 44 | Câu 2: 92,3 | Câu 3: 2 | Câu 4: 3 | Câu 5: 0,5 | Câu 6: 4,83'
              }
            />
          </div>

          <div className="exu-card">
            <div className="exu-card-head">
              <div className="exu-row-actions">
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set(questions.map((q) => q.id)))}
                  className="exam-tab"
                >
                  Chọn tất cả ({questions.length})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(new Set(questions.filter((q) => q.warnings.length > 0).map((q) => q.id)))
                  }
                  className="exam-tab"
                >
                  Chọn câu cần soát
                </button>
                {selectedIds.size > 0 && (
                  <button type="button" onClick={() => setSelectedIds(new Set())} className="exam-tab">
                    Bỏ chọn ({selectedIds.size})
                  </button>
                )}
              </div>

              <div className="exu-row-actions">
                <button type="button" onClick={handleRenumberAll} className="exam-tab">
                  Đánh lại số 1..N
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <select
                      value={bulkType}
                      onChange={(e) => setBulkType(e.target.value as QuestionType)}
                      className="exam-input exu-select-compact"
                    >
                      <option value="SINGLE_CHOICE">Phần I · Trắc nghiệm A–D</option>
                      <option value="TRUE_FALSE">Phần II · Đúng / Sai</option>
                      <option value="SHORT_ANSWER">Phần III · Trả lời ngắn</option>
                    </select>
                    <button type="button" onClick={handleBulkChangeType} className="exam-tab">
                      Đổi phần
                    </button>
                    <button type="button" onClick={handleBulkDelete} className="exam-card-delete-btn exu-btn-inline">
                      <Trash2 size={13} />
                      Xóa ({selectedIds.size})
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="exam-table-wrap">
              <table className="exam-table exu-bulk-table">
                <thead>
                  <tr>
                    <th style={{ width: 38 }}></th>
                    <th style={{ width: 78 }}>Câu</th>
                    <th style={{ width: 130 }}>Dạng</th>
                    <th>Nội dung</th>
                    <th style={{ width: 150 }}>Đáp án</th>
                    <th style={{ width: 84 }}>Thứ tự</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, idx) => {
                    const checked = selectedIds.has(q.id);
                    const plainStem = q.stem.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    let ansSummary = '—';
                    if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
                      const right = q.options.filter((o) => o.isCorrect).map((o) => o.label);
                      ansSummary = right.length > 0 ? right.join(', ') : 'Chưa chọn';
                    } else if (q.type === 'TRUE_FALSE') {
                      ansSummary = q.options
                        .map((o) => `${o.label}:${!o.detectionSource ? '?' : o.isCorrect ? 'Đ' : 'S'}`)
                        .join(' ');
                    } else if (q.type === 'SHORT_ANSWER') {
                      ansSummary = q.acceptedAnswers[0] ?? 'Chưa nhập';
                    } else {
                      ansSummary = 'Tự luận';
                    }
                    return (
                      <tr key={q.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(q.id)}
                          />
                        </td>
                        <td className="exu-tabular">
                          <strong>Câu {q.index}</strong>
                        </td>
                        <td>{TYPE_SHORT[q.type]}</td>
                        <td>
                          <div className="exu-preview-stem">{plainStem || '(Ảnh cắt PDF / Hình vẽ)'}</div>
                          {q.warnings.length > 0 && (
                            <small className="exu-warn-inline">
                              <AlertTriangle size={11} /> {q.warnings[0]}
                            </small>
                          )}
                        </td>
                        <td className="exu-tabular">
                          <code>{ansSummary}</code>
                        </td>
                        <td>
                          <div className="exu-row-actions">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveQuestion(idx, -1)}
                              className="exu-icon-btn"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === questions.length - 1}
                              onClick={() => handleMoveQuestion(idx, 1)}
                              className="exu-icon-btn"
                            >
                              <ArrowDown size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
