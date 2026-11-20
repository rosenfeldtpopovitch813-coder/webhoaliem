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
export declare function stripRichHtmlToPlainText(raw?: string): string;
export declare function hasRichInlineTags(raw?: string): boolean;
export declare function hasMathNotation(raw?: string): boolean;
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
