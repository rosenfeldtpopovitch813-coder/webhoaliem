// Native OOXML (.docx) exporter with editable Word <m:oMath> equations + multi-code .zip packager.
// Zero external dependencies — directly compatible with HTVVM Studio's examExport.ts conventions.

import { buildZipBytes, base64ToBytes } from './zip-codec.js';
import { expandChemLatex } from './math-render.js';
import { buildAnswerKeyCsv } from './exam-shuffler.js';

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function ommlRun(text) {
  return `<m:r><m:t xml:space="preserve">${escapeXml(text)}</m:t></m:r>`;
}

/**
 * Convert LaTeX (including \ce{...}) to real Microsoft Word Office Math Markup Language (<m:oMath>).
 */
export function latexToOmml(texInput) {
  let tex = expandChemLatex(String(texInput || '').trim());
  tex = tex
    .replace(/\\xrightleftharpoons\{([^{}]*)\}/g, (_m, c) => ` ⇌[${c.replace(/\\text\{([^{}]*)\}/g, '$1')}] `)
    .replace(/\\xrightarrow\{([^{}]*)\}/g, (_m, c) => ` →[${c.replace(/\\text\{([^{}]*)\}/g, '$1')}] `)
    .replace(/\\(?:mathrm|text|mathbf)\{([^{}]*)\}/g, '$1')
    .replace(/\\rightarrow|\\to/g, '→')
    .replace(/\\rightleftharpoons/g, '⇌')
    .replace(/\\uparrow/g, '↑')
    .replace(/\\downarrow/g, '↓')
    .replace(/\\leq|\\le/g, '≤')
    .replace(/\\geq|\\ge/g, '≥')
    .replace(/\\neq|\\ne/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\pm/g, '±')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '⋅')
    .replace(/\\infty/g, '∞')
    .replace(/\^\\circ/g, '°');

  // Tokenize \frac and \sqrt recursively
  const tokens = [];
  const stash = (xml) => {
    const id = `@@T${tokens.length}@@`;
    tokens.push(xml);
    return id;
  };

  let prev = '';
  while (prev !== tex) {
    prev = tex;
    tex = tex.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, n, d) =>
      stash(`<m:f><m:num>${latexToOmmlInner(n, tokens)}</m:num><m:den>${latexToOmmlInner(d, tokens)}</m:den></m:f>`)
    );
    tex = tex.replace(/\\sqrt\[([^{}\]]*)\]\{([^{}]*)\}/g, (_m, deg, rad) =>
      stash(`<m:rad><m:deg>${latexToOmmlInner(deg, tokens)}</m:deg><m:e>${latexToOmmlInner(rad, tokens)}</m:e></m:rad>`)
    );
    tex = tex.replace(/\\sqrt\{([^{}]*)\}/g, (_m, rad) =>
      stash(`<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${latexToOmmlInner(rad, tokens)}</m:e></m:rad>`)
    );
  }

  return `<m:oMath>${latexToOmmlInner(tex, tokens)}</m:oMath>`;
}

function latexToOmmlInner(seg, tokens) {
  const parts = seg.split(/(@@T\d+@@)/g);
  const out = [];
  for (const p of parts) {
    if (!p) continue;
    const tm = p.match(/^@@T(\d+)@@$/);
    if (tm) {
      out.push(tokens[Number(tm[1])]);
      continue;
    }
    // Parse base_{sub}^{sup}, base_{sub}, base^{sup}
    const scriptRe = /([A-Za-z0-9\)\]])(?:_\{([^{}]+)\}|_(\d))(?:\^\{([^{}]+)\}|\^([0-9+-]))?|([A-Za-z0-9\)\]])(?:\^\{([^{}]+)\}|\^([0-9+-]))/g;
    let last = 0;
    let m;
    while ((m = scriptRe.exec(p)) !== null) {
      if (m.index > last) out.push(ommlRun(p.slice(last, m.index)));
      if (m[1]) {
        const base = ommlRun(m[1]);
        const sub = ommlRun(m[2] ?? m[3]);
        const supText = m[4] ?? m[5];
        if (supText) {
          out.push(`<m:sSubSup><m:e>${base}</m:e><m:sub>${sub}</m:sub><m:sup>${ommlRun(supText)}</m:sup></m:sSubSup>`);
        } else {
          out.push(`<m:sSub><m:e>${base}</m:e><m:sub>${sub}</m:sub></m:sSub>`);
        }
      } else if (m[6]) {
        out.push(`<m:sSup><m:e>${ommlRun(m[6])}</m:e><m:sup>${ommlRun(m[7] ?? m[8])}</m:sup></m:sSup>`);
      }
      last = m.index + m[0].length;
    }
    if (last < p.length) out.push(ommlRun(p.slice(last)));
  }
  return out.join('');
}

function wordRunXml(text, { bold = false, italic = false, underline = false, color = '', highlight = '', vertAlign = '', sizeHalfPt = 24 } = {}) {
  const rPr = [
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>',
    `<w:sz w:val="${sizeHalfPt}"/><w:szCs w:val="${sizeHalfPt}"/>`,
    bold ? '<w:b/>' : '',
    italic ? '<w:i/>' : '',
    underline ? '<w:u w:val="single"/>' : '',
    color ? `<w:color w:val="${color}"/>` : '',
    highlight ? `<w:highlight w:val="${highlight}"/>` : '',
    vertAlign ? `<w:vertAlign w:val="${vertAlign}"/>` : ''
  ].join('');
  return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function richTextToWordRuns(rawText, style = {}) {
  const parts = String(rawText ?? '').split(/(\$(?:\\.|[^$\n])+\$|<sub>[^<]+<\/sub>|<sup>[^<]+<\/sup>)/gi);
  return parts
    .map((p) => {
      if (!p) return '';
      if (p.startsWith('$') && p.endsWith('$') && p.length > 2) {
        return latexToOmml(p.slice(1, -1));
      }
      const subM = /^<sub>([^<]+)<\/sub>$/i.exec(p);
      if (subM) return wordRunXml(subM[1], { ...style, vertAlign: 'subscript' });
      const supM = /^<sup>([^<]+)<\/sup>$/i.exec(p);
      if (supM) return wordRunXml(supM[1], { ...style, vertAlign: 'superscript' });
      return wordRunXml(p, style);
    })
    .join('');
}

/**
 * Build a complete binary .docx Uint8Array for an exam (student or teacher mode).
 */
export function buildExamDocxBytes(exam, { mode = 'teacher', code = exam.code || exam.examCode || '101' } = {}) {
  const isTeacher = mode === 'teacher';
  const body = [];
  const mediaFiles = [];

  const registerImage = (dataUrl) => {
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl || '');
    if (!m) return '';
    const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
    const idx = mediaFiles.length + 1;
    const rId = `rIdImg${idx}`;
    const name = `word/media/image${idx}.${ext}`;
    mediaFiles.push({ rId, name, ext, data: base64ToBytes(m[2]) });
    return `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="2600000" cy="1700000"/><wp:docPr id="${idx}" name="Img${idx}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${idx}" name="Img${idx}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2600000" cy="1700000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  };

  // Header
  body.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${wordRunXml(exam.title || 'ĐỀ KIỂM TRA', { bold: true, sizeHalfPt: 28 })}</w:p>`);
  body.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>${wordRunXml(`Môn: ${exam.subject || 'Hóa học'}   ·   Thời gian: ${exam.durationMinutes || 50} phút   ·   Mã đề: ${code}`, { italic: true, sizeHalfPt: 22 })}</w:p>`);

  const partMeta = {
    I: 'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.',
    II: 'PHẦN II. Câu trắc nghiệm đúng sai.',
    III: 'PHẦN III. Câu trắc nghiệm trả lời ngắn.'
  };

  let qIndex = 0;
  for (const part of ['I', 'II', 'III']) {
    const group = exam.questions.filter((q) => q.part === part);
    if (!group.length) continue;

    body.push(`<w:p><w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>${wordRunXml(partMeta[part], { bold: true, sizeHalfPt: 24 })}</w:p>`);

    for (const q of group) {
      qIndex += 1;
      const tagStr = isTeacher && q.level ? ` [${q.level}${q.chapter && q.chapter !== 'Chung' ? ` | ${q.chapter}` : ''}]` : '';
      body.push(`<w:p><w:pPr><w:spacing w:before="100" w:after="40"/></w:pPr>${wordRunXml(`Câu ${qIndex}.${tagStr} `, { bold: true })}${richTextToWordRuns(q.prompt)}</w:p>`);
      const qImgs = Array.isArray(q.images) && q.images.length ? q.images : (q.image ? [q.image] : []);
      for (const imgUrl of qImgs) {
        const xml = registerImage(imgUrl);
        if (xml) body.push(xml);
      }

      if (part === 'I' && Array.isArray(q.options)) {
        const letters = ['A', 'B', 'C', 'D'];
        q.options.forEach((opt, idx) => {
          const isAns = isTeacher && String(q.answer || '').toUpperCase() === letters[idx];
          const labelStyle = isAns ? { bold: true, underline: true, color: 'DC2626' } : { bold: true };
          body.push(`<w:p><w:pPr><w:ind w:left="360"/></w:pPr>${wordRunXml(`${letters[idx]}. `, labelStyle)}${richTextToWordRuns(opt)}</w:p>`);
        });
      } else if (part === 'II' && Array.isArray(q.options)) {
        const labels = ['a', 'b', 'c', 'd'];
        q.options.forEach((opt, idx) => {
          const val = Array.isArray(q.answer) ? q.answer[idx] : null;
          const badge = isTeacher && val !== null ? (val ? ' [ĐÚNG]' : ' [SAI]') : '';
          body.push(
            `<w:p><w:pPr><w:ind w:left="360"/></w:pPr>${wordRunXml(`${labels[idx]}) `, { bold: true })}${richTextToWordRuns(opt)}${
              badge ? wordRunXml(badge, { bold: true, color: val ? '15803D' : 'DC2626' }) : ''
            }</w:p>`
          );
        });
      } else if (part === 'III') {
        if (isTeacher && q.answer !== '' && q.answer != null) {
          body.push(`<w:p><w:pPr><w:ind w:left="360"/></w:pPr>${wordRunXml('Đáp án: ', { bold: true })}${wordRunXml(String(q.answer), { bold: true, color: '15803D' })}</w:p>`);
        } else {
          body.push(`<w:p><w:pPr><w:ind w:left="360"/></w:pPr>${wordRunXml('Trả lời: ............................', { italic: true })}</w:p>`);
        }
      }

      if (isTeacher && q.explanation) {
        body.push(`<w:p><w:pPr><w:ind w:left="360"/></w:pPr>${wordRunXml('Lời giải: ', { bold: true, color: '1D4ED8' })}${richTextToWordRuns(q.explanation)}</w:p>`);
      }
    }
  }

  body.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="200"/></w:pPr>${wordRunXml('—————— HẾT ——————', { bold: true })}</w:p>`);
  body.push('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="950"/></w:sectPr>');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>${body.join('')}</w:body>
</w:document>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${mediaFiles.map((mf) => `<Relationship Id="${mf.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mf.name.split('/').pop()}"/>`).join('\n  ')}
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="webp" ContentType="image/webp"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  return buildZipBytes([
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/_rels/document.xml.rels', data: relsXml },
    ...mediaFiles.map((mf) => ({ name: mf.name, data: mf.data }))
  ]);
}

/**
 * Package N shuffled exam variants (student .docx + teacher .docx + Master Answer Key CSV) into 1 .zip file.
 */
export function buildShuffledExamZipBytes(variants, { includeTeacherDocs = true } = {}) {
  const files = [];
  for (const v of variants) {
    files.push({
      name: `de-hoc-sinh/ma-de-${v.code}-hoc-sinh.docx`,
      data: buildExamDocxBytes(v, { mode: 'student', code: v.code })
    });
    if (includeTeacherDocs) {
      files.push({
        name: `de-giao-vien/ma-de-${v.code}-giao-vien.docx`,
        data: buildExamDocxBytes(v, { mode: 'teacher', code: v.code })
      });
    }
  }
  files.push({
    name: 'bang-dap-an-tong-hop.csv',
    data: buildAnswerKeyCsv(variants)
  });
  return buildZipBytes(files);
}
