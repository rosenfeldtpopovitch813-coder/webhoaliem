import {useEffect,useRef} from 'react';
import {BoardPage,H,W} from '../../types/board';
import {drawPage} from '../../utils/render';
export default function PageThumbnail({page}: {page:BoardPage}){const ref=useRef<HTMLCanvasElement>(null);useEffect(()=>{const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);drawPage(ctx,page,()=>{const c=ref.current?.getContext('2d');if(c){c.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);drawPage(c,page)}})},[page]);return <canvas ref={ref} className="page-thumbnail" width="112" height="158" aria-hidden="true"/>}
