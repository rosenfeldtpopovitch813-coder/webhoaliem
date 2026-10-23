const URL_RE = /^https?:\/\//i;

export function parseCsv(text) {
  const input = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ',') { row.push(cell.trim()); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell.length || row.length) { row.push(cell.trim()); if (row.some(value => value !== '')) rows.push(row); }
  return rows;
}

export function normalizeHeader(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
}

const TITLE_KEYS = ['ten tai lieu', 'ten sach', 'ten de thi', 'ten', 'title', 'name', 'resource', 'document', 'tai lieu'];
const URL_KEYS = ['link', 'url', 'drive', 'google drive', 'tep', 'file', 'tai lieu', 'thu muc', 'folder', 'download', 'preview', 'tai xuong'];
const DESCRIPTION_KEYS = ['mo ta', 'description', 'ghi chu', 'noi dung', 'note'];
const SUBJECT_KEYS = ['mon hoc', 'mon', 'subject', 'chuyen de', 'topic', 'khoi', 'lop'];
const TYPE_KEYS = ['loai', 'type', 'phan loai', 'kind', 'dinh dang'];

function columnIndex(headers, aliases) {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const exact = normalized.findIndex(value => value === alias);
    if (exact >= 0) return exact;
  }
  for (const alias of aliases) {
    const partial = normalized.findIndex(value => value && (value.includes(alias) || alias.includes(value)));
    if (partial >= 0) return partial;
  }
  return -1;
}

function extractDriveId(url) {
  try {
    const parsed = new URL(url);
    if (!['drive.google.com', 'docs.google.com'].includes(parsed.hostname.toLowerCase())) return '';
    return parsed.pathname.match(/\/d\/([A-Za-z0-9_-]{5,200})(?:\/|$)/)?.[1] || parsed.searchParams.get('id') || '';
  } catch { return ''; }
}

function googlePreview(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const doc = host === 'docs.google.com' && parsed.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]{5,200})(?:\/|$)/);
    if (doc) return `https://docs.google.com/${doc[1]}/d/${doc[2]}/preview`;
    if (host === 'drive.google.com') {
      if (/\/drive\/folders\//.test(parsed.pathname)) return '';
      const id = extractDriveId(url);
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
    if (/\.pdf(?:$|[?#])/i.test(url)) return url;
    return url;
  } catch { return url; }
}

function googleDownload(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const doc = host === 'docs.google.com' && parsed.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]{5,200})(?:\/|$)/);
    if (doc) {
      const format = doc[1] === 'spreadsheets' ? 'xlsx' : 'pdf';
      return `https://docs.google.com/${doc[1]}/d/${doc[2]}/export?format=${format}`;
    }
    const id = extractDriveId(url);
    if (id && host === 'drive.google.com' && !/\/drive\/folders\//.test(parsed.pathname)) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
    return url;
  } catch { return url; }
}

export function rowsToLibraryItems(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const likelyHeader = rows[0].some(cell => {
    const h = normalizeHeader(cell);
    return TITLE_KEYS.includes(h) || URL_KEYS.includes(h) || DESCRIPTION_KEYS.includes(h) || SUBJECT_KEYS.includes(h) || TYPE_KEYS.includes(h);
  });
  const headers = (likelyHeader ? rows[0] : rows[0].map((_, i) => `column ${i + 1}`)).map(String);
  const dataRows = likelyHeader ? rows.slice(1) : rows;
  const titleCol = columnIndex(headers, TITLE_KEYS);
  const descriptionCol = columnIndex(headers, DESCRIPTION_KEYS);
  const subjectCol = columnIndex(headers, SUBJECT_KEYS);
  const typeCol = columnIndex(headers, TYPE_KEYS);
  const urlCols = headers.map((header, index) => ({ header: normalizeHeader(header), index })).filter(({ header }) => URL_KEYS.some(key => header === key || header.includes(key)));

  return dataRows.flatMap((row, index) => {
    const values = headers.map((_, col) => String(row[col] ?? '').trim());
    const linkedCells = values.map((value, col) => ({ value, col, header: normalizeHeader(headers[col]) })).filter(entry => URL_RE.test(entry.value));
    if (!linkedCells.length) return [];
    const rankedLinks = linkedCells.slice().sort((a, b) => {
      const score = item => (urlCols.some(x => x.index === item.col) ? 10 : 0) + (/drive|link|url|tai lieu|file|thu muc|folder|download|preview/.test(item.header) ? 5 : 0);
      return score(b) - score(a);
    });
    const selected = rankedLinks[0];
    const folderEntry = linkedCells.find(entry => /drive\.google\.com/i.test(entry.value) && /\/drive\/folders\/|\/folders\//i.test(entry.value));
    const explicitType = typeCol >= 0 ? normalizeHeader(values[typeCol]) : '';
    const folder = Boolean(folderEntry) || /folder|thu muc/.test(explicitType) || /folder|thu muc/.test(selected.header);
    const url = folder ? (folderEntry?.value || selected.value) : selected.value;
    const notUrlValues = values.filter(value => value && !URL_RE.test(value));
    const name = (titleCol >= 0 ? values[titleCol] : '') || notUrlValues.find(value => value.length > 2) || `Tài liệu ${index + 1}`;
    const description = descriptionCol >= 0 ? values[descriptionCol] : '';
    const subject = subjectCol >= 0 ? values[subjectCol] : '';
    const ext = (() => { try { return new URL(url).pathname.split('.').pop().toLowerCase().slice(0, 8); } catch { return ''; } })();
    const kind = folder ? 'folder' : /youtube\.com|youtu\.be/i.test(url) ? 'video' : 'document';
    const id = `${index + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`;
    return [{
      id, name: name.slice(0, 240), description: description.slice(0, 1200), subject: subject.slice(0, 120),
      kind, url, viewUrl: url,
      previewUrl: folder ? '' : (kind === 'video' ? url : googlePreview(url)),
      downloadUrl: kind === 'document' && !folder ? googleDownload(url) : '',
      extension: folder ? 'folder' : ext,
      folder
    }];
  });
}
