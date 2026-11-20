import React, { useEffect, useRef } from 'react';
import { ExamParagraphVariant } from '../../types/board';
import {
  autoFormatLeadPrefixHtml,
  autoNormalizeFormulaText,
  cleanWordClipboardHtml,
  convertFormulaDisplayMode,
  hasMathNotation,
  matchLeadPrefix,
  sanitizeColor,
  sanitizeFontFamily,
  sanitizeFontSizePt,
  sanitizeInlineRichHtml,
  stripRichHtmlToPlainText
} from '../../../../shared/exam-rich-text.js';
import { renderRichExamText } from './examTemplates';

export type InlineFormatCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'superscript'
  | 'subscript'
  | 'color'
  | 'bgColor'
  | 'fontSize'
  | 'fontFamily'
  | 'wrapMath'
  | 'wrapChem'
  | 'normalizeFormula'
  | 'formulaDisplay'
  | 'formulaBoxed'
  | 'formulaNumbered'
  | 'clear';

/**
 * Check if current DOM selection lies inside a live RichEditableBlock and is non-collapsed.
 */
export function getActiveRichSelection(): {
  host: HTMLElement;
  blockId: string;
  field: string;
  range: Range;
  text: string;
  rect: DOMRect;
} | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const text = sel.toString();
  if (!text.trim()) return null;
  const node = range.commonAncestorContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  const host = el?.closest<HTMLElement>('[data-rich-editable="true"]');
  if (!host) return null;
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;
  return {
    host,
    blockId: host.dataset.blockId || '',
    field: host.dataset.field || 'text',
    range,
    text,
    rect
  };
}

function wrapRangeWithElement(range: Range, tag: string, styleCss?: string) {
  const frag = range.extractContents();
  const wrapper = document.createElement(tag);
  if (styleCss) wrapper.setAttribute('style', styleCss);
  wrapper.appendChild(frag);
  range.insertNode(wrapper);
  const sel = window.getSelection();
  if (sel) {
    const nextRange = document.createRange();
    nextRange.selectNodeContents(wrapper);
    sel.removeAllRanges();
    sel.addRange(nextRange);
  }
}

/**
 * Apply an inline formatting action to the currently highlighted text inside a RichEditableBlock.
 * Returns true if an active selection was formatted, false if no text was selected (caller can fall back to block-level style).
 */
export function applyInlineStyleToSelection(command: InlineFormatCommand, value?: string | number): boolean {
  const active = getActiveRichSelection();
  if (!active) return false;
  const { host, range } = active;

  try {
    if (command === 'bold') {
      document.execCommand('bold', false);
    } else if (command === 'italic') {
      document.execCommand('italic', false);
    } else if (command === 'underline') {
      document.execCommand('underline', false);
    } else if (command === 'strike') {
      document.execCommand('strikeThrough', false);
    } else if (command === 'superscript') {
      document.execCommand('superscript', false);
    } else if (command === 'subscript') {
      document.execCommand('subscript', false);
    } else if (command === 'clear') {
      const plain = range.toString();
      range.deleteContents();
      const textNode = document.createTextNode(plain);
      range.insertNode(textNode);
      const sel = window.getSelection();
      if (sel) {
        const nr = document.createRange();
        nr.selectNodeContents(textNode);
        sel.removeAllRanges();
        sel.addRange(nr);
      }
    } else if (command === 'wrapMath' || command === 'wrapChem') {
      const plain = range.toString().trim();
      const wrapped = command === 'wrapChem' ? `$\\ce{${plain}}$` : `$${plain}$`;
      range.deleteContents();
      const textNode = document.createTextNode(wrapped);
      range.insertNode(textNode);
      const sel = window.getSelection();
      if (sel) {
        const nr = document.createRange();
        nr.setStartAfter(textNode);
        nr.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nr);
      }
    } else if (command === 'normalizeFormula') {
      const plain = range.toString();
      let normalized = autoNormalizeFormulaText(plain);
      if (normalized === plain && plain.trim()) {
        // If user selected a single expression that didn't trigger heuristic, wrap appropriately
        const trimmed = plain.trim();
        normalized = /(?:<=>|->|[A-Z][a-z]?\d)/.test(trimmed) ? `$\\ce{${trimmed}}$` : `$${trimmed}$`;
      }
      range.deleteContents();
      const textNode = document.createTextNode(normalized);
      range.insertNode(textNode);
      const sel = window.getSelection();
      if (sel) {
        const nr = document.createRange();
        nr.setStartAfter(textNode);
        nr.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nr);
      }
    } else if (command === 'formulaDisplay' || command === 'formulaBoxed' || command === 'formulaNumbered') {
      const plain = range.toString().trim();
      const mode = command === 'formulaDisplay' ? 'display' : command === 'formulaBoxed' ? 'boxed' : 'numbered';
      const transformed = convertFormulaDisplayMode(plain, mode, Number(value) || 1);
      range.deleteContents();
      const textNode = document.createTextNode(transformed);
      range.insertNode(textNode);
      const sel = window.getSelection();
      if (sel) {
        const nr = document.createRange();
        nr.setStartAfter(textNode);
        nr.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nr);
      }
    } else if (command === 'color') {
      const safe = sanitizeColor(String(value || ''));
      if (safe) wrapRangeWithElement(range, 'span', `color:${safe}`);
      else wrapRangeWithElement(range, 'span', 'color:#111827');
    } else if (command === 'bgColor') {
      const safe = sanitizeColor(String(value || ''));
      if (safe) wrapRangeWithElement(range, 'span', `background-color:${safe}`);
      else {
        const plain = range.toString();
        range.deleteContents();
        range.insertNode(document.createTextNode(plain));
      }
    } else if (command === 'fontSize') {
      const pt = sanitizeFontSizePt(value);
      if (pt !== null) wrapRangeWithElement(range, 'span', `font-size:${pt}pt`);
    } else if (command === 'fontFamily') {
      const ff = sanitizeFontFamily(String(value || ''));
      if (ff) wrapRangeWithElement(range, 'span', `font-family:${ff}`);
    }
  } catch {
    return false;
  }

  host.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

export function focusRichBlock(blockId: string, position: 'start' | 'end' = 'end') {
  window.requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-rich-editable="true"][data-block-id="${CSS.escape(blockId)}"]`);
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(position === 'start');
    sel.removeAllRanges();
    sel.addRange(range);
  });
}

type Props = {
  blockId: string;
  field?: string;
  value: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  isFocused: boolean;
  allowBlockSplit?: boolean;
  disableAutoPrefixBold?: boolean;
  variant?: ExamParagraphVariant;
  slashMenuOpen?: boolean;
  onFocusBlock: () => void;
  onChange: (sanitizedHtml: string) => void;
  onEnterSplit?: (beforeHtml: string, afterHtml: string) => void;
  onBackspaceEmpty?: () => void;
  onTurnIntoVariant?: (variant: ExamParagraphVariant, cleanHtml: string) => void;
  onNavigateVertical?: (dir: -1 | 1) => void;
  onSlashTrigger?: (info: { blockId: string; query: string; rect: DOMRect } | null) => void;
  onPasteMultiParagraph?: (pastedHtml: string, beforeHtml: string, afterHtml: string) => void;
  onPasteImageFile?: (file: File) => void;
  onNormalizeBlockFormula?: () => void;
  onSelectionChange?: () => void;
  onBlurBlock?: () => void;
};

function extractBeforeAfterHtmlAtSelection(el: HTMLElement): [string, string] {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).startContainer)) {
    const range = sel.getRangeAt(0);
    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(el);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const afterRange = document.createRange();
    afterRange.selectNodeContents(el);
    afterRange.setStart(range.endContainer, range.endOffset);
    const bDiv = document.createElement('div');
    bDiv.appendChild(beforeRange.cloneContents());
    const aDiv = document.createElement('div');
    aDiv.appendChild(afterRange.cloneContents());
    return [sanitizeInlineRichHtml(bDiv.innerHTML), sanitizeInlineRichHtml(aDiv.innerHTML)];
  }
  return [sanitizeInlineRichHtml(el.innerHTML), ''];
}

function insertHtmlAtSelection(el: HTMLElement, html: string) {
  el.focus();
  const sel = window.getSelection();
  if (!sel) {
    el.innerHTML += html;
    return;
  }
  let range: Range;
  if (sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).startContainer)) {
    range = sel.getRangeAt(0);
  } else {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  range.deleteContents();
  const frag = range.createContextualFragment(html);
  const lastNode = frag.lastChild;
  range.insertNode(frag);
  if (lastNode) {
    const nextRange = document.createRange();
    nextRange.setStartAfter(lastNode);
    nextRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(nextRange);
  }
}

function getCaretCoordinates(fallbackEl: HTMLElement): DOMRect {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0).cloneRange();
    r.collapse(true);
    const rects = r.getClientRects();
    if (rects.length > 0 && rects[0].height > 0) return rects[0];
  }
  return fallbackEl.getBoundingClientRect();
}

function getTextBeforeCaret(root: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return '';
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString();
}

function isCaretAtEdge(root: HTMLElement, edge: 'start' | 'end'): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return false;
  const probe = range.cloneRange();
  probe.selectNodeContents(root);
  if (edge === 'start') {
    probe.setEnd(range.startContainer, range.startOffset);
    return probe.toString().length === 0;
  }
  probe.setStart(range.endContainer, range.endOffset);
  return probe.toString().length === 0;
}

export default function RichEditableBlock({
  blockId,
  field = 'text',
  value,
  placeholder = 'Nhập nội dung hoặc gõ "/" để chèn nhanh…',
  className = '',
  style,
  isFocused,
  allowBlockSplit = true,
  disableAutoPrefixBold = false,
  slashMenuOpen = false,
  onFocusBlock,
  onChange,
  onEnterSplit,
  onBackspaceEmpty,
  onTurnIntoVariant,
  onNavigateVertical,
  onSlashTrigger,
  onPasteMultiParagraph,
  onPasteImageFile,
  onNormalizeBlockFormula,
  onSelectionChange,
  onBlurBlock
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastEmittedRef = useRef<string>(value);
  const containsMath = hasMathNotation(value);
  const showRenderedMathView = containsMath && !isFocused;

  useEffect(() => {
    const el = ref.current;
    if (!el || showRenderedMathView) return;
    const sanitized = sanitizeInlineRichHtml(value);
    if (document.activeElement !== el || sanitized !== lastEmittedRef.current) {
      if (el.innerHTML !== sanitized) {
        el.innerHTML = sanitized;
      }
      lastEmittedRef.current = sanitized;
    }
  }, [value, showRenderedMathView]);

  const tryAutoBoldLeadPrefixInDom = (el: HTMLElement): boolean => {
    if (disableAutoPrefixBold) return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    // Only auto-bold when the text node is at the start of the block or right after a <br>
    const prev = node.previousSibling;
    const isLineStart = !prev || (prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).tagName === 'BR');
    if (!isLineStart) return false;
    // Also skip if already inside a <strong> or <b>
    if (node.parentElement && node.parentElement !== el && /^(STRONG|B)$/i.test(node.parentElement.tagName)) {
      return false;
    }
    const text = (node.nodeValue || '').replace(/\u00A0/g, ' ');
    const hit = matchLeadPrefix(text);
    if (!hit) return false;

    const strong = document.createElement('strong');
    strong.textContent = hit.label;
    const normalAfter = document.createTextNode(' ' + (hit.rest || ''));
    const parent = node.parentNode;
    if (!parent) return false;
    parent.insertBefore(strong, node);
    parent.insertBefore(normalAfter, node);
    parent.removeChild(node);

    // Ensure browser typing state does not keep bold active and place caret right after the space in normalAfter
    try {
      if (document.queryCommandState?.('bold')) {
        document.execCommand('bold', false);
      }
    } catch {
      /* ignore */
    }
    const nextRange = document.createRange();
    const caretPos = Math.min(normalAfter.length, 1 + (hit.rest ? hit.rest.length : 0));
    nextRange.setStart(normalAfter, caretPos);
    nextRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(nextRange);
    return true;
  };

  const emitChangeFromDom = () => {
    const el = ref.current;
    if (!el) return;
    tryAutoBoldLeadPrefixInDom(el);
    let cleaned = sanitizeInlineRichHtml(el.innerHTML);
    if (!disableAutoPrefixBold) {
      cleaned = autoFormatLeadPrefixHtml(cleaned);
    }
    lastEmittedRef.current = cleaned;
    onChange(cleaned);

    // Check Notion-style Markdown shortcuts at start of block
    if (onTurnIntoVariant) {
      const plain = stripRichHtmlToPlainText(cleaned);
      const mdRules: Array<[RegExp, ExamParagraphVariant]> = [
        [/^###\s(.*)$/, 'h3'],
        [/^##\s(.*)$/, 'h2'],
        [/^#\s(.*)$/, 'h1'],
        [/^[-*]\s(.*)$/, 'bullet'],
        [/^1\.\s(.*)$/, 'numbered'],
        [/^>\s(.*)$/, 'callout']
      ];
      for (const [re, nextVar] of mdRules) {
        const match = plain.match(re);
        if (match) {
          const rest = match[1] || '';
          el.innerHTML = sanitizeInlineRichHtml(rest);
          lastEmittedRef.current = el.innerHTML;
          onTurnIntoVariant(nextVar, el.innerHTML);
          onSlashTrigger?.(null);
          return;
        }
      }
    }

    // Check Slash Command trigger ("/" at start or after space)
    if (onSlashTrigger) {
      const before = getTextBeforeCaret(el);
      const slashMatch = /(?:^|\s)\/([^\s/]{0,24})$/.exec(before);
      if (slashMatch) {
        onSlashTrigger({
          blockId,
          query: slashMatch[1] || '',
          rect: getCaretCoordinates(el)
        });
      } else {
        onSlashTrigger(null);
      }
    }
  };

  if (showRenderedMathView) {
    return (
      <div
        className={`exam-rich-rendered ${className}`}
        style={style}
        data-block-id={blockId}
        onClick={e => {
          e.stopPropagation();
          onFocusBlock();
          focusRichBlock(blockId, 'end');
        }}
        dangerouslySetInnerHTML={{
          __html: renderRichExamText(value) || `<span class="exam-rich-placeholder">${placeholder}</span>`
        }}
      />
    );
  }

  return (
    <div className="exam-rich-wrap">
      <div
        ref={ref}
        className={`exam-rich-editable ${className}`}
        style={style}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-rich-editable="true"
        data-block-id={blockId}
        data-field={field}
        data-placeholder={placeholder}
        onFocus={() => onFocusBlock()}
        onBlur={() => {
          onBlurBlock?.();
        }}
        onInput={() => emitChangeFromDom()}
        onMouseUp={() => onSelectionChange?.()}
        onKeyUp={() => onSelectionChange?.()}
        onPaste={e => {
          e.preventDefault();
          const html = e.clipboardData.getData('text/html');
          const plain = e.clipboardData.getData('text/plain');
          const safe = cleanWordClipboardHtml(html, plain);
          const hasText = Boolean(stripRichHtmlToPlainText(safe).trim());
          if (!hasText && onPasteImageFile) {
            const imgFile = Array.from(e.clipboardData.files || []).find(f => f.type.startsWith('image/'));
            if (imgFile) {
              onPasteImageFile(imgFile);
              return;
            }
          }
          if (!hasText) return;
          const el = ref.current;
          if (allowBlockSplit && onPasteMultiParagraph && /<\s*br\s*\/?>/i.test(safe)) {
            const [beforeHtml, afterHtml] = el
              ? extractBeforeAfterHtmlAtSelection(el)
              : [sanitizeInlineRichHtml(value), ''];
            onPasteMultiParagraph(safe, beforeHtml, afterHtml);
            onSlashTrigger?.(null);
            return;
          }
          if (el) {
            insertHtmlAtSelection(el, safe);
            const cleaned = sanitizeInlineRichHtml(el.innerHTML);
            lastEmittedRef.current = cleaned;
            onChange(cleaned);
          } else {
            onChange(safe);
          }
        }}
        onKeyDown={e => {
          if (slashMenuOpen && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
            return; // Handled by parent Slash Menu listener
          }
          const el = ref.current;
          if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            const k = e.key.toLowerCase();
            if (k === 'b') { e.preventDefault(); applyInlineStyleToSelection('bold'); return; }
            if (k === 'i' && e.shiftKey) { e.preventDefault(); applyInlineStyleToSelection('italic'); return; }
            if (k === 'i' && !e.shiftKey) {
              e.preventDefault();
              // Ctrl + I: Auto-normalize formulas in selection or across the entire focused field
              if (applyInlineStyleToSelection('normalizeFormula')) {
                return;
              }
              if (onNormalizeBlockFormula) {
                onNormalizeBlockFormula();
                return;
              }
              if (el) {
                const normalized = autoNormalizeFormulaText(sanitizeInlineRichHtml(el.innerHTML));
                el.innerHTML = normalized;
                lastEmittedRef.current = normalized;
                onChange(normalized);
                focusRichBlock(blockId, 'end');
              }
              return;
            }
            if (k === 'u') { e.preventDefault(); applyInlineStyleToSelection('underline'); return; }
            if (e.shiftKey && k === 's') { e.preventDefault(); applyInlineStyleToSelection('strike'); return; }
          }
          if (!el) return;

          if (e.key === 'Enter' && !e.shiftKey && allowBlockSplit && onEnterSplit) {
            e.preventDefault();
            const [beforeHtml, afterHtml] = extractBeforeAfterHtmlAtSelection(el);
            onEnterSplit(beforeHtml, afterHtml);
            onSlashTrigger?.(null);
            return;
          }

          if (e.key === 'Backspace' && onBackspaceEmpty) {
            const plain = stripRichHtmlToPlainText(el.innerHTML);
            if (!plain && isCaretAtEdge(el, 'start')) {
              e.preventDefault();
              onBackspaceEmpty();
              onSlashTrigger?.(null);
              return;
            }
          }

          if (e.key === 'ArrowUp' && onNavigateVertical && isCaretAtEdge(el, 'start')) {
            e.preventDefault();
            onNavigateVertical(-1);
          } else if (e.key === 'ArrowDown' && onNavigateVertical && isCaretAtEdge(el, 'end')) {
            e.preventDefault();
            onNavigateVertical(1);
          }
        }}
      />
    </div>
  );
}
