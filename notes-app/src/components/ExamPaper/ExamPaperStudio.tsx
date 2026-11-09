import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ExamBlock,
  ExamFigureSource,
  ExamInlineFigure,
  ExamPaperDocument,
  ExamStatementTF
} from '../../types/board';
import {
  CHEMISTRY_TEMPLATES,
  createDefaultExamPaper,
  MATH_TEMPLATES,
  MOLECULE_PRESETS,
  parseInlineOptionsLine,
  renderFigureSourceToDataUrl,
  renderRichExamText
} from './examTemplates';
import {
  convertExamPaperToOnlineQuestions,
  exportExamPaperToDocx,
  exportExamPaperToPDF
} from './examExport';
import './exam-paper.css';

type Props = {
  initialPaper?: ExamPaperDocument;
  boardTitle: string;
  onSavePaper: (paper: ExamPaperDocument, closeAfterSave?: boolean) => Promise<void> | void;
  onClose: () => void;
};

export default function ExamPaperStudio({
  initialPaper,
  boardTitle,
  onSavePaper,
  onClose
}: Props) {
  const initialSnapshot = useRef<ExamPaperDocument>(
    structuredClone(initialPaper || createDefaultExamPaper(boardTitle || 'ĐỀ KIỂM TRA ĐỊNH KỲ'))
  );

  const [paper, setPaper] = useState<ExamPaperDocument>(() =>
    structuredClone(initialSnapshot.current)
  );
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingSolutionId, setEditingSolutionId] = useState<string | null>(null);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [selectedFigure, setSelectedFigure] = useState<{ blockId: string; figId: string } | null>(null);
  const [splitBoardOpen, setSplitBoardOpen] = useState(false);
  const [activeSourceId, setActiveSourceId] = useState<string>(() =>
    initialSnapshot.current.figureSources[0]?.id || ''
  );
  const [dropTargetBlockId, setDropTargetBlockId] = useState<string | null>(null);
  const [draggingSourceId, setDraggingSourceId] = useState<string | null>(null);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [formulaModal, setFormulaModal] = useState<'math' | 'chem' | null>(null);
  const [customLatex, setCustomLatex] = useState('\\int_{0}^{1} (3x^2 + 2x)\\,dx');
  const [smartText, setSmartText] = useState('');
  const [smartComposerOpen, setSmartComposerOpen] = useState(false);
  const [saveBadge, setSaveBadge] = useState('✓ Tự động lưu khi gõ');
  const isFirstRenderRef = useRef(true);
  const imageUploadRef = useRef<HTMLInputElement | null>(null);

  // Freehand canvas state when source.kind === 'board'
  const freeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingStrokeRef = useRef<Array<{ x: number; y: number }> | null>(null);
  const [freePointLabel, setFreePointLabel] = useState('A');

  // Auto-save whenever paper changes
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    setSaveBadge('Đang tự lưu…');
    const timer = window.setTimeout(() => {
      Promise.resolve(
        typeof onSavePaper === 'function' ? onSavePaper(paper, false) : undefined
      )
        .then(() => {
          setSaveBadge(
            '✓ Đã tự lưu lúc ' +
              new Date().toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })
          );
        })
        .catch(() => {
          setSaveBadge('⚠ Chưa lưu được bản nháp');
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [paper]);

  const activeSource = useMemo(() => {
    return (
      paper.figureSources.find(s => s.id === activeSourceId) ||
      paper.figureSources[0] ||
      null
    );
  }, [paper.figureSources, activeSourceId]);

  /**
   * Update a figure source on the board AND automatically update all linked figures in the exam!
   */
  const updateFigureSource = (
    sourceId: string,
    updater: (prev: ExamFigureSource) => ExamFigureSource
  ) => {
    setPaper(prev => {
      const nextSources = prev.figureSources.map(s => {
        if (s.id !== sourceId) return s;
        const updated = updater(s);
        const freshSrc = renderFigureSourceToDataUrl(updated);
        return { ...updated, src: freshSrc };
      });
      const changed = nextSources.find(s => s.id === sourceId);
      const nextBlocks = changed
        ? prev.blocks.map(b => {
            if (!('figures' in b) || !b.figures?.length) return b;
            return {
              ...b,
              figures: b.figures.map(f =>
                f.sourceId === sourceId ? { ...f, src: changed.src } : f
              )
            };
          })
        : prev.blocks;
      return {
        ...prev,
        figureSources: nextSources,
        blocks: nextBlocks,
        updatedAt: Date.now()
      };
    });
  };

  /**
   * Create a new figure source on the right-hand drawing board
   */
  const createBoardSource = (kind: ExamFigureSource['kind']) => {
    const newId = `fig-src-${crypto.randomUUID().slice(0, 8)}`;
    let nextSource: ExamFigureSource;
    if (kind === '3d') {
      nextSource = {
        id: newId,
        kind: '3d',
        label: 'Hình không gian 3D',
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
    } else if (kind === 'graph') {
      nextSource = {
        id: newId,
        kind: 'graph',
        label: 'Đồ thị hàm số',
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
    } else if (kind === 'molecule') {
      const preset = MOLECULE_PRESETS.benzene;
      nextSource = {
        id: newId,
        kind: 'molecule',
        label: preset.name,
        src: '',
        aspectRatio: 1.35,
        pointFontSize: 16,
        strokeColor: '#0f172a',
        moleculeConfig: {
          preset: 'benzene',
          atoms: structuredClone(preset.atoms),
          bonds: structuredClone(preset.bonds)
        }
      };
    } else {
      nextSource = {
        id: newId,
        kind: 'board',
        label: 'Hình phẳng tự vẽ',
        src: '',
        aspectRatio: 1.35,
        pointFontSize: 17,
        strokeColor: '#1e293b',
        boardStrokes: [
          {
            id: crypto.randomUUID(),
            points: [
              { x: 250, y: 60 },
              { x: 110, y: 280 },
              { x: 400, y: 280 },
              { x: 250, y: 60 }
            ],
            color: '#1e293b',
            width: 2.5,
            label: 'A',
            lx: 245,
            ly: 46
          },
          {
            id: crypto.randomUUID(),
            points: [
              { x: 250, y: 60 },
              { x: 250, y: 280 }
            ],
            color: '#64748b',
            width: 1.8,
            label: 'H',
            lx: 245,
            ly: 302
          },
          {
            id: crypto.randomUUID(),
            points: [],
            color: '#1e293b',
            width: 2,
            label: 'B',
            lx: 90,
            ly: 292
          },
          {
            id: crypto.randomUUID(),
            points: [],
            color: '#1e293b',
            width: 2,
            label: 'C',
            lx: 412,
            ly: 292
          }
        ]
      };
    }
    nextSource.src = renderFigureSourceToDataUrl(nextSource);
    setPaper(prev => ({
      ...prev,
      figureSources: [...prev.figureSources, nextSource],
      updatedAt: Date.now()
    }));
    setActiveSourceId(newId);
    setSplitBoardOpen(true);
  };

  /**
   * Insert a figure from the right-hand board into a specific block on the A4 sheet (centered by default)
   */
  const insertFigureIntoBlock = (sourceId: string, targetBlockId?: string) => {
    const srcObj =
      paper.figureSources.find(s => s.id === sourceId) || activeSource;
    if (!srcObj) return;

    const newFig: ExamInlineFigure = {
      id: crypto.randomUUID(),
      sourceId: srcObj.id,
      src: srcObj.src,
      width: 260,
      align: 'center'
    };

    setPaper(prev => {
      const targetId =
        targetBlockId ||
        focusedBlockId ||
        [...prev.blocks].reverse().find(b => b.type === 'question')?.id ||
        prev.blocks[prev.blocks.length - 1]?.id;

      const nextBlocks = prev.blocks.map(b => {
        if (b.id !== targetId || (b.type !== 'question' && b.type !== 'paragraph')) return b;
        return {
          ...b,
          figures: [...(b.figures || []), newFig]
        };
      });
      return { ...prev, blocks: nextBlocks, updatedAt: Date.now() };
    });
    setDropTargetBlockId(null);
    setDraggingSourceId(null);
  };

  /**
   * Revert exam text/blocks to initial snapshot while keeping any figures drawn on the board!
   */
  const handleRevertChanges = () => {
    setPaper(current => ({
      ...structuredClone(initialSnapshot.current),
      figureSources: current.figureSources,
      updatedAt: Date.now()
    }));
    setSaveBadge('↩ Đã khôi phục đề như lúc mới mở (giữ nguyên hình trên bảng)');
  };

  /**
   * Add a new question or section block
   */
  const addBlock = (kind: 'section' | 'mcq' | 'tf' | 'short') => {
    let newBlock: ExamBlock;
    if (kind === 'section') {
      const count = paper.blocks.filter(b => b.type === 'section').length + 1;
      const roman = ['I', 'II', 'III', 'IV', 'V'][count - 1] || String(count);
      newBlock = {
        id: crypto.randomUUID(),
        type: 'section',
        title: `PHẦN ${roman}. Câu hỏi phần ${roman}`,
        subtitle: 'Thí sinh trả lời các câu hỏi bên dưới.'
      };
    } else if (kind === 'mcq') {
      newBlock = {
        id: crypto.randomUUID(),
        type: 'question',
        questionType: 'mcq',
        prompt: 'Nhập nội dung câu hỏi trắc nghiệm (có thể gõ A. ... B. ... C. ... D. ... liền 1 dòng để tự chia cột):',
        options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
        optionCols: 4,
        correctChoice: 'A'
      };
    } else if (kind === 'tf') {
      newBlock = {
        id: crypto.randomUUID(),
        type: 'question',
        questionType: 'tf',
        prompt: 'Cho mệnh đề hoặc dữ kiện sau. Xét tính đúng sai của các khẳng định:',
        statements: [
          { id: crypto.randomUUID(), label: 'a', text: 'Khẳng định a', correct: true },
          { id: crypto.randomUUID(), label: 'b', text: 'Khẳng định b', correct: false },
          { id: crypto.randomUUID(), label: 'c', text: 'Khẳng định c', correct: true },
          { id: crypto.randomUUID(), label: 'd', text: 'Khẳng định d', correct: false }
        ]
      };
    } else {
      newBlock = {
        id: crypto.randomUUID(),
        type: 'question',
        questionType: 'short',
        points: '1 điểm',
        prompt: 'Nhập nội dung câu hỏi trả lời ngắn hoặc tự luận:',
        shortAnswer: '',
        solution: ''
      };
    }

    setPaper(prev => {
      const idx = focusedBlockId
        ? prev.blocks.findIndex(b => b.id === focusedBlockId)
        : -1;
      const nextBlocks = [...prev.blocks];
      if (idx >= 0) nextBlocks.splice(idx + 1, 0, newBlock);
      else nextBlocks.push(newBlock);
      return { ...prev, blocks: nextBlocks, updatedAt: Date.now() };
    });
    setFocusedBlockId(newBlock.id);
    if (newBlock.type === 'question') setEditingPromptId(newBlock.id);
  };

  /**
   * Parse freeform Word-like text pasted/typed into the Smart Composer
   * Supports:
   * - PHẦN I..., PHẦN II...
   * - Câu 1. / Câu 1: / Câu 3 (1 điểm).
   * - A. ... B. ... C. ... D. ... on 1 line
   * - a) ... b) ... c) ... d) ...
   * - Đáp án: ...
   * - Lời giải: ...
   */
  const parseSmartTextToBlocks = () => {
    const lines = smartText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    if (!lines.length) return;

    const parsedBlocks: ExamBlock[] = [];
    let currentQ: Extract<ExamBlock, { type: 'question' }> | null = null;
    let inTfSection = false;

    const flushQuestion = () => {
      if (currentQ) {
        parsedBlocks.push(currentQ);
        currentQ = null;
      }
    };

    for (const line of lines) {
      if (/^PHẦN\s+[IVX0-9]+/i.test(line)) {
        flushQuestion();
        inTfSection = /đúng\s*sai/i.test(line);
        parsedBlocks.push({
          id: crypto.randomUUID(),
          type: 'section',
          title: line
        });
        continue;
      }

      const qMatch = line.match(/^Câu\s*\d+\s*(?:\(([^)]+)\))?\s*[.:]\s*(.*)$/i);
      if (qMatch) {
        flushQuestion();
        const points = qMatch[1]?.trim();
        const restPrompt = qMatch[2]?.trim() || 'Nội dung câu hỏi';
        currentQ = {
          id: crypto.randomUUID(),
          type: 'question',
          questionType: inTfSection ? 'tf' : points ? 'short' : 'mcq',
          ...(points ? { points } : {}),
          prompt: restPrompt,
          ...(inTfSection
            ? { statements: [] }
            : points
            ? { shortAnswer: '', solution: '' }
            : { options: ['A', 'B', 'C', 'D'], optionCols: 4, correctChoice: 'A' })
        };
        continue;
      }

      const inlineOpts = parseInlineOptionsLine(line);
      if (inlineOpts) {
        if (!currentQ) {
          currentQ = {
            id: crypto.randomUUID(),
            type: 'question',
            questionType: 'mcq',
            prompt: 'Câu hỏi trắc nghiệm:',
            options: inlineOpts,
            optionCols: 4,
            correctChoice: 'A'
          };
        } else {
          currentQ.questionType = 'mcq';
          currentQ.options = inlineOpts;
          currentQ.optionCols = currentQ.optionCols || 4;
        }
        continue;
      }

      const tfMatch = line.match(/^([abcd])[.)]\s*(.+)$/i);
      if (tfMatch && currentQ) {
        currentQ.questionType = 'tf';
        const label = tfMatch[1].toLowerCase() as 'a' | 'b' | 'c' | 'd';
        const statements = currentQ.statements || [];
        statements.push({
          id: crypto.randomUUID(),
          label,
          text: tfMatch[2].trim(),
          correct: true
        });
        currentQ.statements = statements;
        continue;
      }

      const ansMatch = line.match(/^Đáp\s*án\s*[.:]\s*(.+)$/i);
      if (ansMatch && currentQ) {
        const val = ansMatch[1].trim();
        if (/^[ABCD]$/i.test(val) && currentQ.questionType === 'mcq') {
          currentQ.correctChoice = val.toUpperCase() as 'A' | 'B' | 'C' | 'D';
        } else {
          if (currentQ.questionType !== 'mcq' && currentQ.questionType !== 'tf') {
            currentQ.questionType = 'short';
          }
          currentQ.shortAnswer = val;
        }
        continue;
      }

      const solMatch = line.match(/^Lời\s*giải\s*[.:]\s*(.+)$/i);
      if (solMatch && currentQ) {
        currentQ.solution = solMatch[1].trim();
        continue;
      }

      if (currentQ) {
        currentQ.prompt += '\n' + line;
      } else {
        parsedBlocks.push({
          id: crypto.randomUUID(),
          type: 'paragraph',
          text: line
        });
      }
    }
    flushQuestion();

    if (parsedBlocks.length) {
      setPaper(prev => ({
        ...prev,
        blocks: [...prev.blocks, ...parsedBlocks],
        updatedAt: Date.now()
      }));
      setSmartText('');
      setSmartComposerOpen(false);
    }
  };

  /**
   * Insert LaTeX formula into the currently focused question or open prompt
   */
  const insertFormulaIntoFocused = (latex: string) => {
    const wrapped = `$${latex}$`;
    setPaper(prev => {
      const targetId =
        editingPromptId ||
        focusedBlockId ||
        [...prev.blocks].reverse().find(b => b.type === 'question')?.id;
      if (!targetId) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map(b => {
          if (b.id !== targetId) return b;
          if (b.type === 'question') {
            return { ...b, prompt: `${b.prompt} ${wrapped}`.trim() };
          }
          if (b.type === 'paragraph') {
            return { ...b, text: `${b.text} ${wrapped}`.trim() };
          }
          return b;
        }),
        updatedAt: Date.now()
      };
    });
    setFormulaModal(null);
  };

  /**
   * Resize a figure inside the A4 exam by dragging its corner handle
   */
  const startFigureResize = (
    e: React.PointerEvent,
    blockId: string,
    figId: string,
    initialWidth: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const nextWidth = Math.max(110, Math.min(580, Math.round(initialWidth + dx)));
      setPaper(prev => ({
        ...prev,
        blocks: prev.blocks.map(b => {
          if (b.id !== blockId || !('figures' in b) || !b.figures) return b;
          return {
            ...b,
            figures: b.figures.map(f =>
              f.id === figId ? { ...f, width: nextWidth } : f
            )
          };
        })
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /**
   * Push parsed questions to /exam Room Creator via localStorage + postMessage / navigation
   */
  const pushToOnlineExamRoom = () => {
    const questions = convertExamPaperToOnlineQuestions(paper);
    if (!questions.length) {
      alert('Đề chưa có câu hỏi nào để tạo phòng thi.');
      return;
    }
    try {
      localStorage.setItem(
        'htvvm_pending_exam_paper',
        JSON.stringify({
          title: paper.header.examTitle,
          questions,
          exportedAt: Date.now()
        })
      );
    } catch {
      /* ignore storage errors */
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'HTVVM_EXAM_PAPER_EXPORT',
          title: paper.header.examTitle,
          questions
        },
        '*'
      );
      setSaveBadge(`🚀 Đã chuyển ${questions.length} câu hỏi sang Phòng thi!`);
    } else {
      window.open('/exam', '_blank');
    }
    setDownloadMenuOpen(false);
  };

  /**
   * Upload an image directly from disk into the currently focused question
   */
  const handleUploadLocalImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl.startsWith('data:image/')) return;
      const newFig: ExamInlineFigure = {
        id: crypto.randomUUID(),
        sourceId: 'uploaded-image',
        src: dataUrl,
        width: 260,
        align: 'center'
      };
      setPaper(prev => {
        const targetId =
          focusedBlockId ||
          [...prev.blocks].reverse().find(b => b.type === 'question')?.id ||
          prev.blocks.find(b => b.type === 'question')?.id;
        if (!targetId) return prev;
        return {
          ...prev,
          blocks: prev.blocks.map(b =>
            b.id === targetId && (b.type === 'question' || b.type === 'paragraph')
              ? { ...b, figures: [...(b.figures || []), newFig] }
              : b
          ),
          updatedAt: Date.now()
        };
      });
    };
    reader.readAsDataURL(file);
  };

  /**
   * Explicitly add a new A4 page (Trang 2, Trang 3, ...) and jump to it
   */
  const addNewPage = () => {
    const breakBlock: ExamBlock = { id: crypto.randomUUID(), type: 'page-break' };
    const starterQuestion: ExamBlock = {
      id: crypto.randomUUID(),
      type: 'question',
      questionType: 'mcq',
      prompt: 'Nhập nội dung câu hỏi trên trang mới:',
      options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
      optionCols: 4,
      correctChoice: 'A'
    };
    setPaper(prev => ({
      ...prev,
      blocks: [...prev.blocks, breakBlock, starterQuestion],
      updatedAt: Date.now()
    }));
    setFocusedBlockId(starterQuestion.id);
    setEditingPromptId(starterQuestion.id);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const allSheets = document.querySelectorAll('.exam-a4-sheet');
        const lastSheet = allSheets[allSheets.length - 1];
        lastSheet?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  const togglePageBreakBefore = (blockId: string) => {
    setPaper(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId && b.type !== 'page-break'
          ? { ...b, pageBreakBefore: !b.pageBreakBefore }
          : b
      ),
      updatedAt: Date.now()
    }));
  };

  const removeManualPageBreak = (breakId?: string, breakBeforeBlockId?: string) => {
    setPaper(prev => ({
      ...prev,
      blocks: prev.blocks
        .filter(b => !(breakId && b.id === breakId && b.type === 'page-break'))
        .map(b =>
          breakBeforeBlockId && b.id === breakBeforeBlockId && b.type !== 'page-break'
            ? { ...b, pageBreakBefore: false }
            : b
        ),
      updatedAt: Date.now()
    }));
  };

  // Precompute automatic question numbering across sections
  const questionNumbers = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const b of paper.blocks) {
      if (b.type === 'section') {
        n = 0; // Reset per PHẦN I, PHẦN II, PHẦN III like Vietnamese national exams
      } else if (b.type === 'question') {
        n++;
        map.set(b.id, n);
      }
    }
    return map;
  }, [paper.blocks]);

  // Multi-page A4 Pagination (automatic overflow + manual page breaks, like Microsoft Word)
  const pages = useMemo(() => {
    type RenderableBlock = Exclude<ExamBlock, { type: 'page-break' }>;
    type PageBucket = {
      pageNumber: number;
      blocks: RenderableBlock[];
      manualBreakId?: string;
      breakBeforeBlockId?: string;
    };

    const fontPt = paper.fontSizePt || 12;
    const linePx = Math.round(fontPt * 1.333 * 1.55);
    const charsPerLine = Math.max(42, Math.round(620 / (fontPt * 0.65)));

    const estimateHeight = (block: RenderableBlock): number => {
      if (block.type === 'section') {
        return 54 + (block.subtitle ? 26 : 0);
      }
      if (block.type === 'paragraph') {
        const lines = Math.max(1, Math.ceil((block.text?.length || 1) / charsPerLine));
        const figsH = (block.figures || []).reduce(
          (sum, f) => sum + Math.round((f.width || 250) * 0.76) + 18,
          0
        );
        return lines * linePx + figsH + 16;
      }
      const promptLines = (block.prompt || '')
        .split(/\r?\n/)
        .reduce((sum, ln) => sum + Math.max(1, Math.ceil((ln.length + 10) / charsPerLine)), 0);
      const figsH = (block.figures || []).reduce(
        (sum, f) => sum + Math.round((f.width || 250) * 0.76) + 20,
        0
      );
      let optsH = 0;
      if (block.questionType === 'mcq' && block.options) {
        const cols = block.optionCols || 4;
        const maxOptLen = Math.max(...block.options.map(o => o.length), 1);
        if (cols === 4) optsH = (maxOptLen > 18 ? 2 : 1) * linePx + 14;
        else if (cols === 2) optsH = 2 * linePx + 18;
        else optsH = 4 * linePx + 24;
      } else if (block.questionType === 'tf' && block.statements) {
        optsH = block.statements.length * (linePx + 8) + 12;
      } else if (block.questionType === 'short') {
        optsH = 36;
      }
      const solH =
        block.solution !== undefined
          ? Math.max(1, Math.ceil((block.solution.length + 12) / charsPerLine)) * linePx + 22
          : 0;
      return promptLines * linePx + figsH + optsH + solH + 24;
    };

    const result: PageBucket[] = [];
    let current: PageBucket = { pageNumber: 1, blocks: [] };
    let usedH = 0;

    for (const block of paper.blocks) {
      if (block.type === 'page-break') {
        result.push(current);
        current = {
          pageNumber: result.length + 1,
          blocks: [],
          manualBreakId: block.id
        };
        usedH = 0;
        continue;
      }

      const h = estimateHeight(block);
      const isFirstPage = result.length === 0;
      const budget = isFirstPage ? (paper.header.showStudentInfo ? 720 : 755) : 900;

      if (block.pageBreakBefore && (current.blocks.length > 0 || result.length > 0)) {
        result.push(current);
        current = {
          pageNumber: result.length + 1,
          blocks: [],
          breakBeforeBlockId: block.id
        };
        usedH = 0;
      } else if (current.blocks.length > 0 && usedH + h > budget) {
        result.push(current);
        current = {
          pageNumber: result.length + 1,
          blocks: []
        };
        usedH = 0;
      }

      current.blocks.push(block);
      usedH += h;
    }

    result.push(current);
    return result;
  }, [paper.blocks, paper.fontSizePt, paper.header.showStudentInfo]);

  return (
    <div className="exam-studio-shell">
      {/* TOP WORD-LIKE RIBBON */}
      <header className="exam-ribbon">
        <div className="exam-ribbon-group">
          <button
            className="exam-btn primary"
            onClick={() => {
              if (typeof onSavePaper === 'function') {
                void onSavePaper(paper, true);
              } else {
                onClose();
              }
            }}
            title="Lưu đề thi và quay về danh sách đề"
          >
            💾 Lưu & Về danh sách đề
          </button>
          <button
            className="exam-btn"
            onClick={handleRevertChanges}
            title="Bỏ các thay đổi vừa gõ trên trang đề (hình minh hoạ vẫn giữ)"
          >
            ↩ Bỏ thay đổi
          </button>
          <span className="exam-ribbon-sep" />
          <select
            className="exam-select"
            value={paper.fontFamily}
            aria-label="Phông chữ"
            onChange={e =>
              setPaper(p => ({ ...p, fontFamily: e.target.value }))
            }
          >
            <option value='"Times New Roman", Times, Georgia, serif'>
              Times New Roman
            </option>
            <option value='"Be Vietnam Pro", Inter, sans-serif'>
              Be Vietnam Pro
            </option>
            <option value='Cambria, Georgia, serif'>Cambria</option>
            <option value='Arial, Helvetica, sans-serif'>Arial</option>
          </select>
          <select
            className="exam-select"
            value={paper.fontSizePt}
            aria-label="Cỡ chữ"
            onChange={e =>
              setPaper(p => ({ ...p, fontSizePt: Number(e.target.value) }))
            }
          >
            {[11, 12, 13, 14, 16].map(sz => (
              <option key={sz} value={sz}>
                {sz} pt
              </option>
            ))}
          </select>
          <span className="exam-ribbon-sep" />
          <button
            className="exam-icon-btn"
            title="In đậm (**chữ**)"
            onClick={() => {
              if (!focusedBlockId) return;
              setPaper(prev => ({
                ...prev,
                blocks: prev.blocks.map(b =>
                  b.id === focusedBlockId && b.type === 'paragraph'
                    ? { ...b, bold: !b.bold }
                    : b
                )
              }));
            }}
          >
            <b>B</b>
          </button>
          <button
            className="exam-icon-btn"
            title="In nghiêng (*chữ*)"
            onClick={() => {
              if (!focusedBlockId) return;
              setPaper(prev => ({
                ...prev,
                blocks: prev.blocks.map(b =>
                  b.id === focusedBlockId && b.type === 'paragraph'
                    ? { ...b, italic: !b.italic }
                    : b
                )
              }));
            }}
          >
            <i>I</i>
          </button>
          {(['left', 'center', 'right', 'justify'] as const).map(al => (
            <button
              key={al}
              className="exam-icon-btn"
              title={`Căn lề: ${al}`}
              onClick={() => {
                if (!focusedBlockId) return;
                setPaper(prev => ({
                  ...prev,
                  blocks: prev.blocks.map(b =>
                    b.id === focusedBlockId &&
                    (b.type === 'question' || b.type === 'paragraph')
                      ? { ...b, align: al }
                      : b
                  )
                }));
              }}
            >
              {al === 'left'
                ? '⇤'
                : al === 'center'
                ? '↔'
                : al === 'right'
                ? '⇥'
                : '≡'}
            </button>
          ))}
          <span className="exam-ribbon-sep" />
          <button
            className="exam-btn"
            onClick={() => setFormulaModal('math')}
            title="Chèn công thức Toán học (phân số, căn, hệ PT, tích phân, giới hạn, vectơ...)"
          >
            <b>ƒ</b> Công thức
          </button>
          <button
            className="exam-btn"
            onClick={() => setFormulaModal('chem')}
            title="Chèn phương trình Hóa học & vẽ công thức cấu tạo phân tử"
          >
            ⚗ Phân tử & Hóa
          </button>
        </div>

        <div className="exam-ribbon-group">
          <input
            ref={imageUploadRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleUploadLocalImage}
          />
          <button
            className="exam-btn"
            onClick={() => imageUploadRef.current?.click()}
            title="Chèn ảnh từ máy tính vào câu đang chọn"
          >
            📂 Chèn ảnh
          </button>
          <button
            className={`exam-btn ${splitBoardOpen ? 'active' : 'purple'}`}
            onClick={() => setSplitBoardOpen(v => !v)}
            title="Mở khung công cụ dựng hình minh hoạ (3D, đồ thị, phân tử) để kéo vào đề"
          >
            📐 Dựng hình minh hoạ {splitBoardOpen ? '· Đang mở' : ''}
          </button>

          <div className="exam-download-wrap">
            <button
              className="exam-btn primary"
              onClick={() => setDownloadMenuOpen(v => !v)}
            >
              ⬇ Tải về ▸
            </button>
            {downloadMenuOpen && (
              <div className="exam-download-menu" role="menu">
                <button
                  className="exam-download-item"
                  onClick={() => {
                    exportExamPaperToDocx(paper, 'student');
                    setDownloadMenuOpen(false);
                  }}
                >
                  <strong>📄 File Word (.docx) — Bản Học sinh</strong>
                  <small>
                    Mở bằng Microsoft Word, công thức chuẩn Word sửa tiếp được, đã ẩn đáp án & lời giải
                  </small>
                </button>
                <button
                  className="exam-download-item"
                  onClick={() => {
                    exportExamPaperToDocx(paper, 'teacher');
                    setDownloadMenuOpen(false);
                  }}
                >
                  <strong>📄 File Word (.docx) — Bản Giáo viên</strong>
                  <small>
                    Có gạch chân đáp án đúng, nhãn Đ/S và lời giải chi tiết
                  </small>
                </button>
                <button
                  className="exam-download-item"
                  onClick={() => {
                    exportExamPaperToPDF(paper, 'student');
                    setDownloadMenuOpen(false);
                  }}
                >
                  <strong>🖨 PDF (In / Lưu PDF) — Bản phát cho Học sinh</strong>
                  <small>
                    Tự động bỏ đáp án, bỏ Đ/S, ẩn lời giải và chừa trống ô trả lời ngắn
                  </small>
                </button>
                <button
                  className="exam-download-item"
                  onClick={() => {
                    exportExamPaperToPDF(paper, 'teacher');
                    setDownloadMenuOpen(false);
                  }}
                >
                  <strong>🖨 PDF (In / Lưu PDF) — Bản Giáo viên</strong>
                  <small>Đầy đủ đáp án A/B/C/D, Đ/S và lời giải</small>
                </button>
                <button
                  className="exam-download-item"
                  onClick={pushToOnlineExamRoom}
                >
                  <strong>🚀 Chuyển sang Phòng thi trực tuyến</strong>
                  <small>
                    Trích xuất tự động các câu hỏi và đáp án sang Phòng thi HTVVM
                  </small>
                </button>
              </div>
            )}
          </div>

          <button className="exam-btn" onClick={onClose} title="Đóng trình soạn đề">
            ✕
          </button>
        </div>
      </header>

      {/* SUB-BAR: QUICK INSERT, MULTI-PAGE CONTROLS & SMART TYPING */}
      <div className="exam-subbar">
        <div className="exam-subbar-left">
          <button className="exam-chip-btn" onClick={() => addBlock('section')}>
            + Chia PHẦN (I, II, III)
          </button>
          <button className="exam-chip-btn" onClick={() => addBlock('mcq')}>
            + Câu trắc nghiệm (A–D)
          </button>
          <button className="exam-chip-btn" onClick={() => addBlock('tf')}>
            + Câu Đúng / Sai (a–d)
          </button>
          <button className="exam-chip-btn" onClick={() => addBlock('short')}>
            + Câu Trả lời ngắn / Tự luận
          </button>
          <button
            className="exam-chip-btn"
            style={{ borderColor: '#0d9488', color: '#0f766e', background: '#f0fdfa' }}
            onClick={addNewPage}
            title="Tạo ngay trang A4 tiếp theo (Trang 2, Trang 3…)"
          >
            📄 + Thêm trang mới
          </button>
          <button
            className="exam-chip-btn"
            style={{
              borderColor: smartComposerOpen ? '#7c3aed' : undefined,
              color: smartComposerOpen ? '#6d28d9' : undefined
            }}
            onClick={() => setSmartComposerOpen(v => !v)}
          >
            ⌨ Gõ / Dán nhanh nhiều câu như Word
          </button>
        </div>
        <div className="exam-subbar-right">
          <div className="exam-page-jump-bar" title="Chuyển nhanh giữa các trang A4">
            <span>{pages.length} trang:</span>
            {pages.map(pg => (
              <button
                key={pg.pageNumber}
                type="button"
                className="exam-page-pill"
                onClick={() =>
                  document
                    .getElementById(`exam-a4-page-${pg.pageNumber}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {pg.pageNumber}
              </button>
            ))}
          </div>
          <span className="exam-autosave-pill">{saveBadge}</span>
        </div>
      </div>

      {/* MAIN WORKSPACE: SINGLE OR SPLIT SCREEN */}
      <div className={`exam-workspace ${splitBoardOpen ? 'is-split' : ''}`}>
        {/* LEFT PANE: MULTI-PAGE A4 EXAM SHEETS */}
        <div
          className="exam-paper-viewport"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setSelectedFigure(null);
              setEditingPromptId(null);
              setEditingSolutionId(null);
            }
          }}
        >
          {pages.map((pg, pageIdx) => (
          <article
            key={pg.pageNumber}
            id={`exam-a4-page-${pg.pageNumber}`}
            className="exam-a4-sheet"
            style={{
              fontFamily: paper.fontFamily,
              fontSize: `${paper.fontSizePt}pt`
            }}
          >
            {pageIdx > 0 && (
              <div className="exam-a4-page-top">
                <span>
                  {paper.header.examTitle} · <strong>Trang {pg.pageNumber}/{pages.length}</strong>
                </span>
                {(pg.manualBreakId || pg.breakBeforeBlockId) && (
                  <button
                    type="button"
                    className="exam-page-break-chip"
                    onClick={() => removeManualPageBreak(pg.manualBreakId, pg.breakBeforeBlockId)}
                    title="Xoá ngắt trang thủ công để gộp lại với trang phía trên"
                  >
                    ✂ Ngắt trang thủ công · Bấm để gộp trang
                  </button>
                )}
              </div>
            )}

            {pageIdx === 0 && (
              <>
                {/* A4 EXAM HEADER (PAGE 1) */}
                <header className="exam-a4-header">
                  <div className="exam-a4-header-col">
                    <input
                      className="exam-inline-input"
                      value={paper.header.department}
                      onChange={e =>
                        setPaper(p => ({
                          ...p,
                          header: { ...p.header, department: e.target.value }
                        }))
                      }
                    />
                    <input
                      className="exam-inline-input"
                      style={{ fontWeight: 700, textDecoration: 'underline' }}
                      value={paper.header.school}
                      onChange={e =>
                        setPaper(p => ({
                          ...p,
                          header: { ...p.header, school: e.target.value }
                        }))
                      }
                    />
                    <div className="exam-code-badge">
                      <span>Mã đề:</span>
                      <input
                        className="exam-inline-input"
                        style={{ width: 52, fontWeight: 700 }}
                        value={paper.header.examCode}
                        onChange={e =>
                          setPaper(p => ({
                            ...p,
                            header: { ...p.header, examCode: e.target.value }
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="exam-a4-header-col">
                    <input
                      className="exam-inline-input"
                      style={{ fontWeight: 700, fontSize: '1.08em' }}
                      value={paper.header.examTitle}
                      onChange={e =>
                        setPaper(p => ({
                          ...p,
                          header: { ...p.header, examTitle: e.target.value }
                        }))
                      }
                    />
                    <input
                      className="exam-inline-input"
                      style={{ fontWeight: 700 }}
                      value={paper.header.subject}
                      onChange={e =>
                        setPaper(p => ({
                          ...p,
                          header: { ...p.header, subject: e.target.value }
                        }))
                      }
                    />
                    <input
                      className="exam-inline-input"
                      style={{ fontStyle: 'italic', fontSize: '0.95em' }}
                      value={paper.header.duration}
                      onChange={e =>
                        setPaper(p => ({
                          ...p,
                          header: { ...p.header, duration: e.target.value }
                        }))
                      }
                    />
                  </div>
                </header>

                {paper.header.showStudentInfo && (
                  <div className="exam-student-line">
                    <span>
                      Họ và tên thí sinh:
                      ........................................................................
                    </span>
                    <span>Số báo danh: ..........................</span>
                  </div>
                )}

                {/* OPTIONAL SMART COMPOSER BOX */}
                {smartComposerOpen && (
                  <div className="exam-smart-composer">
                    <div className="exam-smart-composer-top">
                      <strong>
                        Gõ hoặc dán đề tự nhiên (tự nhận diện PHẦN I, Câu 1., A. ... B. ... C. ... D. ..., a) b) c) d), Đáp án:, Lời giải:)
                      </strong>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="exam-chip-btn"
                          onClick={parseSmartTextToBlocks}
                        >
                          ✓ Đưa vào trang A4
                        </button>
                        <button
                          className="exam-chip-btn"
                          onClick={() => setSmartComposerOpen(false)}
                        >
                          Đóng
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="exam-smart-textarea"
                      value={smartText}
                      onChange={e => setSmartText(e.target.value)}
                      placeholder={
                        'Ví dụ:\nCâu 1. Cho hàm số $y = x^3 - 3x$. Giá trị cực đại bằng:\nA. 2   B. -2   C. 1   D. 0\nĐáp án: A\nLời giải: Đạo hàm y\' = 3x^2 - 3 = 0...'
                      }
                    />
                  </div>
                )}
              </>
            )}

            {/* BLOCKS ON THIS A4 PAGE */}
            {pg.blocks.map((block, bIdx) => {
              const isFocused = focusedBlockId === block.id;
              const isDropTarget = dropTargetBlockId === block.id;

              if (block.type === 'section') {
                return (
                  <section
                    key={block.id}
                    className={`exam-block ${isFocused ? 'is-focused' : ''}`}
                    onClick={() => setFocusedBlockId(block.id)}
                  >
                    <div className="exam-block-controls">
                      <button
                        className={`exam-mini-action ${block.pageBreakBefore ? 'active' : ''}`}
                        title="Đẩy phần này sang đầu trang A4 tiếp theo"
                        onClick={() => togglePageBreakBefore(block.id)}
                      >
                        ↵ Sang trang
                      </button>
                      <button
                        className="exam-mini-action danger"
                        onClick={() =>
                          setPaper(p => ({
                            ...p,
                            blocks: p.blocks.filter(x => x.id !== block.id)
                          }))
                        }
                      >
                        🗑 Xoá phần
                      </button>
                    </div>
                    {editingFieldKey === `sec-title:${block.id}` ? (
                      <textarea
                        autoFocus
                        rows={1}
                        className="exam-q-textarea"
                        style={{ fontWeight: 700, textTransform: 'uppercase' }}
                        value={block.title}
                        onChange={e => {
                          const val = e.target.value;
                          setPaper(p => ({
                            ...p,
                            blocks: p.blocks.map(x =>
                              x.id === block.id && x.type === 'section'
                                ? { ...x, title: val }
                                : x
                            )
                          }));
                        }}
                        onBlur={() => setEditingFieldKey(null)}
                      />
                    ) : (
                      <div
                        className="exam-inline-rendered"
                        style={{ fontWeight: 700, textTransform: 'uppercase' }}
                        onClick={() => setEditingFieldKey(`sec-title:${block.id}`)}
                        dangerouslySetInnerHTML={{
                          __html: renderRichExamText(block.title || 'PHẦN MỚI')
                        }}
                      />
                    )}
                    {editingFieldKey === `sec-sub:${block.id}` ? (
                      <textarea
                        autoFocus
                        rows={1}
                        className="exam-q-textarea"
                        style={{ fontStyle: 'italic', fontSize: '0.94em' }}
                        value={block.subtitle || ''}
                        placeholder="Ghi chú hướng dẫn phần (tùy chọn)…"
                        onChange={e => {
                          const val = e.target.value;
                          setPaper(p => ({
                            ...p,
                            blocks: p.blocks.map(x =>
                              x.id === block.id && x.type === 'section'
                                ? { ...x, subtitle: val }
                                : x
                            )
                          }));
                        }}
                        onBlur={() => setEditingFieldKey(null)}
                      />
                    ) : (
                      <div
                        className="exam-inline-rendered"
                        style={{ fontStyle: 'italic', fontSize: '0.94em', color: '#334155' }}
                        onClick={() => setEditingFieldKey(`sec-sub:${block.id}`)}
                        dangerouslySetInnerHTML={{
                          __html: renderRichExamText(
                            block.subtitle || 'Nhấp để thêm hướng dẫn phần…'
                          )
                        }}
                      />
                    )}
                  </section>
                );
              }

              if (block.type === 'paragraph') {
                return (
                  <div
                    key={block.id}
                    className={`exam-block ${isFocused ? 'is-focused' : ''}`}
                    style={{ textAlign: block.align || 'left' }}
                    onClick={() => setFocusedBlockId(block.id)}
                  >
                    <div className="exam-block-controls">
                      <button
                        className="exam-mini-action danger"
                        onClick={() =>
                          setPaper(p => ({
                            ...p,
                            blocks: p.blocks.filter(x => x.id !== block.id)
                          }))
                        }
                      >
                        🗑 Xoá dòng
                      </button>
                    </div>
                    <input
                      className="exam-inline-input"
                      style={{
                        fontWeight: block.bold ? 700 : 400,
                        fontStyle: block.italic ? 'italic' : 'normal'
                      }}
                      value={block.text}
                      onChange={e => {
                        const val = e.target.value;
                        setPaper(p => ({
                          ...p,
                          blocks: p.blocks.map(x =>
                            x.id === block.id && x.type === 'paragraph'
                              ? { ...x, text: val }
                              : x
                          )
                        }));
                      }}
                    />
                  </div>
                );
              }

              // QUESTION BLOCK
              const qNum = questionNumbers.get(block.id) || bIdx + 1;
              const isEditingPrompt = editingPromptId === block.id;

              return (
                <article
                  key={block.id}
                  className={`exam-block ${isFocused ? 'is-focused' : ''} ${
                    isDropTarget ? 'is-drop-target' : ''
                  }`}
                  style={{ textAlign: block.align || 'left' }}
                  onClick={() => setFocusedBlockId(block.id)}
                  onDragOver={e => {
                    e.preventDefault();
                    if (dropTargetBlockId !== block.id) {
                      setDropTargetBlockId(block.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (dropTargetBlockId === block.id) {
                      setDropTargetBlockId(null);
                    }
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    const srcId =
                      e.dataTransfer.getData('text/htvvm-figure-source') ||
                      draggingSourceId ||
                      activeSource?.id;
                    if (srcId) insertFigureIntoBlock(srcId, block.id);
                  }}
                >
                  {/* Floating Controls for Question */}
                  <div className="exam-block-controls">
                    <button
                      className="exam-mini-action"
                      onClick={() =>
                        setEditingPromptId(isEditingPrompt ? null : block.id)
                      }
                    >
                      {isEditingPrompt ? '✓ Xong' : '✎ Sửa đề'}
                    </button>
                    <button
                      className="exam-mini-action"
                      onClick={() => {
                        setFocusedBlockId(block.id);
                        setSplitBoardOpen(true);
                      }}
                    >
                      📐 Dựng hình
                    </button>
                    <button
                      className="exam-mini-action"
                      onClick={() => {
                        setPaper(p => ({
                          ...p,
                          blocks: p.blocks.map(x =>
                            x.id === block.id && x.type === 'question'
                              ? { ...x, solution: x.solution ?? 'Ta có: ' }
                              : x
                          )
                        }));
                        setEditingSolutionId(block.id);
                      }}
                    >
                      + Lời giải
                    </button>
                    <button
                      className={`exam-mini-action ${block.pageBreakBefore ? 'active' : ''}`}
                      title="Đẩy câu này sang đầu trang A4 tiếp theo"
                      onClick={() => togglePageBreakBefore(block.id)}
                    >
                      ↵ Sang trang
                    </button>
                    <button
                      className="exam-mini-action danger"
                      title="Xoá câu này (các câu sau sẽ tự đánh số lại)"
                      onClick={() =>
                        setPaper(p => ({
                          ...p,
                          blocks: p.blocks.filter(x => x.id !== block.id)
                        }))
                      }
                    >
                      🗑 Xoá câu
                    </button>
                  </div>

                  {/* Question Prompt Row */}
                  <div className="exam-q-row">
                    <span className="exam-q-label">Câu {qNum}</span>
                    {(block.questionType === 'short' ||
                      block.questionType === 'essay' ||
                      block.points) && (
                      <input
                        className="exam-q-points"
                        value={block.points ? `(${block.points})` : ''}
                        placeholder="(1 điểm)"
                        title="Điểm câu hỏi (ví dụ: 1 điểm)"
                        onChange={e => {
                          const raw = e.target.value.replace(/[()]/g, '');
                          setPaper(p => ({
                            ...p,
                            blocks: p.blocks.map(x =>
                              x.id === block.id && x.type === 'question'
                                ? { ...x, points: raw }
                                : x
                            )
                          }));
                        }}
                      />
                    )}
                    <span className="exam-q-label">.</span>

                    <div className="exam-q-prompt-area">
                      {isEditingPrompt ? (
                        <textarea
                          autoFocus
                          className="exam-q-textarea"
                          rows={3}
                          value={block.prompt}
                          placeholder="Gõ nội dung câu hỏi... Nếu gõ dòng cuối là 'A. ... B. ... C. ... D. ...' máy sẽ tự tách thành 4 phương án thẳng cột!"
                          onChange={e => {
                            const rawVal = e.target.value;
                            // Check if teacher typed "Câu X." at beginning — strip duplicate prefix since auto-numbered
                            const cleaned = rawVal.replace(
                              /^\s*Câu\s*\d+\s*[.:]\s*/i,
                              ''
                            );
                            // Check if last line has inline A. ... B. ... C. ... D. ...
                            const lines = cleaned.split(/\r?\n/);
                            const lastLine = lines[lines.length - 1] || '';
                            const autoOpts = parseInlineOptionsLine(lastLine);
                            if (autoOpts && lines.length > 1) {
                              const promptWithoutOpts = lines
                                .slice(0, -1)
                                .join('\n');
                              setPaper(p => ({
                                ...p,
                                blocks: p.blocks.map(x =>
                                  x.id === block.id && x.type === 'question'
                                    ? {
                                        ...x,
                                        questionType: 'mcq',
                                        prompt: promptWithoutOpts,
                                        options: autoOpts
                                      }
                                    : x
                                )
                              }));
                              return;
                            }
                            setPaper(p => ({
                              ...p,
                              blocks: p.blocks.map(x =>
                                x.id === block.id && x.type === 'question'
                                  ? { ...x, prompt: cleaned }
                                  : x
                              )
                            }));
                          }}
                          onBlur={() => setEditingPromptId(null)}
                        />
                      ) : (
                        <div
                          className="exam-q-rendered"
                          title="Nhấp để sửa nội dung câu hỏi hoặc công thức"
                          onClick={() => setEditingPromptId(block.id)}
                          dangerouslySetInnerHTML={{
                            __html: renderRichExamText(
                              block.prompt || 'Nhấp vào đây để gõ nội dung câu hỏi…'
                            )
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Inline Figures (Resizable, Alignable, Live-Linked to Drawing Board) */}
                  {(block.figures || []).map(fig => {
                    const isFigSelected =
                      selectedFigure?.blockId === block.id &&
                      selectedFigure?.figId === fig.id;
                    return (
                      <div
                        key={fig.id}
                        className={`exam-figure-row align-${fig.align || 'center'}`}
                      >
                        <div
                          className={`exam-figure-box ${
                            isFigSelected ? 'is-selected' : ''
                          }`}
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedFigure({
                              blockId: block.id,
                              figId: fig.id
                            });
                          }}
                        >
                          {isFigSelected && (
                            <div
                              className="exam-figure-toolbar"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                className={fig.align === 'left' ? 'active' : ''}
                                onClick={() =>
                                  setPaper(p => ({
                                    ...p,
                                    blocks: p.blocks.map(x =>
                                      x.id === block.id &&
                                      'figures' in x &&
                                      x.figures
                                        ? {
                                            ...x,
                                            figures: x.figures.map(f =>
                                              f.id === fig.id
                                                ? { ...f, align: 'left' }
                                                : f
                                            )
                                          }
                                        : x
                                    )
                                  }))
                                }
                              >
                                ⇤ Trái
                              </button>
                              <button
                                className={
                                  fig.align === 'center' ? 'active' : ''
                                }
                                onClick={() =>
                                  setPaper(p => ({
                                    ...p,
                                    blocks: p.blocks.map(x =>
                                      x.id === block.id &&
                                      'figures' in x &&
                                      x.figures
                                        ? {
                                            ...x,
                                            figures: x.figures.map(f =>
                                              f.id === fig.id
                                                ? { ...f, align: 'center' }
                                                : f
                                            )
                                          }
                                        : x
                                    )
                                  }))
                                }
                              >
                                ↔ Giữa
                              </button>
                              <button
                                className={
                                  fig.align === 'right' ? 'active' : ''
                                }
                                onClick={() =>
                                  setPaper(p => ({
                                    ...p,
                                    blocks: p.blocks.map(x =>
                                      x.id === block.id &&
                                      'figures' in x &&
                                      x.figures
                                        ? {
                                            ...x,
                                            figures: x.figures.map(f =>
                                              f.id === fig.id
                                                ? { ...f, align: 'right' }
                                                : f
                                            )
                                          }
                                        : x
                                    )
                                  }))
                                }
                              >
                                Phải ⇥
                              </button>
                              <button
                                onClick={() => {
                                  setActiveSourceId(fig.sourceId);
                                  setSplitBoardOpen(true);
                                }}
                              >
                                ✏️ Sửa hình
                              </button>
                              <button
                                className="danger"
                                title="Xoá hình này"
                                onClick={() => {
                                  setPaper(p => ({
                                    ...p,
                                    blocks: p.blocks.map(x =>
                                      x.id === block.id &&
                                      'figures' in x &&
                                      x.figures
                                        ? {
                                            ...x,
                                            figures: x.figures.filter(
                                              f => f.id !== fig.id
                                            )
                                          }
                                        : x
                                    )
                                  }));
                                  setSelectedFigure(null);
                                }}
                              >
                                🗑
                              </button>
                            </div>
                          )}
                          <img
                            src={fig.src}
                            style={{ width: `${fig.width || 250}px` }}
                            alt="Hình minh hoạ câu hỏi"
                            draggable={false}
                          />
                          <span
                            className="exam-figure-resize-handle"
                            title="Kéo góc để phóng to / thu nhỏ hình"
                            onPointerDown={e =>
                              startFigureResize(
                                e,
                                block.id,
                                fig.id,
                                fig.width || 250
                              )
                            }
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* MCQ Options: A. B. C. D. + Floating 1 dòng · 2 dòng · 4 dòng switcher */}
                  {block.questionType === 'mcq' && block.options && (
                    <div className="exam-options-wrap">
                      <div className="exam-options-layout-bar">
                        <button
                          className={
                            (block.optionCols || 4) === 4 ? 'active' : ''
                          }
                          onClick={() =>
                            setPaper(p => ({
                              ...p,
                              blocks: p.blocks.map(x =>
                                x.id === block.id && x.type === 'question'
                                  ? { ...x, optionCols: 4 }
                                  : x
                              )
                            }))
                          }
                        >
                          1 dòng
                        </button>
                        <span>·</span>
                        <button
                          className={block.optionCols === 2 ? 'active' : ''}
                          onClick={() =>
                            setPaper(p => ({
                              ...p,
                              blocks: p.blocks.map(x =>
                                x.id === block.id && x.type === 'question'
                                  ? { ...x, optionCols: 2 }
                                  : x
                              )
                            }))
                          }
                        >
                          2 dòng
                        </button>
                        <span>·</span>
                        <button
                          className={block.optionCols === 1 ? 'active' : ''}
                          onClick={() =>
                            setPaper(p => ({
                              ...p,
                              blocks: p.blocks.map(x =>
                                x.id === block.id && x.type === 'question'
                                  ? { ...x, optionCols: 1 }
                                  : x
                              )
                            }))
                          }
                        >
                          4 dòng
                        </button>
                      </div>

                      <div
                        className={`exam-options-grid cols-${
                          block.optionCols || 4
                        }`}
                      >
                        {(['A', 'B', 'C', 'D'] as const).map((letter, idx) => {
                          const isCorrect = block.correctChoice === letter;
                          return (
                            <div key={letter} className="exam-option-cell">
                              <button
                                type="button"
                                className={`exam-option-letter ${
                                  isCorrect ? 'is-correct' : ''
                                }`}
                                title={`Bấm vào chữ ${letter} để đánh dấu đáp án đúng`}
                                onClick={() =>
                                  setPaper(p => ({
                                    ...p,
                                    blocks: p.blocks.map(x =>
                                      x.id === block.id && x.type === 'question'
                                        ? { ...x, correctChoice: letter }
                                        : x
                                    )
                                  }))
                                }
                              >
                                {letter}.
                              </button>
                              {editingFieldKey === `opt:${block.id}:${idx}` ? (
                                <input
                                  autoFocus
                                  className="exam-option-input"
                                  value={block.options![idx] || ''}
                                  placeholder={`Phương án ${letter} (hoặc gõ A. ... B. ... C. ... D. ...)`}
                                  onChange={e => {
                                    const raw = e.target.value;
                                    const inlineAll = parseInlineOptionsLine(raw);
                                    if (inlineAll) {
                                      setPaper(p => ({
                                        ...p,
                                        blocks: p.blocks.map(x =>
                                          x.id === block.id &&
                                          x.type === 'question'
                                            ? { ...x, options: inlineAll }
                                            : x
                                        )
                                      }));
                                      return;
                                    }
                                    setPaper(p => ({
                                      ...p,
                                      blocks: p.blocks.map(x => {
                                        if (
                                          x.id !== block.id ||
                                          x.type !== 'question' ||
                                          !x.options
                                        )
                                          return x;
                                        const nextOpts = [...x.options] as [
                                          string,
                                          string,
                                          string,
                                          string
                                        ];
                                        nextOpts[idx] = raw;
                                        return { ...x, options: nextOpts };
                                      })
                                    }));
                                  }}
                                  onBlur={() => setEditingFieldKey(null)}
                                />
                              ) : (
                                <div
                                  className="exam-inline-rendered"
                                  title="Nhấp để sửa phương án"
                                  onClick={() => setEditingFieldKey(`opt:${block.id}:${idx}`)}
                                  dangerouslySetInnerHTML={{
                                    __html: renderRichExamText(
                                      block.options![idx] || `Phương án ${letter}`
                                    )
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* True / False Statements: a), b), c), d) with Đ | S buttons */}
                  {block.questionType === 'tf' && block.statements && (
                    <div className="exam-tf-list">
                      {block.statements.map((st, sIdx) => (
                        <div key={st.id} className="exam-tf-item">
                          <span className="exam-tf-label">{st.label})</span>
                          <div
                            className="exam-tf-toggle"
                            title="Chọn Đúng (Đ) hoặc Sai (S)"
                          >
                            <button
                              type="button"
                              className={st.correct === true ? 'is-true' : ''}
                              onClick={() =>
                                setPaper(p => ({
                                  ...p,
                                  blocks: p.blocks.map(x => {
                                    if (
                                      x.id !== block.id ||
                                      x.type !== 'question' ||
                                      !x.statements
                                    )
                                      return x;
                                    const nextSt = x.statements.map((item, i) =>
                                      i === sIdx
                                        ? { ...item, correct: true }
                                        : item
                                    );
                                    return { ...x, statements: nextSt };
                                  })
                                }))
                              }
                            >
                              Đ
                            </button>
                            <button
                              type="button"
                              className={st.correct === false ? 'is-false' : ''}
                              onClick={() =>
                                setPaper(p => ({
                                  ...p,
                                  blocks: p.blocks.map(x => {
                                    if (
                                      x.id !== block.id ||
                                      x.type !== 'question' ||
                                      !x.statements
                                    )
                                      return x;
                                    const nextSt = x.statements.map((item, i) =>
                                      i === sIdx
                                        ? { ...item, correct: false }
                                        : item
                                    );
                                    return { ...x, statements: nextSt };
                                  })
                                }))
                              }
                            >
                              S
                            </button>
                          </div>
                          {editingFieldKey === `tf:${block.id}:${sIdx}` ? (
                            <textarea
                              autoFocus
                              rows={1}
                              className="exam-q-textarea"
                              value={st.text}
                              onChange={e => {
                                const val = e.target.value;
                                setPaper(p => ({
                                  ...p,
                                  blocks: p.blocks.map(x => {
                                    if (
                                      x.id !== block.id ||
                                      x.type !== 'question' ||
                                      !x.statements
                                    )
                                      return x;
                                    const nextSt = x.statements.map((item, i) =>
                                      i === sIdx ? { ...item, text: val } : item
                                    );
                                    return { ...x, statements: nextSt };
                                  })
                                }));
                              }}
                              onBlur={() => setEditingFieldKey(null)}
                            />
                          ) : (
                            <div
                              className="exam-inline-rendered"
                              title="Nhấp để sửa mệnh đề"
                              onClick={() => setEditingFieldKey(`tf:${block.id}:${sIdx}`)}
                              dangerouslySetInnerHTML={{
                                __html: renderRichExamText(st.text || `Khẳng định ${st.label}`)
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Short Answer Row (Đáp án: ...) */}
                  {(block.questionType === 'short' ||
                    block.shortAnswer !== undefined) && (
                    <div className="exam-short-row">
                      <strong>Đáp án:</strong>
                      <input
                        className="exam-option-input"
                        style={{ maxWidth: 220, fontWeight: 700 }}
                        value={block.shortAnswer || ''}
                        placeholder="Nhập đáp án (bản phát học sinh sẽ tự để trống ô này)…"
                        onChange={e => {
                          const val = e.target.value;
                          setPaper(p => ({
                            ...p,
                            blocks: p.blocks.map(x =>
                              x.id === block.id && x.type === 'question'
                                ? { ...x, shortAnswer: val }
                                : x
                            )
                          }));
                        }}
                      />
                    </div>
                  )}

                  {/* Solution Row (Lời giải: ... with rich KaTeX / mhchem formula rendering!) */}
                  {block.solution !== undefined && (
                    <div className="exam-solution-row">
                      <strong>Lời giải:</strong>
                      {editingSolutionId === block.id ? (
                        <div style={{ flex: 1, display: 'grid', gap: 4 }}>
                          <textarea
                            autoFocus
                            className="exam-q-textarea"
                            rows={2}
                            value={block.solution}
                            placeholder="Nhập lời giải (hỗ trợ $công thức$ và \ce{Hóa}, bản Học sinh sẽ tự ẩn dòng này)…"
                            onChange={e => {
                              const val = e.target.value;
                              setPaper(p => ({
                                ...p,
                                blocks: p.blocks.map(x =>
                                  x.id === block.id && x.type === 'question'
                                    ? { ...x, solution: val }
                                    : x
                                )
                              }));
                            }}
                            onBlur={() => setEditingSolutionId(null)}
                          />
                        </div>
                      ) : (
                        <div
                          className="exam-solution-rendered"
                          title="Nhấp để sửa lời giải (tự hiển thị đẹp công thức Toán & Hóa)"
                          onClick={() => setEditingSolutionId(block.id)}
                          dangerouslySetInnerHTML={{
                            __html: renderRichExamText(
                              block.solution || 'Nhấp vào đây để nhập lời giải chi tiết…'
                            )
                          }}
                        />
                      )}
                    </div>
                  )}
                </article>
              );
            })}

            {pg.blocks.length === 0 && (
              <div
                style={{
                  padding: '28px 16px',
                  border: '1.5px dashed #cbd5e1',
                  borderRadius: 10,
                  textAlign: 'center',
                  color: '#64748b',
                  fontFamily: '"Be Vietnam Pro", system-ui, sans-serif',
                  fontSize: 13
                }}
              >
                Trang {pg.pageNumber} đang trống — bấm <strong>+ Câu trắc nghiệm</strong>,{' '}
                <strong>+ Câu Đúng / Sai</strong> hoặc <strong>+ Câu Tự luận</strong> trên thanh công cụ để thêm câu hỏi vào trang này.
              </div>
            )}

            <footer className="exam-a4-footer">
              <span>Mã đề {paper.header.examCode}</span>
              {pageIdx === pages.length - 1 ? (
                <span className="exam-a4-end-mark">—————— HẾT ——————</span>
              ) : (
                <span>(Xem tiếp Trang {pg.pageNumber + 1})</span>
              )}
              <strong>
                Trang {pg.pageNumber} / {pages.length}
              </strong>
            </footer>
          </article>
          ))}

          <button
            type="button"
            className="exam-add-page-below"
            onClick={addNewPage}
          >
            📄 + Thêm Trang {pages.length + 1} (Khổ A4)
          </button>
        </div>

        {/* RIGHT PANE: INTERACTIVE DRAWING BOARD (SPLIT SCREEN) */}
        {splitBoardOpen && (
          <aside className="exam-board-pane">
            <div className="exam-board-header">
              <div className="exam-board-tabs">
                <button
                  className="exam-board-tab"
                  onClick={() => createBoardSource('3d')}
                >
                  + Hình 3D (Chóp / Thiết diện)
                </button>
                <button
                  className="exam-board-tab"
                  onClick={() => createBoardSource('graph')}
                >
                  + Đồ thị hàm số
                </button>
                <button
                  className="exam-board-tab"
                  onClick={() => createBoardSource('molecule')}
                >
                  + Phân tử Hóa học
                </button>
                <button
                  className="exam-board-tab"
                  onClick={() => createBoardSource('board')}
                >
                  + Hình phẳng / Tự vẽ
                </button>
              </div>
              <button
                className="exam-btn"
                onClick={() => setSplitBoardOpen(false)}
                title="Đóng bảng vẽ để trang đề rộng trở lại"
              >
                ✕ Đóng bảng vẽ
              </button>
            </div>

            <div className="exam-board-body">
              {/* List of figures on the board */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {paper.figureSources.map((src, idx) => (
                  <button
                    key={src.id}
                    className={`exam-board-tab ${
                      activeSource?.id === src.id ? 'active' : ''
                    }`}
                    onClick={() => setActiveSourceId(src.id)}
                  >
                    Hình {idx + 1}: {src.label}
                  </button>
                ))}
              </div>

              {activeSource && (
                <>
                  {/* LIVE CONTROLS FOR THE ACTIVE BOARD FIGURE */}
                  <div className="exam-board-controls">
                    <div className="exam-board-control-row">
                      <label style={{ fontWeight: 700 }}>
                        Cỡ tên điểm trên bảng ({activeSource.pointFontSize}px):
                        <input
                          type="range"
                          min={11}
                          max={28}
                          value={activeSource.pointFontSize}
                          style={{ marginLeft: 8, verticalAlign: 'middle' }}
                          onChange={e =>
                            updateFigureSource(activeSource.id, s => ({
                              ...s,
                              pointFontSize: Number(e.target.value)
                            }))
                          }
                        />
                      </label>
                      <label style={{ fontWeight: 700 }}>
                        Màu nét:
                        <input
                          type="color"
                          value={activeSource.strokeColor}
                          style={{ marginLeft: 6, verticalAlign: 'middle' }}
                          onChange={e =>
                            updateFigureSource(activeSource.id, s => ({
                              ...s,
                              strokeColor: e.target.value
                            }))
                          }
                        />
                      </label>
                    </div>

                    {activeSource.kind === '3d' &&
                      activeSource.solid3DConfig && (
                        <>
                          <div className="exam-board-control-row">
                            <label>
                              Khối 3D:{' '}
                              <select
                                className="exam-select"
                                value={activeSource.solid3DConfig.solid}
                                onChange={e =>
                                  updateFigureSource(activeSource.id, s => ({
                                    ...s,
                                    label:
                                      e.target.value === 'pyramid4'
                                        ? 'Hình chóp S.ABCD'
                                        : e.target.value === 'pyramid3'
                                        ? 'Hình chóp S.ABC'
                                        : 'Hình lăng trụ / Hộp',
                                    solid3DConfig: {
                                      ...s.solid3DConfig!,
                                      solid: e.target.value as 'pyramid4' | 'pyramid3' | 'cube'
                                    }
                                  }))
                                }
                              >
                                <option value="pyramid4">
                                  Hình chóp tứ giác S.ABCD
                                </option>
                                <option value="pyramid3">
                                  Hình chóp tam giác S.ABC
                                </option>
                                <option value="cube">
                                  Hình hộp / Lăng trụ ABCD.A&apos;B&apos;C&apos;D&apos;
                                </option>
                              </select>
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={activeSource.solid3DConfig.showMidpoints}
                                onChange={e =>
                                  updateFigureSource(activeSource.id, s => ({
                                    ...s,
                                    solid3DConfig: {
                                      ...s.solid3DConfig!,
                                      showMidpoints: e.target.checked
                                    }
                                  }))
                                }
                              />{' '}
                              Trung điểm M, N, P
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={activeSource.solid3DConfig.showSection}
                                onChange={e =>
                                  updateFigureSource(activeSource.id, s => ({
                                    ...s,
                                    solid3DConfig: {
                                      ...s.solid3DConfig!,
                                      showSection: e.target.checked
                                    }
                                  }))
                                }
                              />{' '}
                              Tô màu thiết diện
                            </label>
                            <label>
                              Màu mặt:{' '}
                              <input
                                type="color"
                                value={activeSource.solid3DConfig.faceColor}
                                onChange={e =>
                                  updateFigureSource(activeSource.id, s => ({
                                    ...s,
                                    solid3DConfig: {
                                      ...s.solid3DConfig!,
                                      faceColor: e.target.value
                                    }
                                  }))
                                }
                              />
                            </label>
                          </div>
                          <div className="exam-board-control-row">
                            <label>
                              Xoay ngang ({activeSource.solid3DConfig.ry}°):
                              <input
                                type="range"
                                min={-80}
                                max={80}
                                value={activeSource.solid3DConfig.ry}
                                onChange={e =>
                                  updateFigureSource(activeSource.id, s => ({
                                    ...s,
                                    solid3DConfig: {
                                      ...s.solid3DConfig!,
                                      ry: Number(e.target.value)
                                    }
                                  }))
                                }
                              />
                            </label>
                            <label>
                              Góc nhìn dọc ({activeSource.solid3DConfig.rx}°):
                              <input
                                type="range"
                                min={5}
                                max={55}
                                value={activeSource.solid3DConfig.rx}
                                onChange={e =>
                                  updateFigureSource(activeSource.id, s => ({
                                    ...s,
                                    solid3DConfig: {
                                      ...s.solid3DConfig!,
                                      rx: Number(e.target.value)
                                    }
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </>
                      )}

                    {activeSource.kind === 'graph' && (
                      <div className="exam-board-control-row">
                        <label style={{ flex: 1 }}>
                          Hàm số <b>y = </b>
                          <input
                            className="exam-select"
                            style={{ width: '75%' }}
                            value={activeSource.graphFormula || ''}
                            placeholder="Ví dụ: x^3 - 3*x hoặc (2*x-1)/(x+1)"
                            onChange={e =>
                              updateFigureSource(activeSource.id, s => ({
                                ...s,
                                label: `Đồ thị y = ${e.target.value}`,
                                graphFormula: e.target.value
                              }))
                            }
                          />
                        </label>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[
                            ['Bậc 3', 'x^3 - 3*x'],
                            ['Trùng phương', 'x^4 - 2*x^2 - 1'],
                            ['Parabol', 'x^2 - 2*x - 1'],
                            ['Hữu tỉ', '(x - 1)/(x + 1)']
                          ].map(([lb, fn]) => (
                            <button
                              key={lb}
                              className="exam-chip-btn"
                              onClick={() =>
                                updateFigureSource(activeSource.id, s => ({
                                  ...s,
                                  label: `Đồ thị y = ${fn}`,
                                  graphFormula: fn
                                }))
                              }
                            >
                              {lb}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeSource.kind === 'molecule' && (
                      <div className="exam-board-control-row">
                        <span>Mẫu phân tử có sẵn:</span>
                        {Object.entries(MOLECULE_PRESETS).map(([key, pr]) => (
                          <button
                            key={key}
                            className="exam-chip-btn"
                            onClick={() =>
                              updateFigureSource(activeSource.id, s => ({
                                ...s,
                                label: pr.name,
                                moleculeConfig: {
                                  preset: key,
                                  atoms: structuredClone(pr.atoms),
                                  bonds: structuredClone(pr.bonds)
                                }
                              }))
                            }
                          >
                            {pr.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {activeSource.kind === 'board' && (
                      <div className="exam-board-control-row">
                        <span>
                          Vẽ trực tiếp lên bảng bên dưới hoặc đặt nhãn điểm:
                        </span>
                        <input
                          className="exam-select"
                          style={{ width: 64 }}
                          value={freePointLabel}
                          onChange={e => setFreePointLabel(e.target.value)}
                          placeholder="Tên điểm"
                        />
                        <button
                          className="exam-chip-btn"
                          onClick={() =>
                            updateFigureSource(activeSource.id, s => ({
                              ...s,
                              boardStrokes: []
                            }))
                          }
                        >
                          Xoá bảng vẽ
                        </button>
                      </div>
                    )}
                  </div>

                  {/* STAGE: DRAG DIRECTLY FROM HERE TO THE A4 SHEET */}
                  <div
                    className="exam-board-stage"
                    draggable={activeSource.kind !== 'board'}
                    onDragStart={e => {
                      setDraggingSourceId(activeSource.id);
                      e.dataTransfer.setData(
                        'text/htvvm-figure-source',
                        activeSource.id
                      );
                    }}
                    title="Nhấn giữ chuột vào hình và kéo thẳng sang trang đề A4 bên trái!"
                  >
                    {activeSource.kind === 'board' ? (
                      <canvas
                        ref={freeCanvasRef}
                        width={520}
                        height={380}
                        style={{
                          background: '#fff',
                          borderRadius: 8,
                          cursor: 'crosshair'
                        }}
                        onPointerDown={e => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x =
                            ((e.clientX - rect.left) * 520) / rect.width;
                          const y =
                            ((e.clientY - rect.top) * 380) / rect.height;
                          drawingStrokeRef.current = [{ x, y }];
                        }}
                        onPointerMove={e => {
                          if (!drawingStrokeRef.current) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x =
                            ((e.clientX - rect.left) * 520) / rect.width;
                          const y =
                            ((e.clientY - rect.top) * 380) / rect.height;
                          drawingStrokeRef.current.push({ x, y });
                        }}
                        onPointerUp={() => {
                          const pts = drawingStrokeRef.current;
                          drawingStrokeRef.current = null;
                          if (!pts || !pts.length) return;
                          if (pts.length < 3) {
                            // Single click places a point label
                            const pt = pts[0];
                            updateFigureSource(activeSource.id, s => ({
                              ...s,
                              boardStrokes: [
                                ...(s.boardStrokes || []),
                                {
                                  id: crypto.randomUUID(),
                                  points: [],
                                  color: s.strokeColor,
                                  width: 2.2,
                                  label: freePointLabel,
                                  lx: pt.x,
                                  ly: pt.y
                                }
                              ]
                            }));
                          } else {
                            updateFigureSource(activeSource.id, s => ({
                              ...s,
                              boardStrokes: [
                                ...(s.boardStrokes || []),
                                {
                                  id: crypto.randomUUID(),
                                  points: pts,
                                  color: s.strokeColor,
                                  width: 2.4
                                }
                              ]
                            }));
                          }
                        }}
                      />
                    ) : null}
                    <img
                      src={activeSource.src}
                      alt={activeSource.label}
                      style={{
                        display:
                          activeSource.kind === 'board' ? 'block' : 'block',
                        pointerEvents:
                          activeSource.kind === 'board' ? 'none' : 'auto',
                        position:
                          activeSource.kind === 'board' ? 'absolute' : 'static',
                        inset: activeSource.kind === 'board' ? 10 : undefined
                      }}
                    />
                  </div>

                  {/* BOTTOM DRAG HANDLE: ⟵ 🖼 Kéo hình sang trang */}
                  <div
                    className="exam-board-drag-pill"
                    draggable
                    onDragStart={e => {
                      setDraggingSourceId(activeSource.id);
                      e.dataTransfer.setData(
                        'text/htvvm-figure-source',
                        activeSource.id
                      );
                    }}
                    onClick={() => insertFigureIntoBlock(activeSource.id)}
                    title="Kéo ô này thả sang câu hỏi bên trang đề A4 (hoặc bấm để chèn vào câu đang chọn)"
                  >
                    <span>⟵ 🖼 Kéo hình sang trang (hoặc bấm để chèn ngay)</span>
                    <small style={{ opacity: 0.9 }}>
                      Hình trong đề luôn tự cập nhật theo bảng
                    </small>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* FORMULA & MOLECULE MODAL */}
      {formulaModal && (
        <div
          className="exam-modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setFormulaModal(null);
          }}
        >
          <div className="exam-modal-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16 }}>
                {formulaModal === 'math'
                  ? 'ƒ Bảng công thức Toán học (chuẩn sách giáo khoa)'
                  : '⚗ Công thức Hóa học & Cấu tạo Phân tử'}
              </h3>
              <button
                className="exam-btn"
                onClick={() => setFormulaModal(null)}
              >
                Đóng ✕
              </button>
            </div>

            {formulaModal === 'math' ? (
              <>
                <div className="exam-formula-grid">
                  {MATH_TEMPLATES.map(item => (
                    <button
                      key={item.label}
                      className="exam-formula-tile"
                      onClick={() => setCustomLatex(item.latex)}
                    >
                      <strong>
                        {item.category} · {item.label}
                      </strong>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: renderRichExamText(`$${item.latex}$`)
                        }}
                      />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="exam-formula-grid">
                  {CHEMISTRY_TEMPLATES.map(item => (
                    <button
                      key={item.label}
                      className="exam-formula-tile"
                      onClick={() => setCustomLatex(item.latex)}
                    >
                      <strong>{item.label}</strong>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: renderRichExamText(`$${item.latex}$`)
                        }}
                      />
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    padding: 10,
                    background: '#f5f3ff',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10
                  }}
                >
                  <span style={{ fontSize: 12, color: '#4c1d95' }}>
                    Cần chèn hình công thức cấu tạo 2D (vòng Benzen, Phenol, Este, Amino acid)?
                  </span>
                  <button
                    className="exam-btn purple"
                    onClick={() => {
                      setFormulaModal(null);
                      createBoardSource('molecule');
                    }}
                  >
                    🖼 Mở bảng vẽ Phân tử 2D
                  </button>
                </div>
              </>
            )}

            <div
              style={{
                display: 'grid',
                gap: 8,
                padding: 12,
                background: '#f8fafc',
                borderRadius: 10,
                border: '1px solid #cbd5e1'
              }}
            >
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Soạn / Chỉnh sửa mã công thức (LaTeX / mhchem):
              </label>
              <input
                className="exam-select"
                style={{ width: '100%', fontFamily: 'monospace' }}
                value={customLatex}
                onChange={e => setCustomLatex(e.target.value)}
              />
              <div
                style={{
                  minHeight: 48,
                  padding: 10,
                  background: '#ffffff',
                  borderRadius: 8,
                  border: '1px dashed #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16
                }}
                dangerouslySetInnerHTML={{
                  __html: renderRichExamText(`$$${customLatex}$$`)
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  className="exam-btn primary"
                  onClick={() => insertFormulaIntoFocused(customLatex)}
                >
                  ✓ Chèn công thức vào câu đang chọn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
