import {useEffect,useRef,useState} from 'react';
import {BoardItem,BoardPage,LinePattern,Point,Stroke,W,H} from '../../types/board';
import {bounds,drawItem,drawLiveStrokeSegment,drawPageBase,drawInteractionOverlay,hitItem,translateItem,unionVisibleBounds,visibleBounds,intersects,Rect} from '../../utils/render';
import {recognizeStroke} from '../../utils/recognize';
import {
  GeometryCanvasOverlay,
  GeometryToolState,
  LiveSnapFeedback,
  QuickGeometryAction,
  SnapSession,
  SnapTargetId,
  appendSnappedPoint,
  buildQuickGeometryStrokes,
  findSnapTarget,
  getGeometryToolState,
  normalizeDeg,
  startSnapSession,
  subscribeQuickGeometryAction,
  useGeometryToolState,
} from '../GeometryTools/GeometryTools';

export type ActiveTool='pen'|'highlighter'|'eraser'|'select'|'shape'|'text'|'math'|'pan'|'laser';
export type BoardSettings={
  color:string;width:number;opacity:number;style:string;dash:LinePattern;shape:string;
  eraser:'stroke'|'pixel'|'object';eraserSize:number;fill:string;ignorePressure:boolean;
  allowFinger:boolean;recognize:boolean;textSize:number;
  laserStyle:'dot'|'ring'|'spotlight';laserColor:string;laserSize:number;highlightColor:string;
};
type Props={
  page:BoardPage;tool:ActiveTool;settings:BoardSettings;selected:string|null;selectedIds?:string[];isActive?:boolean;
  onSelect:(id:string|null)=>void;onSelectMany?:(ids:string[])=>void;onEditText?:(id:string)=>void;
  onCommit:(items:BoardItem[],overflow?:BoardItem|BoardItem[],nearBottom?:boolean)=>void;
  onInsertText:(x:number,y:number,math:boolean)=>void;
  onPan:(dx:number,dy:number)=>void;onZoomDrag:(delta:number,clientX?:number,clientY?:number)=>void;zoom:number;
};
type ResizeHandle='nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w';
type TransientLaser={stroke:Stroke;startedAt:number;opacity:number};
type BaseRenderSnapshot={
  pageId:string;background:BoardPage['background'];backgroundImage?:string;paperColor?:string;lineColor?:string;
  spacing?:number;border?:boolean;margins?:boolean;ratio:number;pixelWidth:number;pixelHeight:number;
  excludedKey:string;itemRefs:BoardItem[];
};
type Gesture={start:Point;item?:BoardItem;items?:BoardItem[];ids?:string[];groupBounds?:Rect;resizeHandle?:ResizeHandle;mode:'pan'|'zoom'|'erase'|'eraseOnce'|'temporaryErase'|'marquee'|'moveSelection'|'resize'|'rotateSelection'|'draw'|'laser'|'noop';lastX:number;lastY:number;lastAngle?:number;rotationDegrees?:number;rotationCenter?:Point;additive?:boolean;moved?:boolean;baseIds?:string[]};

function splitStroke(stroke:Stroke):{current:Stroke|null;overflow:Stroke|null}{
  const index=stroke.points.findIndex(p=>p.y>=H);
  if(index<0)return {current:stroke,overflow:null};
  if(index===0)return {current:null,overflow:{...stroke,id:crypto.randomUUID(),points:stroke.points.map(p=>({...p,y:p.y-H}))}};
  const a=stroke.points[index-1],b=stroke.points[index],ratio=(H-a.y)/Math.max(.001,b.y-a.y);
  const cut:Point={x:a.x+(b.x-a.x)*ratio,y:H,p:a.p+(b.p-a.p)*ratio,t:(a.t??0)+((b.t??a.t??0)-(a.t??0))*ratio,tiltX:(a.tiltX??0)+((b.tiltX??a.tiltX??0)-(a.tiltX??0))*ratio,tiltY:(a.tiltY??0)+((b.tiltY??a.tiltY??0)-(a.tiltY??0))*ratio};
  return {current:{...stroke,points:[...stroke.points.slice(0,index),cut]},overflow:{...stroke,id:crypto.randomUUID(),points:[{...cut,y:0},...stroke.points.slice(index).map(p=>({...p,y:p.y-H}))]}};
}
function itemMovedPastBottom(item:BoardItem):{current:BoardItem|null;overflow:BoardItem[]}{
  if(item.kind==='stroke'){
    const split=splitStroke(item);
    return {current:split.current,overflow:split.overflow?[split.overflow]:[]};
  }
  if(item.kind==='text'){
    const lineCount=Math.max(1,item.text.split('\n').length);
    const bottom=item.y+(lineCount-1)*item.fontSize*1.3+item.fontSize*.28;
    if(item.y<H&&bottom<=H)return {current:item,overflow:[]};
    // Text moves as a whole; splitting text baselines across pages would make it unreadable.
    const nextY=item.y>=H?item.y-H:36;
    return {current:null,overflow:[{...item,id:crypto.randomUUID(),y:Math.max(30,Math.min(H-item.fontSize,nextY))}]};
  }
  const top=Math.min(item.y,item.y+item.h),bottom=Math.max(item.y,item.y+item.h);
  if(top>=H)return {current:null,overflow:[{...translateItem(item,0,-H),id:crypto.randomUUID()} as BoardItem]};
  if(bottom>H)return {current:item,overflow:[{...translateItem(item,0,-H),id:crypto.randomUUID()} as BoardItem]};
  return {current:item,overflow:[]};
}
function translateItems(items:BoardItem[],dx:number,dy:number){return items.map(item=>translateItem(item,dx,dy))}
function normalizeRect(a:Point,b:Point):Rect{return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)}}
function resizeHandleAt(p:Point,b:Rect):ResizeHandle|null{
  const l=b.x-5,t=b.y-5,r=b.x+b.w+5,bt=b.y+b.h+5,mx=(l+r)/2,my=(t+bt)/2;
  const handles:{id:ResizeHandle;x:number;y:number}[]=[{id:'nw',x:l,y:t},{id:'n',x:mx,y:t},{id:'ne',x:r,y:t},{id:'e',x:r,y:my},{id:'se',x:r,y:bt},{id:'s',x:mx,y:bt},{id:'sw',x:l,y:bt},{id:'w',x:l,y:my}];
  const hit=handles.find(h=>Math.hypot(p.x-h.x,p.y-h.y)<=13);return hit?.id||null;
}
function rotationHandleAt(p:Point,b:Rect):boolean{
  const x=b.x+b.w/2,y=b.y-33;
  return Math.hypot(p.x-x,p.y-y)<=13;
}
function rotateSelection(items:BoardItem[],degrees:number,center:Point):BoardItem[]{
  if(!degrees)return items;
  const a=degrees*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a);
  const rotatePoint=(p:Point):Point=>({ ...p,x:center.x+(p.x-center.x)*cos-(p.y-center.y)*sin,y:center.y+(p.x-center.x)*sin+(p.y-center.y)*cos });
  return items.map(item=>{
    if(item.kind==='stroke')return {...item,points:item.points.map(rotatePoint)};
    const b=bounds(item),itemCenter={x:b.x+b.w/2,y:b.y+b.h/2},nextCenter=rotatePoint({...itemCenter,p:.5});
    const dx=nextCenter.x-itemCenter.x,dy=nextCenter.y-itemCenter.y;
    return {...item,x:item.x+dx,y:item.y+dy,rotation:((item.rotation||0)+degrees)%360} as BoardItem;
  });
}
function normalizeAngleRadians(angle:number){while(angle>Math.PI)angle-=Math.PI*2;while(angle< -Math.PI)angle+=Math.PI*2;return angle}
function scaleSelectionFromAnchor(items:BoardItem[],sx:number,sy:number,anchor:Point):BoardItem[]{
  // Permit the dragged handle to cross its opposite anchor: negative scales
  // intentionally mirror the selected content, as in a desktop select tool.
  const safe=(s:number)=>Math.abs(s)<.025?(s<0?-.025:.025):s;
  sx=safe(sx);sy=safe(sy);
  return items.map(item=>{
    if(item.kind==='stroke')return {...item,points:item.points.map(p=>({...p,x:anchor.x+(p.x-anchor.x)*sx,y:anchor.y+(p.y-anchor.y)*sy}))};
    const b=bounds(item),x1=anchor.x+(b.x-anchor.x)*sx,x2=anchor.x+(b.x+b.w-anchor.x)*sx,y1=anchor.y+(b.y-anchor.y)*sy,y2=anchor.y+(b.y+b.h-anchor.y)*sy;
    const left=Math.min(x1,x2),top=Math.min(y1,y2),w=Math.max(1,Math.abs(x2-x1)),h=Math.max(1,Math.abs(y2-y1));
    const reflectX=sx<0,reflectY=sy<0,rotation=reflectX!==reflectY?-(item.rotation||0):(item.rotation||0);
    const legacyShapeFlipX=item.kind==='shape'&&item.w<0,legacyShapeFlipY=item.kind==='shape'&&item.h<0;
    const flipX=(!!item.flipX!==reflectX)!==legacyShapeFlipX,flipY=(!!item.flipY!==reflectY)!==legacyShapeFlipY;
    if(item.kind==='text')return {...item,x:left,y:top+Math.max(8,item.fontSize*Math.abs(sy)),fontSize:Math.max(8,item.fontSize*Math.abs(sy)),flipX,flipY,rotation};
    return {...item,x:left,y:top,w,h,flipX,flipY,rotation} as BoardItem;
  });
}
function resizedSelection(g:Gesture,p:Point):BoardItem[]{
  const b=g.groupBounds!,h=g.resizeHandle!;const dx=p.x-g.start.x,dy=p.y-g.start.y;
  const west=h.includes('w'),east=h.includes('e'),north=h.includes('n'),south=h.includes('s');
  let sx=1,sy=1,anchorX=b.x+b.w/2,anchorY=b.y+b.h/2;
  if(west){anchorX=b.x+b.w;const startX=b.x,curX=b.x+dx;sx=(curX-anchorX)/(startX-anchorX||-1)}
  else if(east){anchorX=b.x;const startX=b.x+b.w,curX=startX+dx;sx=(curX-anchorX)/(startX-anchorX||1)}
  if(north){anchorY=b.y+b.h;const startY=b.y,curY=b.y+dy;sy=(curY-anchorY)/(startY-anchorY||-1)}
  else if(south){anchorY=b.y;const startY=b.y+b.h,curY=startY+dy;sy=(curY-anchorY)/(startY-anchorY||1)}
  if(!west&&!east)anchorX=b.x; if(!north&&!south)anchorY=b.y;
  return scaleSelectionFromAnchor(g.items||[],sx,sy,{x:anchorX,y:anchorY,p:.5});
}

export default function Whiteboard({page,tool,settings,selected,selectedIds=[],isActive=true,onSelect,onSelectMany,onEditText,onCommit,onInsertText,onPan,onZoomDrag,zoom}:Props){
  const canvas=useRef<HTMLCanvasElement>(null);const wetCanvas=useRef<HTMLCanvasElement>(null);const overlayCanvas=useRef<HTMLCanvasElement>(null);const laserCanvas=useRef<HTMLCanvasElement>(null);const laserBuffer=useRef<HTMLCanvasElement|null>(null);const baseSnapshot=useRef<BaseRenderSnapshot|null>(null);
  const [draft,setDraft]=useState<BoardItem|null>(null);const draftRef=useRef<BoardItem|null>(null);
  const draftPublishFrame=useRef<number>(0);const predictedPublishFrame=useRef<number>(0);const pendingPredictedPoints=useRef<Point[]>([]);
  const [previewItems,setPreviewItems]=useState<BoardItem[]|null>(null);
  const [transientLasers,setTransientLasers]=useState<TransientLaser[]>([]);const [predictedPoints,setPredictedPoints]=useState<Point[]>([]);const [eraserCursor,setEraserCursor]=useState<Point|null>(null);
  const [marquee,setMarquee]=useState<Rect|null>(null);
  const [geometryState,setGeometryState]=useGeometryToolState();
  const snapSessionRef=useRef<SnapSession|null>(null);
  const [hoveredSnap,setHoveredSnap]=useState<SnapTargetId|null>(null);
  const [liveFeedback,setLiveFeedback]=useState<LiveSnapFeedback|null>(null);
  const updateDraft=(item:BoardItem|null)=>{
    draftRef.current=item;
    if(item===null){
      if(draftPublishFrame.current)cancelAnimationFrame(draftPublishFrame.current);
      draftPublishFrame.current=0;setDraft(null);return;
    }
    if(!draftPublishFrame.current)draftPublishFrame.current=requestAnimationFrame(()=>{
      draftPublishFrame.current=0;setDraft(draftRef.current);
    });
  };
  const clearPredictedPoints=()=>{
    if(predictedPublishFrame.current)cancelAnimationFrame(predictedPublishFrame.current);
    predictedPublishFrame.current=0;
    const hadPredictions=pendingPredictedPoints.current.length>0||predictedPoints.length>0;
    pendingPredictedPoints.current=[];
    if(hadPredictions)setPredictedPoints([]);
  };
  useEffect(()=>()=>{if(draftPublishFrame.current)cancelAnimationFrame(draftPublishFrame.current);if(predictedPublishFrame.current)cancelAnimationFrame(predictedPublishFrame.current)},[]);
  const gesture=useRef<Gesture|null>(null);const activePointerId=useRef<number|null>(null);const baseFrame=useRef<number>(0);const overlayFrame=useRef<number>(0);const space=useRef(false);const baseContext=useRef<CanvasRenderingContext2D|null>(null);const wetContext=useRef<CanvasRenderingContext2D|null>(null);const overlayContext=useRef<CanvasRenderingContext2D|null>(null);const laserContext=useRef<CanvasRenderingContext2D|null>(null);
  const currentSelection=selectedIds.length?selectedIds:(selected?[selected]:[]);
  const commitSelection=(ids:string[])=>{if(onSelectMany)onSelectMany(ids);else onSelect(ids[0]||null)};
  useEffect(()=>{
    if(!isActive)return;
    return subscribeQuickGeometryAction((action:QuickGeometryAction)=>{
      const st=getGeometryToolState();
      if(!st.open)return;
      const strokeColor=settings.style.startsWith('highlighter')?settings.highlightColor:settings.color;
      const strokes=buildQuickGeometryStrokes(st,action,{
        color:strokeColor,
        width:settings.width,
        opacity:settings.opacity,
        style:settings.style,
        dash:settings.dash,
      });
      if(strokes.length)onCommit([...page.items,...strokes]);
    });
  },[isActive,page.items,settings,onCommit]);
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{if(e.code==='Space'&&!['INPUT','TEXTAREA'].includes((e.target as HTMLElement).tagName)){space.current=true;e.preventDefault()}};
    const up=(e:KeyboardEvent)=>{if(e.code==='Space')space.current=false};
    const blur=()=>{space.current=false;activePointerId.current=null;gesture.current=null;snapSessionRef.current=null;setLiveFeedback(null);setHoveredSnap(null);updateDraft(null);clearPredictedPoints();setPreviewItems(null);setMarquee(null);setTransientLasers([])};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur)};
  },[]);
  // Limit backing-store resolution to prevent 4x DPR canvases from consuming hundreds of MB.
  // Live pen segments are drawn imperatively, so the lower cap improves latency without losing sample density.
  const ratio=Math.min(isActive?2:1.5,Math.max(1,Math.ceil((window.devicePixelRatio||1)*Math.min(zoom,1.25)*2)/2));
  const setCanvasSize=(el:HTMLCanvasElement,ctx:CanvasRenderingContext2D,renderRatio:number)=>{
    const pixelWidth=Math.round(W*renderRatio),pixelHeight=Math.round(H*renderRatio);
    if(el.width!==pixelWidth||el.height!==pixelHeight){el.width=pixelWidth;el.height=pixelHeight}
    ctx.setTransform(renderRatio,0,0,renderRatio,0,0);
  };
  const clearWetLayer=()=>{
    const el=wetCanvas.current,ctx=wetContext.current;if(!el||!ctx)return;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,el.width,el.height);ctx.restore();
    el.style.mixBlendMode='normal';
  };
  const prepareWetLayer=(item:Stroke)=>{
    const el=wetCanvas.current,ctx=wetContext.current;if(!el||!ctx)return null;
    setCanvasSize(el,ctx,ratio);
    const blend=(item.style.startsWith('highlighter')||item.style==='marker')?'multiply':'normal';
    if(el.style.mixBlendMode!==blend)el.style.mixBlendMode=blend;
    return ctx;
  };
  const beginWetStroke=(item:Stroke,point:Point)=>{
    const ctx=prepareWetLayer(item);if(!ctx)return;
    // The stroke starts on the active layer immediately; no React render is needed.
    drawLiveStrokeSegment(ctx,item,point,point);
  };
  const appendWetPoints=(item:Stroke,points:Point[])=>{
    if(!points.length)return;
    const ctx=prepareWetLayer(item);
    let previous=item.points[item.points.length-1];
    for(const point of points){
      if(ctx)drawLiveStrokeSegment(ctx,item,previous,point);
      item.points.push(point);previous=point;
    }
    // Draft objects are mutable only while the pointer is down; they become immutable
    // document objects after pointer-up commits the completed stroke.
    draftRef.current=item;
  };
  useEffect(()=>{
    const base=canvas.current?.getContext('2d',{alpha:false,desynchronized:true});
    const wet=wetCanvas.current?.getContext('2d',{alpha:true,desynchronized:true});
    const overlay=overlayCanvas.current?.getContext('2d',{alpha:true,desynchronized:true});
    // Laser ink owns an isolated transparent surface: fading it can only clear its own pixels,
    // never the static document canvas, imported PDFs, highlighter strokes, or normal ink.
    const laser=laserCanvas.current?.getContext('2d',{alpha:true,desynchronized:true});
    baseContext.current=base||null;wetContext.current=wet||null;overlayContext.current=overlay||null;laserContext.current=laser||null;
    return()=>{baseContext.current=null;wetContext.current=null;overlayContext.current=null;laserContext.current=null;laserBuffer.current=null};
  },[]);
  const previewKey=previewItems?.map(item=>item.id).sort().join('|')||'';
  const paintBase=()=>{
    const el=canvas.current,ctx=baseContext.current;if(!el||!ctx)return;
    const pixelWidth=Math.round(W*ratio),pixelHeight=Math.round(H*ratio);
    const resized=el.width!==pixelWidth||el.height!==pixelHeight;
    setCanvasSize(el,ctx,ratio);
    const excluded=previewItems?.length?new Set(previewItems.map(item=>item.id)):undefined;
    const excludedKey=excluded?[...excluded].sort().join('|'):'';
    const renderPage=excluded?{...page,items:page.items.filter(item=>!excluded.has(item.id))}:page;
    const prior=baseSnapshot.current;
    const metaMatches=!!prior&&!resized&&prior.pageId===page.id&&prior.background===page.background
      &&prior.backgroundImage===page.backgroundImage&&prior.paperColor===page.paperColor&&prior.lineColor===page.lineColor
      &&prior.spacing===page.spacing&&prior.border===page.border&&prior.margins===page.margins
      &&prior.ratio===ratio&&prior.pixelWidth===pixelWidth&&prior.pixelHeight===pixelHeight&&prior.excludedKey===excludedKey;
    if(metaMatches&&prior){
      const prefixMatches=prior.itemRefs.length<=renderPage.items.length&&prior.itemRefs.every((item,i)=>renderPage.items[i]===item);
      if(prefixMatches){
        const appended=renderPage.items.slice(prior.itemRefs.length);
        const canAppend=excludedKey===''&&appended.every(item=>item.kind!=='image'&&!(item.kind==='stroke'&&item.style.startsWith('highlighter')));
        if(canAppend){
          if(!appended.length)return;
          // Most teaching strokes are append-only foreground objects. Draw only the new items
          // rather than re-rendering every prior textured stroke after each pointer-up.
          const redrawAfterAssetLoad=()=>{baseSnapshot.current=null;baseFrame.current=requestAnimationFrame(paintBase)};
          appended.forEach(item=>drawItem(ctx,item,redrawAfterAssetLoad));
          baseSnapshot.current={pageId:page.id,background:page.background,backgroundImage:page.backgroundImage,paperColor:page.paperColor,
            lineColor:page.lineColor,spacing:page.spacing,border:page.border,margins:page.margins,ratio,pixelWidth,pixelHeight,excludedKey,
            itemRefs:renderPage.items.slice()};
          if(activePointerId.current===null&&!draftRef.current)clearWetLayer();
          return;
        }
      }
    }
    drawPageBase(ctx,renderPage,()=>{baseSnapshot.current=null;baseFrame.current=requestAnimationFrame(paintBase)});
    baseSnapshot.current={pageId:page.id,background:page.background,backgroundImage:page.backgroundImage,paperColor:page.paperColor,
      lineColor:page.lineColor,spacing:page.spacing,border:page.border,margins:page.margins,ratio,pixelWidth,pixelHeight,excludedKey,
      itemRefs:renderPage.items.slice()};
    if(activePointerId.current===null&&!draftRef.current)clearWetLayer();
  };
  useEffect(()=>{cancelAnimationFrame(baseFrame.current);baseFrame.current=requestAnimationFrame(paintBase);return()=>cancelAnimationFrame(baseFrame.current)},[page,ratio,previewKey]);
  const visualDraft:BoardItem|null=draft?.kind==='stroke'&&predictedPoints.length?{...draft,points:[...draft.points,...predictedPoints]}:draft;
  const laserDraft=tool==='laser'&&visualDraft?.kind==='stroke'&&visualDraft.style==='neon'?visualDraft:null;
  const paintOverlay=()=>{
    const el=overlayCanvas.current,ctx=overlayContext.current;if(!el||!ctx)return;
    const pixelWidth=Math.round(W*ratio),pixelHeight=Math.round(H*ratio);
    if(el.width!==pixelWidth||el.height!==pixelHeight){el.width=pixelWidth;el.height=pixelHeight}
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,el.width,el.height);ctx.setTransform(ratio,0,0,ratio,0,0);
    // Keep the live laser and its fading trails off this canvas entirely.
    const interactionDraft=(laserDraft||visualDraft?.kind==='stroke')?null:visualDraft;
    const activeOverlay=interactionDraft||previewItems;
    const overlays:BoardItem[] = activeOverlay ? (Array.isArray(activeOverlay)?activeOverlay:[activeOverlay]) : [];
    drawInteractionOverlay(ctx,page,()=>{overlayFrame.current=requestAnimationFrame(paintOverlay)},overlays.length?overlays:undefined,currentSelection,marquee||undefined,tool==='eraser'&&eraserCursor?{x:eraserCursor.x,y:eraserCursor.y,radius:settings.eraserSize}:undefined,!!(draft?.kind==='stroke'&&gesture.current?.mode==='draw'));
  };
  const paintLaserOverlay=()=>{
    const el=laserCanvas.current,ctx=laserContext.current;if(!el||!ctx)return;
    const pixelWidth=Math.round(W*ratio),pixelHeight=Math.round(H*ratio);
    if(el.width!==pixelWidth||el.height!==pixelHeight){el.width=pixelWidth;el.height=pixelHeight}
    // Draw every fading neon trail into a disposable transparent buffer, NEVER onto
    // the document/selection surfaces. Only the completed buffer is composited.
    let buffer=laserBuffer.current;
    if(!buffer){buffer=document.createElement('canvas');laserBuffer.current=buffer}
    if(buffer.width!==pixelWidth||buffer.height!==pixelHeight){buffer.width=pixelWidth;buffer.height=pixelHeight}
    const ink=buffer.getContext('2d',{alpha:true});if(!ink)return;
    ink.setTransform(1,0,0,1,0,0);
    ink.globalCompositeOperation='source-over';ink.globalAlpha=1;ink.filter='none';
    ink.clearRect(0,0,buffer.width,buffer.height);
    ink.setTransform(ratio,0,0,ratio,0,0);
    if(laserDraft)drawItem(ink,laserDraft);
    for(const entry of transientLasers)drawItem(ink,{...entry.stroke,opacity:entry.opacity});
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.filter='none';
    ctx.clearRect(0,0,el.width,el.height);
    ctx.drawImage(buffer,0,0);
  };
  useEffect(()=>{cancelAnimationFrame(overlayFrame.current);overlayFrame.current=requestAnimationFrame(paintOverlay);return()=>cancelAnimationFrame(overlayFrame.current)},[page,draft,predictedPoints,previewItems,currentSelection.join('|'),marquee,ratio,eraserCursor,tool,settings.eraserSize]);
  useEffect(()=>{let frame=requestAnimationFrame(paintLaserOverlay);return()=>cancelAnimationFrame(frame)},[draft,predictedPoints,transientLasers,ratio,tool]);
  // Laser strokes are overlays, never committed to the document. Hold briefly, then fade smoothly.
  useEffect(()=>{
    if(!transientLasers.length)return;
    const timer=window.setInterval(()=>{
      const now=performance.now();
      setTransientLasers(current=>current.map(entry=>({...entry,opacity:Math.max(0,1-Math.max(0,now-entry.startedAt)/1150)})).filter(entry=>entry.opacity>.015));
    },32);
    return()=>window.clearInterval(timer);
  },[transientLasers.length>0]);
  const loc=(e:{clientX:number;clientY:number;pressure:number;timeStamp?:number;tiltX?:number;tiltY?:number}):Point=>{const r=canvas.current!.getBoundingClientRect();const pressure=e.pressure>0?e.pressure:.5;return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height,p:Math.max(.05,Math.min(1,pressure)),t:e.timeStamp??performance.now(),tiltX:e.tiltX,tiltY:e.tiltY}};
  const erase=(p:Point)=>{
    // Neon strokes visibly extend well beyond their centerline because of the bloom and
    // shadow. Prioritize that visible neon stroke inside its glow radius so an eraser never
    // accidentally removes a PDF/image, shape, or ordinary stroke underneath the glow.
    const neonTarget=[...page.items].reverse().find((item):item is Stroke=>item.kind==='stroke'&&item.style==='neon'&&hitItem(item,p.x,p.y,Math.max(settings.eraserSize,item.width*2.05+23)));
    if(neonTarget){
      if(settings.eraser==='pixel'){
        const radius=Math.max(settings.eraserSize,neonTarget.width*2.05+23);
        const fragments:Point[][]=[];let segment:Point[]=[];
        for(const pt of neonTarget.points){
          if(Math.hypot(pt.x-p.x,pt.y-p.y)<=radius){if(segment.length>=2)fragments.push(segment);segment=[]}
          else segment.push(pt);
        }
        if(segment.length>=2)fragments.push(segment);
        // Pixel erasing a neon path changes only that neon item's samples. No other stroke
        // is considered during this gesture, even when it crosses an object below the glow.
        const replacements:BoardItem[]=fragments.map((points,index)=>({...neonTarget,id:index===0?neonTarget.id:crypto.randomUUID(),points}));
        onCommit(page.items.flatMap(item=>item.id===neonTarget.id?replacements:[item]));
      }else{
        // Stroke/object eraser removes the persistent neon line itself, not the objects
        // that happen to be underneath its rendered glow.
        onCommit(page.items.filter(item=>item.id!==neonTarget.id));
        commitSelection([]);
      }
      return;
    }
    if(settings.eraser==='pixel'){
      const next:BoardItem[]=[];page.items.forEach(item=>{if(item.kind!=='stroke'){next.push(item);return}let segment:Point[]=[];item.points.forEach(pt=>{if(Math.hypot(pt.x-p.x,pt.y-p.y)<=settings.eraserSize){if(segment.length>1)next.push({...item,id:crypto.randomUUID(),points:segment});segment=[]}else segment.push(pt)});if(segment.length>1)next.push({...item,id:crypto.randomUUID(),points:segment})});onCommit(next);
    }else{const found=[...page.items].reverse().find(i=>hitItem(i,p.x,p.y,settings.eraserSize));if(found){onCommit(page.items.filter(i=>i.id!==found.id));commitSelection([])}}
  };
  const laserStroke=(p:Point):Stroke=>({id:'transient-laser-'+crypto.randomUUID(),kind:'stroke',points:[p],color:settings.laserColor,width:settings.laserSize,opacity:1,style:'neon',dash:'solid',ignorePressure:true});
  const down=(e:React.PointerEvent)=>{
    if(e.pointerType==='touch'&&(!settings.allowFinger||(e.width>35&&e.height>35)))return;
    if(activePointerId.current!==null)return;activePointerId.current=e.pointerId;
    const p=loc(e);setEraserCursor(p);clearPredictedPoints();overlayCanvas.current?.setPointerCapture(e.pointerId);
    const stylusEraser=e.pointerType==='pen'&&(e.button===5||(e.buttons&32)===32||e.button===2||(e.buttons&2)===2);
    if(stylusEraser){gesture.current={start:p,mode:'temporaryErase',lastX:p.x,lastY:p.y};erase(p);return}
    if(e.ctrlKey&&e.pointerType==='mouse'){e.preventDefault();gesture.current={start:p,mode:'zoom',lastX:e.clientX,lastY:e.clientY};return}
    if(tool==='pan'||space.current||e.button===1||e.buttons===4){gesture.current={start:p,mode:'pan',lastX:e.clientX,lastY:e.clientY};return}
    if(e.button===2&&e.pointerType!=='pen'){gesture.current={start:p,mode:'eraseOnce',lastX:p.x,lastY:p.y};erase(p);return}
    if(tool==='text'||tool==='math'){onInsertText(p.x,p.y,tool==='math');return}
    if(tool==='select'){
      const selectedItems=page.items.filter(i=>currentSelection.includes(i.id));const groupBounds=unionVisibleBounds(selectedItems);
      if(selectedItems.length&&rotationHandleAt(p,groupBounds)){
        const rotationCenter={x:groupBounds.x+groupBounds.w/2,y:groupBounds.y+groupBounds.h/2,p:.5};
        gesture.current={start:p,items:selectedItems,ids:selectedItems.map(i=>i.id),groupBounds,rotationCenter,lastAngle:Math.atan2(p.y-rotationCenter.y,p.x-rotationCenter.x),rotationDegrees:0,mode:'rotateSelection',lastX:p.x,lastY:p.y,moved:false};return;
      }
      const handle=selectedItems.length?resizeHandleAt(p,groupBounds):null;
      if(handle){gesture.current={start:p,items:selectedItems,ids:selectedItems.map(i=>i.id),groupBounds,resizeHandle:handle,mode:'resize',lastX:p.x,lastY:p.y,moved:false};return}
      const hit=[...page.items].reverse().find(i=>hitItem(i,p.x,p.y));
      if(hit&&e.shiftKey){
        const toggled=currentSelection.includes(hit.id)?currentSelection.filter(id=>id!==hit.id):[...currentSelection,hit.id];commitSelection(toggled);
        if(currentSelection.includes(hit.id)){gesture.current={start:p,mode:'noop',lastX:p.x,lastY:p.y};return}
        const items=page.items.filter(i=>toggled.includes(i.id));gesture.current={start:p,items,ids:toggled,groupBounds:unionVisibleBounds(items),mode:'moveSelection',lastX:p.x,lastY:p.y,moved:false};return;
      }
      if(hit&&currentSelection.includes(hit.id)){
        const items=page.items.filter(i=>currentSelection.includes(i.id));gesture.current={start:p,items,ids:currentSelection,groupBounds:unionVisibleBounds(items),mode:'moveSelection',lastX:p.x,lastY:p.y,moved:false};return;
      }
      // Once a group is selected, dragging anywhere inside its frame moves it,
      // even in blank space between sparse strokes (matching Scrble-style select).
      const insideFrame=selectedItems.length&&p.x>=groupBounds.x-7&&p.x<=groupBounds.x+groupBounds.w+7&&p.y>=groupBounds.y-7&&p.y<=groupBounds.y+groupBounds.h+7;
      if(insideFrame){gesture.current={start:p,items:selectedItems,ids:selectedItems.map(i=>i.id),groupBounds,mode:'moveSelection',lastX:p.x,lastY:p.y,moved:false};return}
      if(hit){const ids=[hit.id];commitSelection(ids);const items=[hit];gesture.current={start:p,items,ids,groupBounds:unionVisibleBounds(items),mode:'moveSelection',lastX:p.x,lastY:p.y,moved:false};return}
      gesture.current={start:p,mode:'marquee',lastX:p.x,lastY:p.y,additive:e.shiftKey,baseIds:[...currentSelection]};setMarquee({x:p.x,y:p.y,w:0,h:0});if(!e.shiftKey)commitSelection([]);return;
    }
    if(tool==='eraser'){gesture.current={start:p,mode:'erase',lastX:p.x,lastY:p.y};erase(p);return}

    let initialPoint=p;
    snapSessionRef.current=null;
    setLiveFeedback(null);
    if(isActive&&geometryState.open&&geometryState.snapEnabled&&(tool==='pen'||tool==='highlighter'||tool==='laser')){
      const snapTarget=findSnapTarget(p,geometryState);
      if(snapTarget){
        const started=startSnapSession(p,snapTarget,geometryState);
        snapSessionRef.current=started.session;
        initialPoint=started.snappedPoint;
        setLiveFeedback(started.session.feedback);
        if(snapTarget==='compass-arc'){
          const ang=(Math.atan2(initialPoint.y-geometryState.y,initialPoint.x-geometryState.x)*180)/Math.PI;
          setGeometryState((prev:GeometryToolState)=>({...prev,compassAngle:normalizeDeg(ang)}));
        }
      }
    }

    if(tool==='laser'){gesture.current={start:initialPoint,mode:'laser',lastX:initialPoint.x,lastY:initialPoint.y};updateDraft(laserStroke(initialPoint));return}
    const id=crypto.randomUUID();const isHighlighter=settings.style.startsWith('highlighter');const strokeColor=isHighlighter?settings.highlightColor:settings.color;const next:BoardItem=tool==='shape'?{id,kind:'shape',shape:settings.shape,x:p.x,y:p.y,w:0,h:0,color:settings.color,width:settings.width,fill:settings.fill,opacity:settings.opacity,dash:settings.dash}:{id,kind:'stroke',points:[initialPoint],color:strokeColor,width:settings.width,opacity:isHighlighter?1:settings.opacity,style:settings.style,dash:settings.dash,ignorePressure:snapSessionRef.current?true:settings.ignorePressure};
    gesture.current={start:initialPoint,mode:'draw',lastX:initialPoint.x,lastY:initialPoint.y};updateDraft(next);
    if(next.kind==='stroke')beginWetStroke(next,initialPoint);
  };
  const move=(e:React.PointerEvent)=>{
    const p=loc(e);
    if(activePointerId.current!==e.pointerId){
      if(tool==='eraser'&&e.pointerType!=='touch')setEraserCursor(old=>old&&Math.hypot(old.x-p.x,old.y-p.y)<1.25?old:p);
      if(isActive&&geometryState.open&&geometryState.snapEnabled&&(tool==='pen'||tool==='highlighter'||tool==='laser')){
        const target=findSnapTarget(p,geometryState);
        setHoveredSnap((old:SnapTargetId|null)=>old===target?old:target);
      }else if(hoveredSnap){
        setHoveredSnap(null);
      }
      return;
    }
    if(tool==='eraser')setEraserCursor(p);const g=gesture.current;
    const barrelHeld=e.pointerType==='pen'&&(((e.buttons&32)!==0)||((e.buttons&2)!==0));
    // If the side button is pressed mid-stroke, commit the ink up to that point,
    // temporarily erase while held, then resume pen input on release.
    if((tool==='pen'||tool==='highlighter')&&barrelHeld&&g?.mode==='draw'){
      const partial=draftRef.current;if(partial?.kind==='stroke'&&partial.points.length>1)onCommit([...page.items,partial]);
      snapSessionRef.current=null;setLiveFeedback(null);
      updateDraft(null);clearPredictedPoints();gesture.current={start:p,mode:'temporaryErase',lastX:p.x,lastY:p.y};erase(p);return;
    }
    if(g?.mode==='temporaryErase'&&(tool==='pen'||tool==='highlighter')&&e.pointerType==='pen'&&!barrelHeld&&(e.buttons&1)!==0){
      const id=crypto.randomUUID();const highlighter=settings.style.startsWith('highlighter');const next:BoardItem={id,kind:'stroke',points:[p],color:highlighter?settings.highlightColor:settings.color,width:settings.width,opacity:highlighter?1:settings.opacity,style:settings.style,dash:settings.dash,ignorePressure:settings.ignorePressure};
      gesture.current={start:p,mode:'draw',lastX:p.x,lastY:p.y};updateDraft(next);beginWetStroke(next,p);return;
    }
    if(g?.mode==='zoom'){e.preventDefault();onZoomDrag((e.clientX-g.lastX)-(e.clientY-g.lastY),e.clientX,e.clientY);g.lastX=e.clientX;g.lastY=e.clientY;return}
    if(g?.mode==='pan'){onPan(e.clientX-g.lastX,e.clientY-g.lastY);g.lastX=e.clientX;g.lastY=e.clientY;return}
    if(tool==='laser'&&g?.mode==='laser'){
      const prev=draftRef.current;
      if(prev?.kind==='stroke'){
        let events:PointerEvent[]=[];try{events=typeof e.nativeEvent.getCoalescedEvents==='function'?e.nativeEvent.getCoalescedEvents():[]}catch{};
        const rawPoints=[...events,e.nativeEvent].map(ev=>loc(ev));
        if(snapSessionRef.current&&geometryState.open){
          let curSession=snapSessionRef.current;
          const snapped:Point[]=[];
          for(const rp of rawPoints){
            const res=appendSnappedPoint(rp,curSession,geometryState);
            curSession=res.session;
            snapped.push(...res.points);
          }
          snapSessionRef.current=curSession;
          setLiveFeedback(curSession.feedback);
          if(snapped.length)updateDraft({...prev,points:[...prev.points,...snapped]});
        }else{
          const appended=rawPoints.filter((point,i)=>{const before=i?rawPoints[i-1]:prev.points[prev.points.length-1];return Math.hypot(point.x-before.x,point.y-before.y)>.35});
          if(appended.length)updateDraft({...prev,points:[...prev.points,...appended]});
        }
      }
      return;
    }
    if(!g)return;
    if(g.mode==='erase'){erase(p);return}if(g.mode==='temporaryErase'){erase(p);return}
    if(g.mode==='marquee'){setMarquee(normalizeRect(g.start,p));return}
    if(g.mode==='moveSelection'&&g.items&&g.ids){const dx=p.x-g.start.x,dy=p.y-g.start.y;g.moved=Math.hypot(dx,dy)>1;setPreviewItems(translateItems(g.items,dx,dy));return}
    if(g.mode==='rotateSelection'&&g.items&&g.rotationCenter){
      const angle=Math.atan2(p.y-g.rotationCenter.y,p.x-g.rotationCenter.x);const step=normalizeAngleRadians(angle-(g.lastAngle??angle));
      g.rotationDegrees=(g.rotationDegrees||0)+step*180/Math.PI;g.lastAngle=angle;g.moved=Math.abs(g.rotationDegrees)>.35;
      setPreviewItems(rotateSelection(g.items,g.rotationDegrees,g.rotationCenter));return;
    }
    if(g.mode==='resize'&&g.items&&g.groupBounds&&g.resizeHandle){g.moved=Math.hypot(p.x-g.start.x,p.y-g.start.y)>1;setPreviewItems(resizedSelection(g,p));return}
    if(g.mode==='draw'){
      let prev=draftRef.current;
      if(prev?.kind==='stroke'){
        let coalesced:PointerEvent[]=[];
        try{coalesced=typeof e.nativeEvent.getCoalescedEvents==='function'?e.nativeEvent.getCoalescedEvents():[]}catch{coalesced=[]}
        const events=[...coalesced,e.nativeEvent];

        if(!snapSessionRef.current&&prev.points.length<=4&&isActive&&geometryState.open&&geometryState.snapEnabled){
          const lateTarget=findSnapTarget(p,geometryState,22);
          if(lateTarget){
            const started=startSnapSession(prev.points[0],lateTarget,geometryState);
            snapSessionRef.current=started.session;
            prev={...prev,points:[started.snappedPoint],ignorePressure:true};
            draftRef.current=prev;
            clearWetLayer();beginWetStroke(prev,started.snappedPoint);updateDraft(prev);
          }
        }

        if(snapSessionRef.current&&geometryState.open){
          let curSession=snapSessionRef.current;
          let anchor=prev.points[prev.points.length-1];
          const points:Point[]=[];
          for(const event of events){
            const rawPt=loc(event);
            const res=appendSnappedPoint(rawPt,curSession,geometryState);
            curSession=res.session;
            for(const sp of res.points){
              if(Math.hypot(sp.x-anchor.x,sp.y-anchor.y)>.18){
                points.push(sp);
                anchor=sp;
              }
            }
          }
          snapSessionRef.current=curSession;
          setLiveFeedback(curSession.feedback);
          if(curSession.targetId==='compass-arc'){
            const ang=(Math.atan2(curSession.lastWorld.y-geometryState.y,curSession.lastWorld.x-geometryState.x)*180)/Math.PI;
            setGeometryState((st:GeometryToolState)=>({...st,compassAngle:normalizeDeg(ang)}));
          }
          if(points.length)appendWetPoints(prev,points);
          clearPredictedPoints();
          return;
        }

        // Some browsers omit the dispatching pointermove from getCoalescedEvents(). Always
        // include the current event, then deduplicate gently so the last point/pressure is not lost.
        let anchor=prev.points[prev.points.length-1];const points:Point[]=[];
        for(const event of events){const point=loc(event);if(Math.hypot(point.x-anchor.x,point.y-anchor.y)>.12||Math.abs(point.p-anchor.p)>.012){points.push(point);anchor=point}}
        if(points.length)appendWetPoints(prev,points);
        // Actual coalesced hardware samples are drawn immediately on the wet canvas.
        // Avoid publishing predicted-tip React state on every frame; prediction added visual
        // wobble on some Windows pen drivers and forced full-overlay repainting.
      }else if(prev?.kind==='shape')updateDraft({...prev,w:p.x-g.start.x,h:p.y-g.start.y});
    }
  };
  const up=(e:React.PointerEvent)=>{
    if(activePointerId.current!==e.pointerId)return;activePointerId.current=null;clearPredictedPoints();const g=gesture.current;gesture.current=null;
    const wasSnapped=!!snapSessionRef.current;
    const snapBeforeEnd=snapSessionRef.current;
    snapSessionRef.current=null;setLiveFeedback(null);
    const item=draftRef.current;if(!g)return;
    if(g.mode==='draw'&&item){
      if(item.kind==='stroke'){
        const rawEnd=loc(e),last=item.points[item.points.length-1];
        let completed=item;
        if(wasSnapped&&snapBeforeEnd&&geometryState.open){
          const res=appendSnappedPoint({...rawEnd,p:e.pressure>0?rawEnd.p:last.p},snapBeforeEnd,geometryState);
          const extra=res.points.filter((pt:Point)=>Math.hypot(pt.x-last.x,pt.y-last.y)>.15);
          if(extra.length)completed={...item,points:[...item.points,...extra]};
        }else{
          // Pointerup may be delivered without a final pointermove. Preserve that endpoint,
          // but don't interpret the zero pressure reported on pen lift as an actual light press.
          const finalPoint:Point={...rawEnd,p:e.pressure>0?rawEnd.p:last.p};
          const needsFinalPoint=Math.hypot(finalPoint.x-last.x,finalPoint.y-last.y)>.12||Math.abs(finalPoint.p-last.p)>.012;
          completed=needsFinalPoint?{...item,points:[...item.points,finalPoint]}:item;
        }
        const {current,overflow}=splitStroke(completed);
        const drawn=current&&settings.recognize&&!overflow&&!wasSnapped?recognizeStroke(current)||current:current;
        // Do not advance at 82% of the page. Advance only when splitStroke detects a true boundary crossing.
        onCommit(drawn?[...page.items,drawn]:page.items,overflow||undefined,false);
      }
      else if(item.kind==='shape'){
        const parts=itemMovedPastBottom(item);
        onCommit(parts.current?[...page.items,parts.current]:page.items,parts.overflow.length?parts.overflow:undefined,false);
      }else onCommit([...page.items,item]);updateDraft(null);
    }else if((g.mode==='moveSelection'||g.mode==='resize'||g.mode==='rotateSelection')&&g.items&&g.ids){
      const end=loc(e),dx=end.x-g.start.x,dy=end.y-g.start.y;
      const moved=g.mode==='rotateSelection'?Math.abs(g.rotationDegrees||0)>.35:Math.hypot(dx,dy)>1;
      if(moved){
        const finalItems=g.mode==='moveSelection'?translateItems(g.items,dx,dy):g.mode==='rotateSelection'&&g.rotationCenter?rotateSelection(g.items,g.rotationDegrees||0,g.rotationCenter):(g.resizeHandle?resizedSelection(g,end):g.items);
        const replacement=new Map<string,BoardItem>(finalItems.map(i=>[i.id,i] as const));
        const movedIds=new Set(g.ids||[]),sourceItems:BoardItem[]=[],overflowItems:BoardItem[]=[];
        for(const original of page.items){
          const finalItem=replacement.get(original.id)||original;
          if(!movedIds.has(original.id)){sourceItems.push(finalItem);continue}
          const parts=itemMovedPastBottom(finalItem);
          if(parts.current)sourceItems.push(parts.current);
          overflowItems.push(...parts.overflow);
        }
        onCommit(sourceItems,overflowItems.length?overflowItems:undefined,false);
      }
      setPreviewItems(null);
    }else if(g.mode==='marquee'){
      const r=marquee||normalizeRect(g.start,loc(e));const found=page.items.filter(i=>intersects(visibleBounds(i),r)).map(i=>i.id);const finalIds=g.additive?[...new Set([...(g.baseIds||[]),...found])]:found;commitSelection(finalIds);setMarquee(null);
    }else if(g.mode==='laser'&&item?.kind==='stroke'){
      if(item.points.length){const end=loc(e),last=item.points[item.points.length-1];const finalStroke={...item,points:!wasSnapped&&Math.hypot(end.x-last.x,end.y-last.y)>.45?[...item.points,end]:item.points,opacity:1};setTransientLasers(current=>[...current,{stroke:finalStroke,startedAt:performance.now()+240,opacity:1}])}
      updateDraft(null);
    }
  };
  return <div className="whiteboard-canvas-stack" data-zoom={zoom}>
    <canvas ref={canvas} className="whiteboard-canvas whiteboard-static-canvas" aria-hidden="true" />
    <canvas ref={wetCanvas} className="whiteboard-canvas whiteboard-wet-canvas" aria-hidden="true" />
    <canvas ref={overlayCanvas} className="whiteboard-canvas whiteboard-interaction-canvas" style={{touchAction:'none',mixBlendMode:(previewItems?.some(i=>i.kind==='stroke'&&i.style.startsWith('highlighter')))?'multiply':'normal',cursor:tool==='pen'||tool==='highlighter'?'crosshair':tool==='pan'?'grab':tool==='eraser'?'none':tool==='laser'?'none':tool==='select'?'move':'default'}}
      onContextMenu={e=>e.preventDefault()} onDoubleClick={e=>{if(tool!=='select'&&tool!=='text')return;const p=loc({clientX:e.clientX,clientY:e.clientY,pressure:.5,timeStamp:e.timeStamp});const item=[...page.items].reverse().find(i=>i.kind==='text'&&hitItem(i,p.x,p.y));if(item&&onEditText){commitSelection([item.id]);onEditText(item.id)}}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onPointerLeave={()=>{if(activePointerId.current===null){setEraserCursor(null);setHoveredSnap(null)}}}
      onLostPointerCapture={e=>{if(activePointerId.current===e.pointerId){activePointerId.current=null;gesture.current=null;snapSessionRef.current=null;setLiveFeedback(null);updateDraft(null);clearPredictedPoints();setPreviewItems(null);setMarquee(null);clearWetLayer()}}}
      aria-label="Bảng viết tương tác" role="img" />
    <canvas ref={laserCanvas} className="whiteboard-canvas whiteboard-laser-canvas" aria-hidden="true" />
    {isActive&&geometryState.open&&<GeometryCanvasOverlay
      state={geometryState}
      onChange={setGeometryState}
      penColor={settings.style.startsWith('highlighter')?settings.highlightColor:settings.color}
      penWidth={settings.width}
      penOpacity={settings.opacity}
      penStyle={settings.style}
      penDash={settings.dash}
      hoveredSnap={hoveredSnap}
      liveFeedback={liveFeedback}
      onCommitStroke={(stroke:Stroke)=>{
        const {current,overflow}=splitStroke(stroke);
        onCommit(current?[...page.items,current]:page.items,overflow||undefined,false);
      }}
    />}
  </div>;
}
