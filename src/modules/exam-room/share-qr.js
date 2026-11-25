import QRCode from 'qrcode';
import { element, button } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { buildExamRoomShareUrl } from '../../../shared/exam-grading.js';

const E = element;

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ['Phòng thi trực tuyến'];
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

export async function renderShareQrIntoCanvas(canvas, shareUrl, size = 220) {
  await QRCode.toCanvas(canvas, shareUrl, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' }
  });
}

export async function downloadRoomQrCardPng({ examId, title, durationMinutes, hasPassword, shareUrl }) {
  const cardW = 680;
  const cardH = 820;
  const canvas = document.createElement('canvas');
  canvas.width = cardW;
  canvas.height = cardH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Trình duyệt không hỗ trợ tạo ảnh PNG.');

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, cardW, cardH);

  drawRoundedRect(ctx, 28, 28, cardW - 56, cardH - 56, 24);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#0f766e';
  ctx.font = '700 18px "Be Vietnam Pro", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HTVVM STUDIO · PHÒNG THI TRỰC TUYẾN', cardW / 2, 82);

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 28px "Be Vietnam Pro", Arial, sans-serif';
  const titleLines = wrapCanvasText(ctx, title || `Phòng thi ${examId}`, cardW - 120, 2);
  titleLines.forEach((ln, idx) => {
    ctx.fillText(ln, cardW / 2, 128 + idx * 36);
  });

  const metaY = 128 + titleLines.length * 36 + 12;
  ctx.fillStyle = '#475569';
  ctx.font = '500 18px "Be Vietnam Pro", Arial, sans-serif';
  ctx.fillText(
    `${durationMinutes ? `${durationMinutes} phút` : 'Đề trực tuyến'}${hasPassword ? '  ·  Phòng có mật khẩu' : '  ·  Quét mã để vào ngay'}`,
    cardW / 2,
    metaY
  );

  const qrSize = 380;
  const qrCanvas = document.createElement('canvas');
  await renderShareQrIntoCanvas(qrCanvas, shareUrl, qrSize);
  const qrX = Math.round((cardW - qrSize) / 2);
  const qrY = metaY + 28;
  drawRoundedRect(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = '#0f172a';
  ctx.font = '600 17px "IBM Plex Mono", monospace';
  ctx.fillText(`Mã phòng: ${examId}`, cardW / 2, qrY + qrSize + 54);

  ctx.fillStyle = '#0f766e';
  ctx.font = '500 15px "IBM Plex Mono", monospace';
  const shortUrl = shareUrl.length > 56 ? `${shareUrl.slice(0, 53)}…` : shareUrl;
  ctx.fillText(shortUrl, cardW / 2, qrY + qrSize + 84);

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `QR-PhongThi-${examId}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  canvas.width = 0;
  canvas.height = 0;
  qrCanvas.width = 0;
  qrCanvas.height = 0;
}

export function buildShareRoomPanel({ exam, passwordHint = '', onOpenRoom = null, onDelete = null, onBackToList = null }) {
  const shareUrl = buildExamRoomShareUrl(window.location.origin, exam.id);
  const wrap = E('div', 'exam-share-card');

  const qrSide = E('div', 'exam-share-qr-col');
  const qrFrame = E('div', 'exam-share-qr-frame');
  const qrCanvas = document.createElement('canvas');
  qrCanvas.className = 'exam-share-qr-canvas';
  qrCanvas.setAttribute('aria-label', `Mã QR vào phòng thi ${exam.id}`);
  qrFrame.append(qrCanvas);
  const qrStatus = E('small', 'exam-drive-tip', 'Quét bằng camera điện thoại hoặc Zalo để mở thẳng phòng thi.');
  qrSide.append(qrFrame, qrStatus);

  renderShareQrIntoCanvas(qrCanvas, shareUrl, 212).catch(() => {
    qrStatus.textContent = 'Không thể dựng mã QR trên trình duyệt này; hãy dùng đường link bên cạnh.';
  });

  const infoSide = E('div', 'exam-share-info-col');
  const modeLabel = exam.displayMode === 'unified_inline' ? 'Kiểu 2 · Phiếu & đề chung' : 'Kiểu 1 · Đề & phiếu riêng';
  const badges = E('div', 'exam-card-badges');
  badges.append(
    E('span', 'exam-card-pill is-doc', modeLabel),
    E('span', 'exam-card-pill', `${exam.durationMinutes} phút`)
  );
  if (exam.hasPassword || passwordHint) {
    badges.append(E('span', 'exam-card-pill is-locked', 'Có mật khẩu phòng'));
  }

  const titleEl = E('h4', 'exam-share-title', exam.title || `Phòng thi ${exam.id}`);
  const urlRow = E('div', 'exam-share-link-row');
  const urlInput = E('input', 'exam-input exam-share-link-input');
  urlInput.type = 'text';
  urlInput.readOnly = true;
  urlInput.value = shareUrl;
  urlInput.addEventListener('focus', () => urlInput.select());

  const feedback = E('small', 'exam-share-feedback', '');
  const setFeedback = (msg) => {
    feedback.textContent = msg;
    clearTimeout(feedback._t);
    feedback._t = setTimeout(() => { feedback.textContent = ''; }, 2400);
  };

  const copyLinkBtn = button('', 'primary-btn exu-btn-inline', async () => {
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setFeedback('✓ Đã sao chép đường link phòng thi.');
    } catch {
      urlInput.select();
      setFeedback('Hãy nhấn Ctrl+C để sao chép đường link.');
    }
  });
  copyLinkBtn.append(icon('copy', 14), document.createTextNode(' Chép link'));
  urlRow.append(urlInput, copyLinkBtn);

  const subMeta = E('div', 'exam-share-submeta');
  subMeta.append(
    E('span', '', `Mã phòng dự phòng: `),
    E('code', 'exu-tabular', exam.id),
    ...(passwordHint ? [E('span', 'exam-share-pass-note', ` · Mật khẩu: ${passwordHint}`)] : [])
  );

  const toolRow = E('div', 'exam-tabs');
  const dlQrBtn = button('', 'exam-tab exu-btn-inline', async () => {
    dlQrBtn.disabled = true;
    try {
      await downloadRoomQrCardPng({
        examId: exam.id,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        hasPassword: Boolean(exam.hasPassword || passwordHint),
        shareUrl
      });
      setFeedback('✓ Đã tải ảnh thẻ QR (PNG) để gửi lớp hoặc chèn slide.');
    } catch (err) {
      setFeedback(err.message || 'Không tải được ảnh QR.');
    } finally {
      dlQrBtn.disabled = false;
    }
  });
  dlQrBtn.append(icon('qr', 14), document.createTextNode(' Tải thẻ QR (PNG)'));

  const copyInviteBtn = button('', 'exam-tab exu-btn-inline', async () => {
    const inviteLines = [
      `Mời vào phòng thi: ${exam.title}`,
      `Link vào phòng: ${shareUrl}`,
      `Thời gian làm bài: ${exam.durationMinutes} phút`,
      ...(passwordHint ? [`Mật khẩu phòng: ${passwordHint}`] : exam.hasPassword ? ['(Phòng có mật khẩu — liên hệ giáo viên để lấy mật khẩu)'] : [])
    ];
    try {
      await navigator.clipboard?.writeText(inviteLines.join('\n'));
      setFeedback('✓ Đã sao chép tin mời thi đầy đủ.');
    } catch {
      setFeedback('Không truy cập được clipboard.');
    }
  });
  copyInviteBtn.append(icon('copy', 14), document.createTextNode(' Chép tin mời thi'));
  toolRow.append(dlQrBtn, copyInviteBtn);

  if (onOpenRoom) {
    toolRow.append(button('Vào phòng ngay →', 'primary-btn', onOpenRoom));
  }
  if (onBackToList) {
    toolRow.append(button('Quay về kho đề', 'exam-tab', onBackToList));
  }
  if (onDelete) {
    const delBtn = button('', 'exam-card-delete-btn exu-btn-inline', onDelete);
    delBtn.append(icon('trash', 14), document.createTextNode(' Xóa phòng'));
    toolRow.append(delBtn);
  }

  infoSide.append(badges, titleEl, urlRow, subMeta, toolRow, feedback);
  wrap.append(qrSide, infoSide);
  return wrap;
}

export function openShareRoomModal({ exam, passwordHint = '', onOpenRoom = null }) {
  const prevActive = document.activeElement;
  const backdrop = E('div', 'exu-modal-backdrop');
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', `Chia sẻ phòng thi ${exam.title || exam.id}`);

  const dialog = E('div', 'exu-modal-dialog is-share');
  const head = E('div', 'exu-modal-head');
  const titleWrap = E('div', 'exu-modal-title-wrap');
  const chip = E('span', 'exu-icon-chip');
  chip.append(icon('qr', 16));
  const hCopy = E('div', '');
  hCopy.append(
    E('strong', 'exu-modal-title', 'Chia sẻ Link & Mã QR phòng thi'),
    E('p', 'exu-modal-sub', 'Gửi đường link hoặc mã QR để học sinh mở thẳng sảnh phòng thi.')
  );
  titleWrap.append(chip, hCopy);

  const close = () => {
    window.removeEventListener('keydown', onKeyDown);
    backdrop.remove();
    if (prevActive && typeof prevActive.focus === 'function') prevActive.focus();
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  const closeBtn = button('', 'exu-icon-btn', close);
  closeBtn.setAttribute('aria-label', 'Đóng');
  closeBtn.append(icon('close', 16));
  head.append(titleWrap, closeBtn);

  const body = E('div', 'exu-modal-body');
  body.append(
    buildShareRoomPanel({
      exam,
      passwordHint,
      onOpenRoom: onOpenRoom ? () => { close(); onOpenRoom(); } : null
    })
  );

  dialog.append(head, body);
  backdrop.append(dialog);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  window.addEventListener('keydown', onKeyDown);
  document.body.append(backdrop);
  closeBtn.focus();
}
