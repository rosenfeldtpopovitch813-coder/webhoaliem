import {BoardPage,H,TextItem,W,createPage} from '../types/board';

// Số điểm ảnh nền trên mỗi px logic của giấy (2 ≈ 190 dpi): nét hơn nhiều so với 1.12 trước đây,
// nhưng vẫn đủ nhẹ để mở PDF nhiều trang.
const QUALITY_DEFAULT=2;

type Run={x:number;y:number;size:number;w:number;text:string};

export type PdfImportResult={pages:BoardPage[];textRuns:number};

export async function pdfToPages(file:File,startIndex:number,editable:boolean,progress?:(i:number,n:number)=>void):Promise<PdfImportResult>{
  const pdfjs=await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
  const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
  // PDF càng dài càng giảm độ phân giải nền để tài liệu không phình quá lớn.
  const QUALITY=pdf.numPages>40?1.4:pdf.numPages>16?1.7:QUALITY_DEFAULT;
  const pages:BoardPage[]=[];let textRuns=0;
  for(let i=1;i<=pdf.numPages;i++){
    progress?.(i,pdf.numPages);
    const page=await pdf.getPage(i);
    const base=page.getViewport({scale:1});
    // Vừa khít trang A4 mà KHÔNG kéo giãn: giữ đúng tỉ lệ gốc của PDF, căn giữa theo chiều ngang.
    const fit=Math.min(W/base.width,H/base.height);
    const ox=(W-base.width*fit)/2,oy=0;
    const canvas=document.createElement('canvas');canvas.width=Math.round(W*QUALITY);canvas.height=Math.round(H*QUALITY);
    const ctx=canvas.getContext('2d',{willReadFrequently:editable})!;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    const viewport=page.getViewport({scale:fit*QUALITY,offsetX:ox*QUALITY,offsetY:oy*QUALITY});
    await page.render({canvasContext:ctx,viewport}).promise;
    const items:TextItem[]=[];
    if(editable){
      const logical=page.getViewport({scale:fit});
      const content=await page.getTextContent();
      const raw:Run[]=[];
      for(const it of content.items as Array<{str?:string;transform:ArrayLike<number>;width:number}>){
        if(typeof it.str!=='string'||!it.str.trim())continue;
        const t=pdfjs.Util.transform(logical.transform,it.transform);
        const size=Math.hypot(t[2],t[3]);
        // Chữ xoay/nghiêng để nguyên trong ảnh nền; chỉ tách chữ nằm ngang.
        if(size<4||Math.abs(t[1])>.01||t[0]<=0)continue;
        raw.push({x:ox+t[4],y:oy+t[5],size,w:it.width*fit,text:it.str});
      }
      raw.sort((a,b)=>Math.abs(a.y-b.y)<Math.min(a.size,b.size)*.3?a.x-b.x:a.y-b.y);
      // Gộp các đoạn chữ cùng dòng thành một khối để sửa cho tiện.
      const runs:Run[]=[];
      for(const r of raw){
        const last=runs[runs.length-1];
        const gap=last?r.x-(last.x+last.w):0;
        if(last&&Math.abs(last.y-r.y)<last.size*.3&&gap<last.size*.9&&gap>-last.size*.5){
          const spaced=gap>last.size*.12&&!last.text.endsWith(' ')&&!r.text.startsWith(' ');
          last.text+=(spaced?' ':'')+r.text;last.w=r.x+r.w-last.x;last.size=Math.max(last.size,r.size);
        }else runs.push({...r});
      }
      for(const r of runs){
        const x0=Math.max(0,Math.floor((r.x-1)*QUALITY)),y0=Math.max(0,Math.floor((r.y-r.size*.95)*QUALITY));
        const w=Math.min(canvas.width-x0,Math.ceil((r.w+2)*QUALITY)),h=Math.min(canvas.height-y0,Math.ceil(r.size*1.25*QUALITY));
        if(w<=0||h<=0)continue;
        // Màu chữ = điểm tối nhất trong khung; màu nền = điểm ngay sát bên trái khung (giữ nền màu/bảng).
        let color='#111111',min=255*3;
        const data=ctx.getImageData(x0,y0,w,h).data;
        for(let p=0;p<data.length;p+=8){const s=data[p]+data[p+1]+data[p+2];if(s<min){min=s;color=`rgb(${data[p]},${data[p+1]},${data[p+2]})`}}
        if(min>600)color='#111111';
        const sx=Math.max(0,x0-3),sy=Math.min(canvas.height-1,y0+Math.floor(h/2));
        const px=ctx.getImageData(sx,sy,1,1).data;
        ctx.fillStyle=`rgb(${px[0]},${px[1]},${px[2]})`;ctx.fillRect(x0,y0,w,h);
        items.push({id:crypto.randomUUID(),kind:'text',x:r.x,y:r.y,text:r.text,color,fontSize:Math.round(r.size*10)/10});
      }
      textRuns+=items.length;
    }
    pages.push({...createPage(startIndex+i),name:`${file.name} · ${i}`,background:'white',backgroundImage:encode(canvas),items});
    canvas.width=canvas.height=0;
  }
  return {pages,textRuns};
}

function encode(canvas:HTMLCanvasElement){
  // WebP nhẹ hơn JPEG ~30% ở cùng độ nét; trình duyệt không hỗ trợ sẽ tự về JPEG.
  const webp=canvas.toDataURL('image/webp',.9);
  return webp.startsWith('data:image/webp')?webp:canvas.toDataURL('image/jpeg',.9);
}
