import React, { useRef, useState } from 'react';
import {
  FileUp,
  FileText,
  FileCode2,
  ClipboardPaste,
  Scissors,
  Loader2,
  AlertCircle,
  Plus,
} from './icons';
import type { ParseResult } from './types';
import { parseLatexExam, parsePlainTextExam } from './latexParser';

interface ExamScanDropzoneProps {
  onParsed: (result: ParseResult) => void;
  onStartBlank: () => void;
}

const SAMPLE_PASTE_TEXT = `ĐỀ KIỂM TRA VẬT LÝ 12 — CHƯƠNG NHIỆT HỌC
PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn
Câu 1. Nội năng của một vật phụ thuộc vào
*A. nhiệt độ và thể tích của vật.
B. khối lượng và vận tốc của vật.
C. độ cao và gia tốc trọng trường.
D. hình dạng bên ngoài của vật.

Câu 2. Biểu thức nguyên lý I nhiệt động lực học là $\\Delta U = A + Q$. Khi vật nhận nhiệt và sinh công thì:
A. $Q < 0, A > 0$
*B. $Q > 0, A < 0$
C. $Q > 0, A > 0$
D. $Q < 0, A < 0$

PHẦN II. Câu trắc nghiệm đúng sai
Câu 1. Cho một lượng khí lý tưởng biến đổi trạng thái trong bình kín:
a) Khi giữ thể tích không đổi, áp suất tỉ lệ thuận với nhiệt độ tuyệt đối. [Đ]
b) Động năng tịnh tiến trung bình của phân tử khí phụ thuộc vào bản chất khí. [S]
c) Nhiệt độ $27^\\circ\\text{C}$ tương ứng $300\\text{ K}$. [Đ]
d) Ở độ không tuyệt đối, áp suất khí đạt cực đại. [S]

PHẦN III. Câu trắc nghiệm trả lời ngắn
Câu 1. Nhiệt độ $37^\\circ\\text{C}$ đổi sang thang Kelvin (làm tròn đến hàng đơn vị) bằng bao nhiêu?
Đáp án: 310`;

export const ExamScanDropzone: React.FC<ExamScanDropzoneProps> = ({
  onParsed,
  onStartBlank,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [pdfMode, setPdfMode] = useState<'crop' | 'text'>('crop');
  const [isDragging, setIsDragging] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    try {
      if (ext === 'docx') {
        setLoadingMsg('Đang tách câu hỏi, công thức toán, bảng biểu và hình vẽ từ tệp Word (.docx)…');
        const { parseDocxFile } = await import('./docxParser');
        const res = await parseDocxFile(file);
        if (res.questions.length === 0) {
          throw new Error('Không tìm thấy câu hỏi (mỗi câu cần bắt đầu bằng "Câu 1.", "Câu 2."…).');
        }
        onParsed(res);
      } else if (ext === 'pdf') {
        setLoadingMsg(
          pdfMode === 'crop'
            ? 'Đang dựng trang PDF và cắt khung hình từng câu hỏi / phương án…'
            : 'Đang đọc lớp văn bản và trích xuất hình vẽ từ tệp PDF…'
        );
        const { parsePdfCropMode, parsePdfTextMode } = await import('./pdfParser');
        const res =
          pdfMode === 'crop' ? await parsePdfCropMode(file) : await parsePdfTextMode(file);
        if (res.questions.length === 0) {
          throw new Error('Không tách được câu hỏi tự động từ tệp PDF này. Hãy kiểm tra tiền tố "Câu 1." hoặc dùng Kiểu 1 (Đề và phiếu riêng).');
        }
        onParsed(res);
      } else if (ext === 'tex') {
        setLoadingMsg('Đang phân tích tệp LaTeX (.tex)…');
        const text = await file.text();
        const res = parseLatexExam(text, file.name);
        if (res.questions.length === 0) {
          throw new Error('Không nhận diện được câu hỏi trong tệp .tex.');
        }
        onParsed(res);
      } else if (ext === 'txt' || ext === 'md') {
        setLoadingMsg('Đang tách câu hỏi từ tệp văn bản…');
        const text = await file.text();
        const res = parsePlainTextExam(text, file.name);
        if (res.questions.length === 0) {
          throw new Error('Không nhận diện được câu hỏi (mỗi câu cần bắt đầu bằng "Câu 1.", "Câu 2."…).');
        }
        onParsed(res);
      } else {
        throw new Error(
          `Định dạng .${ext} không được hỗ trợ. Vui lòng chọn tệp .docx (Word), .pdf, .tex hoặc .txt.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đọc tệp đề thi.');
    } finally {
      setLoadingMsg(null);
    }
  };

  const handlePasteSubmit = () => {
    setError(null);
    if (!pasteContent.trim()) {
      setError('Hãy dán nội dung đề thi vào ô bên dưới.');
      return;
    }
    const res = parsePlainTextExam(
      pasteContent,
      pasteTitle.trim() ? `${pasteTitle.trim()}.txt` : 'Đề dán trực tiếp.txt'
    );
    if (pasteTitle.trim()) res.title = pasteTitle.trim();
    if (res.questions.length === 0) {
      setError('Chưa nhận diện được câu hỏi. Mỗi câu cần bắt đầu bằng "Câu 1.", "Câu 2."…');
      return;
    }
    onParsed(res);
  };

  return (
    <div className="exu-stack">
      <div className="exu-toolbar-card">
        <div className="exu-seg-group">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`exu-seg-btn ${activeTab === 'file' ? 'is-active' : ''}`}
          >
            <FileUp size={14} />
            Tải tệp đề (.DOCX · .PDF · .TEX)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`exu-seg-btn ${activeTab === 'paste' ? 'is-active' : ''}`}
          >
            <ClipboardPaste size={14} />
            Dán văn bản đề nhanh
          </button>
        </div>

        <button type="button" onClick={onStartBlank} className="exam-tab exu-btn-inline">
          <Plus size={14} />
          Tạo từng câu thủ công
        </button>
      </div>

      {activeTab === 'file' ? (
        <div className="exu-card">
          <div className="exu-pdf-mode-bar">
            <span className="exu-section-label">Chế độ xử lý khi chọn tệp PDF:</span>
            <div className="exu-seg-group">
              <button
                type="button"
                onClick={() => setPdfMode('crop')}
                className={`exu-seg-btn ${pdfMode === 'crop' ? 'is-active' : ''}`}
              >
                <Scissors size={13} />
                PDF Cắt vùng ảnh (giữ nguyên hình vẽ &amp; công thức)
              </button>
              <button
                type="button"
                onClick={() => setPdfMode('text')}
                className={`exu-seg-btn ${pdfMode === 'text' ? 'is-active' : ''}`}
              >
                <FileText size={13} />
                PDF Tách chữ nhanh
              </button>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            onClick={() => !loadingMsg && fileInputRef.current?.click()}
            className={`exu-dropzone ${isDragging ? 'is-dragging' : ''} ${loadingMsg ? 'is-busy' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf,.tex,.txt,.md"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
            />

            {loadingMsg ? (
              <div className="exu-dropzone-inner">
                <Loader2 size={28} className="exu-spin" />
                <strong>{loadingMsg}</strong>
                <small>Quá trình quét diễn ra hoàn toàn trực tiếp trên trình duyệt của bạn.</small>
              </div>
            ) : (
              <div className="exu-dropzone-inner">
                <span className="exu-dropzone-icon">
                  <FileUp size={24} />
                </span>
                <strong>Kéo thả tệp đề vào đây hoặc bấm để chọn tệp từ máy</strong>
                <p>
                  Tự động tách Phần I (A–D), Phần II (Đúng–Sai 4 ý), Phần III (Trả lời ngắn), nhận diện đáp án gạch chân / tô màu / bảng đáp án cuối đề.
                </p>
                <div className="exu-format-tags">
                  <span><FileText size={13} /> Word (.docx + công thức OMML + bảng + hình)</span>
                  <span><Scissors size={13} /> PDF (Cắt vùng ảnh / Tách chữ)</span>
                  <span><FileCode2 size={13} /> LaTeX (.tex ex_test) · .txt</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="exu-card exu-stack">
          <div className="exu-card-head">
            <div>
              <strong>Dán nội dung đề thi để quét tự động</strong>
              <p className="exu-card-sub">
                Hỗ trợ đánh dấu đáp án đúng bằng dấu <code>*A.</code>, ý Đúng/Sai bằng <code>[Đ]</code> / <code>[S]</code>, hoặc dán kèm <code>BẢNG ĐÁP ÁN</code> ở cuối.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPasteTitle('Đề kiểm tra Vật lý 12 — Nhiệt học');
                setPasteContent(SAMPLE_PASTE_TEXT);
              }}
              className="exam-tab"
            >
              Chèn đề mẫu 3 phần
            </button>
          </div>

          <input
            type="text"
            value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)}
            placeholder="Tên đề thi (tùy chọn — bỏ trống sẽ tự lấy từ dòng tiêu đề)"
            className="exam-input"
          />

          <textarea
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            rows={13}
            className="exam-input exu-mono-textarea"
            placeholder={'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn\nCâu 1. Cho hàm số $y = x^3 - 3x$. Số cực trị của hàm số là:\nA. 0\nB. 1\n*C. 2\nD. 3'}
          />

          <div className="exu-row-actions is-end">
            <button type="button" onClick={handlePasteSubmit} className="primary-btn">
              Quét &amp; Rà soát đề →
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="exu-alert is-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
