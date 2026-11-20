import React, { useEffect, useMemo, useState } from 'react';
import {
  Bold,
  Copy,
  CornerDownLeft,
  Eraser,
  FlaskConical,
  Highlighter,
  Italic,
  Palette,
  Sigma,
  Strikethrough,
  Subscript,
  Superscript,
  Trash2,
  Underline
} from 'lucide-react';
import { ExamBlock, ExamBlockStyle, ExamParagraphVariant } from '../../types/board';
import {
  EXAM_BG_COLORS,
  EXAM_FONT_CATALOG,
  EXAM_FONT_SIZES,
  EXAM_TEXT_COLORS
} from './examTemplates';
import { InlineFormatCommand } from './RichEditableBlock';

export type SlashActionId =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'numbered'
  | 'callout'
  | 'section'
  | 'mcq'
  | 'tf'
  | 'short'
  | 'essay'
  | 'math'
  | 'chem'
  | 'figure'
  | 'page-break';

type SlashOption = {
  id: SlashActionId;
  group: 'Văn bản' | 'Đề thi & Công thức';
  badge: string;
  label: string;
  desc: string;
  keywords: string;
};

export const SLASH_OPTIONS: SlashOption[] = [
  { id: 'text', group: 'Văn bản', badge: 'T', label: 'Đoạn văn bản', desc: 'Gõ chữ tự do bình thường', keywords: 'text doan van ban paragraph' },
  { id: 'h1', group: 'Văn bản', badge: 'H1', label: 'Tiêu đề lớn (H1)', desc: 'Tiêu đề chính cỡ lớn in đậm', keywords: 'h1 tieu de lon heading 1' },
  { id: 'h2', group: 'Văn bản', badge: 'H2', label: 'Tiêu đề vừa (H2)', desc: 'Tiêu đề mục phụ rõ ràng', keywords: 'h2 tieu de vua heading 2' },
  { id: 'h3', group: 'Văn bản', badge: 'H3', label: 'Tiêu đề nhỏ (H3)', desc: 'Đề mục nhỏ in đậm', keywords: 'h3 tieu de nho heading 3' },
  { id: 'bullet', group: 'Văn bản', badge: '•', label: 'Danh sách gạch đầu dòng', desc: 'Tạo ý liệt kê dấu chấm tròn', keywords: 'bullet list danh sach gach dau dong cham' },
  { id: 'numbered', group: 'Văn bản', badge: '1.', label: 'Danh sách đánh số', desc: 'Tạo danh sách tự tăng 1, 2, 3', keywords: 'numbered list danh sach danh so' },
  { id: 'callout', group: 'Văn bản', badge: '!', label: 'Hộp ghi chú / Lưu ý', desc: 'Khung nổi bật cho hướng dẫn, chú thích', keywords: 'callout quote luu y ghi chu trich dan' },
  { id: 'section', group: 'Đề thi & Công thức', badge: 'I.', label: 'Chia PHẦN đề thi', desc: 'PHẦN I, PHẦN II, PHẦN III...', keywords: 'phan section phan thi' },
  { id: 'mcq', group: 'Đề thi & Công thức', badge: 'A–D', label: 'Câu Trắc nghiệm (A–D)', desc: '4 phương án chia 1 / 2 / 4 cột + đáp án', keywords: 'mcq trac nghiem a b c d cau hoi' },
  { id: 'tf', group: 'Đề thi & Công thức', badge: 'Đ/S', label: 'Câu Đúng / Sai (4 ý)', desc: '4 mệnh đề a, b, c, d chọn Đ/S', keywords: 'tf dung sai menh de' },
  { id: 'short', group: 'Đề thi & Công thức', badge: '123', label: 'Câu Trả lời ngắn', desc: 'Ô đáp án số/ngắn + lời giải', keywords: 'short tra loi ngan dap so' },
  { id: 'essay', group: 'Đề thi & Công thức', badge: 'TL', label: 'Câu Tự luận', desc: 'Đề bài tự luận kèm lời giải chi tiết', keywords: 'essay tu luan' },
  { id: 'math', group: 'Đề thi & Công thức', badge: '∑', label: 'Chèn công thức Toán', desc: 'Mở bảng công thức KaTeX (phân số, tích phân…)', keywords: 'math toan cong thuc latex katex' },
  { id: 'chem', group: 'Đề thi & Công thức', badge: 'H₂O', label: 'Phương trình & Phân tử Hóa', desc: 'Chèn \\ce{...} hoặc sơ đồ cấu tạo phân tử', keywords: 'chem hoa phuong trinh phan tu' },
  { id: 'figure', group: 'Đề thi & Công thức', badge: '3D', label: 'Dựng hình minh họa', desc: 'Hình 3D, đồ thị hàm số, vẽ tay tự do', keywords: 'figure hinh ve do thi 3d minh hoa' },
  { id: 'page-break', group: 'Đề thi & Công thức', badge: '---', label: 'Ngắt sang trang mới', desc: 'Đẩy nội dung sau sang trang A4 tiếp theo', keywords: 'page break ngat trang moi a4' }
];

function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .trim();
}

export function SlashCommandMenu({
  rect,
  query,
  onSelect,
  onClose
}: {
  rect: DOMRect;
  query: string;
  onSelect: (action: SlashActionId) => void;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return SLASH_OPTIONS;
    return SLASH_OPTIONS.filter(
      (opt) =>
        normalizeSearch(opt.label).includes(q) ||
        normalizeSearch(opt.desc).includes(q) ||
        opt.keywords.includes(q)
    );
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const chosen = filtered[activeIndex];
        if (chosen) onSelect(chosen.id);
        else onClose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [filtered, activeIndex, onSelect, onClose]);

  const top = Math.min(window.innerHeight - 320, Math.max(60, rect.bottom + 6));
  const left = Math.min(window.innerWidth - 310, Math.max(12, rect.left));

  return (
    <div
      className="exam-slash-menu"
      style={{ top, left }}
      onMouseDown={(e) => e.preventDefault()}
      role="listbox"
      aria-label="Chèn nhanh khối nội dung"
    >
      <div className="exam-slash-head">
        <span>Chèn nhanh</span>
        <small>{query ? `Lọc: /${query}` : '↑↓ chọn · Enter chèn'}</small>
      </div>
      {filtered.length === 0 ? (
        <div className="exam-slash-empty">Không có mục khớp “/{query}”</div>
      ) : (
        <div className="exam-slash-list">
          {filtered.map((opt, idx) => {
            const showGroup = idx === 0 || filtered[idx - 1].group !== opt.group;
            return (
              <React.Fragment key={opt.id}>
                {showGroup && <div className="exam-slash-group">{opt.group}</div>}
                <button
                  type="button"
                  className={`exam-slash-item ${idx === activeIndex ? 'is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => onSelect(opt.id)}
                >
                  <span className="exam-slash-badge">{opt.badge}</span>
                  <span className="exam-slash-copy">
                    <strong>{opt.label}</strong>
                    <small>{opt.desc}</small>
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FloatingSelectionToolbar({
  rect,
  onCommand
}: {
  rect: DOMRect;
  onCommand: (cmd: InlineFormatCommand, value?: string | number) => void;
}) {
  const [openPicker, setOpenPicker] = useState<'color' | 'bg' | 'size' | null>(null);

  const top = Math.max(54, rect.top - 48);
  const left = Math.min(window.innerWidth - 430, Math.max(12, rect.left + rect.width / 2 - 205));

  return (
    <div
      className="exam-bubble-bar"
      style={{ top, left }}
      onMouseDown={(e) => e.preventDefault()}
      role="toolbar"
      aria-label="Định dạng đoạn chữ đang chọn"
    >
      <button type="button" className="exam-bubble-btn" title="In đậm (Ctrl+B)" onClick={() => onCommand('bold')}>
        <Bold size={14} />
      </button>
      <button type="button" className="exam-bubble-btn" title="In nghiêng (Ctrl+I)" onClick={() => onCommand('italic')}>
        <Italic size={14} />
      </button>
      <button type="button" className="exam-bubble-btn" title="Gạch chân (Ctrl+U)" onClick={() => onCommand('underline')}>
        <Underline size={14} />
      </button>
      <button type="button" className="exam-bubble-btn" title="Gạch ngang (Ctrl+Shift+S)" onClick={() => onCommand('strike')}>
        <Strikethrough size={14} />
      </button>
      <button type="button" className="exam-bubble-btn" title="Chỉ số trên (x²)" onClick={() => onCommand('superscript')}>
        <Superscript size={14} />
      </button>
      <button type="button" className="exam-bubble-btn" title="Chỉ số dưới (H₂O)" onClick={() => onCommand('subscript')}>
        <Subscript size={14} />
      </button>

      <span className="exam-bubble-sep" />

      <div className="exam-bubble-popwrap">
        <button
          type="button"
          className={`exam-bubble-btn is-text ${openPicker === 'size' ? 'is-open' : ''}`}
          title="Cỡ chữ cho đoạn đang chọn"
          onClick={() => setOpenPicker((p) => (p === 'size' ? null : 'size'))}
        >
          Cỡ chữ ▾
        </button>
        {openPicker === 'size' && (
          <div className="exam-bubble-popover is-sizes">
            {EXAM_FONT_SIZES.map((sz) => (
              <button
                key={sz}
                type="button"
                className="exam-bubble-size-opt"
                onClick={() => {
                  onCommand('fontSize', sz);
                  setOpenPicker(null);
                }}
              >
                {sz} pt
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="exam-bubble-popwrap">
        <button
          type="button"
          className={`exam-bubble-btn ${openPicker === 'color' ? 'is-open' : ''}`}
          title="Màu chữ"
          onClick={() => setOpenPicker((p) => (p === 'color' ? null : 'color'))}
        >
          <Palette size={14} />
        </button>
        {openPicker === 'color' && (
          <div className="exam-bubble-popover">
            <small className="exam-pop-label">Màu chữ</small>
            <div className="exam-color-grid">
              {EXAM_TEXT_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className="exam-color-swatch"
                  title={c.label}
                  style={{ background: c.value || '#111827' }}
                  onClick={() => {
                    onCommand('color', c.value);
                    setOpenPicker(null);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="exam-bubble-popwrap">
        <button
          type="button"
          className={`exam-bubble-btn ${openPicker === 'bg' ? 'is-open' : ''}`}
          title="Màu tô nền (Highlight)"
          onClick={() => setOpenPicker((p) => (p === 'bg' ? null : 'bg'))}
        >
          <Highlighter size={14} />
        </button>
        {openPicker === 'bg' && (
          <div className="exam-bubble-popover">
            <small className="exam-pop-label">Tô màu nền</small>
            <div className="exam-color-grid">
              {EXAM_BG_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className={`exam-color-swatch ${!c.value ? 'is-none' : ''}`}
                  title={c.label}
                  style={{ background: c.value || '#ffffff' }}
                  onClick={() => {
                    onCommand('bgColor', c.value);
                    setOpenPicker(null);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <span className="exam-bubble-sep" />

      <button type="button" className="exam-bubble-btn" title="Bọc công thức Toán ($...$)" onClick={() => onCommand('wrapMath')}>
        <Sigma size={14} />
      </button>
      <button type="button" className="exam-bubble-btn" title="Bọc công thức Hóa ($\ce{...}$)" onClick={() => onCommand('wrapChem')}>
        <FlaskConical size={14} />
      </button>
      <button type="button" className="exam-bubble-btn" title="Xóa định dạng đoạn đang chọn" onClick={() => onCommand('clear')}>
        <Eraser size={14} />
      </button>
    </div>
  );
}

export function BlockQuickMenu({
  block,
  rect,
  onUpdateStyle,
  onTurnVariant,
  onDuplicate,
  onTogglePageBreak,
  onDelete,
  onClose
}: {
  block: Exclude<ExamBlock, { type: 'page-break' }>;
  rect: DOMRect;
  onUpdateStyle: (patch: Partial<ExamBlockStyle>) => void;
  onTurnVariant?: (variant: ExamParagraphVariant) => void;
  onDuplicate: () => void;
  onTogglePageBreak: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const top = Math.min(window.innerHeight - 360, Math.max(58, rect.top));
  const left = Math.min(window.innerWidth - 280, Math.max(12, rect.left + 26));

  return (
    <div
      className="exam-block-menu"
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="exam-block-menu-head">
        <strong>Định dạng khối</strong>
        <button type="button" onClick={onClose} aria-label="Đóng">✕</button>
      </div>

      {block.type === 'paragraph' && onTurnVariant && (
        <div className="exam-block-menu-section">
          <small>Chuyển kiểu đoạn</small>
          <div className="exam-block-menu-chips">
            {([
              ['text', 'Văn bản'],
              ['h1', 'H1'],
              ['h2', 'H2'],
              ['h3', 'H3'],
              ['bullet', '• Ý'],
              ['numbered', '1. Số'],
              ['callout', 'Lưu ý']
            ] as Array<[ExamParagraphVariant, string]>).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={(block.variant || 'text') === v ? 'is-active' : ''}
                onClick={() => onTurnVariant(v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="exam-block-menu-section">
        <small>Phông &amp; cỡ chữ riêng cho đoạn này</small>
        <div className="exam-block-menu-row">
          <select
            className="exam-select"
            value={block.fontFamily || ''}
            onChange={(e) => onUpdateStyle({ fontFamily: e.target.value || undefined })}
          >
            <option value="">Theo phông chung</option>
            {EXAM_FONT_CATALOG.map((f) => (
              <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            className="exam-select"
            value={block.fontSizePt || ''}
            onChange={(e) => onUpdateStyle({ fontSizePt: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">Cỡ chung</option>
            {EXAM_FONT_SIZES.map((sz) => (
              <option key={sz} value={sz}>{sz} pt</option>
            ))}
          </select>
        </div>
      </div>

      <div className="exam-block-menu-section">
        <small>Màu chữ khối</small>
        <div className="exam-color-grid">
          {EXAM_TEXT_COLORS.map((c) => (
            <button
              key={c.label}
              type="button"
              className={`exam-color-swatch ${(block.textColor || '') === c.value ? 'is-selected' : ''}`}
              title={c.label}
              style={{ background: c.value || '#111827' }}
              onClick={() => onUpdateStyle({ textColor: c.value || undefined })}
            />
          ))}
        </div>
      </div>

      <div className="exam-block-menu-section">
        <small>Màu nền khối</small>
        <div className="exam-color-grid">
          {EXAM_BG_COLORS.map((c) => (
            <button
              key={c.label}
              type="button"
              className={`exam-color-swatch ${!c.value ? 'is-none' : ''} ${(block.bgColor || '') === c.value ? 'is-selected' : ''}`}
              title={c.label}
              style={{ background: c.value || '#ffffff' }}
              onClick={() => onUpdateStyle({ bgColor: c.value || undefined })}
            />
          ))}
        </div>
      </div>

      <div className="exam-block-menu-section">
        <small>Giãn dòng</small>
        <div className="exam-block-menu-chips">
          {[1.3, 1.5, 1.75, 2].map((lh) => (
            <button
              key={lh}
              type="button"
              className={(block.lineHeight || 1.55) === lh ? 'is-active' : ''}
              onClick={() => onUpdateStyle({ lineHeight: lh })}
            >
              {lh}×
            </button>
          ))}
        </div>
      </div>

      <div className="exam-block-menu-actions">
        <button type="button" onClick={() => { onDuplicate(); onClose(); }}>
          <Copy size={13} /> Nhân bản khối
        </button>
        <button type="button" onClick={() => { onTogglePageBreak(); onClose(); }}>
          <CornerDownLeft size={13} /> {block.pageBreakBefore ? 'Bỏ ngắt trang trước' : 'Sang trang mới trước khối'}
        </button>
        <button type="button" className="danger" onClick={() => { onDelete(); onClose(); }}>
          <Trash2 size={13} /> Xóa khối này
        </button>
      </div>
    </div>
  );
}
