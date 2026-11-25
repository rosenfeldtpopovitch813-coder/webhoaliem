export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'ESSAY';

export type AnswerDetectionSource =
  | 'underline'
  | 'color'
  | 'highlight'
  | 'bold'
  | 'asterisk'
  | 'answer_table'
  | 'inline_text'
  | 'latex'
  | 'manual';

export interface StyledRun {
  text: string;
  kind: 'text' | 'math_inline' | 'math_block' | 'image' | 'html_table' | 'break' | 'tab';
  imageDataUrl?: string;
  tableHtml?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  colorHex?: string;
  highlight?: string;
}

export interface NormalizedParagraph {
  id: string;
  listPrefix?: string;
  runs: StyledRun[];
  plainText: string;
  inTableCell?: { row: number; col: number; totalCols: number };
}

export interface ExamOption {
  id: string;
  label: string;
  content: string;
  cropImage?: string;
  isCorrect: boolean;
  detectionSource?: AnswerDetectionSource;
}

export interface ExamQuestion {
  id: string;
  index: number;
  partIndex?: number;
  localIndex?: number;
  partTitle?: string;
  type: QuestionType;
  stem: string;
  stemCropImage?: string;
  options: ExamOption[];
  acceptedAnswers: string[];
  explanation: string;
  points: number;
  isFixedPosition: boolean;
  lockOptionOrder: boolean;
  warnings: string[];
  sourceMeta?: {
    pageNumber?: number;
    pdfRect?: { x: number; y: number; w: number; h: number };
  };
}

export interface PdfPagePreview {
  pageNumber: number;
  width: number;
  height: number;
  imageDataUrl: string;
  boxes: PdfCropBox[];
}

export interface PdfCropBox {
  id: string;
  kind: 'question' | 'option';
  questionId: string;
  questionIndex: number;
  optionLabel?: string;
  pageNumber: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParseResult {
  title: string;
  sourceFileName: string;
  sourceFormat: 'docx' | 'pdf_text' | 'pdf_crop' | 'latex' | 'text' | 'exam_paper';
  questions: ExamQuestion[];
  stats: {
    total: number;
    singleChoice: number;
    multipleChoice: number;
    trueFalse: number;
    shortAnswer: number;
    essay: number;
    withAnswerKey: number;
    withWarnings: number;
    mathFormulasDetected: number;
    imagesExtracted: number;
    answerTableMatched: number;
  };
  rawPreviewText: string;
  pdfPages?: PdfPagePreview[];
  parseDurationMs: number;
}

export interface ScoringConfigState {
  preset: 'math_2025' | 'science_2025' | 'social_it_2025' | 'custom';
  perQuestion: { I: number; II: number; III: number };
  partTotals?: { I: number; II: number; III: number };
  normalizeTo10: boolean;
}
