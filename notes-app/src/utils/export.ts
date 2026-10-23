import {jsPDF} from 'jspdf';
import {BoardItem,BoardPage,H,W} from '../types/board';
import {dashArray,drawPage} from './render';
import {openShapes,shapePath} from './shapes';

function canvasFor(page:BoardPage,scale=2){
  const canvas=document.createElement('canvas');canvas.width=W*scale;canvas.height=H*scale;
  const ctx=canvas.getContext('2d')!;ctx.scale(scale,scale);drawPage(ctx,page);return canvas;
}
function download(url:string,name:string){
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  if(url.startsWith('blob:'))setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const dash=(width:number,pattern?:'solid'|'dashed'|'dotted')=>{const a=dashArray(pattern,width);return a.length?` stroke-dasharray="${a.join(' ')}"`:''};

function svgFor(page:BoardPage){
  const bg=page.paperColor||(page.background==='black'?'#202936':'#ffffff');
  let out=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="${esc(bg)}"/>`;
  if(page.backgroundImage)out+=`<image href="${esc(page.backgroundImage)}" width="${W}" height="${H}"/>`;
  const paper=page.background;
  if(!['white','black'].includes(paper)){
    const gap=page.spacing||(paper==='graph'||paper==='physics'?22:paper==='notebook'?30:28);
    const col=page.lineColor||(paper==='chemistry'?'#b9cfc9':'#b6d6eb');
    if(paper==='dots')for(let x=gap;x<W;x+=gap)for(let y=gap;y<H;y+=gap)out+=`<circle cx="${x}" cy="${y}" r="1.3" fill="${esc(col)}" opacity=".52"/>`;
    else{
      if(paper!=='lined'&&paper!=='notebook')for(let x=0;x<W;x+=gap)out+=`<path d="M${x} 0V${H}" stroke="${esc(col)}" opacity=".52"/>`;
      for(let y=gap;y<H;y+=gap)out+=`<path d="M0 ${y}H${W}" stroke="${esc(col)}" opacity=".52"/>`;
    }
  }
  if(paper==='lined'||paper==='notebook')out+=`<path d="M40 0V${H} M${W-40} 0V${H}" stroke="#ee7e91" opacity=".55"/><path d="M40 1H${W-40} M40 60H${W-40}" stroke="#5ca8f5" opacity=".75" stroke-dasharray="6 4"/>`;
  const isHighlight=(item:BoardItem)=>item.kind==='stroke'&&item.style.startsWith('highlighter');
  // Keep inserted scan/document images below marker strokes and keep all normal ink/text above.
  const orderedItems=[...page.items.filter(item=>item.kind==='image'),...page.items.filter(isHighlight),...page.items.filter(item=>item.kind!=='image'&&!isHighlight(item))];
  for(const item of orderedItems){
    if(item.kind==='stroke'){
      const d=item.points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ');
      const opacity=item.style.startsWith('highlighter')?1:item.style==='pencil'?item.opacity*.58:item.opacity;
      const factor=item.style.startsWith('highlighter')?4.4:item.style==='brush'?1.8:item.style==='marker'?1.35:1;
      const blend=isHighlight(item)?' style="mix-blend-mode:multiply"':'';
      out+=`<path d="${d}" fill="none" stroke="${esc(item.color)}" stroke-width="${item.width*factor}" stroke-linecap="${item.style==='highlighter-square'?'butt':'round'}" stroke-linejoin="round" opacity="${opacity}"${blend}${dash(item.width*factor,item.dash)}/>`;
    }else if(item.kind==='shape'){
      const cx=item.x+item.w/2,cy=item.y+item.h/2;
      const transform=item.rotation?` transform="rotate(${item.rotation} ${cx} ${cy})"`:'';
      out+=`<path d="${shapePath(item)}" stroke="${esc(item.color)}" stroke-width="${item.width}" stroke-linecap="round" stroke-linejoin="round" fill="${openShapes.has(item.shape)?'none':esc(item.fill)}" opacity="${item.opacity}"${dash(item.width,item.dash)}${transform}/>`;
    }else if(item.kind==='text'){
      const transform=item.rotation?` transform="rotate(${item.rotation} ${item.x} ${item.y})"`:'';
      item.text.split('\n').forEach((line,i)=>out+=`<text x="${item.x}" y="${item.y+i*item.fontSize*1.3}" fill="${esc(item.color)}" font-family="Arial, sans-serif" font-size="${item.fontSize}" font-weight="${item.bold?'bold':'normal'}" font-style="${item.italic?'italic':'normal'}"${transform}>${esc(line)}</text>`);
    }else out+=`<image href="${esc(item.src)}" x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}"${item.rotation?` transform="rotate(${item.rotation} ${item.x+item.w/2} ${item.y+item.h/2})"`:''}/>`;
  }
  return out+'</svg>';
}

async function waitImages(page:BoardPage){
  const srcs=[page.backgroundImage,...page.items.filter(i=>i.kind==='image').map(i=>i.src)].filter((s):s is string=>!!s);
  await Promise.all(srcs.map(src=>new Promise<void>(resolve=>{const img=new Image();img.onload=()=>resolve();img.onerror=()=>resolve();img.src=src;if(img.complete)resolve()})));
}

export async function exportPages(pages:BoardPage[],format:'png'|'jpg'|'pdf'|'svg',title:string){
  const safe=title.replace(/[^\p{L}\p{N}-]+/gu,'-').replace(/^-|-$/g,'')||'bai-giang';
  if(format==='pdf'){
    const pdf=new jsPDF({orientation:'portrait',unit:'px',format:[W,H],hotfixes:['px_scaling']});
    for(let i=0;i<pages.length;i++){if(i)pdf.addPage([W,H],'portrait');await waitImages(pages[i]);pdf.addImage(canvasFor(pages[i]).toDataURL('image/png'),'PNG',0,0,W,H)}
    pdf.save(`${safe}.pdf`);return;
  }
  for(let i=0;i<pages.length;i++){
    const page=pages[i],name=`${safe}-${i+1}.${format}`;await waitImages(page);
    if(format==='svg')download(URL.createObjectURL(new Blob([svgFor(page)],{type:'image/svg+xml'})),name);
    else download(canvasFor(page).toDataURL(format==='jpg'?'image/jpeg':'image/png',.96),name);
  }
}
