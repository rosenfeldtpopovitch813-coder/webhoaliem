export type ExamFontEntry = {
  group: string;
  label: string;
  value: string;
  docxName: string;
};

export type ExamColorEntry = {
  label: string;
  value: string;
};

export type ExamRichRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  sup: boolean;
  sub: boolean;
  colorHex: string;
  bgHex: string;
  fontSizePt: number | null;
  fontFamily: string;
};

export declare const EXAM_FONT_CATALOG: ExamFontEntry[];
export declare const EXAM_FONT_SIZES: number[];
export declare const EXAM_TEXT_COLORS: ExamColorEntry[];
export declare const EXAM_BG_COLORS: ExamColorEntry[];

export declare function extractPrimaryFontName(fontCss?: string): string;
export declare function sanitizeFontFamily(raw?: string): string;
export declare function sanitizeColor(raw?: string): string;
export declare function sanitizeFontSizePt(raw?: string | number | null): number | null;
export declare function escapeHtmlText(raw?: string): string;
export declare function sanitizeInlineRichHtml(raw?: string): string;
export declare function cleanWordClipboardHtml(rawHtml?: string, fallbackPlain?: string): string;
export declare function matchLeadPrefix(plainLine?: string): { label: string; space: string; rest: string } | null;
export declare function autoFormatLeadPrefixHtml(rawHtml?: string, tag?: 'strong' | 'b'): string;
export declare function parseFlexibleOptionTokens(line?: string): Array<{ letter: string; text: string }>;
export declare function parseSmartExamClipboardText(rawText?: string): {
  prologue: string;
  blocks: Array<any>;
  questionCount: number;
};
export declare function isLikelyChemicalToken(token?: string): boolean;
export declare function autoNormalizeFormulaText(input?: string): string;
export declare function convertFormulaDisplayMode(
  rawText?: string,
  mode?: 'inline' | 'display' | 'boxed' | 'numbered',
  eqNumber?: number
): string;
export declare function stripFormattedHtmlTags(raw?: string): string;
export declare function stripRichHtmlToPlainText(raw?: string): string;
export declare function hasRichInlineTags(raw?: string): boolean;
export declare function hasMathNotation(raw?: string): boolean;
export declare function convertChemicalExprToLatex(ceExpr?: string): string;
export declare function expandCeCommands(input?: string): string;
export declare function prepareExamMathForKatex(rawMath?: string): string;
export declare function splitRichExamSegments(source?: string): Array<
  | { type: 'text'; raw: string }
  | { type: 'math'; raw: string; tex: string; displayMode: boolean }
>;
export declare function parseRichInlineRuns(
  raw?: string,
  baseStyle?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    textColor?: string;
    bgColor?: string;
    fontSizePt?: number;
    fontFamily?: string;
  }
): ExamRichRun[];
export declare function compileSafeMathExpression(rawFormula?: string): ((x: number) => number) | null;
