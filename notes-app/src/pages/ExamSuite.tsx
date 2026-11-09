import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  Copy,
  PenLine,
  Trash2,
  X,
  Download,
  Upload,
  Sparkles,
  ArrowUpRight,
  Clock3
} from 'lucide-react';
import ExamPaperStudio from '../components/ExamPaper/ExamPaperStudio';
import { examStore, ExamRecord, ExamSummary } from '../services/examStore';
import { ExamPaperDocument } from '../types/board';
import './home.css';

type Dialog = { kind: 'rename' | 'delete'; id: string; title: string } | null;

const fmtDate = (n: number) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(n);

export default function ExamSuite() {
  const backupInput = useRef<HTMLInputElement>(null);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [active, setActive] = useState<ExamRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [draftName, setDraftName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setExams(await examStore.list());
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const list = await examStore.list();
        if (!live) return;
        setExams(list);
        const hashId = window.location.hash.match(/^#\/exam\/([^/]+)$/)?.[1];
        if (hashId) {
          const loaded = await examStore.load(hashId).catch(() => null);
          if (live && loaded) setActive(loaded);
        }
      } catch {
        if (live) setError('Không tải được danh sách đề thi trên thiết bị.');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest('.home-card-menu') && !t?.closest('.home-card-more')) setMenu(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menu]);

  const openExam = async (id: string) => {
    try {
      setError('');
      const rec = await examStore.load(id);
      setActive(rec);
      window.location.hash = `/exam/${id}`;
    } catch {
      setError('Không mở được đề thi này.');
    }
  };

  const createNewExam = async (titleInput?: string) => {
    try {
      setError('');
      const rec = await examStore.create(titleInput || newTitle || 'Đề kiểm tra định kỳ');
      setNewTitle('');
      await refresh();
      setActive(rec);
      window.location.hash = `/exam/${rec.id}`;
    } catch {
      setError('Không tạo được đề mới. Hãy kiểm tra bộ nhớ trình duyệt.');
    }
  };

  const closeToLobby = async () => {
    setActive(null);
    window.location.hash = '/exam';
    await refresh();
  };

  const handleSavePaper = async (paper: ExamPaperDocument, closeAfterSave?: boolean) => {
    if (!active) return;
    await examStore.save(active.id, paper);
    if (closeAfterSave) {
      await closeToLobby();
    }
  };

  const handleExportBackup = async () => {
    try {
      const backup = await examStore.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bo-de-thi-a4-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Đã xuất tệp sao lưu toàn bộ đề thi A4.');
    } catch {
      setError('Không xuất được bản sao lưu.');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const count = await examStore.importBackup(parsed);
      await refresh();
      setNotice(`Đã nhập thành công ${count} đề thi A4.`);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không nhập được bản sao lưu.');
    }
  };

  const visible = useMemo(
    () =>
      exams.filter(x =>
        x.title.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))
      ),
    [exams, query]
  );

  if (loading) {
    return <div className="home-loading">Đang mở kho Đề thi khổ A4…</div>;
  }

  if (active) {
    return (
      <ExamPaperStudio
        key={active.id}
        initialPaper={active.paper}
        boardTitle={active.title}
        onSavePaper={handleSavePaper}
        onClose={() => void closeToLobby()}
      />
    );
  }

  return (
    <div className="home-shell">
      <aside className="home-side">
        <div className="home-brand">
          <span
            className="home-mark"
            style={{ background: 'linear-gradient(145deg, #6d28d9, #4f46e5)' }}
            aria-hidden="true"
          >
            <span>Đ</span>
            <i />
          </span>
          <div>
            <strong>
              Soạn đề <em style={{ color: '#6d28d9' }}>A4</em>
            </strong>
            <small>Tạo đề riêng chuẩn như Word</small>
          </div>
        </div>

        <div className="home-side-label">KHÔNG GIAN ĐỀ THI</div>
        <button className="home-inbox" onClick={() => setQuery('')}>
          <span className="home-nav-icon">
            <FileText size={17} />
          </span>
          <span>Tất cả đề thi A4</span>
          <b>{exams.length}</b>
        </button>

        <button
          className="home-side-exam-btn"
          style={{ marginTop: 6 }}
          onClick={() => void createNewExam()}
        >
          <Plus size={16} />
          <span>Tạo đề A4 mới</span>
        </button>

        <div className="home-side-spacer" />
        <div className="home-side-tools">
          <button className="home-backup" onClick={() => void handleExportBackup()}>
            <Download size={16} /> Sao lưu bộ đề (.json)
          </button>
          <button className="home-backup" onClick={() => backupInput.current?.click()}>
            <Upload size={16} /> Nhập bộ đề (.json)
          </button>
          <input
            ref={backupInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={e => void handleImportBackup(e)}
          />
        </div>
      </aside>

      <main className="home-main">
        <header className="home-header">
          <div className="home-heading">
            <span className="home-overline">
              <span style={{ background: '#7c3aed' }} /> KHU SOẠN ĐỀ THI ĐỘC LẬP (TÁCH RIÊNG VỚI BẢNG VẼ)
            </span>
            <h1>Quản lý & Soạn đề khổ A4</h1>
          </div>
          <div className="home-header-actions">
            <label className="home-search">
              <Search size={17} />
              <input
                aria-label="Tìm đề thi"
                placeholder="Tìm tên đề thi…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && (
                <button type="button" title="Xóa tìm kiếm" onClick={() => setQuery('')}>
                  <X size={15} />
                </button>
              )}
            </label>
          </div>
        </header>

        <div className="home-content">
          <section className="home-welcome">
            <div className="home-welcome-copy" style={{ maxWidth: 620 }}>
              <div className="home-kicker" style={{ color: '#6d28d9' }}>
                <Sparkles size={14} /> SOẠN ĐỀ NHIỀU TRANG A4 NHƯ TRONG MICROSOFT WORD
              </div>
              <h2>
                Tạo đề thi chuẩn <span style={{ color: '#6d28d9' }}>khổ A4.</span>
              </h2>
              <p style={{ maxWidth: 560 }}>
                Tự động phân trang sang Trang 2, Trang 3… hoặc bấm thêm trang mới tùy ý; gõ công thức Toán &amp; Hóa học chuẩn sách giáo khoa; dựng hình chóp 3D, đồ thị, phân tử kéo thẳng vào câu hỏi; tải về Word (.docx) hoặc PDF.
              </p>
              <form
                className="home-exam-quick-bar"
                onSubmit={e => {
                  e.preventDefault();
                  void createNewExam(newTitle);
                }}
              >
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Gõ tên đề thi mới (VD: Đề kiểm tra giữa kì 1 Hóa học 12)…"
                />
                <button type="submit" className="home-exam-quick-btn">
                  📝 Mở trang A4 soạn ngay
                </button>
              </form>
            </div>
            <div className="home-welcome-visual" aria-hidden="true">
              <div className="welcome-orbit orbit-one" />
              <div className="welcome-orbit orbit-two" />
              <div className="welcome-sheet sheet-back">
                <span />
                <span />
                <span />
              </div>
              <div className="welcome-sheet sheet-front">
                <div className="welcome-sheet-dot" />
                <span />
                <span />
                <i />
              </div>
              <div className="welcome-sticker">
                A4 <span>📝</span>
              </div>
            </div>
          </section>

          {error && (
            <p className="home-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="home-notice" role="status">
              {notice}
            </p>
          )}

          <section className="home-library-section">
            <div className="home-section-heading">
              <div>
                <span className="home-section-kicker">DANH SÁCH ĐỀ THI KHỔ A4 ĐÃ LƯU</span>
                <h2>{query ? 'Kết quả tìm kiếm đề thi' : 'Bộ đề thi của bạn'}</h2>
                <p>Bấm vào đề bất kỳ để mở lại và soạn tiếp trên các trang A4.</p>
              </div>
              <span className="home-count-pill">
                <FileText size={14} /> {exams.length} đề thi
              </span>
            </div>

            <div className="home-library">
              {visible.length ? (
                <div className="home-grid">
                  {visible.map((exam, idx) => (
                    <article className="home-card has-exam" key={exam.id}>
                      <button
                        className="home-card-open"
                        onClick={() => void openExam(exam.id)}
                        aria-label={`Mở ${exam.title}`}
                      >
                        <div className="home-preview-wrap">
                          <div className="home-paper lined">
                            <span className="paper-edge" />
                            <span className="home-paper-index">
                              MÃ {exam.examCode || String(idx + 1).padStart(3, '0')}
                            </span>
                            <span className="home-paper-mark" />
                          </div>
                          <span className="home-open-arrow">
                            <ArrowUpRight size={16} />
                          </span>
                        </div>
                        <div className="home-card-info">
                          <strong title={exam.title}>{exam.title}</strong>
                          <div className="home-card-meta">
                            <span>
                              <FileText size={13} />
                              {exam.questionCount} câu hỏi
                            </span>
                            <time>
                              <Clock3 size={13} />
                              {fmtDate(exam.updatedAt)}
                            </time>
                          </div>
                        </div>
                      </button>

                      <span className="home-exam-badge" style={{ pointerEvents: 'none' }}>
                        📝 Đề A4
                      </span>

                      <button
                        className="home-card-more"
                        title="Tùy chọn đề thi"
                        onClick={() => setMenu(menu === exam.id ? null : exam.id)}
                      >
                        <MoreHorizontal size={19} />
                      </button>

                      {menu === exam.id && (
                        <div className="home-card-menu" role="menu">
                          <div className="home-menu-heading">TÙY CHỌN ĐỀ THI</div>
                          <button
                            role="menuitem"
                            className="exam-item"
                            onClick={() => {
                              setMenu(null);
                              void openExam(exam.id);
                            }}
                          >
                            📄 Mở soạn tiếp
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setDraftName(exam.title);
                              setDialog({ kind: 'rename', id: exam.id, title: exam.title });
                              setMenu(null);
                            }}
                          >
                            <PenLine size={15} /> Đổi tên đề
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setMenu(null);
                              void examStore.duplicate(exam.id).then(refresh);
                            }}
                          >
                            <Copy size={15} /> Nhân đôi đề
                          </button>
                          <button
                            role="menuitem"
                            className="danger"
                            onClick={() => {
                              setDialog({ kind: 'delete', id: exam.id, title: exam.title });
                              setMenu(null);
                            }}
                          >
                            <Trash2 size={15} /> Xoá đề thi
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="home-empty">
                  <div className="home-empty-icon">
                    <FileText size={26} />
                  </div>
                  <strong>
                    {query ? 'Không tìm thấy đề thi phù hợp' : 'Chưa có đề thi khổ A4 nào'}
                  </strong>
                  <p>
                    Gõ tên đề ở ô phía trên rồi bấm “📝 Mở trang A4 soạn ngay” để tạo đề đầu tiên (có sẵn mẫu nhiều phần).
                  </p>
                  <button onClick={() => void createNewExam('Đề kiểm tra Hóa học 12')}>
                    📝 Tạo đề A4 mẫu ngay
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {dialog && (
        <div
          className="home-dialog-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setDialog(null);
          }}
        >
          <form
            className="home-dialog"
            onSubmit={e => {
              e.preventDefault();
              if (dialog.kind === 'rename' && draftName.trim()) {
                void examStore.rename(dialog.id, draftName.trim()).then(refresh);
              } else if (dialog.kind === 'delete') {
                void examStore.remove(dialog.id).then(refresh);
              }
              setDialog(null);
            }}
          >
            <div className="home-dialog-top">
              <h2>{dialog.kind === 'rename' ? 'Đổi tên đề thi' : 'Xoá đề thi?'}</h2>
              <button type="button" onClick={() => setDialog(null)}>
                <X size={18} />
              </button>
            </div>
            {dialog.kind === 'delete' ? (
              <p>Xoá vĩnh viễn đề “{dialog.title}”? Thao tác này không thể hoàn tác.</p>
            ) : (
              <label>
                Tên đề thi
                <input
                  autoFocus
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  maxLength={140}
                />
              </label>
            )}
            <div className="home-dialog-actions">
              <button type="button" onClick={() => setDialog(null)}>
                Huỷ
              </button>
              <button
                className={dialog.kind === 'delete' ? 'danger' : 'primary'}
                type="submit"
              >
                {dialog.kind === 'delete' ? 'Xoá đề' : 'Lưu tên mới'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
