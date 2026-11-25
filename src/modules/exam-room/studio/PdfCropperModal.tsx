import React, { useEffect, useState } from 'react';
import { X, Scissors, Check, ChevronLeft, ChevronRight } from './icons';
import type { ExamQuestion, PdfCropBox, PdfPagePreview } from './types';

interface PdfCropperModalProps {
  pages: PdfPagePreview[];
  questions: ExamQuestion[];
  onApply: (updatedQuestions: ExamQuestion[], updatedPages: PdfPagePreview[]) => void;
  onClose: () => void;
}

export const PdfCropperModal: React.FC<PdfCropperModalProps> = ({
  pages,
  questions,
  onApply,
  onClose,
}) => {
  const [pageIdx, setPageIdx] = useState(0);
  const [localPages, setLocalPages] = useState<PdfPagePreview[]>(() =>
    pages.map((p) => ({ ...p, boxes: p.boxes.map((b) => ({ ...b })) }))
  );
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(
    pages[0]?.boxes[0]?.id ?? null
  );
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      prevActive?.focus?.();
    };
  }, [onClose]);

  const currentPage = localPages[pageIdx];
  const selectedBox = currentPage?.boxes.find((b) => b.id === selectedBoxId) ?? null;

  const updateBox = (patch: Partial<PdfCropBox>) => {
    if (!currentPage || !selectedBoxId) return;
    setLocalPages((prev) =>
      prev.map((pg, idx) =>
        idx !== pageIdx
          ? pg
          : {
              ...pg,
              boxes: pg.boxes.map((b) => (b.id === selectedBoxId ? { ...b, ...patch } : b)),
            }
      )
    );
  };

  const handleApplyAll = async () => {
    setApplying(true);
    try {
      const { cropRegionDataUrl } = await import('./pdfParser');
      const nextQuestions = questions.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) }));
      for (const pg of localPages) {
        for (const box of pg.boxes) {
          const targetQ =
            nextQuestions.find((q) => q.id === box.questionId) ??
            nextQuestions.find((q) => q.index === box.questionIndex);
          if (!targetQ) continue;
          const cropped = await cropRegionDataUrl(
            pg.imageDataUrl,
            box,
            box.kind === 'question' ? 210000 : 140000
          );
          if (box.kind === 'question') {
            targetQ.stemCropImage = cropped;
          } else if (box.kind === 'option' && box.optionLabel) {
            const targetOpt = targetQ.options.find((o) => o.label === box.optionLabel);
            if (targetOpt) targetOpt.cropImage = cropped;
          }
        }
      }
      onApply(nextQuestions, localPages);
    } finally {
      setApplying(false);
    }
  };

  if (!currentPage) return null;

  return (
    <div className="exu-modal-backdrop" role="dialog" aria-modal="true" aria-label="Chỉnh vùng cắt PDF">
      <div className="exu-modal-dialog is-wide">
        <div className="exu-modal-head">
          <div className="exu-modal-title-wrap">
            <span className="exu-icon-chip">
              <Scissors size={16} />
            </span>
            <div>
              <strong className="exu-modal-title">Chỉnh khung cắt trang đề PDF</strong>
              <p className="exu-modal-sub">
                Chọn khung câu hỏi hoặc phương án A/B/C/D để điều chỉnh lề cắt chính xác.
              </p>
            </div>
          </div>
          <div className="exu-row-actions">
            <button
              type="button"
              disabled={applying}
              onClick={handleApplyAll}
              className="primary-btn exu-btn-inline"
            >
              <Check size={15} />
              {applying ? 'Đang cắt lại…' : 'Áp dụng vùng cắt'}
            </button>
            <button type="button" onClick={onClose} className="exu-icon-btn" aria-label="Đóng">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="exu-cropper-body">
          <div className="exu-cropper-stage">
            {localPages.length > 1 && (
              <div className="exu-cropper-pager">
                <button
                  type="button"
                  disabled={pageIdx === 0}
                  onClick={() => {
                    const next = pageIdx - 1;
                    setPageIdx(next);
                    setSelectedBoxId(localPages[next]?.boxes[0]?.id ?? null);
                  }}
                  className="exu-icon-btn"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="exu-tabular">
                  Trang {pageIdx + 1} / {localPages.length}
                </span>
                <button
                  type="button"
                  disabled={pageIdx === localPages.length - 1}
                  onClick={() => {
                    const next = pageIdx + 1;
                    setPageIdx(next);
                    setSelectedBoxId(localPages[next]?.boxes[0]?.id ?? null);
                  }}
                  className="exu-icon-btn"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}

            <div className="exu-cropper-page-frame">
              <img
                src={currentPage.imageDataUrl}
                alt={`Trang PDF ${currentPage.pageNumber}`}
                className="exu-cropper-page-img"
              />
              {currentPage.boxes.map((box) => {
                const isSelected = box.id === selectedBoxId;
                const isQ = box.kind === 'question';
                return (
                  <button
                    key={box.id}
                    type="button"
                    onClick={() => setSelectedBoxId(box.id)}
                    style={{
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.w * 100}%`,
                      height: `${box.h * 100}%`,
                    }}
                    className={`exu-crop-box ${isQ ? 'is-question' : 'is-option'} ${isSelected ? 'is-selected' : ''}`}
                  >
                    <span className="exu-crop-box-tag">
                      {isQ ? `Câu ${box.questionIndex}` : `${box.questionIndex}.${box.optionLabel}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="exu-cropper-sidebar">
            <div className="exu-section-label">Khung trên trang ({currentPage.boxes.length})</div>
            {selectedBox ? (
              <div className="exu-subpanel">
                <strong className="exu-subpanel-title">
                  {selectedBox.kind === 'question'
                    ? `Đề bài · Câu ${selectedBox.questionIndex}`
                    : `Phương án ${selectedBox.optionLabel} · Câu ${selectedBox.questionIndex}`}
                </strong>
                {(['x', 'y', 'w', 'h'] as const).map((field) => {
                  const labels = { x: 'Lề trái (X)', y: 'Lề trên (Y)', w: 'Rộng (W)', h: 'Cao (H)' };
                  return (
                    <label key={field} className="exu-range-field">
                      <span className="exu-range-row">
                        <span>{labels[field]}</span>
                        <strong className="exu-tabular">{Math.round(selectedBox[field] * 100)}%</strong>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={0.5}
                        value={Math.round(selectedBox[field] * 1000) / 10}
                        onChange={(e) => updateBox({ [field]: Number(e.target.value) / 100 })}
                      />
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="exam-message">Bấm vào một khung trên trang đề để tinh chỉnh.</p>
            )}

            <div className="exu-crop-list">
              {currentPage.boxes.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBoxId(b.id)}
                  className={`exu-crop-list-item ${b.id === selectedBoxId ? 'is-active' : ''}`}
                >
                  <span>
                    {b.kind === 'question' ? `Câu ${b.questionIndex} · Đề bài` : `Câu ${b.questionIndex} · Đáp án ${b.optionLabel}`}
                  </span>
                  <small className="exu-tabular">
                    {Math.round(b.w * 100)}×{Math.round(b.h * 100)}%
                  </small>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
