const XML_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const EMU = 914400;
const xml = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const textRun = (value, properties = '') => `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(value)}</w:t></w:r>`;
const paragraph = (content, properties = '') => `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${content || textRun('')}</w:p>`;

const SYMBOLS = {
  '\\alpha':'α','\\beta':'β','\\gamma':'γ','\\delta':'δ','\\epsilon':'ε','\\theta':'θ','\\lambda':'λ','\\mu':'μ','\\pi':'π','\\rho':'ρ','\\sigma':'σ','\\phi':'φ','\\omega':'ω',
  '\\Alpha':'Α','\\Beta':'Β','\\Gamma':'Γ','\\Delta':'Δ','\\Theta':'Θ','\\Lambda':'Λ','\\Pi':'Π','\\Sigma':'Σ','\\Omega':'Ω',
  '\\times':'×','\\cdot':'·','\\pm':'±','\\mp':'∓','\\le':'≤','\\leq':'≤','\\ge':'≥','\\geq':'≥','\\neq':'≠','\\approx':'≈','\\equiv':'≡','\\infty':'∞','\\to':'→','\\rightarrow':'→','\\leftarrow':'←','\\Rightarrow':'⇒','\\angle':'∠','\\perp':'⊥','\\parallel':'∥','\\degree':'°','\\sum':'∑','\\int':'∫','\\partial':'∂','\\nabla':'∇','\\cup':'∪','\\cap':'∩','\\in':'∈','\\notin':'∉','\\subset':'⊂','\\subseteq':'⊆','\\emptyset':'∅','\\therefore':'∴','\\because':'∵','\\forall':'∀','\\exists':'∃','\\lim':'lim','\\log':'log','\\ln':'ln','\\sin':'sin','\\cos':'cos','\\tan':'tan','\\cot':'cot','\\max':'max','\\min':'min','\\cdots':'⋯','\\ldots':'…','\\dots':'…',
  '\\ ': ' ','\\,':' ','\\;':' ','\\!':'','\\quad':' ','\\qquad':'  '
};
function mathRun(value) { return `<m:r><m:t xml:space="preserve">${xml(value)}</m:t></m:r>`; }
function readGroup(source, start) {
  if (source[start] !== '{') return { value: source[start] || '', next: start + 1 };
  let depth = 1, i = start + 1;
  while (i < source.length && depth) { if (source[i] === '{') depth++; else if (source[i] === '}') depth--; i++; }
  return { value: source.slice(start + 1, depth ? source.length : i - 1), next: i };
}
function parseMathSequence(source) {
  const nodes = [];
  let i = 0;
  const readAtom = () => {
    if (source[i] === '{') {
      const group = readGroup(source, i); i = group.next;
      return `<m:e>${parseMathSequence(group.value)}</m:e>`;
    }
    if (source[i] === '\\') {
      const start = i++;
      let command = '';
      if (/[A-Za-z]/.test(source[i] || '')) {
        while (/[A-Za-z]/.test(source[i] || '')) command += source[i++];
      } else command = source[i++] || '';
      const full = `\\${command}`;
      if (['frac','dfrac','tfrac'].includes(command)) {
        while (source[i] === ' ') i++;
        const numerator = readGroup(source, i); i = numerator.next;
        while (source[i] === ' ') i++;
        const denominator = readGroup(source, i); i = denominator.next;
        return `<m:f><m:fPr><m:type m:val="bar"/></m:fPr><m:num>${parseMathSequence(numerator.value)}</m:num><m:den>${parseMathSequence(denominator.value)}</m:den></m:f>`;
      }
      if (command === 'sqrt') {
        while (source[i] === ' ') i++;
        const radicand = readGroup(source, i); i = radicand.next;
        return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${parseMathSequence(radicand.value)}</m:e></m:rad>`;
      }
      if (['vec','overrightarrow','bar','overline','hat','tilde'].includes(command)) {
        while (source[i] === ' ') i++;
        const group = readGroup(source, i); i = group.next;
        const accent = command === 'vec' || command === 'overrightarrow' ? '→' : command === 'hat' ? '^' : command === 'tilde' ? '~' : '¯';
        return `<m:acc><m:accPr><m:chr m:val="${xml(accent)}"/></m:accPr><m:e>${parseMathSequence(group.value)}</m:e></m:acc>`;
      }
      if (['text','mathrm','mathbf','mathit'].includes(command)) {
        const group = readGroup(source, i); i = group.next;
        const props = command === 'mathbf' ? '<m:rPr><m:b/></m:rPr>' : '';
        return `<m:r>${props}<m:t xml:space="preserve">${xml(group.value)}</m:t></m:r>`;
      }
      if (command === 'ce' || command === 'pu') {
        const group = readGroup(source, i); i = group.next;
        const chemistry = group.value
          .replace(/([A-Za-z])([0-9]+)/g, '$1_{$2}')
          .replace(/->|\\rightarrow/g, '\\rightarrow')
          .replace(/\\uparrow/g, '↑')
          .replace(/\\downarrow/g, '↓');
        return parseMathSequence(chemistry);
      }
      if (command === 'begin') {
        const env = readGroup(source, i); i = env.next;
        if (['matrix','pmatrix','bmatrix','cases','aligned'].includes(env.value)) {
          const ending = `\\end{${env.value}}`;
          const end = source.indexOf(ending, i);
          const raw = end >= 0 ? source.slice(i, end) : '';
          if (end >= 0) i = end + ending.length;
          const rows = raw.split('\\\\').map(row => row.split('&').map(cell => `<m:e>${parseMathSequence(cell.trim())}</m:e>`));
          const props = env.value === 'cases' ? '<m:mcJc m:val="left"/>' : '';
          return `<m:m><m:mPr>${props}</m:mPr>${rows.map(cells => `<m:mr>${cells.join('')}</m:mr>`).join('')}</m:m>`;
        }
      }
      if (SYMBOLS[full] !== undefined) return mathRun(SYMBOLS[full]);
      return mathRun(full || source.slice(start, i));
    }
    const char = source[i++];
    if (char === ' ') return mathRun(' ');
    if ('#%&_'.includes(char)) return mathRun(char);
    return mathRun(char);
  };

  while (i < source.length) {
    if (source[i] === '^' || source[i] === '_') {
      const kind = source[i++];
      while (source[i] === ' ') i++;
      const group = source[i] === '{' ? readGroup(source, i) : { value: source[i] || '', next: i + 1 };
      i = group.next;
      const base = nodes.pop() || mathRun('');
      const inner = parseMathSequence(group.value);
      nodes.push(kind === '^'
        ? `<m:sSup><m:e>${base}</m:e><m:sup>${inner}</m:sup></m:sSup>`
        : `<m:sSub><m:e>${base}</m:e><m:sub>${inner}</m:sub></m:sSub>`);
      continue;
    }
    nodes.push(readAtom());
  }
  return nodes.join('');
}
export function latexToOMML(latex) {
  const content = parseMathSequence(String(latex || '').replace(/\\left|\\right/g,''));
  return `<m:oMath>${content}</m:oMath>`;
}

function runProperties(node) {
  const tags = [];
  if (node.closest('strong,b')) tags.push('<w:b/>');
  if (node.closest('em,i')) tags.push('<w:i/>');
  if (node.closest('u')) tags.push('<w:u w:val="single"/>');
  if (node.closest('s,del')) tags.push('<w:strike/>');
  return tags.join('');
}
async function imageDimensions(dataUrl) {
  return new Promise(resolve => { const image = new Image(); image.onload=()=>resolve({width:image.naturalWidth||640,height:image.naturalHeight||420});image.onerror=()=>resolve({width:640,height:420});image.src=dataUrl; });
}
function base64Bytes(dataUrl) {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if(!match) throw Error('Một hình ảnh không hợp lệ để xuất Word.');
  const binary=atob(match[2]);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const ext=match[1].toLowerCase()==='jpeg'?'jpg':match[1].toLowerCase();return {bytes,ext,mime:ext==='jpg'?'image/jpeg':`image/${ext}`};
}

function makeZip(entries) {
  const encoder = new TextEncoder();
  const crcTable = new Uint32Array(256);
  for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);crcTable[n]=c>>>0;}
  const crc32 = data => {let c=0xFFFFFFFF;for(const b of data)c=crcTable[(c^b)&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
  const chunks=[],central=[];let offset=0;
  const u16=(view,pos,value)=>view.setUint16(pos,value,true),u32=(view,pos,value)=>view.setUint32(pos,value,true);
  for(const entry of entries){
    const name=encoder.encode(entry.name);const data=typeof entry.data==='string'?encoder.encode(entry.data):entry.data;const checksum=crc32(data);
    const local=new Uint8Array(30+name.length);const lv=new DataView(local.buffer);u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x0800);u16(lv,8,0);u16(lv,10,0);u16(lv,12,0);u32(lv,14,checksum);u32(lv,18,data.length);u32(lv,22,data.length);u16(lv,26,name.length);u16(lv,28,0);local.set(name,30);
    chunks.push(local,data);
    const c=new Uint8Array(46+name.length);const cv=new DataView(c.buffer);u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x0800);u16(cv,10,0);u16(cv,12,0);u16(cv,14,0);u32(cv,16,checksum);u32(cv,20,data.length);u32(cv,24,data.length);u16(cv,28,name.length);u16(cv,30,0);u16(cv,32,0);u16(cv,34,0);u16(cv,36,0);u32(cv,38,0);u32(cv,42,offset);c.set(name,46);central.push(c);offset+=local.length+data.length;
  }
  const centralSize=central.reduce((sum,item)=>sum+item.length,0);const end=new Uint8Array(22);const ev=new DataView(end.buffer);u32(ev,0,0x06054b50);u16(ev,4,0);u16(ev,6,0);u16(ev,8,entries.length);u16(ev,10,entries.length);u32(ev,12,centralSize);u32(ev,16,offset);u16(ev,20,0);
  return new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

export async function exportExamDocx({title,durationMinutes,metadata={},pages=[],studentVersion=false}) {
  if(!pages.length) throw Error('Không tìm thấy trang đề để xuất Word.');
  const imageParts=[];const rels=[];let nextRel=1,nextDocPr=1;
  const imageRunXml=async img=>{
    const dataUrl=img.getAttribute('src')||'';
    if(!dataUrl.startsWith('data:image/'))return textRun('[Hình minh họa]');
    const {bytes,ext,mime}=base64Bytes(dataUrl);const name=`image${imageParts.length+1}.${ext}`;imageParts.push({name,bytes,mime});
    const relId=`rId${nextRel++}`;rels.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`);
    const dimensions=await imageDimensions(dataUrl);const maxW=5.75*EMU,maxH=3.65*EMU;const percent=Math.max(.2,Math.min(1,Number(img.dataset.width||parseFloat(img.style.width)||70)/100));const scale=Math.min(maxW*percent/dimensions.width,maxH/dimensions.height,1);const cx=Math.round(dimensions.width*scale),cy=Math.round(dimensions.height*scale);
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${nextDocPr++}" name="Hình minh họa"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  };
  const imageXml=async img=>{
    const run=await imageRunXml(img);
    const align=({left:'left',right:'right',center:'center'}[img.closest('.exam-doc-figure')?.style.textAlign||'center']);
    return paragraph(run,`<w:jc w:val="${align}"/>`);
  };
  const inline = async node => {
    if(node.nodeType===Node.TEXT_NODE)return textRun(node.nodeValue||'');
    if(node.nodeType!==Node.ELEMENT_NODE)return '';
    const el=node;
    if(el.classList?.contains('exam-math-token'))return latexToOMML(el.dataset.latex||el.textContent||'');
    if(el.tagName==='IMG')return await imageRunXml(el);
    if(el.classList?.contains('exam-doc-figure')){const img=el.querySelector('img');return img?await imageRunXml(img):'';}
    if(el.tagName==='BR')return '<w:r><w:br/></w:r>';
    let children='';for(const child of el.childNodes)children+=await inline(child);
    const props=runProperties(el);
    if(['P','DIV','H1','H2','H3','H4','LI'].includes(el.tagName)){
      let ppr='';if(/^H[1-4]$/.test(el.tagName))ppr='<w:pStyle w:val="Heading1"/>';
      if(el.style?.textAlign==='center')ppr+='<w:jc w:val="center"/>';
      if(el.tagName==='LI')ppr+='<w:ind w:left="420" w:hanging="220"/>';
      return paragraph(children,ppr);
    }
    if(props&&children)return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${xml(el.textContent||'')}</w:t></w:r>`;
    return children;
  };
  const inlineRuns = async node => {
    if(node.nodeType===Node.TEXT_NODE)return textRun(node.nodeValue||'');
    if(node.nodeType!==Node.ELEMENT_NODE)return '';
    const el=node;
    if(el.classList?.contains('exam-math-token'))return latexToOMML(el.dataset.latex||el.textContent||'');
    if(el.tagName==='IMG')return await imageRunXml(el);
    if(el.classList?.contains('exam-doc-figure')){const img=el.querySelector('img');return img?await imageRunXml(img):'';}
    if(el.tagName==='BR')return '<w:r><w:br/></w:r>';
    let children='';
    for(const child of el.childNodes){
      if(child.nodeType===Node.ELEMENT_NODE&&['P','DIV'].includes(child.tagName)&&children)children+='<w:r><w:br/></w:r>';
      children+=await inlineRuns(child);
    }
    const props=runProperties(el);
    if(props&&children)return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${xml(el.textContent||'')}</w:t></w:r>`;
    return children;
  };
  const blocks=[];
  const headerLines=[
    {text:String(metadata.department||'SỞ GIÁO DỤC VÀ ĐÀO TẠO …'),bold:true,align:'center'},
    {text:String(metadata.school||'TRƯỜNG …'),bold:true,align:'center'},
    {text:String(metadata.examName||title||'ĐỀ KIỂM TRA'),bold:true,align:'center'},
    {text:`Môn: ${metadata.subject||'…'} · Lớp ${metadata.grade||'…'} · Thời gian: ${durationMinutes} phút`,bold:true,align:'center'}
  ];
  for(const line of headerLines)blocks.push(paragraph(textRun(line.text,line.bold?'<w:b/>':'') ,`<w:jc w:val="${line.align}"/><w:spacing w:after="40"/>`));
  blocks.push(paragraph(textRun('Họ và tên: ............................................................     Lớp: ............     Số báo danh: ................'),'<w:spacing w:after="220"/>'));
  const allPages=pages;
  for(let pageIndex=0;pageIndex<allPages.length;pageIndex++){
    const page=allPages[pageIndex];
    if(pageIndex>0)blocks.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    const flow=page.querySelector('.exam-a4-flow');if(!flow)continue;
    for(const node of [...flow.children]){
      if(node.classList.contains('exam-doc-page-break')){blocks.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');continue;}
      if(node.classList.contains('exam-doc-section')){
        blocks.push(paragraph(textRun((node.textContent||'').trim(),'<w:b/><w:sz w:val="26"/>'),'<w:jc w:val="center"/><w:spacing w:before="220" w:after="160"/>'));
        continue;
      }
      if(node.classList.contains('exam-doc-question')){
        const number=node.dataset.number||'1';const prompt=node.querySelector('.exam-doc-prompt');
        blocks.push(paragraph(textRun(`Câu ${number}${node.dataset.points?` (${node.dataset.points})`:''}. `,'<w:b/>')+(prompt?await inlineRuns(prompt):textRun('')),'<w:spacing w:before="120" w:after="50"/><w:keepNext/>'));
        const part=node.dataset.part;
        if(part==='I'){
          const options=[...node.querySelectorAll('.exam-doc-option')];
          const layout=node.querySelector('.exam-doc-options')?.dataset.layout||'2';
          const columns=layout==='4'?4:layout==='1'?1:2;
          for(let i=0;i<options.length;i+=columns){
            const cells=options.slice(i,i+columns).map(option=>{const letter=option.querySelector('.exam-option-letter')?.dataset.optionAnswer||'A';const content=option.querySelector('.exam-option-text');const correct=option.querySelector('.exam-option-letter')?.classList.contains('is-correct');const mark=!studentVersion&&correct?' ✓':'';return `<w:tc><w:tcPr><w:tcW w:w="${Math.floor(9000/columns)}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${paragraph(textRun(`${letter}. `,'<w:b/>')+(content?`<w:r>${!studentVersion&&correct?'<w:rPr><w:highlight w:val="yellow"/></w:rPr>':''}<w:t xml:space="preserve">${xml(content.textContent||'')}${mark}</w:t></w:r>`:textRun('')))}</w:tc>`;}).join('');
            blocks.push(`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid>${Array.from({length:columns},()=>`<w:gridCol w:w="${Math.floor(9000/columns)}"/>`).join('')}</w:tblGrid><w:tr>${cells}</w:tr></w:tbl>`);
          }
        } else if(part==='II'){
          for(const row of [...node.querySelectorAll('.exam-doc-statement')]){
            const letter=row.querySelector('b')?.textContent||'a)';const statement=row.querySelector('.exam-statement-text')?.textContent||'';
            const key=row.querySelector('[data-tf-answer].is-correct,[data-tf-answer].is-wrong')?.dataset.value;
            blocks.push(paragraph(textRun(`${letter} ${statement}${studentVersion?'     □ Đúng   □ Sai':!key?'':`     (${key==='true'?'Đúng':'Sai'})`}`),'<w:spacing w:after="60"/>')); 
          }
        } else {
          const answer=node.querySelector('.exam-short-answer')?.textContent||'';
          blocks.push(paragraph(textRun(`Đáp án: ${studentVersion?'................................':answer||'................................'}`)));
          if(!studentVersion){const solution=node.querySelector('.exam-solution');if(solution?.textContent?.trim())blocks.push(paragraph(textRun(`Lời giải: ${solution.textContent.trim()}`)));}
        }
        continue;
      }
      if(node.classList.contains('exam-doc-figure')){const img=node.querySelector('img');if(img)blocks.push(await imageXml(img));continue;}
      const value=await inline(node);if(value)blocks.push(value);
    }
  }
  const namespaces=`xmlns:w="${XML_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${namespaces}><w:body>${blocks.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="900" w:bottom="850" w:left="900" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="webp" ContentType="image/webp"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const relationships=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${XML_NS}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="340" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style></w:styles>`;
  const documentRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`;
  const now=new Date().toISOString();
  const core=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)}</dc:title><dc:creator>HTVVM Studio</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`;
  const app=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>HTVVM Studio</Application></Properties>`;
  const entries=[{name:'[Content_Types].xml',data:contentTypes},{name:'_rels/.rels',data:relationships},{name:'word/document.xml',data:documentXml},{name:'word/styles.xml',data:styles},{name:'word/_rels/document.xml.rels',data:documentRels},{name:'docProps/core.xml',data:core},{name:'docProps/app.xml',data:app},...imageParts.map(part=>({name:`word/media/${part.name}`,data:part.bytes}))];
  const blob=makeZip(entries);const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`${String(title||'de-thi').replace(/[^\p{L}\p{N}-]+/gu,'-').replace(/^-|-$/g,'')||'de-thi'}${studentVersion?'-ban-hoc-sinh':''}.docx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);return link.download;
}
