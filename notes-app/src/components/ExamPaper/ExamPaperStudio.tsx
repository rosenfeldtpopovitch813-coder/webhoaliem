import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bold,
  Check,
  ChevronDown,
  Copy,
  CornerDownLeft,
  Download,
  FilePlus2,
  FileText,
  FlaskConical,
  GripVertical,
  Highlighter,
  ImagePlus,
  Italic,
  Keyboard,
  Palette,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Scissors,
  Send,
  Shapes,
  Sigma,
  Strikethrough,
  Subscript,
  Superscript,
  Trash2,
  Underline,
  X
} from 'lucide-react';
import {
  duplicateExamBlock,
  getFocusedSelectionLabel,
  moveExamBlock,
  reorderExamBlock
} from './examBlockUtils';
import {
  ExamBlock,
  ExamBlockStyle,
  ExamFigureSource,
  ExamInlineFigure,
  ExamPaperDocument,
  ExamParagraphVariant,
  ExamStatementTF
} from '../../types/board';
import {
  CHEMISTRY_TEMPLATES,
  createDefaultExamPaper,
  EXAM_BG_COLORS,
  EXAM_FONT_CATALOG,
  EXAM_FONT_SIZES,
  EXAM_TEXT_COLORS,
  MATH_TEMPLATES,
  MOLECULE_PRESETS,
  parseInlineOptionsLine,
  renderFigureSourceToDataUrl,
  renderRichExamText,
  stripRichHtmlToPlainText
} from './examTemplates';
import {
  convertExamPaperToOnlineQuestions,
  exportExamPaperToDocx,
  exportExamPaperToPDF
} from './examExport';
import RichEditableBlock, {
  applyInlineStyleToSelection,
  focusRichBlock,
  getActiveRichSelection,
  InlineFormatCommand
} from './RichEditableBlock';
import {
  BlockQuickMenu,
  FloatingSelectionToolbar,
  SlashActionId,
  SlashCommandMenu
} from './ExamNotionOverlays';
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
  const [headerFooterOpen, setHeaderFooterOpen] = useState(false);
  const [saveBadge, setSaveBadge] = useState('✓ Tự động lưu khi gõ');
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; query: string; rect: DOMRect } | null>(null);
  const [selectionToolbar, setSelectionToolbar] = useState<{ rect: DOMRect; blockId: string } | null>(null);
  const [blockMenu, setBlockMenu] = useState<{ blockId: string; rect: DOMRect } | null>(null);
  const [ribbonPicker, setRibbonPicker] = useState<'color' | 'bg' | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const isFirstRenderRef = useRef(true);
  const imageUploadRef = useRef<HTMLInputElement | null>(null);

  const refreshSelectionToolbar = () => {
    const active = getActiveRichSelection();
    if (active) {
      setSelectionToolbar({ rect: active.rect, blockId: active.blockId });
      if (active.blockId) setFocusedBlockId(active.blockId);
    } else {
      setSelectionToolbar(null);
    }
  };

  useEffect(() => {
    const onSelChange = () => refreshSelectionToolbar();
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, []);

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

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        Promise.resolve(
          typeof onSavePaper === 'function' ? onSavePaper(paper, false) : undefined
        )
          .then(() => setSaveBadge('✓ Đã lưu đề (Ctrl+S)'))
          .catch(() => setSaveBadge('⚠ Chưa lưu được bản nháp'));
      } else if (event.key === 'Escape') {
        if (slashMenu) setSlashMenu(null);
        else if (blockMenu) setBlockMenu(null);
        else if (ribbonPicker) setRibbonPicker(null);
        else if (formulaModal) setFormulaModal(null);
        else if (downloadMenuOpen) setDownloadMenuOpen(false);
        else if (editingPromptId) setEditingPromptId(null);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [paper, slashMenu, blockMenu, ribbonPicker, formulaModal, downloadMenuOpen, editingPromptId, onSavePaper]);

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

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    setPaper(prev => ({
      ...prev,
      blocks: moveExamBlock(prev.blocks, blockId, direction),
      updatedAt: Date.now()
    }));
    setFocusedBlockId(blockId);
  };

  const duplicateBlock = (blockId: string) => {
    let createdId: string | null = null;
    setPaper(prev => {
      const res = duplicateExamBlock(prev.blocks, blockId);
      createdId = res.createdId;
      return { ...prev, blocks: res.blocks, updatedAt: Date.now() };
    });
    if (createdId) setFocusedBlockId(createdId);
  };

  const focusedBlock = useMemo(
    () => paper.blocks.find(b => b.id === focusedBlockId) || null,
    [paper.blocks, focusedBlockId]
  );

  const numberedListIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const b of paper.blocks) {
      if (b.type === 'paragraph' && b.variant === 'numbered') {
        n += 1;
        map.set(b.id, n);
      } else {
        n = 0;
      }
    }
    return map;
  }, [paper.blocks]);

  const updateBlockStyle = (blockId: string, patch: Partial<ExamBlockStyle>) => {
    setPaper(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId && b.type !== 'page-break' ? { ...b, ...patch } : b
      ),
      updatedAt: Date.now()
    }));
  };

  const applyFormatCommand = (cmd: InlineFormatCommand, val?: string | number) => {
    const formattedSelection = applyInlineStyleToSelection(cmd, val);
    if (formattedSelection) {
      window.setTimeout(refreshSelectionToolbar, 20);
      return;
    }
    if (!focusedBlockId) return;
    setPaper(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id !== focusedBlockId || b.type === 'page-break') return b;
        if (cmd === 'bold') return { ...b, bold: !b.bold };
        if (cmd === 'italic') return { ...b, italic: !b.italic };
        if (cmd === 'underline') return { ...b, underline: !b.underline };
        if (cmd === 'strike') return { ...b, strike: !b.strike };
        if (cmd === 'color') return { ...b, textColor: val ? String(val) : undefined };
        if (cmd === 'bgColor') return { ...b, bgColor: val ? String(val) : undefined };
        if (cmd === 'fontSize') return { ...b, fontSizePt: val ? Number(val) : undefined };
        if (cmd === 'fontFamily') return { ...b, fontFamily: val ? String(val) : undefined };
        if (cmd === 'clear') {
          return {
            ...b,
            bold: false,
            italic: false,
            underline: false,
            strike: false,
            textColor: undefined,
            bgColor: undefined,
            fontSizePt: undefined,
            fontFamily: undefined
          };
        }
        return b;
      }),
      updatedAt: Date.now()
    }));
  };

  const insertParagraphBlock = (
    afterBlockId?: string | null,
    variant: ExamParagraphVariant = 'text',
    initialText = ''
  ) => {
    const created: ExamBlock = {
      id: crypto.randomUUID(),
      type: 'paragraph',
      variant,
      text: initialText
    };
    setPaper(prev => {
      const next = [...prev.blocks];
      const idx = afterBlockId ? next.findIndex(b => b.id === afterBlockId) : -1;
      if (idx >= 0) next.splice(idx + 1, 0, created);
      else next.push(created);
      return { ...prev, blocks: next, updatedAt: Date.now() };
    });
    setFocusedBlockId(created.id);
    focusRichBlock(created.id, 'start');
    return created.id;
  };

  const ensureWritableBottomBlock = (pageBlocks: ExamBlock[]) => {
    const last = pageBlocks[pageBlocks.length - 1];
    if (last && last.type === 'paragraph' && !stripRichHtmlToPlainText(last.text)) {
      setFocusedBlockId(last.id);
      focusRichBlock(last.id, 'end');
      return;
    }
    insertParagraphBlock(last?.id || null, 'text', '');
  };

  const handleSplitParagraph = (blockId: string, beforeHtml: string, afterHtml: string) => {
    const source = paper.blocks.find(b => b.id === blockId);
    if (!source || source.type !== 'paragraph') return;
    const curVariant = source.variant || 'text';
    if ((curVariant === 'bullet' || curVariant === 'numbered') && !stripRichHtmlToPlainText(beforeHtml) && !stripRichHtmlToPlainText(afterHtml)) {
      setPaper(prev => ({
        ...prev,
        blocks: prev.blocks.map(b => (b.id === blockId && b.type === 'paragraph' ? { ...b, variant: 'text', text: '' } : b)),
        updatedAt: Date.now()
      }));
      focusRichBlock(blockId, 'start');
      return;
    }
    const nextVariant: ExamParagraphVariant =
      curVariant === 'bullet' || curVariant === 'numbered' ? curVariant : 'text';
    const created: ExamBlock = {
      id: crypto.randomUUID(),
      type: 'paragraph',
      variant: nextVariant,
      text: afterHtml,
      align: source.align,
      fontFamily: source.fontFamily,
      fontSizePt: nextVariant === 'text' && curVariant.startsWith('h') ? undefined : source.fontSizePt,
      textColor: source.textColor
    };
    setPaper(prev => {
      const idx = prev.blocks.findIndex(b => b.id === blockId);
      const next = prev.blocks.map(b =>
        b.id === blockId && b.type === 'paragraph' ? { ...b, text: beforeHtml } : b
      );
      if (idx >= 0) next.splice(idx + 1, 0, created);
      else next.push(created);
      return { ...prev, blocks: next, updatedAt: Date.now() };
    });
    setFocusedBlockId(created.id);
    focusRichBlock(created.id, 'start');
  };

  const handleBackspaceEmptyParagraph = (blockId: string) => {
    const idx = paper.blocks.findIndex(b => b.id === blockId);
    if (idx < 0) return;
    const cur = paper.blocks[idx];
    if (cur.type !== 'paragraph') return;
    if (cur.variant && cur.variant !== 'text') {
      setPaper(prev => ({
        ...prev,
        blocks: prev.blocks.map(b => (b.id === blockId && b.type === 'paragraph' ? { ...b, variant: 'text' } : b)),
        updatedAt: Date.now()
      }));
      focusRichBlock(blockId, 'start');
      return;
    }
    if (paper.blocks.length <= 1) return;
    const prevEditable = [...paper.blocks.slice(0, idx)].reverse().find(b => b.type === 'paragraph' || b.type === 'question');
    setPaper(prev => ({
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== blockId),
      updatedAt: Date.now()
    }));
    if (prevEditable) {
      setFocusedBlockId(prevEditable.id);
      focusRichBlock(prevEditable.id, 'end');
    }
  };

  const handleNavigateVertical = (blockId: string, dir: -1 | 1) => {
    const editableIds = paper.blocks
      .filter(b => b.type === 'paragraph' || b.type === 'question')
      .map(b => b.id);
    const pos = editableIds.indexOf(blockId);
    if (pos < 0) return;
    const targetId = editableIds[pos + dir];
    if (!targetId) return;
    setFocusedBlockId(targetId);
    focusRichBlock(targetId, dir < 0 ? 'end' : 'start');
  };

  const handleSlashSelect = (action: SlashActionId) => {
    const trigger = slashMenu;
    setSlashMenu(null);
    if (!trigger) return;
    const { blockId, query } = trigger;
    const stripSlash = (raw: string) => {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return raw.replace(new RegExp(`(?:^|\\s)\\/${escaped}$`), '').trimEnd();
    };

    const target = paper.blocks.find(b => b.id === blockId);
    const cleanedText = target?.type === 'paragraph'
      ? stripSlash(target.text)
      : target?.type === 'question'
        ? stripSlash(target.prompt)
        : '';

    const variantActions: SlashActionId[] = ['text', 'h1', 'h2', 'h3', 'bullet', 'numbered', 'callout'];
    if (variantActions.includes(action)) {
      const nextVar = action as ExamParagraphVariant;
      if (target?.type === 'paragraph' && !stripRichHtmlToPlainText(cleanedText)) {
        setPaper(prev => ({
          ...prev,
          blocks: prev.blocks.map(b => (b.id === blockId && b.type === 'paragraph' ? { ...b, variant: nextVar, text: '' } : b)),
          updatedAt: Date.now()
        }));
        setFocusedBlockId(blockId);
        focusRichBlock(blockId, 'start');
      } else {
        if (target?.type === 'paragraph') {
          setPaper(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => (b.id === blockId && b.type === 'paragraph' ? { ...b, text: cleanedText } : b)),
            updatedAt: Date.now()
          }));
        }
        insertParagraphBlock(blockId, nextVar, '');
      }
      return;
    }

    // Strip the `/query` text first before running exam/modal action
    if (target?.type === 'paragraph') {
      const removeEmptyHost = !stripRichHtmlToPlainText(cleanedText) && ['section', 'mcq', 'tf', 'short', 'essay', 'page-break'].includes(action);
      if (removeEmptyHost) {
        const idx = paper.blocks.findIndex(b => b.id === blockId);
        let replacement: ExamBlock | null = null;
        if (action === 'section') {
          replacement = { id: crypto.randomUUID(), type: 'section', title: 'PHẦN MỚI.', subtitle: 'Thí sinh trả lời các câu hỏi bên dưới.' };
        } else if (action === 'mcq') {
          replacement = { id: crypto.randomUUID(), type: 'question', questionType: 'mcq', prompt: '', options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'], optionCols: 4, correctChoice: 'A' };
        } else if (action === 'tf') {
          replacement = {
            id: crypto.randomUUID(),
            type: 'question',
            questionType: 'tf',
            prompt: '',
            statements: [
              { id: crypto.randomUUID(), label: 'a', text: 'Khẳng định a', correct: true },
              { id: crypto.randomUUID(), label: 'b', text: 'Khẳng định b', correct: false },
              { id: crypto.randomUUID(), label: 'c', text: 'Khẳng định c', correct: true },
              { id: crypto.randomUUID(), label: 'd', text: 'Khẳng định d', correct: false }
            ]
          };
        } else if (action === 'short') {
          replacement = { id: crypto.randomUUID(), type: 'question', questionType: 'short', points: '0,5 điểm', prompt: '', shortAnswer: '', solution: '' };
        } else if (action === 'essay') {
          replacement = { id: crypto.randomUUID(), type: 'question', questionType: 'essay', points: '1 điểm', prompt: '', solution: '' };
        } else if (action === 'page-break') {
          const breakBlk: ExamBlock = { id: crypto.randomUUID(), type: 'page-break' };
          const nextPara: ExamBlock = { id: crypto.randomUUID(), type: 'paragraph', variant: 'text', text: '' };
          setPaper(prev => {
            const next = [...prev.blocks];
            next.splice(idx, 1, breakBlk, nextPara);
            return { ...prev, blocks: next, updatedAt: Date.now() };
          });
          setFocusedBlockId(nextPara.id);
          focusRichBlock(nextPara.id, 'start');
          return;
        }
        if (replacement) {
          const created = replacement;
          setPaper(prev => {
            const next = [...prev.blocks];
            next.splice(idx, 1, created);
            return { ...prev, blocks: next, updatedAt: Date.now() };
          });
          setFocusedBlockId(created.id);
          if (created.type === 'question') focusRichBlock(created.id, 'start');
          return;
        }
      } else {
        setPaper(prev => ({
          ...prev,
          blocks: prev.blocks.map(b => (b.id === blockId && b.type === 'paragraph' ? { ...b, text: cleanedText } : b)),
          updatedAt: Date.now()
        }));
      }
    } else if (target?.type === 'question') {
      setPaper(prev => ({
        ...prev,
        blocks: prev.blocks.map(b => (b.id === blockId && b.type === 'question' ? { ...b, prompt: cleanedText } : b)),
        updatedAt: Date.now()
      }));
    }

    if (action === 'math') setFormulaModal('math');
    else if (action === 'chem') setFormulaModal('chem');
    else if (action === 'figure') setSplitBoardOpen(true);
    else if (action === 'page-break') addNewPage();
    else if (action === 'essay') {
      const created: ExamBlock = { id: crypto.randomUUID(), type: 'question', questionType: 'essay', points: '1 điểm', prompt: '', solution: '' };
      setPaper(prev => {
        const idx = prev.blocks.findIndex(b => b.id === blockId);
        const next = [...prev.blocks];
        if (idx >= 0) next.splice(idx + 1, 0, created);
        else next.push(created);
        return { ...prev, blocks: next, updatedAt: Date.now() };
      });
      setFocusedBlockId(created.id);
      focusRichBlock(created.id, 'start');
    } else if (action === 'section' || action === 'mcq' || action === 'tf' || action === 'short') {
      addBlock(action);
    }
  };

  const blockInlineCss = (block: ExamBlockStyle): React.CSSProperties => ({
    textAlign: block.align || undefined,
    fontFamily: block.fontFamily || undefined,
    fontSize: block.fontSizePt ? `${block.fontSizePt}pt` : undefined,
    color: block.textColor || undefined,
    backgroundColor: block.bgColor || undefined,
    lineHeight: block.lineHeight || undefined,
    fontWeight: block.bold ? 700 : undefined,
    fontStyle: block.italic ? 'italic' : undefined,
    textDecoration:
      block.underline && block.strike
        ? 'underline line-through'
        : block.underline
          ? 'underline'
          : block.strike
            ? 'line-through'
            : undefined
  });

  const renderGutter = (block: Exclude<ExamBlock, { type: 'page-break' }>) => (
    <div className="exam-notion-gutter" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="exam-gutter-btn"
        title="Thêm dòng mới bên dưới (hoặc gõ /)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const newId = insertParagraphBlock(block.id, 'text', '');
          setSlashMenu({ blockId: newId, query: '', rect });
        }}
      >
        <Plus size={13} />
      </button>
      <button
        type="button"
        className="exam-gutter-btn is-drag"
        draggable
        title="Kéo để đổi vị trí · Bấm để định dạng cỡ chữ, màu sắc, kiểu đoạn"
        onDragStart={(e) => {
          setDraggingBlockId(block.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/htvvm-block-id', block.id);
        }}
        onDragEnd={() => {
          setDraggingBlockId(null);
          setDragOverBlockId(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          setFocusedBlockId(block.id);
          const rect = e.currentTarget.getBoundingClientRect();
          setBlockMenu((cur) => (cur?.blockId === block.id ? null : { blockId: block.id, rect }));
        }}
      >
        <GripVertical size={13} />
      </button>
    </div>
  );

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
      setSaveBadge(`Đã chuyển ${questions.length} câu hỏi sang Phòng thi!`);
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
            <Save size={15} /> Lưu &amp; Về danh sách đề
          </button>
          <button
            className="exam-btn"
            onClick={handleRevertChanges}
            title="Bỏ các thay đổi vừa gõ trên trang đề (hình minh họa vẫn giữ)"
          >
            <RotateCcw size={15} /> Bỏ thay đổi
          </button>
          <span className="exam-ribbon-sep" />
          <select
            className="exam-select exam-font-select"
            value={
              focusedBlock && focusedBlock.type !== 'page-break' && focusedBlock.fontFamily
                ? focusedBlock.fontFamily
                : paper.fontFamily
            }
            aria-label="Phông chữ"
            title="Chọn phông chữ (áp dụng cho vùng bôi đen, hoặc toàn đề nếu không bôi đen)"
            onChange={e => {
              const val = e.target.value;
              if (applyInlineStyleToSelection('fontFamily', val)) return;
              setPaper(p => ({ ...p, fontFamily: val, updatedAt: Date.now() }));
            }}
          >
            {(['Chuẩn đề thi (Có chân)', 'Hiện đại (Không chân)', 'Đơn cách (Tin học / Công thức)'] as const).map(grp => (
              <optgroup key={grp} label={grp}>
                {EXAM_FONT_CATALOG.filter(f => f.group === grp).map(f => (
                  <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            className="exam-select"
            value={paper.fontSizePt}
            aria-label="Cỡ chữ chung"
            title="Cỡ chữ chung toàn đề"
            onChange={e =>
              setPaper(p => ({ ...p, fontSizePt: Number(e.target.value), updatedAt: Date.now() }))
            }
          >
            {EXAM_FONT_SIZES.map(sz => (
              <option key={sz} value={sz}>
                Chung {sz}pt
              </option>
            ))}
          </select>
          <select
            className="exam-select"
            value={
              focusedBlock && focusedBlock.type !== 'page-break' && focusedBlock.fontSizePt
                ? String(focusedBlock.fontSizePt)
                : ''
            }
            aria-label="Cỡ chữ đoạn đang chọn"
            title="Chỉnh cỡ chữ riêng cho cụm chữ bôi đen hoặc đoạn đang chọn"
            onChange={e => {
              const raw = e.target.value;
              applyFormatCommand('fontSize', raw ? Number(raw) : undefined);
            }}
          >
            <option value="">Cỡ đoạn</option>
            {EXAM_FONT_SIZES.map(sz => (
              <option key={sz} value={sz}>
                Đoạn {sz}pt
              </option>
            ))}
          </select>
          <span className="exam-ribbon-sep" />
          <button
            className={`exam-icon-btn ${focusedBlock && focusedBlock.type !== 'page-break' && focusedBlock.bold ? 'is-active' : ''}`}
            onMouseDown={e => e.preventDefault()}
            title="In đậm (Ctrl+B)"
            onClick={() => applyFormatCommand('bold')}
          >
            <Bold size={15} />
          </button>
          <button
            className={`exam-icon-btn ${focusedBlock && focusedBlock.type !== 'page-break' && focusedBlock.italic ? 'is-active' : ''}`}
            onMouseDown={e => e.preventDefault()}
            title="In nghiêng (Ctrl+I)"
            onClick={() => applyFormatCommand('italic')}
          >
            <Italic size={15} />
          </button>
          <button
            className={`exam-icon-btn ${focusedBlock && focusedBlock.type !== 'page-break' && focusedBlock.underline ? 'is-active' : ''}`}
            onMouseDown={e => e.preventDefault()}
            title="Gạch chân (Ctrl+U)"
            onClick={() => applyFormatCommand('underline')}
          >
            <Underline size={15} />
          </button>
          <button
            className={`exam-icon-btn ${focusedBlock && focusedBlock.type !== 'page-break' && focusedBlock.strike ? 'is-active' : ''}`}
            onMouseDown={e => e.preventDefault()}
            title="Gạch ngang (Ctrl+Shift+S)"
            onClick={() => applyFormatCommand('strike')}
          >
            <Strikethrough size={15} />
          </button>
          <button
            className="exam-icon-btn"
            onMouseDown={e => e.preventDefault()}
            title="Chỉ số trên (x²)"
            onClick={() => applyFormatCommand('superscript')}
          >
            <Superscript size={15} />
          </button>
          <button
            className="exam-icon-btn"
            onMouseDown={e => e.preventDefault()}
            title="Chỉ số dưới (H₂O)"
            onClick={() => applyFormatCommand('subscript')}
          >
            <Subscript size={15} />
          </button>

          <div className="exam-ribbon-popwrap">
            <button
              className={`exam-icon-btn ${ribbonPicker === 'color' ? 'is-active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              title="Màu chữ (cho chữ bôi đen hoặc đoạn đang chọn)"
              onClick={() => setRibbonPicker(p => (p === 'color' ? null : 'color'))}
            >
              <Palette size={15} />
            </button>
            {ribbonPicker === 'color' && (
              <div className="exam-ribbon-popover" onMouseDown={e => e.preventDefault()}>
                <small className="exam-pop-label">Màu chữ</small>
                <div className="exam-color-grid">
                  {EXAM_TEXT_COLORS.map(c => (
                    <button
                      key={c.label}
                      type="button"
                      className="exam-color-swatch"
                      title={c.label}
                      style={{ background: c.value || '#111827' }}
                      onClick={() => {
                        applyFormatCommand('color', c.value);
                        setRibbonPicker(null);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="exam-ribbon-popwrap">
            <button
              className={`exam-icon-btn ${ribbonPicker === 'bg' ? 'is-active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              title="Tô màu nền (Highlight)"
              onClick={() => setRibbonPicker(p => (p === 'bg' ? null : 'bg'))}
            >
              <Highlighter size={15} />
            </button>
            {ribbonPicker === 'bg' && (
              <div className="exam-ribbon-popover" onMouseDown={e => e.preventDefault()}>
                <small className="exam-pop-label">Màu nền đoạn / chữ</small>
                <div className="exam-color-grid">
                  {EXAM_BG_COLORS.map(c => (
                    <button
                      key={c.label}
                      type="button"
                      className={`exam-color-swatch ${!c.value ? 'is-none' : ''}`}
                      title={c.label}
                      style={{ background: c.value || '#ffffff' }}
                      onClick={() => {
                        applyFormatCommand('bgColor', c.value);
                        setRibbonPicker(null);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {(['left', 'center', 'right', 'justify'] as const).map(al => (
            <button
              key={al}
              className={`exam-icon-btn ${focusedBlock && focusedBlock.type !== 'page-break' && focusedBlock.align === al ? 'is-active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              title={`Căn lề: ${al}`}
              onClick={() => {
                if (!focusedBlockId) return;
                updateBlockStyle(focusedBlockId, { align: al });
              }}
            >
              {al === 'left' ? (
                <AlignLeft size={15} />
              ) : al === 'center' ? (
                <AlignCenter size={15} />
              ) : al === 'right' ? (
                <AlignRight size={15} />
              ) : (
                <AlignJustify size={15} />
              )}
            </button>
          ))}
          <span className="exam-ribbon-sep" />
          <button
            className="exam-btn"
            onMouseDown={e => e.preventDefault()}
            onClick={() => setFormulaModal('math')}
            title="Chèn công thức Toán học (phân số, căn, hệ PT, tích phân, giới hạn, vectơ...)"
          >
            <Sigma size={15} /> Công thức
          </button>
          <button
            className="exam-btn"
            onMouseDown={e => e.preventDefault()}
            onClick={() => setFormulaModal('chem')}
            title="Chèn phương trình Hóa học & vẽ công thức cấu tạo phân tử"
          >
            <FlaskConical size={15} /> Phân tử &amp; Hóa
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
            onMouseDown={e => e.preventDefault()}
            onClick={() => imageUploadRef.current?.click()}
            title="Chèn ảnh từ máy tính vào câu đang chọn"
          >
            <ImagePlus size={15} /> Chèn ảnh
          </button>
          <button
            className={`exam-btn ${splitBoardOpen ? 'active' : 'purple'}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => setSplitBoardOpen(v => !v)}
            title="Mở khung công cụ dựng hình minh họa (3D, đồ thị, phân tử) để kéo hoặc bấm chèn vào đề"
          >
            <Shapes size={15} /> Dựng hình minh họa {splitBoardOpen ? '· Đang mở' : ''}
          </button>

          <div className="exam-download-wrap">
            <button
              className="exam-btn primary"
              onClick={() => setDownloadMenuOpen(v => !v)}
            >
              <Download size={15} /> Tải về <ChevronDown size={14} />
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
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={14} /> File Word (.docx) — Bản Học sinh
                  </strong>
                  <small>
                    Mở bằng Microsoft Word, công thức chuẩn Word sửa tiếp được, đã ẩn đáp án &amp; lời giải
                  </small>
                </button>
                <button
                  className="exam-download-item"
                  onClick={() => {
                    exportExamPaperToDocx(paper, 'teacher');
                    setDownloadMenuOpen(false);
                  }}
                >
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={14} /> File Word (.docx) — Bản Giáo viên
                  </strong>
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
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Printer size={14} /> PDF (In / Lưu PDF) — Bản phát cho Học sinh
                  </strong>
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
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Printer size={14} /> PDF (In / Lưu PDF) — Bản Giáo viên
                  </strong>
                  <small>Đầy đủ đáp án A/B/C/D, Đ/S và lời giải</small>
                </button>
                <button
                  className="exam-download-item"
                  onClick={pushToOnlineExamRoom}
                >
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Send size={14} /> Chuyển sang Phòng thi trực tuyến
                  </strong>
                  <small>
                    Trích xuất tự động các câu hỏi và đáp án sang Phòng thi HTVVM
                  </small>
                </button>
              </div>
            )}
          </div>

          <button className="exam-btn" onClick={onClose} title="Đóng trình soạn đề">
            <X size={15} />
          </button>
        </div>
      </header>

      {/* SUB-BAR: QUICK INSERT, MULTI-PAGE CONTROLS & SMART TYPING */}
      <div className="exam-subbar">
        <div className="exam-subbar-left">
          <button
            className="exam-chip-btn"
            onClick={() => insertParagraphBlock(focusedBlockId, 'text', '')}
            title="Thêm dòng gõ tự do (hoặc nhấp vào vùng trống trang giấy / gõ dấu /)"
          >
            <Plus size={13} /> Dòng văn bản (gõ /)
          </button>
          <button className="exam-chip-btn" onClick={() => addBlock('section')}>
            <Plus size={13} /> Chia PHẦN (I, II, III)
          </button>
          <button className="exam-chip-btn" onClick={() => addBlock('mcq')}>
            <Plus size={13} /> Câu trắc nghiệm (A–D)
          </button>
          <button className="exam-chip-btn" onClick={() => addBlock('tf')}>
            <Plus size={13} /> Câu Đúng / Sai (a–d)
          </button>
          <button className="exam-chip-btn" onClick={() => addBlock('short')}>
            <Plus size={13} /> Câu Trả lời ngắn / Tự luận
          </button>
          <button
            className="exam-chip-btn"
            style={{ borderColor: '#0d9488', color: '#0f766e', background: '#f0fdfa' }}
            onClick={addNewPage}
            title="Tạo ngay trang A4 tiếp theo (Trang 2, Trang 3…)"
          >
            <FilePlus2 size={13} /> Thêm trang mới
          </button>
          <button
            className="exam-chip-btn"
            style={{
              borderColor: smartComposerOpen ? '#7c3aed' : undefined,
              color: smartComposerOpen ? '#6d28d9' : undefined
            }}
            onClick={() => setSmartComposerOpen(v => !v)}
          >
            <Keyboard size={13} /> Gõ / Dán nhanh nhiều câu như Word
          </button>
          <button
            className="exam-chip-btn"
            style={{
              borderColor: headerFooterOpen ? '#2563eb' : undefined,
              color: headerFooterOpen ? '#1d4ed8' : undefined,
              background: headerFooterOpen ? '#eff6ff' : undefined
            }}
            onClick={() => setHeaderFooterOpen(v => !v)}
            title="Chỉnh sửa nội dung Header (đầu trang) và Footer (chân trang)"
          >
            <FileText size={13} /> Header &amp; Footer
          </button>
        </div>
        <div className="exam-subbar-right">
          <span className="exam-selection-badge" title="Mọi nút chèn công thức, ảnh hoặc thêm câu sẽ đặt tại khối này">
            {getFocusedSelectionLabel(paper.blocks, focusedBlockId, questionNumbers)}
          </span>
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

      {/* INLINE HEADER & FOOTER SETTINGS BAR */}
      {headerFooterOpen && (
        <div className="exam-hf-bar">
          <label className="exam-hf-field">
            <span>Header trang sau</span>
            <input
              className="exam-select"
              placeholder={paper.header.examTitle || 'Tiêu đề đầu trang…'}
              value={paper.header.runningHeaderText ?? ''}
              onChange={e =>
                setPaper(p => ({ ...p, header: { ...p.header, runningHeaderText: e.target.value }, updatedAt: Date.now() }))
              }
            />
          </label>
          <label className="exam-hf-field">
            <span>Footer trái</span>
            <input
              className="exam-select"
              placeholder={`Mã đề ${paper.header.examCode}`}
              value={paper.header.footerLeftText ?? ''}
              onChange={e =>
                setPaper(p => ({ ...p, header: { ...p.header, footerLeftText: e.target.value }, updatedAt: Date.now() }))
              }
            />
          </label>
          <label className="exam-hf-field">
            <span>Footer giữa (trang cuối)</span>
            <input
              className="exam-select"
              placeholder="—————— HẾT ——————"
              value={paper.header.footerCenterText ?? ''}
              onChange={e =>
                setPaper(p => ({ ...p, header: { ...p.header, footerCenterText: e.target.value }, updatedAt: Date.now() }))
              }
            />
          </label>
          <label className="exam-hf-field">
            <span>Chữ chuyển trang</span>
            <input
              className="exam-select"
              placeholder="(Xem tiếp trang sau)"
              value={paper.header.footerContinueText ?? ''}
              onChange={e =>
                setPaper(p => ({ ...p, header: { ...p.header, footerContinueText: e.target.value }, updatedAt: Date.now() }))
              }
            />
          </label>
          <div className="exam-hf-toggles">
            <label>
              <input
                type="checkbox"
                checked={paper.header.showRunningHeader !== false}
                onChange={e =>
                  setPaper(p => ({ ...p, header: { ...p.header, showRunningHeader: e.target.checked }, updatedAt: Date.now() }))
                }
              /> Hiện Header trang sau
            </label>
            <label>
              <input
                type="checkbox"
                checked={paper.header.showStudentInfo !== false}
                onChange={e =>
                  setPaper(p => ({ ...p, header: { ...p.header, showStudentInfo: e.target.checked }, updatedAt: Date.now() }))
                }
              /> Dòng Họ tên &amp; SBD
            </label>
            <label>
              <input
                type="checkbox"
                checked={paper.header.showFooter !== false}
                onChange={e =>
                  setPaper(p => ({ ...p, header: { ...p.header, showFooter: e.target.checked }, updatedAt: Date.now() }))
                }
              /> Hiện Footer
            </label>
            <label>
              <input
                type="checkbox"
                checked={paper.header.showPageNumbers !== false}
                onChange={e =>
                  setPaper(p => ({ ...p, header: { ...p.header, showPageNumbers: e.target.checked }, updatedAt: Date.now() }))
                }
              /> Hiện số trang
            </label>
          </div>
        </div>
      )}

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
            {pageIdx > 0 && paper.header.showRunningHeader !== false && (
              <div className="exam-a4-page-top">
                <div className="exam-hf-inline-row">
                  <input
                    className="exam-inline-input exam-hf-inline-input"
                    value={paper.header.runningHeaderText ?? paper.header.examTitle}
                    placeholder="Nhập Header đầu trang…"
                    title="Nhấp để sửa Header đầu trang"
                    onChange={e =>
                      setPaper(p => ({ ...p, header: { ...p.header, runningHeaderText: e.target.value }, updatedAt: Date.now() }))
                    }
                  />
                  {paper.header.showPageNumbers !== false && (
                    <strong style={{ whiteSpace: 'nowrap' }}>· Trang {pg.pageNumber}/{pages.length}</strong>
                  )}
                </div>
                {(pg.manualBreakId || pg.breakBeforeBlockId) && (
                  <button
                    type="button"
                    className="exam-page-break-chip"
                    onClick={() => removeManualPageBreak(pg.manualBreakId, pg.breakBeforeBlockId)}
                    title="Xóa ngắt trang thủ công để gộp lại với trang phía trên"
                  >
                    <Scissors size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ngắt trang thủ công · Bấm để gộp trang
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
                      placeholder="TÊN SỞ GD&ĐT"
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
                      placeholder="TÊN TRƯỜNG"
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
              const isReorderTarget = dragOverBlockId === block.id && draggingBlockId !== block.id;

              const onBlockDragOver = (e: React.DragEvent) => {
                e.preventDefault();
                if (draggingBlockId) {
                  if (dragOverBlockId !== block.id) setDragOverBlockId(block.id);
                } else if (block.type === 'question' || block.type === 'paragraph') {
                  if (dropTargetBlockId !== block.id) setDropTargetBlockId(block.id);
                }
              };
              const onBlockDragLeave = () => {
                if (dragOverBlockId === block.id) setDragOverBlockId(null);
                if (dropTargetBlockId === block.id) setDropTargetBlockId(null);
              };
              const onBlockDrop = (e: React.DragEvent) => {
                e.preventDefault();
                const draggedBlk = e.dataTransfer.getData('text/htvvm-block-id') || draggingBlockId;
                if (draggedBlk && draggedBlk !== block.id) {
                  setPaper(prev => ({
                    ...prev,
                    blocks: reorderExamBlock(prev.blocks, draggedBlk, block.id),
                    updatedAt: Date.now()
                  }));
                  setDraggingBlockId(null);
                  setDragOverBlockId(null);
                  return;
                }
                const srcId =
                  e.dataTransfer.getData('text/htvvm-figure-source') ||
                  draggingSourceId ||
                  activeSource?.id;
                if (srcId && (block.type === 'question' || block.type === 'paragraph')) {
                  insertFigureIntoBlock(srcId, block.id);
                }
              };

              if (block.type === 'section') {
                return (
                  <section
                    key={block.id}
                    className={`exam-block has-gutter ${isFocused ? 'is-focused' : ''} ${isReorderTarget ? 'is-reorder-target' : ''}`}
                    style={blockInlineCss(block)}
                    onClick={() => { setFocusedBlockId(block.id); setBlockMenu(null); }}
                    onDragOver={onBlockDragOver}
                    onDragLeave={onBlockDragLeave}
                    onDrop={onBlockDrop}
                  >
                    {renderGutter(block)}
                    <div className="exam-block-controls">
                      <button
                        className="exam-mini-action"
                        onMouseDown={e => e.preventDefault()}
                        title="Di chuyển phần này lên"
                        onClick={() => moveBlock(block.id, -1)}
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        className="exam-mini-action"
                        onMouseDown={e => e.preventDefault()}
                        title="Di chuyển phần này xuống"
                        onClick={() => moveBlock(block.id, 1)}
                      >
                        <ArrowDown size={11} />
                      </button>
                      <button
                        className={`exam-mini-action ${block.pageBreakBefore ? 'active' : ''}`}
                        onMouseDown={e => e.preventDefault()}
                        title="Đẩy phần này sang đầu trang A4 tiếp theo"
                        onClick={() => togglePageBreakBefore(block.id)}
                      >
                        <CornerDownLeft size={11} /> Sang trang
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
                        <Trash2 size={11} /> Xóa phần
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
                const variant = block.variant || 'text';
                const listIdx = numberedListIndexMap.get(block.id) || 1;
                const variantClass = `exam-para-variant-${variant}`;
                return (
                  <div
                    key={block.id}
                    className={`exam-block has-gutter exam-notion-para ${variantClass} ${isFocused ? 'is-focused' : ''} ${isDropTarget ? 'is-drop-target' : ''} ${isReorderTarget ? 'is-reorder-target' : ''}`}
                    style={blockInlineCss(block)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFocusedBlockId(block.id);
                      setBlockMenu(null);
                    }}
                    onDragOver={onBlockDragOver}
                    onDragLeave={onBlockDragLeave}
                    onDrop={onBlockDrop}
                  >
                    {renderGutter(block)}
                    <div className="exam-para-inner">
                      {variant === 'bullet' && <span className="exam-list-bullet" aria-hidden="true">•</span>}
                      {variant === 'numbered' && <span className="exam-list-num" aria-hidden="true">{listIdx}.</span>}
                      <RichEditableBlock
                        blockId={block.id}
                        field="text"
                        value={block.text}
                        variant={variant}
                        isFocused={isFocused}
                        slashMenuOpen={Boolean(slashMenu && slashMenu.blockId === block.id)}
                        placeholder={
                          variant === 'h1'
                            ? 'Tiêu đề lớn…'
                            : variant === 'h2'
                              ? 'Tiêu đề vừa…'
                              : variant === 'h3'
                                ? 'Tiêu đề nhỏ…'
                                : variant === 'callout'
                                  ? 'Ghi chú / lưu ý cho học sinh…'
                                  : 'Nhập nội dung hoặc gõ "/" để chèn câu hỏi, công thức, tiêu đề…'
                        }
                        onFocusBlock={() => {
                          setFocusedBlockId(block.id);
                          setEditingPromptId(null);
                          setBlockMenu(null);
                        }}
                        onChange={(sanitizedHtml) => {
                          setPaper(p => ({
                            ...p,
                            blocks: p.blocks.map(x =>
                              x.id === block.id && x.type === 'paragraph'
                                ? { ...x, text: sanitizedHtml }
                                : x
                            )
                          }));
                        }}
                        onEnterSplit={(beforeHtml, afterHtml) => handleSplitParagraph(block.id, beforeHtml, afterHtml)}
                        onBackspaceEmpty={() => handleBackspaceEmptyParagraph(block.id)}
                        onTurnIntoVariant={(nextVar, cleanHtml) => {
                          setPaper(p => ({
                            ...p,
                            blocks: p.blocks.map(x =>
                              x.id === block.id && x.type === 'paragraph'
                                ? { ...x, variant: nextVar, text: cleanHtml }
                                : x
                            ),
                            updatedAt: Date.now()
                          }));
                        }}
                        onNavigateVertical={(dir) => handleNavigateVertical(block.id, dir)}
                        onSlashTrigger={(info) => setSlashMenu(info)}
                        onSelectionChange={refreshSelectionToolbar}
                      />
                    </div>
                  </div>
                );
              }

              // QUESTION BLOCK
              const qNum = questionNumbers.get(block.id) || bIdx + 1;
              const isEditingPrompt = editingPromptId === block.id;

              return (
                <article
                  key={block.id}
                  className={`exam-block has-gutter ${isFocused ? 'is-focused' : ''} ${
                    isDropTarget ? 'is-drop-target' : ''
                  } ${isReorderTarget ? 'is-reorder-target' : ''}`}
                  style={blockInlineCss(block)}
                  onClick={() => { setFocusedBlockId(block.id); setBlockMenu(null); }}
                  onDragOver={onBlockDragOver}
                  onDragLeave={onBlockDragLeave}
                  onDrop={onBlockDrop}
                >
                  {renderGutter(block)}
                  {/* Floating Controls for Question */}
                  <div className="exam-block-controls">
                    <button
                      className="exam-mini-action"
                      onClick={() => {
                        if (isEditingPrompt) setEditingPromptId(null);
                        else {
                          setFocusedBlockId(block.id);
                          setEditingPromptId(block.id);
                          focusRichBlock(block.id, 'end');
                        }
                      }}
                    >
                      {isEditingPrompt ? <><Check size={11} /> Xong</> : <><Pencil size={11} /> Sửa đề</>}
                    </button>
                    <button
                      className="exam-mini-action"
                      onClick={() => {
                        setFocusedBlockId(block.id);
                        setSplitBoardOpen(true);
                      }}
                    >
                      <Shapes size={11} /> Dựng hình
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
                      <Plus size={11} /> Lời giải
                    </button>
                    <button
                      className="exam-mini-action"
                      onMouseDown={e => e.preventDefault()}
                      title="Đẩy câu lên trên"
                      onClick={() => moveBlock(block.id, -1)}
                    >
                      <ArrowUp size={11} />
                    </button>
                    <button
                      className="exam-mini-action"
                      onMouseDown={e => e.preventDefault()}
                      title="Đẩy câu xuống dưới"
                      onClick={() => moveBlock(block.id, 1)}
                    >
                      <ArrowDown size={11} />
                    </button>
                    <button
                      className="exam-mini-action"
                      onMouseDown={e => e.preventDefault()}
                      title="Nhân bản câu này ngay bên dưới"
                      onClick={() => duplicateBlock(block.id)}
                    >
                      <Copy size={11} /> Nhân bản
                    </button>
                    <button
                      className={`exam-mini-action ${block.pageBreakBefore ? 'active' : ''}`}
                      onMouseDown={e => e.preventDefault()}
                      title="Đẩy câu này sang đầu trang A4 tiếp theo"
                      onClick={() => togglePageBreakBefore(block.id)}
                    >
                      <CornerDownLeft size={11} /> Sang trang
                    </button>
                    <button
                      className="exam-mini-action danger"
                      title="Xóa câu này (các câu sau sẽ tự đánh số lại)"
                      onClick={() =>
                        setPaper(p => ({
                          ...p,
                          blocks: p.blocks.filter(x => x.id !== block.id)
                        }))
                      }
                    >
                      <Trash2 size={11} /> Xóa câu
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
                      <RichEditableBlock
                        blockId={block.id}
                        field="prompt"
                        value={block.prompt}
                        isFocused={isFocused || isEditingPrompt}
                        allowBlockSplit={false}
                        slashMenuOpen={Boolean(slashMenu && slashMenu.blockId === block.id)}
                        placeholder="Gõ nội dung câu hỏi trực tiếp… (bôi đen chữ để đổi màu/cỡ chữ, hoặc gõ / để chèn nhanh)"
                        onFocusBlock={() => {
                          setFocusedBlockId(block.id);
                          setEditingPromptId(block.id);
                          setBlockMenu(null);
                        }}
                        onBlurBlock={() => {
                          if (editingPromptId === block.id) setEditingPromptId(null);
                        }}
                        onChange={(sanitizedHtml) => {
                          const plain = stripRichHtmlToPlainText(sanitizedHtml);
                          const cleaned = sanitizedHtml.replace(/^\s*Câu\s*\d+\s*[.:]\s*/i, '');
                          const lines = plain.split(/\r?\n/);
                          const lastLine = lines[lines.length - 1] || '';
                          const autoOpts = parseInlineOptionsLine(lastLine);
                          if (autoOpts && lines.length > 1) {
                            const promptWithoutOpts = lines.slice(0, -1).join('<br>');
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
                        onNavigateVertical={(dir) => handleNavigateVertical(block.id, dir)}
                        onSlashTrigger={(info) => setSlashMenu(info)}
                        onSelectionChange={refreshSelectionToolbar}
                      />
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
                                <Pencil size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} /> Sửa hình
                              </button>
                              <button
                                className="danger"
                                title="Xóa hình này"
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
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                          <img
                            src={fig.src}
                            style={{ width: `${fig.width || 250}px` }}
                            alt="Hình minh họa câu hỏi"
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

            {pg.blocks.length === 0 ? (
              <div
                className="exam-notion-canvas-hint"
                onClick={() => ensureWritableBottomBlock(pg.blocks)}
              >
                Trang {pg.pageNumber} đang trống — <strong>nhấp vào đây để đặt con trỏ gõ ngay</strong>, hoặc gõ phím <code>/</code> để chèn câu hỏi, tiêu đề, công thức.
              </div>
            ) : (
              <div
                className="exam-notion-bottom-zone"
                title="Nhấp vào đây để gõ tiếp trên trang (hoặc gõ /)"
                onClick={() => ensureWritableBottomBlock(pg.blocks)}
              >
                Nhấp để gõ tiếp, hoặc nhập <code>/</code> để chèn nhanh…
              </div>
            )}

            {paper.header.showFooter !== false && (
              <footer className="exam-a4-footer">
                <input
                  className="exam-inline-input exam-hf-footer-input"
                  value={paper.header.footerLeftText ?? `Mã đề ${paper.header.examCode}`}
                  placeholder={`Mã đề ${paper.header.examCode}`}
                  title="Nhấp để sửa Footer bên trái"
                  onChange={e =>
                    setPaper(p => ({ ...p, header: { ...p.header, footerLeftText: e.target.value }, updatedAt: Date.now() }))
                  }
                />
                {pageIdx === pages.length - 1 ? (
                  <input
                    className="exam-inline-input exam-hf-footer-center exam-a4-end-mark"
                    value={paper.header.footerCenterText ?? '—————— HẾT ——————'}
                    placeholder="—————— HẾT ——————"
                    title="Nhấp để sửa chữ chân trang cuối"
                    onChange={e =>
                      setPaper(p => ({ ...p, header: { ...p.header, footerCenterText: e.target.value }, updatedAt: Date.now() }))
                    }
                  />
                ) : (
                  <input
                    className="exam-inline-input exam-hf-footer-center"
                    value={paper.header.footerContinueText ?? `(Xem tiếp Trang ${pg.pageNumber + 1})`}
                    placeholder={`(Xem tiếp Trang ${pg.pageNumber + 1})`}
                    title="Nhấp để sửa chữ chuyển trang"
                    onChange={e =>
                      setPaper(p => ({ ...p, header: { ...p.header, footerContinueText: e.target.value }, updatedAt: Date.now() }))
                    }
                  />
                )}
                {paper.header.showPageNumbers !== false && (
                  <strong style={{ whiteSpace: 'nowrap' }}>
                    Trang {pg.pageNumber} / {pages.length}
                  </strong>
                )}
              </footer>
            )}
          </article>
          ))}

          <button
            type="button"
            className="exam-add-page-below"
            onClick={addNewPage}
          >
            <FilePlus2 size={16} /> Thêm Trang {pages.length + 1} (Khổ A4)
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
                          Xóa bảng vẽ
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <ArrowLeft size={15} /> Chèn hình vào đề ({getFocusedSelectionLabel(paper.blocks, focusedBlockId, questionNumbers).replace('Đang chọn: ', '')})
                    </span>
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
              <h3 style={{ margin: 0, fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                {formulaModal === 'math' ? (
                  <><Sigma size={18} /> Bảng công thức Toán học (chuẩn sách giáo khoa)</>
                ) : (
                  <><FlaskConical size={18} /> Công thức Hóa học &amp; Cấu tạo Phân tử</>
                )}
              </h3>
              <button
                className="exam-btn"
                onClick={() => setFormulaModal(null)}
              >
                Đóng <X size={14} />
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
                    <Shapes size={14} /> Mở bảng vẽ Phân tử 2D
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
                  <Check size={14} /> Chèn công thức vào câu đang chọn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {slashMenu && (
        <SlashCommandMenu
          rect={slashMenu.rect}
          query={slashMenu.query}
          onSelect={handleSlashSelect}
          onClose={() => setSlashMenu(null)}
        />
      )}

      {selectionToolbar && !slashMenu && (
        <FloatingSelectionToolbar
          rect={selectionToolbar.rect}
          onCommand={(cmd, val) => applyFormatCommand(cmd, val)}
        />
      )}

      {blockMenu && (() => {
        const blk = paper.blocks.find(b => b.id === blockMenu.blockId);
        if (!blk || blk.type === 'page-break') return null;
        return (
          <BlockQuickMenu
            block={blk}
            rect={blockMenu.rect}
            onUpdateStyle={(patch) => updateBlockStyle(blk.id, patch)}
            onTurnVariant={
              blk.type === 'paragraph'
                ? (nextVar) =>
                    setPaper(prev => ({
                      ...prev,
                      blocks: prev.blocks.map(x =>
                        x.id === blk.id && x.type === 'paragraph' ? { ...x, variant: nextVar } : x
                      ),
                      updatedAt: Date.now()
                    }))
                : undefined
            }
            onDuplicate={() => duplicateBlock(blk.id)}
            onTogglePageBreak={() => togglePageBreakBefore(blk.id)}
            onDelete={() =>
              setPaper(prev => ({
                ...prev,
                blocks: prev.blocks.filter(x => x.id !== blk.id),
                updatedAt: Date.now()
              }))
            }
            onClose={() => setBlockMenu(null)}
          />
        );
      })()}
    </div>
  );
}
