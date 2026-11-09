const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be']);
const DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com', 'drive.usercontent.google.com']);
const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{5,200}$/;

export function resolveResourceLink(rawValue) {
  let raw = String(rawValue || '').trim();
  if (!raw) throw new Error('Hãy dán liên kết Google Drive, PDF hoặc YouTube.');
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) && /^(?:www\.)?(?:drive\.google\.com|docs\.google\.com|youtube\.com|youtu\.be)\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  let url;
  try { url = new URL(raw); } catch { throw new Error('Liên kết không hợp lệ. Hãy dán URL đầy đủ, bắt đầu bằng https://'); }
  if (url.protocol !== 'https:') throw new Error('Chỉ hỗ trợ liên kết HTTPS an toàn.');

  const host = url.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host)) {
    let id = '';
    if (host === 'youtu.be' || host === 'www.youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
    else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
      if (match) id = match[1];
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
      return { type: 'youtube', label: 'YouTube', openUrl: url.href, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    const playlistId = url.searchParams.get('list') || '';
    if (/^[A-Za-z0-9_-]{10,100}$/.test(playlistId)) {
      return { type: 'youtube', label: 'YouTube Music/playlist', openUrl: url.href, embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlistId)}` };
    }
    throw new Error('Không tìm thấy mã video hoặc playlist YouTube hợp lệ trong liên kết này.');
  }

  if (DRIVE_HOSTS.has(host)) {
    if (/\/folders\/[A-Za-z0-9_-]+/.test(url.pathname)) {
      throw new Error('Đây là liên kết thư mục Google Drive. Hãy mở trực tiếp tệp đề (PDF/Docs) bên trong rồi bấm Chia sẻ → Sao chép liên kết.');
    }
    const pubMatch = url.pathname.match(/\/(?:u\/\d+\/)?(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/e\/([A-Za-z0-9_-]{10,200})(?:\/|$)/);
    if (pubMatch) {
      const [, pubType, pubId] = pubMatch;
      return {
        type: 'drive',
        label: 'Google Docs',
        openUrl: `https://docs.google.com/${pubType}/d/e/${pubId}/pub`,
        embedUrl: `https://docs.google.com/${pubType}/d/e/${pubId}/pub?embedded=true`
      };
    }

    let id = '';
    let docsType = '';
    if (host === 'docs.google.com') {
      const match = url.pathname.match(/\/(?:u\/\d+\/)?(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{5,200})(?:\/|$)/);
      if (match) { docsType = match[1]; id = match[2]; }
    }
    if (!id) {
      const pathMatch = url.pathname.match(/\/d\/([A-Za-z0-9_-]{5,200})(?:\/|$)/);
      id = pathMatch?.[1] || url.searchParams.get('id') || '';
    }
    if (!DRIVE_ID_PATTERN.test(id)) throw new Error('Không đọc được mã tệp Google Drive. Hãy dùng liên kết Chia sẻ của một tệp đề (PDF / Google Docs), không phải thư mục.');
    const embedUrl = docsType
      ? `https://docs.google.com/${docsType}/d/${id}/preview`
      : `https://drive.google.com/file/d/${id}/preview`;
    const openUrl = docsType
      ? `https://docs.google.com/${docsType}/d/${id}/view`
      : `https://drive.google.com/file/d/${id}/view`;
    return { type: 'drive', label: 'Google Drive', openUrl, embedUrl };
  }

  if (/\.pdf$/i.test(url.pathname)) {
    return { type: 'pdf', label: 'PDF', openUrl: url.href, embedUrl: url.href };
  }

  throw new Error('Liên kết chưa được hỗ trợ. Hãy dán link chia sẻ tệp Google Drive / Google Docs hoặc đường dẫn trực tiếp tới file .pdf (https://).');
}
