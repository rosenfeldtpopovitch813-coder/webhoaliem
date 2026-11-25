/**
 * Client-side converter for Microsoft Word WMF / EMF / EMF+ metafiles.
 */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractEmbeddedRaster(bytes: Uint8Array): string | null {
  for (let i = 0; i < bytes.length - 16; i++) {
    if (
      bytes[i] === 0x89 &&
      bytes[i + 1] === 0x50 &&
      bytes[i + 2] === 0x4e &&
      bytes[i + 3] === 0x47 &&
      bytes[i + 4] === 0x0d &&
      bytes[i + 5] === 0x0a &&
      bytes[i + 6] === 0x1a &&
      bytes[i + 7] === 0x0a
    ) {
      for (let j = i + 8; j <= bytes.length - 8; j++) {
        if (
          bytes[j] === 0x49 &&
          bytes[j + 1] === 0x45 &&
          bytes[j + 2] === 0x4e &&
          bytes[j + 3] === 0x44 &&
          bytes[j + 4] === 0xae &&
          bytes[j + 5] === 0x42 &&
          bytes[j + 6] === 0x60 &&
          bytes[j + 7] === 0x82
        ) {
          return `data:image/png;base64,${bytesToBase64(bytes.subarray(i, j + 8))}`;
        }
      }
    }
  }

  for (let i = 0; i < bytes.length - 16; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff && (bytes[i + 3] === 0xe0 || bytes[i + 3] === 0xe1 || bytes[i + 3] === 0xdb)) {
      for (let j = bytes.length - 2; j > i + 16; j--) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
          return `data:image/jpeg;base64,${bytesToBase64(bytes.subarray(i, j + 2))}`;
        }
      }
    }
  }

  return null;
}

function dibToBmpDataUrl(dibBytes: Uint8Array): string | null {
  if (dibBytes.length < 40) return null;
  const dv = new DataView(dibBytes.buffer, dibBytes.byteOffset, dibBytes.byteLength);
  const headerSize = dv.getUint32(0, true);
  if (headerSize !== 40 && headerSize !== 108 && headerSize !== 124) return null;
  const bpp = dv.getUint16(14, true);
  const clrUsed = dv.getUint32(32, true);
  const paletteSize = bpp <= 8 ? (clrUsed || 1 << bpp) * 4 : 0;
  const pixelOffset = 14 + headerSize + paletteSize;
  const fileSize = 14 + dibBytes.length;

  const bmp = new Uint8Array(fileSize);
  const bdv = new DataView(bmp.buffer);
  bmp[0] = 0x42;
  bmp[1] = 0x4d;
  bdv.setUint32(2, fileSize, true);
  bdv.setUint32(10, pixelOffset, true);
  bmp.set(dibBytes, 14);
  return `data:image/bmp;base64,${bytesToBase64(bmp)}`;
}

function colorRefToHex(dv: DataView, offset: number): string {
  const r = dv.getUint8(offset);
  const g = dv.getUint8(offset + 1);
  const b = dv.getUint8(offset + 2);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function wmfToSvgDataUrl(bytes: Uint8Array): string | null {
  if (bytes.length < 22) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;

  let left = 0;
  let top = 0;
  let right = 400;
  let bottom = 200;

  if (dv.getUint32(0, true) === 0x9ac6cdd7) {
    left = dv.getInt16(6, true);
    top = dv.getInt16(8, true);
    right = dv.getInt16(10, true);
    bottom = dv.getInt16(12, true);
    pos = 22;
  }

  if (pos + 18 > bytes.length) return null;
  const headerWords = dv.getUint16(pos + 2, true);
  pos += headerWords * 2;

  let curX = 0;
  let curY = 0;
  let winOrgX = left;
  let winOrgY = top;
  let winExtX = right - left || 400;
  let winExtY = bottom - top || 200;

  let strokeColor = '#0f172a';
  let strokeWidth = 1.5;
  let fillColor = 'none';
  let textColor = '#0f172a';
  let fontSize = 14;

  const objects: Array<{ kind: 'pen' | 'brush' | 'font'; color?: string; width?: number; size?: number }> = [];
  const svgParts: string[] = [];

  const allocObj = (obj: { kind: 'pen' | 'brush' | 'font'; color?: string; width?: number; size?: number }) => {
    const emptyIdx = objects.findIndex((o) => !o);
    if (emptyIdx >= 0) objects[emptyIdx] = obj;
    else objects.push(obj);
  };

  while (pos + 6 <= bytes.length) {
    const sizeWords = dv.getUint32(pos, true);
    const fn = dv.getUint16(pos + 4, true);
    const recLen = sizeWords * 2;
    if (sizeWords < 3 || pos + recLen > bytes.length) break;
    if (fn === 0x0000) break;

    const p = pos + 6;
    switch (fn) {
      case 0x020b:
        winOrgY = dv.getInt16(p, true);
        winOrgX = dv.getInt16(p + 2, true);
        break;
      case 0x020c:
        winExtY = dv.getInt16(p, true) || winExtY;
        winExtX = dv.getInt16(p + 2, true) || winExtX;
        break;
      case 0x0214:
        curY = dv.getInt16(p, true);
        curX = dv.getInt16(p + 2, true);
        break;
      case 0x0213: {
        const y = dv.getInt16(p, true);
        const x = dv.getInt16(p + 2, true);
        svgParts.push(`<line x1="${curX}" y1="${curY}" x2="${x}" y2="${y}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`);
        curX = x;
        curY = y;
        break;
      }
      case 0x0325:
      case 0x0324: {
        const count = dv.getInt16(p, true);
        const pts: string[] = [];
        for (let i = 0; i < count && p + 2 + i * 4 + 4 <= pos + recLen; i++) {
          const px = dv.getInt16(p + 2 + i * 4, true);
          const py = dv.getInt16(p + 2 + i * 4 + 2, true);
          pts.push(`${px},${py}`);
        }
        if (pts.length > 1) {
          const tag = fn === 0x0324 ? 'polygon' : 'polyline';
          svgParts.push(`<${tag} points="${pts.join(' ')}" fill="${fn === 0x0324 ? fillColor : 'none'}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`);
        }
        break;
      }
      case 0x041b: {
        const b = dv.getInt16(p, true);
        const r = dv.getInt16(p + 2, true);
        const t = dv.getInt16(p + 4, true);
        const l = dv.getInt16(p + 6, true);
        svgParts.push(`<rect x="${Math.min(l, r)}" y="${Math.min(t, b)}" width="${Math.abs(r - l)}" height="${Math.abs(b - t)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`);
        break;
      }
      case 0x0418: {
        const b = dv.getInt16(p, true);
        const r = dv.getInt16(p + 2, true);
        const t = dv.getInt16(p + 4, true);
        const l = dv.getInt16(p + 6, true);
        svgParts.push(`<ellipse cx="${(l + r) / 2}" cy="${(t + b) / 2}" rx="${Math.abs(r - l) / 2}" ry="${Math.abs(b - t) / 2}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`);
        break;
      }
      case 0x02fa: {
        const style = dv.getUint16(p, true);
        const width = Math.max(1, dv.getInt16(p + 2, true));
        const color = style === 5 ? 'none' : colorRefToHex(dv, p + 6);
        allocObj({ kind: 'pen', color, width });
        break;
      }
      case 0x02fc: {
        const style = dv.getUint16(p, true);
        const color = style === 1 ? 'none' : colorRefToHex(dv, p + 2);
        allocObj({ kind: 'brush', color });
        break;
      }
      case 0x02fb: {
        const h = Math.abs(dv.getInt16(p, true)) || 14;
        allocObj({ kind: 'font', size: h });
        break;
      }
      case 0x012d: {
        const idx = dv.getUint16(p, true);
        const obj = objects[idx];
        if (obj?.kind === 'pen') {
          strokeColor = obj.color || '#0f172a';
          strokeWidth = obj.width || 1.5;
        } else if (obj?.kind === 'brush') {
          fillColor = obj.color || 'none';
        } else if (obj?.kind === 'font') {
          fontSize = obj.size || 14;
        }
        break;
      }
      case 0x01f0: {
        const idx = dv.getUint16(p, true);
        delete objects[idx];
        break;
      }
      case 0x0209:
        textColor = colorRefToHex(dv, p);
        break;
      case 0x0a32: {
        const y = dv.getInt16(p, true);
        const x = dv.getInt16(p + 2, true);
        const len = dv.getInt16(p + 4, true);
        const opts = dv.getUint16(p + 6, true);
        const strOff = p + 8 + ((opts & 0x06) ? 8 : 0);
        if (len > 0 && strOff + len <= pos + recLen) {
          const txt = new TextDecoder('windows-1252').decode(bytes.subarray(strOff, strOff + len));
          if (txt.trim()) {
            svgParts.push(`<text x="${x}" y="${y + fontSize * 0.8}" fill="${textColor}" font-size="${fontSize}" font-family="serif">${escapeXml(txt)}</text>`);
          }
        }
        break;
      }
      case 0x0f43:
      case 0x0b41: {
        const dibOff = fn === 0x0f43 ? p + 22 : p + 20;
        if (dibOff + 40 < pos + recLen) {
          const bmpUrl = dibToBmpDataUrl(bytes.subarray(dibOff, pos + recLen));
          if (bmpUrl) return bmpUrl;
        }
        break;
      }
    }

    pos += recLen;
  }

  if (svgParts.length === 0) return null;
  const vbW = Math.abs(winExtX) || 400;
  const vbH = Math.abs(winExtY) || 200;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${winOrgX} ${winOrgY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}" style="max-width:100%;height:auto;background:#fff">${svgParts.join('')}</svg>`;
  return `data:image/svg+xml;base64,${bytesToBase64(new TextEncoder().encode(svg))}`;
}

function emfToSvgDataUrl(bytes: Uint8Array): string | null {
  if (bytes.length < 88) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== 1) return null;

  const bLeft = dv.getInt32(8, true);
  const bTop = dv.getInt32(12, true);
  const bRight = dv.getInt32(16, true);
  const bBottom = dv.getInt32(20, true);
  const vbW = Math.max(20, bRight - bLeft);
  const vbH = Math.max(20, bBottom - bTop);

  let pos = dv.getUint32(4, true);
  let curX = 0;
  let curY = 0;
  const svgParts: string[] = [];

  while (pos + 8 <= bytes.length) {
    const recType = dv.getUint32(pos, true);
    const recSize = dv.getUint32(pos + 4, true);
    if (recSize < 8 || pos + recSize > bytes.length) break;
    if (recType === 14) break;

    const p = pos + 8;
    if (recType === 27 && recSize >= 16) {
      curX = dv.getInt32(p, true);
      curY = dv.getInt32(p + 4, true);
    } else if (recType === 54 && recSize >= 16) {
      const x = dv.getInt32(p, true);
      const y = dv.getInt32(p + 4, true);
      svgParts.push(`<line x1="${curX}" y1="${curY}" x2="${x}" y2="${y}" stroke="#0f172a" stroke-width="${Math.max(1, vbW / 300)}" />`);
      curX = x;
      curY = y;
    } else if ((recType === 87 || recType === 86) && recSize >= 28) {
      const count = dv.getUint32(p + 16, true);
      const pts: string[] = [];
      for (let i = 0; i < count && p + 20 + i * 4 + 4 <= pos + recSize; i++) {
        pts.push(`${dv.getInt16(p + 20 + i * 4, true)},${dv.getInt16(p + 20 + i * 4 + 2, true)}`);
      }
      if (pts.length > 1) {
        const tag = recType === 86 ? 'polygon' : 'polyline';
        svgParts.push(`<${tag} points="${pts.join(' ')}" fill="none" stroke="#0f172a" stroke-width="${Math.max(1, vbW / 300)}" />`);
      }
    } else if (recType === 43 && recSize >= 24) {
      const l = dv.getInt32(p, true);
      const t = dv.getInt32(p + 4, true);
      const r = dv.getInt32(p + 8, true);
      const b = dv.getInt32(p + 12, true);
      svgParts.push(`<rect x="${l}" y="${t}" width="${Math.abs(r - l)}" height="${Math.abs(b - t)}" fill="none" stroke="#0f172a" stroke-width="${Math.max(1, vbW / 300)}" />`);
    } else if (recType === 42 && recSize >= 24) {
      const l = dv.getInt32(p, true);
      const t = dv.getInt32(p + 4, true);
      const r = dv.getInt32(p + 8, true);
      const b = dv.getInt32(p + 12, true);
      svgParts.push(`<ellipse cx="${(l + r) / 2}" cy="${(t + b) / 2}" rx="${Math.abs(r - l) / 2}" ry="${Math.abs(b - t) / 2}" fill="none" stroke="#0f172a" stroke-width="${Math.max(1, vbW / 300)}" />`);
    } else if (recType === 81 && recSize >= 80) {
      const offBmiSrc = dv.getUint32(p + 40, true);
      const cbBmiSrc = dv.getUint32(p + 44, true);
      const offBitsSrc = dv.getUint32(p + 48, true);
      const cbBitsSrc = dv.getUint32(p + 52, true);
      if (cbBmiSrc >= 40 && pos + offBmiSrc + cbBmiSrc <= bytes.length && pos + offBitsSrc + cbBitsSrc <= bytes.length) {
        const combined = new Uint8Array(cbBmiSrc + cbBitsSrc);
        combined.set(bytes.subarray(pos + offBmiSrc, pos + offBmiSrc + cbBmiSrc), 0);
        combined.set(bytes.subarray(pos + offBitsSrc, pos + offBitsSrc + cbBitsSrc), cbBmiSrc);
        const bmpUrl = dibToBmpDataUrl(combined);
        if (bmpUrl) return bmpUrl;
      }
    }

    pos += recSize;
  }

  if (svgParts.length === 0) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bLeft} ${bTop} ${vbW} ${vbH}" width="${vbW}" height="${vbH}" style="max-width:100%;height:auto;background:#fff">${svgParts.join('')}</svg>`;
  return `data:image/svg+xml;base64,${bytesToBase64(new TextEncoder().encode(svg))}`;
}

export function convertMetafileToDataUrl(bytes: Uint8Array, ext: string): string | null {
  const raster = extractEmbeddedRaster(bytes);
  if (raster) return raster;
  if (ext === 'wmf') return wmfToSvgDataUrl(bytes);
  if (ext === 'emf') return emfToSvgDataUrl(bytes);
  return null;
}
