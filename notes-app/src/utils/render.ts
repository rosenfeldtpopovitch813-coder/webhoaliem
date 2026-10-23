import {BoardPage,BoardItem,Stroke,H,W,Point,LinePattern} from '../types/board';
import {openShapes,shapePath} from './shapes';

const images=new Map<string,HTMLImageElement>();
export function loadImage(src:string,redraw:()=>void){
  if(images.has(src))return images.get(src)!;
  const img=new Image();img.src=src;img.onload=redraw;images.set(src,img);return img;
}

export function drawBackground(ctx:CanvasRenderingContext2D,page:BoardPage,redraw:()=>void=()=>{}){
  const bg=page.paperColor||(page.background==='black'?'#202936':'#ffffff');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  if(page.backgroundImage){const img=loadImage(page.backgroundImage,redraw);if(img.complete&&img.naturalWidth){const k=Math.min(W/img.naturalWidth,H/img.naturalHeight),dw=img.naturalWidth*k,dh=img.naturalHeight*k;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,(W-dw)/2,0,dw,dh)}}
  const paper=page.background;if(paper==='white'||paper==='black')return;
  ctx.save();ctx.strokeStyle=page.lineColor||(paper==='chemistry'?'#b9cfc9':'#b6d6eb');ctx.fillStyle=ctx.strokeStyle;ctx.globalAlpha=.52;ctx.lineWidth=1;
  const gap=page.spacing||((paper==='graph'||paper==='physics')?22:paper==='notebook'?30:28);
  if(paper==='dots'){
    for(let x=gap;x<W;x+=gap)for(let y=gap;y<H;y+=gap){ctx.beginPath();ctx.arc(x,y,1.3,0,Math.PI*2);ctx.fill()}
  }else{
    if(paper!=='lined'&&paper!=='notebook')for(let x=0;x<W;x+=gap){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for(let y=gap;y<H;y+=gap){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    if(paper==='graph'||paper==='physics'){
      ctx.globalAlpha=.7;
      for(let x=0;x<W;x+=gap*5){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
      for(let y=0;y<H;y+=gap*5){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    }
  }
  ctx.restore();
}

function drawA4Guides(ctx:CanvasRenderingContext2D,page:BoardPage){
  if(page.background!=='lined'&&page.background!=='notebook')return;
  // Hai nét lề tách riêng: trái xanh, phải đỏ (như giấy Scrble). Bật/tắt độc lập với viền đứt.
  if(page.margins!==false){
    ctx.save();ctx.lineWidth=1.4;ctx.globalAlpha=.85;
    ctx.strokeStyle='#4a78d8';ctx.beginPath();ctx.moveTo(40,0);ctx.lineTo(40,H);ctx.stroke();
    ctx.strokeStyle='#e2453c';ctx.beginPath();ctx.moveTo(W-40,0);ctx.lineTo(W-40,H);ctx.stroke();
    ctx.restore();
  }
  // Viền đứt/chấm giữ nguyên, chỉ còn phụ thuộc vào "Đường viền giấy".
  if(page.border!==false){
    ctx.save();ctx.strokeStyle='#5ca8f5';ctx.globalAlpha=.75;ctx.lineWidth=1;ctx.setLineDash([6,4]);
    for(const y of [1,60]){ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(W-40,y);ctx.stroke()}
    ctx.restore();
  }
}

function pathPoints(ctx:CanvasRenderingContext2D,points:Point[]){
  if(!points.length)return;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  if(points.length===1){ctx.lineTo(points[0].x+.01,points[0].y+.01);return}
  for(let i=1;i<points.length-1;i++)ctx.quadraticCurveTo(points[i].x,points[i].y,(points[i].x+points[i+1].x)/2,(points[i].y+points[i+1].y)/2);
  ctx.lineTo(points[points.length-1].x,points[points.length-1].y);
}

export function dashArray(pattern:LinePattern|undefined,width:number){
  return pattern==='dashed'?[Math.max(8,width*4),Math.max(5,width*2)]:pattern==='dotted'?[Math.max(1,width*.1),Math.max(5,width*2)]:[];
}

function pressureSmoothedSamples(points:Point[]):Point[]{
  if(points.length<3)return points.map(p=>({...p,p:Math.max(.04,Math.min(1,p.p))}));
  const raw=points.map(p=>({...p,p:Math.max(.04,Math.min(1,p.p))}));
  // Smooth only a small amount of positional jitter on nearly straight sections.
  // Sharp corners remain anchored, so handwriting does not become rubbery or lag behind the stylus.
  const source=raw.map((p,i)=>{
    if(i===0||i===raw.length-1)return p;
    const before=raw[i-1],after=raw[i+1];
    const ax=p.x-before.x,ay=p.y-before.y,bx=after.x-p.x,by=after.y-p.y;
    const al=Math.hypot(ax,ay)||1,bl=Math.hypot(bx,by)||1;
    const straightness=Math.max(0,Math.min(1,(ax*bx+ay*by)/(al*bl)));
    const dt=Math.max(1,(after.t??p.t??0)-(before.t??p.t??0));
    const velocity=Math.hypot(after.x-before.x,after.y-before.y)/dt;
    // One-Euro-inspired adaptive smoothing: suppress slow hand jitter; preserve fast flicks.
    const adaptiveWeight=Math.max(.025,Math.min(.145,.145-velocity*.045));
    const weight=adaptiveWeight*straightness;
    return {...p,x:p.x*(1-weight*2)+(before.x+after.x)*weight,y:p.y*(1-weight*2)+(before.y+after.y)*weight};
  });
  // Pressure gets a light temporal-style low-pass filter to remove hardware jitter without
  // washing out genuine press/release changes from a stylus.
  const pressure=raw.map((p,i)=>{
    const before=raw[Math.max(0,i-1)].p,after=raw[Math.min(raw.length-1,i+1)].p;
    const median=[before,p.p,after].sort((a,b)=>a-b)[1];
    return Math.max(.04,Math.min(1,before*.18+median*.18+p.p*.46+after*.18));
  });
  const result:Point[]=[];
  const mid=(a:Point,b:Point):Point=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,p:(a.p+b.p)/2,t:((a.t??0)+(b.t??0))/2,tiltX:((a.tiltX??0)+(b.tiltX??0))/2,tiltY:((a.tiltY??0)+(b.tiltY??0))/2});
  for(let i=0;i<source.length-1;i++){
    const cur=source[i],next=source[i+1];
    const start=i===0?cur:mid(source[i-1],cur);
    const end=i===source.length-2?next:mid(cur,next);
    const startP=i===0?pressure[i]:(pressure[i-1]+pressure[i])/2;
    const endP=i===source.length-2?pressure[i+1]:(pressure[i]+pressure[i+1])/2;
    const length=Math.hypot(cur.x-start.x,cur.y-start.y)+Math.hypot(end.x-cur.x,end.y-cur.y);
    // Use the legacy 2.8px / 48-sample cap for low-latency ink and lower finalization cost.
    // High-frequency pointer samples already provide smooth source points on active stylus input.
    const steps=Math.max(2,Math.min(48,Math.ceil(length/2.8)));
    for(let step=0;step<steps;step++){
      if(i>0&&step===0)continue;
      const t=step/steps,u=1-t;
      const interpolate=(a:number|undefined,b:number|undefined,c:number|undefined)=>u*u*(a??0)+2*u*t*(b??0)+t*t*(c??0);
      result.push({
        x:u*u*start.x+2*u*t*cur.x+t*t*end.x,
        y:u*u*start.y+2*u*t*cur.y+t*t*end.y,
        p:Math.max(.04,Math.min(1,u*u*startP+2*u*t*pressure[i]+t*t*endP)),
        t:interpolate(start.t,cur.t,end.t),
        tiltX:interpolate(start.tiltX,cur.tiltX,end.tiltX),
        tiltY:interpolate(start.tiltY,cur.tiltY,end.tiltY),
      });
    }
  }
  result.push({...source[source.length-1],p:pressure[pressure.length-1]});
  return result;
}

function drawPressureStroke(ctx:CanvasRenderingContext2D,points:Point[],baseWidth:number,color:string,factor:number,ignorePressure=false){
  if(!points.length)return;
  const samples=pressureSmoothedSamples(points);
  const radiusAt=(p:Point)=>Math.max(.38,baseWidth*factor*(ignorePressure?1:.25+1.5*p.p)/2);
  if(samples.length===1){ctx.fillStyle=color;ctx.beginPath();ctx.arc(samples[0].x,samples[0].y,radiusAt(samples[0]),0,Math.PI*2);ctx.fill();return}
  const left:Point[]=[],right:Point[]=[];
  samples.forEach((p,i)=>{
    const before=samples[Math.max(0,i-1)],after=samples[Math.min(samples.length-1,i+1)];
    let dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy);
    if(len<.001){dx=1;dy=0;len=1}
    const nx=-dy/len,ny=dx/len,r=radiusAt(p);
    left.push({x:p.x+nx*r,y:p.y+ny*r,p:p.p});right.push({x:p.x-nx*r,y:p.y-ny*r,p:p.p});
  });
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);
  for(let i=1;i<left.length;i++)ctx.lineTo(left[i].x,left[i].y);
  for(let i=right.length-1;i>=0;i--)ctx.lineTo(right[i].x,right[i].y);
  ctx.closePath();ctx.fill();
  // Round caps prevent tiny gaps on fast strokes and at pressure transitions.
  for(const p of [samples[0],samples[samples.length-1]]){ctx.beginPath();ctx.arc(p.x,p.y,radiusAt(p),0,Math.PI*2);ctx.fill()}
}


type InkProfile='ballpoint'|'gel'|'fineliner'|'pencil'|'fountain'|'brush'|'calligraphy'|'chalk'|'crayon'|'marker'|'felt'|'monoline';
type StrokeGeometry={samples:Point[];left:Point[];right:Point[]};

function clamp01(n:number){return Math.max(0,Math.min(1,n))}
function strokeGeometry(points:Point[],baseWidth:number,profile:InkProfile,ignorePressure=false):StrokeGeometry{
  const samples=pressureSmoothedSamples(points),left:Point[]=[],right:Point[]=[];
  if(samples.length===1){const p=samples[0],r=Math.max(.35,baseWidth*.5);return{samples,left:[{x:p.x-r,y:p.y,p:p.p},{x:p.x,y:p.y-r,p:p.p},{x:p.x+r,y:p.y,p:p.p}],right:[{x:p.x+r,y:p.y,p:p.p},{x:p.x,y:p.y+r,p:p.p},{x:p.x-r,y:p.y,p:p.p}]}}
  samples.forEach((p,i)=>{
    const before=samples[Math.max(0,i-1)],after=samples[Math.min(samples.length-1,i+1)];
    let dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy);if(len<.001){dx=1;dy=0;len=1}
    const angle=Math.atan2(dy,dx),nx=-dy/len,ny=dx/len,t=i/Math.max(1,samples.length-1),pressure=ignorePressure?.58:clamp01(p.p);
    const previous=samples[Math.max(0,i-1)],next=samples[Math.min(samples.length-1,i+1)];
    const dt=Math.max(1,((next.t??p.t??0)-(previous.t??p.t??0))||16);
    const speed=Math.hypot(next.x-previous.x,next.y-previous.y)/dt;
    const velocityFast=clamp01(speed/1.35);
    const edgeRamp=clamp01(Math.min(t/.065,(1-t)/.065));
    let scale=1;
    if(profile==='ballpoint'){
      // Oil-based ballpoint: modest pressure response, with velocity taper mostly at fast stroke ends.
      scale=(.7+.5*pressure)*(1-(1-edgeRamp)*velocityFast*.62);
    }else if(profile==='gel'){
      // Gel ink reaches a full saturated body early; only the lifted tail tapers appreciably.
      const tailTaper=clamp01(.2+(1-t)*18);
      scale=(.6+.8*Math.sqrt(pressure))*tailTaper;
    }else if(profile==='fineliner'){
      // Technical fineliner is deliberately invariant: no pressure width and no taper.
      scale=1;
    }else if(profile==='monoline'){
      // Uniform body with a short 5–6% taper at both ends.
      scale=.22+.78*edgeRamp;
    }else if(profile==='fountain'){
      // Screen-space downstrokes (positive y direction) are broad; upstrokes stay narrow.
      const downstroke=Math.max(0,Math.sin(angle));
      const directionFactor=.86+1.34*downstroke;
      const speedFactor=Math.max(.72,Math.min(1.08,1.08-speed*.09));
      const taper=samples.length<8?1:Math.min(1,.16+t*6,.16+(1-t)*6);
      scale=(.68+.76*pressure)*directionFactor*speedFactor*taper;
    }else if(profile==='brush'){
      // Soft brush: aggressive, nonlinear pressure expansion with leaf-like tapered ends.
      const taper=samples.length<6?1:.12+.88*edgeRamp;
      scale=(.08+Math.pow(pressure,1.8)*5.25)*taper;
    }else if(profile==='calligraphy'){
      // Fixed 30-degree flat nib. Broad strokes occur when the path crosses the nib angle.
      const nibAngle=Math.PI/6;
      const orientation=Math.abs(Math.sin(angle-nibAngle));
      scale=Math.max(.10,1.55*orientation)*(.82+pressure*.34);
    }else if(profile==='pencil'){
      // Graphite line widens when tilted; pressure changes the deposited graphite density/width.
      const tilt=clamp01(Math.hypot(p.tiltX||0,p.tiltY||0)/80);
      scale=(.65+pressure*.42+tilt*.28)*(.35+.65*edgeRamp);
    }else if(profile==='chalk'){
      // Chalk stays broad and nearly fixed; texture mask provides the dry appearance.
      scale=.9+pressure*.18;
    }else if(profile==='crayon'){
      scale=.84+pressure*.28;
    }else if(profile==='marker'){
      // Chisel geometry is applied in drawFixedNibStroke; this fallback stays nearly fixed.
      scale=.95+pressure*.1;
    }else if(profile==='felt'){
      // Felt-tip varies by less than 10% across the pressure range.
      scale=.96+pressure*.08;
    }
    const r=Math.max(.32,baseWidth*scale/2);
    left.push({x:p.x+nx*r,y:p.y+ny*r,p:p.p});right.push({x:p.x-nx*r,y:p.y-ny*r,p:p.p});
  });
  return{samples,left,right};
}
function traceSmoothSide(ctx:CanvasRenderingContext2D,side:Point[],reverse=false){
  const points=reverse?[...side].reverse():side;
  if(!points.length)return;
  for(let i=1;i<points.length;i++){
    const current=points[i];
    if(i===points.length-1){ctx.lineTo(current.x,current.y);continue;}
    const next=points[i+1];
    ctx.quadraticCurveTo(current.x,current.y,(current.x+next.x)/2,(current.y+next.y)/2);
  }
}
function traceStrokeGeometry(ctx:CanvasRenderingContext2D,g:StrokeGeometry){
  if(!g.left.length)return;
  if(g.samples.length===1){const p=g.samples[0],r=Math.hypot(g.left[0].x-p.x,g.left[0].y-p.y);ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.35,r),0,Math.PI*2);return;}
  const first=g.samples[0],last=g.samples[g.samples.length-1],before=g.samples[1],after=g.samples[g.samples.length-2];
  const startAngle=Math.atan2(before.y-first.y,before.x-first.x),endAngle=Math.atan2(last.y-after.y,last.x-after.x);
  const startRadius=Math.hypot(g.left[0].x-first.x,g.left[0].y-first.y),endRadius=Math.hypot(g.left[g.left.length-1].x-last.x,g.left[g.left.length-1].y-last.y);
  ctx.beginPath();ctx.moveTo(g.left[0].x,g.left[0].y);traceSmoothSide(ctx,g.left,false);
  // Rounded, pressure-aware caps avoid the flat cut-off previously visible at pen lifts.
  ctx.arc(last.x,last.y,Math.max(.32,endRadius),endAngle+Math.PI/2,endAngle-Math.PI/2,true);
  traceSmoothSide(ctx,g.right,true);
  ctx.arc(first.x,first.y,Math.max(.32,startRadius),startAngle-Math.PI/2,startAngle+Math.PI/2,true);
  ctx.closePath();
}
function drawProfileStroke(ctx:CanvasRenderingContext2D,points:Point[],width:number,color:string,profile:InkProfile,ignorePressure=false):StrokeGeometry{
  const g=strokeGeometry(points,width,profile,ignorePressure);ctx.fillStyle=color;traceStrokeGeometry(ctx,g);ctx.fill();return g;
}
function mixInkColor(color:string,target:'#ffffff'|'#000000',amount:number):string{
  const hex=/^#[0-9a-f]{6}$/i.test(color)?color:'#222222';const from=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));const to=target==='#ffffff'?255:0;
  return '#'+from.map(v=>Math.round(v+(to-v)*amount).toString(16).padStart(2,'0')).join('');
}
function seededRandom(seedText:string){let seed=0x811c9dc5;for(const ch of seedText)seed=Math.imul(seed^ch.charCodeAt(0),0x01000193);return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function addInkTexture(ctx:CanvasRenderingContext2D,g:StrokeGeometry,item:Stroke,kind:'pencil'|'chalk'|'crayon'){
  if(g.samples.length<2)return;const layerAlpha=ctx.globalAlpha;ctx.save();traceStrokeGeometry(ctx,g);ctx.clip();const random=seededRandom(item.id+':'+kind);const width=Math.max(1,item.width);
  const count=Math.min(700,Math.max(22,Math.floor(g.samples.length*(kind==='chalk' ? 1.8 : kind==='crayon' ? .8 : .62))));
  for(let n=0;n<count;n++){
    const i=Math.min(g.samples.length-1,Math.floor(random()*g.samples.length)),p=g.samples[i];
    const before=g.samples[Math.max(0,i-1)],after=g.samples[Math.min(g.samples.length-1,i+1)];let dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
    const along=(random()-.5)*width*(kind==='chalk'?1.15:.9),normal=(random()-.5)*width*.88;
    const x=p.x+dx*along-dy*normal,y=p.y+dy*along+dx*normal;
    if(kind==='chalk'){
      ctx.globalAlpha=layerAlpha*(.18+random()*.2);ctx.fillStyle=random()>.4?mixInkColor(item.color,'#000000',.12):mixInkColor(item.color,'#000000',.28);
      const radius=.22+random()*Math.max(.45,width*.105);ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    }else{
      ctx.globalAlpha=layerAlpha*(kind==='pencil' ? .18+random()*.2 : .22+random()*.2);
      ctx.strokeStyle=kind==='pencil'?mixInkColor(item.color,'#000000',.08+random()*.16):mixInkColor(item.color,'#000000',.06+random()*.14);
      ctx.lineWidth=kind==='pencil' ? .3+random()*.55 : .45+random()*.75;ctx.lineCap='round';
      const length=(kind==='pencil'?1.2:2)+(random()*width*.5);ctx.beginPath();ctx.moveTo(x-dx*length/2,y-dy*length/2);ctx.lineTo(x+dx*length/2,y+dy*length/2);ctx.stroke();
    }
  }
  ctx.restore();
}
const grainPatternCache=new WeakMap<CanvasRenderingContext2D,Map<string,CanvasPattern>>();
const grainTileCache=new Map<string,HTMLCanvasElement>();
function getGrainPattern(ctx:CanvasRenderingContext2D,color:string,kind:'pencil'|'chalk'|'crayon'){
  let cache=grainPatternCache.get(ctx);if(!cache){cache=new Map();grainPatternCache.set(ctx,cache)}
  const key=`${color.toLowerCase()}:${kind}`;const cached=cache.get(key);if(cached)return cached;
  let tile=grainTileCache.get(key);
  if(!tile){
    tile=document.createElement('canvas');tile.width=36;tile.height=36;const c=tile.getContext('2d');if(!c)return null;
    const random=seededRandom(key),density=kind==='chalk'?.66:kind==='pencil'?.38:.48;
    for(let i=0;i<220;i++)if(random()<density){
      c.globalAlpha=(kind==='chalk'?.12:kind==='pencil'?.07:.08)+random()*(kind==='chalk'?.30:.20);c.fillStyle=random()>.25?color:mixInkColor(color,'#000000',.14);
      const r=kind==='chalk'?.25+random()*1.15:.2+random()*.7;c.beginPath();c.arc(random()*36,random()*36,r,0,Math.PI*2);c.fill();
    }
    grainTileCache.set(key,tile);
  }
  const pattern=ctx.createPattern(tile,'repeat');if(pattern)cache.set(key,pattern);return pattern;
}
function drawChalkDryStroke(ctx:CanvasRenderingContext2D,item:Stroke,g:StrokeGeometry){
  if(!g.samples.length)return;
  // Work in a tight offscreen surface so destination-out creates actual transparent pits
  // in the chalk itself, never erasing the paper, PDF, or previously drawn objects.
  const pad=Math.max(8,item.width*2.1),xs=g.left.concat(g.right).map(p=>p.x),ys=g.left.concat(g.right).map(p=>p.y);
  const x0=Math.floor(Math.min(...xs)-pad),y0=Math.floor(Math.min(...ys)-pad),x1=Math.ceil(Math.max(...xs)+pad),y1=Math.ceil(Math.max(...ys)+pad);
  const tile=document.createElement('canvas');tile.width=Math.max(1,x1-x0);tile.height=Math.max(1,y1-y0);const c=tile.getContext('2d');if(!c)return;
  c.translate(-x0,-y0);c.fillStyle=item.color;
  const averagePressure=g.samples.reduce((sum,p)=>sum+(item.ignorePressure?.58:p.p),0)/g.samples.length;
  c.globalAlpha=item.opacity*(.82+averagePressure*.18);traceStrokeGeometry(c,g);c.fill();
  // A low-density pigment layer adds the powdery/chalk body before the dry gaps are cut.
  const pattern=getGrainPattern(c,item.color,'chalk');if(pattern){c.save();traceStrokeGeometry(c,g);c.clip();c.globalAlpha=item.opacity*.48;c.fillStyle=pattern;c.fillRect(x0,y0,x1-x0,y1-y0);c.restore()}
  addInkTexture(c,g,item,'chalk');
  // Stable per-stroke deterministic scratches/gaps: repeatable after save/reopen, no flicker.
  const random=seededRandom(item.id+':chalk-dry-gaps');c.globalCompositeOperation='destination-out';c.globalAlpha=1;
  const count=Math.min(420,Math.max(12,Math.floor(g.samples.length*.075)));
  for(let n=0;n<count;n++){
    const i=Math.floor(random()*g.samples.length),p=g.samples[i],before=g.samples[Math.max(0,i-1)],after=g.samples[Math.min(g.samples.length-1,i+1)];
    const angle=Math.atan2(after.y-before.y,after.x-before.x)+(random()-.5)*.6;
    const length=Math.max(.45,item.width*(.08+random()*.38)),thickness=Math.max(.25,item.width*(.025+random()*.09));
    c.save();c.translate(p.x+(random()-.5)*item.width*.5,p.y+(random()-.5)*item.width*.5);c.rotate(angle);c.fillStyle='#000';c.fillRect(-length/2,-thickness/2,length,thickness);c.restore();
  }
  c.globalCompositeOperation='source-over';c.globalAlpha=1;ctx.drawImage(tile,x0,y0);
}
function drawTexturedInk(ctx:CanvasRenderingContext2D,item:Stroke,kind:'pencil'|'chalk'|'crayon'){
  const mult=kind==='pencil' ? .82 : kind==='chalk' ? 1.6 : 1.45;
  const g=strokeGeometry(item.points,item.width*mult,kind,item.ignorePressure);
  const averagePressure=g.samples.length?g.samples.reduce((sum,p)=>sum+(item.ignorePressure?.58:p.p),0)/g.samples.length:.5;
  if(kind==='chalk'){drawChalkDryStroke(ctx,item,g);return}
  ctx.save();ctx.globalAlpha=item.opacity*(kind==='pencil'?.76+averagePressure*.24:1);ctx.fillStyle=item.color;traceStrokeGeometry(ctx,g);ctx.fill();
  addInkTexture(ctx,g,item,kind);
  const pattern=getGrainPattern(ctx,item.color,kind);if(pattern&&g.samples.length>2){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of g.samples){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}ctx.save();traceStrokeGeometry(ctx,g);ctx.clip();ctx.globalAlpha=item.opacity*(kind==='pencil'?.18:.32);ctx.fillStyle=pattern;ctx.fillRect(minX-item.width,minY-item.width,maxX-minX+item.width*2,maxY-minY+item.width*2);ctx.restore()}
  ctx.restore();
}

function drawFixedNibStroke(ctx:CanvasRenderingContext2D,item:Stroke,nibAngle:number,nibLength:number,nibThickness:number,opacity:number,blend:GlobalCompositeOperation,pressureSensitive:boolean){
  const samples=pressureSmoothedSamples(item.points);if(!samples.length)return;
  const pad=Math.ceil(Math.hypot(nibLength,nibThickness)/2+3),minX=Math.min(...samples.map(p=>p.x)),maxX=Math.max(...samples.map(p=>p.x)),minY=Math.min(...samples.map(p=>p.y)),maxY=Math.max(...samples.map(p=>p.y));
  const x0=Math.floor(minX-pad),y0=Math.floor(minY-pad),x1=Math.ceil(maxX+pad),y1=Math.ceil(maxY+pad);
  const tile=document.createElement('canvas');tile.width=Math.max(1,x1-x0);tile.height=Math.max(1,y1-y0);const c=tile.getContext('2d');if(!c)return;
  c.translate(-x0,-y0);c.fillStyle=item.color;
  // Dense stamps overlap on an opaque temporary surface, preventing dark seams on multiply.
  const spacing=Math.max(.8,Math.min(2.8,nibThickness*.23));let last:Point|undefined;
  const stamp=(p:Point)=>{const pressure=item.ignorePressure?.58:clamp01(p.p),scale=pressureSensitive?(.76+.46*pressure):(.94+.12*pressure);c.save();c.translate(p.x,p.y);c.rotate(nibAngle);c.fillRect(-nibLength*scale/2,-nibThickness*scale/2,nibLength*scale,nibThickness*scale);c.restore()};
  stamp(samples[0]);last=samples[0];let pending=0;
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i],dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);if(dist<1e-5)continue;
    pending+=dist;
    if(pending>=spacing){stamp(b);last=b;pending=0}
  }
  const tail=samples[samples.length-1];if(last!==tail)stamp(tail);
  ctx.save();ctx.globalCompositeOperation=blend;ctx.globalAlpha=opacity;ctx.drawImage(tile,x0,y0);ctx.restore();
}
function drawHighlighterStroke(ctx:CanvasRenderingContext2D,item:Stroke){
  // Draw over the document/reference image using multiply: bright marker color stays visible,
  // while dark glyphs baked into a PDF/image remain dark, as if the marker were beneath ink.
  // The regular tip has rounded ends; the square variant has a flat, squared-off end.
  ctx.save();
  ctx.globalCompositeOperation='multiply';
  ctx.globalAlpha=1;
  drawSmoothStroke(ctx,item,4.4,1,item.style==='highlighter-square'?'butt':'round');
  ctx.restore();
}
function drawSmoothStroke(ctx:CanvasRenderingContext2D,item:Stroke,widthFactor:number,opacityFactor=1,lineCap:CanvasLineCap='round'){
  ctx.globalAlpha=item.opacity*opacityFactor;ctx.strokeStyle=item.color;ctx.lineWidth=Math.max(.55,item.width*widthFactor);ctx.lineJoin='round';ctx.lineCap=lineCap;ctx.setLineDash(dashArray(item.dash,ctx.lineWidth));pathPoints(ctx,item.points);ctx.stroke();
}

export function drawItem(ctx:CanvasRenderingContext2D,item:BoardItem,redraw:()=>void=()=>{}){
  ctx.save();
  if(item.kind!=='stroke'&&(item.rotation||item.flipX||item.flipY)){const b=rawBounds(item);ctx.translate(b.x+b.w/2,b.y+b.h/2);if(item.rotation)ctx.rotate(item.rotation*Math.PI/180);if(item.flipX||item.flipY)ctx.scale(item.flipX?-1:1,item.flipY?-1:1);ctx.translate(-b.x-b.w/2,-b.y-b.h/2)}
  if(item.kind==='stroke'){
    const style=item.style||'ballpoint',isHighlighter=style.startsWith('highlighter');
    // Each nib has its own drawing model rather than only a width/opacity multiplier.
    if(isHighlighter){
      // Dedicated layer ordering places marker strokes above document images but beneath
      // handwritten ink, shapes, and editable text. Multiply preserves dark text in scans.
      drawHighlighterStroke(ctx,item);
    }else if(item.dash==='dashed'||item.dash==='dotted'){
      const factor=style==='marker'?1.8:1;
      drawSmoothStroke(ctx,item,factor,style==='pencil'?.65:style==='chalk'?.72:1,'round');
    }else if(style==='ballpoint'){
      // Saturated oil-ink body: pressure/speed affect nib width only, never wash out the hue.
      // This keeps a selected primary red close to #FF0000 even during fast writing.
      ctx.save();ctx.globalAlpha=item.opacity;drawProfileStroke(ctx,item.points,item.width*.76,item.color,'ballpoint',item.ignorePressure);ctx.restore();
    }else if(style==='gel'){
      // Gel ink uses the exact selected pigment. Width/pressure response differentiates it;
      // no white specular stripe is laid over the body, so vivid colors remain saturated.
      ctx.save();ctx.globalAlpha=item.opacity;drawProfileStroke(ctx,item.points,item.width*.9,item.color,'gel',item.ignorePressure);ctx.restore();
    }else if(style==='fineliner'){
      // Fineliner: uniform, precise pigment line with restrained taper and no brush-like bloom.
      ctx.globalAlpha=item.opacity;drawProfileStroke(ctx,item.points,item.width*.6,item.color,'fineliner',item.ignorePressure);
    }else if(style==='pencil'||style==='chalk'||style==='crayon'){
      ctx.save();drawTexturedInk(ctx,item,style);ctx.restore();
    }else if(style==='fountain'){
      ctx.globalAlpha=item.opacity;ctx.fillStyle=item.color;drawProfileStroke(ctx,item.points,item.width*1.05,item.color,'fountain',item.ignorePressure);
      // A faint ink pool at the lift/touch points gives the nib a wet start/end without blobs.
      if(item.points.length>2){ctx.fillStyle=mixInkColor(item.color,'#000000',.12);ctx.globalAlpha=item.opacity*.14;for(const p of [item.points[0],item.points[item.points.length-1]]){ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.4,item.width*.24*(.75+(item.ignorePressure?.58:p.p)*.5)),0,Math.PI*2);ctx.fill()}}
    }else if(style==='brush'){
      ctx.globalAlpha=item.opacity;ctx.fillStyle=item.color;const g=drawProfileStroke(ctx,item.points,item.width*1.65,item.color,'brush',item.ignorePressure);
      // Soft perimeter and a few tapered bristle traces make this read as a brush pen.
      ctx.save();traceStrokeGeometry(ctx,g);ctx.clip();ctx.globalAlpha=item.opacity*.09;ctx.strokeStyle=mixInkColor(item.color,'#000000',.07);ctx.lineWidth=Math.max(.35,item.width*.12);ctx.lineCap='round';
      const samples=g.samples;for(let i=2;i<samples.length;i+=7){const a=samples[i-1],b=samples[i];ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.restore();
    }else if(style==='calligraphy'){
      // Fixed angled flat nib: width emerges from stroke direction relative to the 30° nib edge.
      drawFixedNibStroke(ctx,item,Math.PI/6,item.width*2.35,item.width*.72,item.opacity,'source-over',true);
    }else if(style==='marker'){
      // Chisel marker: rectangular nib held at a fixed angle and blended with multiply at ~52%.
      drawFixedNibStroke(ctx,item,-Math.PI/6,item.width*2.55,item.width*1.02,item.opacity*.52,'multiply',false);
    }else if(style==='felt'){
      // Felt-tip: dense rounded ink, pressure-sensitive width and a subtle porous edge texture.
      ctx.save();ctx.globalAlpha=item.opacity*.97;ctx.shadowColor=item.color;ctx.shadowBlur=Math.min(.7,item.width*.035);const g=drawProfileStroke(ctx,item.points,item.width*1.04,item.color,'felt',item.ignorePressure);
      if(g.samples.length>4){ctx.save();traceStrokeGeometry(ctx,g);ctx.clip();const rnd=seededRandom(item.id+':felt-pore');const count=Math.min(240,Math.max(10,Math.floor(g.samples.length*.12)));for(let n=0;n<count;n++){const q=g.samples[Math.floor(rnd()*g.samples.length)];ctx.globalAlpha=item.opacity*(.035+rnd()*.07);ctx.fillStyle=rnd()>.5?mixInkColor(item.color,'#000000',.12):mixInkColor(item.color,'#ffffff',.12);ctx.beginPath();ctx.arc(q.x+(rnd()-.5)*item.width*.8,q.y+(rnd()-.5)*item.width*.8,.18+rnd()*.38,0,Math.PI*2);ctx.fill()}ctx.restore()}ctx.restore();
    }else if(style==='neon'){
      // Dual-pass emissive render: broad outer bloom plus a bright near-white inner core.
      ctx.setLineDash([]);ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=item.opacity*.3;ctx.strokeStyle=item.color;ctx.lineWidth=item.width*4.1;ctx.shadowColor=item.color;ctx.shadowBlur=22;pathPoints(ctx,item.points);ctx.stroke();
      ctx.globalAlpha=item.opacity*.72;ctx.lineWidth=item.width*1.8;ctx.shadowBlur=10;pathPoints(ctx,item.points);ctx.stroke();
      ctx.globalAlpha=Math.min(1,item.opacity);ctx.strokeStyle=mixInkColor(item.color,'#ffffff',.76);ctx.lineWidth=Math.max(1,item.width*.52);ctx.shadowColor=mixInkColor(item.color,'#ffffff',.62);ctx.shadowBlur=4;pathPoints(ctx,item.points);ctx.stroke();
      ctx.globalCompositeOperation='source-over';
    }else if(style==='monoline'){
      ctx.globalAlpha=item.opacity;drawProfileStroke(ctx,item.points,item.width*.9,item.color,'monoline',item.ignorePressure);
    }else{
      // Forward compatibility for custom/new tools not known to this renderer.
      const dynamic=!item.ignorePressure&&item.points.some(p=>Math.abs(p.p-.5)>.04);
      ctx.globalAlpha=item.opacity;ctx.strokeStyle=item.color;ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash([]);
      if(dynamic)drawPressureStroke(ctx,item.points,item.width,item.color,1,item.ignorePressure);else{ctx.lineWidth=item.width;pathPoints(ctx,item.points);ctx.stroke()}
    }
  }else if(item.kind==='shape'){
    ctx.globalAlpha=item.opacity;ctx.strokeStyle=item.color;ctx.lineWidth=item.width;ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash(dashArray(item.dash,item.width));
    const path=new Path2D(shapePath(item));
    if(item.fill!=='transparent'&&!openShapes.has(item.shape)){ctx.fillStyle=item.fill;ctx.fill(path)}
    ctx.stroke(path);
  }else if(item.kind==='text'){
    ctx.fillStyle=item.color;ctx.font=`${item.italic?'italic ':''}${item.bold?'bold ':''}${item.fontSize}px ${item.math?'Georgia':'Arial'}, sans-serif`;
    item.text.split('\n').forEach((line,i)=>ctx.fillText(line,item.x,item.y+i*item.fontSize*1.3));
  }else{
    const img=loadImage(item.src,redraw);if(img.complete&&img.naturalWidth){ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,item.x,item.y,item.w,item.h)}
  }
  ctx.restore();
}


/**
 * Incremental wet-ink renderer. It paints only the newly received segment, instead of
 * repainting the entire growing stroke (and React tree) on every pointer event.
 * The final, higher-quality material renderer runs once after pointer-up.
 */
export function drawLiveStrokeSegment(
  ctx: CanvasRenderingContext2D,
  item: Stroke,
  from: Point,
  to: Point,
){
  const style=item.style||'ballpoint';
  const dx=to.x-from.x,dy=to.y-from.y;
  const distance=Math.hypot(dx,dy);
  const dt=Math.max(1,(to.t??0)-(from.t??to.t??0));
  const speed=distance/dt;
  const pressure=(p:Point)=>item.ignorePressure?.58:Math.max(.04,Math.min(1,p.p>0?p.p:.5));
  const widthFactor=(p:Point)=>{
    const q=pressure(p);
    if(style==='ballpoint')return (.7+.5*q)*Math.max(.76,1-Math.min(.24,speed*.06));
    if(style==='gel')return .42+.78*Math.sqrt(q);
    if(style==='fountain')return (.28+1.42*q)*Math.max(.82,1-Math.min(.18,speed*.035));
    if(style==='brush')return .08+1.9*Math.pow(q,1.8);
    if(style==='felt')return .92+.16*q;
    if(style==='monoline')return .96+.08*q;
    if(style==='pencil')return .66+.42*q;
    if(style==='chalk')return .88+.18*q;
    if(style==='crayon')return .82+.24*q;
    return 1;
  };
  ctx.save();
  ctx.setLineDash(dashArray(item.dash,item.width));
  ctx.lineJoin='round';
  ctx.lineCap='round';
  ctx.shadowBlur=0;
  ctx.filter='none';
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=item.opacity;
  ctx.strokeStyle=item.color;
  ctx.fillStyle=item.color;

  if(style==='highlighter'||style==='highlighter-square'){
    ctx.lineWidth=Math.max(.8,item.width*4.4);
    ctx.lineCap=style==='highlighter-square'?'square':'round';
  }else if(style==='marker'){
    ctx.globalAlpha=item.opacity*.52;
    ctx.lineWidth=Math.max(.8,item.width*2.55);
    ctx.lineCap='square';
  }else if(style==='calligraphy'){
    const angle=Math.atan2(dy,dx),nibAngle=Math.PI/6;
    const nibWidth=Math.max(item.width*.72,item.width*2.35*Math.abs(Math.sin(angle-nibAngle)));
    ctx.lineWidth=nibWidth;
    ctx.lineCap='butt';
  }else if(style==='neon'){
    ctx.setLineDash([]);
    ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle=item.color;
    ctx.globalAlpha=item.opacity*.34;ctx.lineWidth=Math.max(1,item.width*4.1);ctx.shadowColor=item.color;ctx.shadowBlur=Math.min(16,item.width*2.3);
    ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
    ctx.globalAlpha=item.opacity*.76;ctx.lineWidth=Math.max(.8,item.width*1.8);ctx.shadowBlur=8;ctx.stroke();
    ctx.globalAlpha=Math.min(1,item.opacity);ctx.strokeStyle=mixInkColor(item.color,'#ffffff',.76);ctx.lineWidth=Math.max(1,item.width*.52);ctx.shadowColor=item.color;ctx.shadowBlur=3;ctx.stroke();
    ctx.restore();return;
  }else if(style==='fineliner'){
    ctx.lineWidth=Math.max(.45,item.width*.6);
  }else if(style==='pencil'||style==='chalk'||style==='crayon'){
    ctx.globalAlpha=item.opacity*(style==='pencil'?.94:style==='chalk'?.92:.96);
    ctx.lineWidth=Math.max(.6,item.width*(style==='pencil'?.8:1.7));
  }else if(style==='brush'){
    // Preview stays light: nonlinear widths follow pressure without grain stamping.
    const wf=(widthFactor(from)+widthFactor(to))*.5;
    ctx.lineWidth=Math.max(.45,item.width*1.65*wf);
  }else if(style==='ballpoint'||style==='gel'||style==='fountain'||style==='felt'||style==='monoline'){
    const wf=(widthFactor(from)+widthFactor(to))*.5;
    const base:Record<string,number>={ballpoint:.76,gel:.9,fountain:1.05,felt:1.04,monoline:.9};
    ctx.lineWidth=Math.max(.45,item.width*(base[style]||1)*wf);
    if(style==='ballpoint')ctx.globalAlpha=item.opacity; // Keep live ink fully saturated; speed still affects width only.
  }else{
    ctx.lineWidth=Math.max(.55,item.width);
  }

  // A zero-distance segment represents the initial pen-down dab.
  ctx.beginPath();
  if(distance<.05){
    const radius=Math.max(.4,ctx.lineWidth/2);
    if(ctx.lineCap==='butt'||ctx.lineCap==='square')ctx.fillRect(from.x-radius,from.y-radius,radius*2,radius*2);
    else{ctx.arc(from.x,from.y,radius,0,Math.PI*2);ctx.fill()}
  }else{
    ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
  }
  ctx.restore();
}

/**
 * Lightweight wet-ink preview used only while the pointer is down.
 * It draws directly from hardware/coalesced samples (O(n)) without dense spline
 * resampling, noise stamps, pore generation, or multi-pass material effects.
 * On pointer-up, the committed item is rendered with the full material renderer.
 */
export function drawLiveStrokePreview(ctx:CanvasRenderingContext2D,item:Stroke){
  const points=item.points;
  if(!points.length)return;
  const style=item.style||'ballpoint';
  ctx.save();
  ctx.lineJoin='round';
  ctx.setLineDash(dashArray(item.dash,item.width));
  if(points.length===1){
    const p=points[0];
    ctx.fillStyle=item.color;
    ctx.globalAlpha=item.opacity;
    const factor=style==='highlighter'||style==='highlighter-square'?4.4:style==='brush'?1.65:style==='marker'?2.55:1;
    ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.45,item.width*factor*.5),0,Math.PI*2);ctx.fill();
    ctx.restore();return;
  }

  if(style==='highlighter'||style==='highlighter-square'){
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=item.opacity;
    ctx.strokeStyle=item.color;
    ctx.lineWidth=Math.max(.8,item.width*4.4);
    ctx.lineCap=style==='highlighter-square'?'butt':'round';
    ctx.setLineDash(dashArray(item.dash,ctx.lineWidth));
    pathPoints(ctx,points);ctx.stroke();
    ctx.restore();return;
  }

  if(style==='marker'){
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha=item.opacity*.52;
    ctx.strokeStyle=item.color;ctx.lineWidth=Math.max(.8,item.width*2.55);
    ctx.lineCap='butt';pathPoints(ctx,points);ctx.stroke();
    ctx.restore();return;
  }
  if(style==='calligraphy'){
    // Keep the live preview inexpensive; the fixed angled nib is applied on pointer-up.
    ctx.globalAlpha=item.opacity;ctx.strokeStyle=item.color;
    ctx.lineWidth=Math.max(.7,item.width*1.5);ctx.lineCap='butt';
    pathPoints(ctx,points);ctx.stroke();ctx.restore();return;
  }
  if(style==='pencil'||style==='chalk'||style==='crayon'){
    // The dry-grain mask is applied once after pointer-up rather than regenerated per frame.
    ctx.globalAlpha=item.opacity*(style==='pencil'?.94:style==='chalk'?.92:.96);
    ctx.strokeStyle=item.color;ctx.lineWidth=Math.max(.6,item.width*(style==='pencil'?.8:style==='chalk'?1.7:1.7));
    ctx.lineCap='round';pathPoints(ctx,points);ctx.stroke();ctx.restore();return;
  }
  if(style==='neon'){
    // Lightweight glow during drawing; full dual-pass glow is used after the stroke is committed.
    ctx.setLineDash([]);ctx.lineCap='round';ctx.strokeStyle=item.color;
    ctx.globalAlpha=item.opacity*.48;ctx.lineWidth=Math.max(1,item.width*2.1);
    ctx.shadowColor=item.color;ctx.shadowBlur=Math.min(9,item.width*1.8);
    pathPoints(ctx,points);ctx.stroke();
    ctx.globalAlpha=item.opacity;ctx.shadowBlur=0;ctx.lineWidth=Math.max(.8,item.width*.65);
    pathPoints(ctx,points);ctx.stroke();ctx.restore();return;
  }

  const variableStyles=new Set(['ballpoint','gel','fountain','brush','felt']);
  if(!variableStyles.has(style)||item.dash==='dashed'||item.dash==='dotted'){
    const factors:Record<string,number>={ballpoint:.76,gel:.9,fineliner:.6,fountain:1.05,brush:1.65,felt:1.04,monoline:.9};
    const factorsAlpha:Record<string,number>={pencil:.78,chalk:.82,crayon:.86};
    ctx.globalAlpha=item.opacity*(factorsAlpha[style]??1);
    ctx.strokeStyle=item.color;ctx.lineWidth=Math.max(.55,item.width*(factors[style]??1));
    ctx.lineCap='round';pathPoints(ctx,points);ctx.stroke();ctx.restore();return;
  }

  // Draw a variable-width ribbon from the raw samples. No resampling or texture is
  // performed during pointermove, but real stylus pressure still affects the preview.
  const left:{x:number;y:number}[]=[],right:{x:number;y:number}[]=[];
  const baseFactor:Record<string,number>={ballpoint:.76,gel:.9,fountain:1.05,brush:1.65,felt:1.04};
  for(let i=0;i<points.length;i++){
    const p=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
    let dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy);
    if(len<.001){dx=1;dy=0;len=1}
    const pressure=item.ignorePressure?.58:clamp01(p.p);
    let response=1;
    if(style==='ballpoint')response=.7+.5*pressure;
    else if(style==='gel')response=.42+.78*Math.sqrt(pressure);
    else if(style==='fountain')response=.28+1.42*pressure;
    else if(style==='brush')response=.08+1.9*Math.pow(pressure,1.8);
    else if(style==='felt')response=.92+.16*pressure;
    const dt=Math.max(1,(p.t??0)-(before.t??p.t??0));
    const speed=Math.hypot(p.x-before.x,p.y-before.y)/dt;
    const speedFactor=style==='ballpoint'?Math.max(.76,1-Math.min(.24,speed*.06)):style==='fountain'?Math.max(.82,1-Math.min(.18,speed*.035)):1;
    const radius=Math.max(.38,item.width*baseFactor[style]*response*speedFactor*.5);
    const nx=-dy/len,ny=dx/len;
    left.push({x:p.x+nx*radius,y:p.y+ny*radius});
    right.push({x:p.x-nx*radius,y:p.y-ny*radius});
  }
  ctx.globalAlpha=item.opacity;ctx.fillStyle=item.color;ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);
  for(let i=1;i<left.length;i++)ctx.lineTo(left[i].x,left[i].y);
  for(let i=right.length-1;i>=0;i--)ctx.lineTo(right[i].x,right[i].y);
  ctx.closePath();ctx.fill();
  for(const [p,i] of [[points[0],0],[points[points.length-1],points.length-1]] as const){
    const a=left[i],b=right[i],r=Math.hypot(a.x-b.x,a.y-b.y)*.5;
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

export type Rect={x:number;y:number;w:number;h:number};
export function unionBounds(items:BoardItem[]):Rect{
  if(!items.length)return{x:0,y:0,w:0,h:0};
  const boxes=items.map(bounds),x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  const right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h));
  return{x,y,w:right-x,h:bottom-y};
}
export function intersects(a:Rect,b:Rect){return a.x<=b.x+b.w&&a.x+a.w>=b.x&&a.y<=b.y+b.h&&a.y+a.h>=b.y}
function itemIsHighlight(item:BoardItem){return item.kind==='stroke'&&item.style.startsWith('highlighter')}
function drawItemsOrdered(ctx:CanvasRenderingContext2D,items:BoardItem[],redraw:()=>void){
  // Images are used as reference/document objects. Paint them first so highlighter strokes
  // can annotate image-based worksheets and scanned pages. Marker strokes are next; ordinary
  // handwriting, shapes and editable text always remain on top of the marker color.
  const documentImages=items.filter(item=>item.kind==='image');
  const highlights=items.filter(itemIsHighlight);
  const foreground=items.filter(item=>item.kind!=='image'&&!itemIsHighlight(item));
  [...documentImages,...highlights,...foreground].forEach(item=>drawItem(ctx,item,redraw));
}
export function drawPageBase(ctx:CanvasRenderingContext2D,page:BoardPage,redraw:()=>void=()=>{},excludedIds?:ReadonlySet<string>){
  drawBackground(ctx,page,redraw);drawA4Guides(ctx,page);
  const items=excludedIds?.size?page.items.filter(item=>!excludedIds.has(item.id)):page.items;
  drawItemsOrdered(ctx,items,redraw);
}
function drawSelectionOverlay(ctx:CanvasRenderingContext2D,page:BoardPage,drafts:BoardItem[],selection?:string|string[],marquee?:Rect){
  const ids=selection?(Array.isArray(selection)?selection:[selection]):[];
  if(ids.length){
    const lookup=new Map<string,BoardItem>(page.items.map(i=>[i.id,i] as const));drafts.forEach(i=>lookup.set(i.id,i));
    const chosen=ids.map(id=>lookup.get(id)).filter((item):item is BoardItem=>!!item);
    chosen.forEach(item=>{const b=visibleBounds(item);ctx.save();ctx.strokeStyle='#1889c4';ctx.lineWidth=1.2;ctx.setLineDash([4,3]);ctx.strokeRect(b.x-3,b.y-3,Math.max(2,b.w+6),Math.max(2,b.h+6));ctx.restore()});
    const b=unionVisibleBounds(chosen);ctx.save();ctx.strokeStyle='#087fbd';ctx.fillStyle='#fff';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);ctx.strokeRect(b.x-5,b.y-5,Math.max(2,b.w+10),Math.max(2,b.h+10));ctx.setLineDash([]);
    const l=b.x-5,t=b.y-5,r=b.x+b.w+5,bt=b.y+b.h+5,mx=(l+r)/2,my=(t+bt)/2;
    for(const [x,y] of [[l,t],[mx,t],[r,t],[r,my],[r,bt],[mx,bt],[l,bt],[l,my]]){ctx.fillRect(x-4,y-4,8,8);ctx.strokeRect(x-4,y-4,8,8)}
    const rotateY=t-28;ctx.save();ctx.setLineDash([]);ctx.strokeStyle='#087fbd';ctx.fillStyle='#fff';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(mx,t);ctx.lineTo(mx,rotateY+8);ctx.stroke();ctx.beginPath();ctx.arc(mx,rotateY,7,.25*Math.PI,1.78*Math.PI);ctx.stroke();
    const arrowX=mx+Math.cos(1.78*Math.PI)*7,arrowY=rotateY+Math.sin(1.78*Math.PI)*7;ctx.beginPath();ctx.moveTo(arrowX-1,arrowY-5);ctx.lineTo(arrowX+4,arrowY-4);ctx.lineTo(arrowX+2,arrowY+1);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();ctx.restore();
  }
  if(marquee){ctx.save();ctx.fillStyle='rgba(22,135,194,.14)';ctx.strokeStyle='#1687c2';ctx.lineWidth=1.2;ctx.setLineDash([5,3]);ctx.fillRect(marquee.x,marquee.y,marquee.w,marquee.h);ctx.strokeRect(marquee.x,marquee.y,marquee.w,marquee.h);ctx.restore()}
}
export function drawInteractionOverlay(ctx:CanvasRenderingContext2D,page:BoardPage,redraw:()=>void=()=>{},draft?:BoardItem|BoardItem[],selection?:string|string[],marquee?:Rect,eraserCursor?:{x:number;y:number;radius:number},fastLiveInk=false){
  const drafts=draft?(Array.isArray(draft)?draft:[draft]):[];
  if(fastLiveInk){
    drafts.forEach(item=>item.kind==='stroke'?drawLiveStrokePreview(ctx,item):drawItem(ctx,item,redraw));
  }else drawItemsOrdered(ctx,drafts,redraw);
  drawSelectionOverlay(ctx,page,drafts,selection,marquee);
  if(eraserCursor){ctx.save();ctx.globalAlpha=.9;ctx.strokeStyle='#1687c2';ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(eraserCursor.x,eraserCursor.y,Math.max(2,eraserCursor.radius),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(eraserCursor.x,eraserCursor.y,2,0,Math.PI*2);ctx.stroke();ctx.restore()}
}
export function drawPage(ctx:CanvasRenderingContext2D,page:BoardPage,redraw:()=>void=()=>{},draft?:BoardItem|BoardItem[],selection?:string|string[],marquee?:Rect){
  const drafts=draft?(Array.isArray(draft)?draft:[draft]):[];const ids=new Set(drafts.map(i=>i.id));
  drawPageBase(ctx,page,redraw,ids);drawInteractionOverlay(ctx,page,redraw,drafts,selection,marquee);
}

function rawBounds(item:BoardItem):Rect{
  if(item.kind==='stroke'){const xs=item.points.map(p=>p.x),ys=item.points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}
  if(item.kind==='text')return{x:item.x,y:item.y-item.fontSize,w:item.text.length*item.fontSize*.58,h:item.fontSize*1.3};
  return{x:Math.min(item.x,item.x+item.w),y:Math.min(item.y,item.y+item.h),w:Math.abs(item.w),h:Math.abs(item.h)};
}
/** Geometry bounds before the object's own visual rotation. */
export function bounds(item:BoardItem):Rect{return rawBounds(item)}
/** Axis-aligned visible bounds, including an object's intrinsic rotation. */
export function visibleBounds(item:BoardItem):Rect{
  const b=rawBounds(item);if(item.kind==='stroke'||!item.rotation)return b;
  const a=item.rotation*Math.PI/180,cx=b.x+b.w/2,cy=b.y+b.h/2,cos=Math.cos(a),sin=Math.sin(a);
  const corners=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}].map(p=>({x:cx+(p.x-cx)*cos-(p.y-cy)*sin,y:cy+(p.x-cx)*sin+(p.y-cy)*cos}));
  const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
}
export function unionVisibleBounds(items:BoardItem[]):Rect{
  if(!items.length)return{x:0,y:0,w:0,h:0};
  const boxes=items.map(visibleBounds),x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  const right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h));
  return{x,y,w:right-x,h:bottom-y};
}

export function hitItem(item:BoardItem,x:number,y:number,r=8){
  if(item.kind==='stroke'){
    // Neon's visible hit area includes its outer bloom/shadow, not only the geometric core.
    // This keeps selection and erasing aligned with what the user can actually see.
    const glowHitRadius=item.style==='neon'?item.width*2.05+23:0;
    const threshold=Math.max(r,item.width/2+5,glowHitRadius),pts=item.points;
    if(!pts.length)return false;
    if(pts.length===1)return Math.hypot(pts[0].x-x,pts[0].y-y)<=threshold;
    // Test distance to each segment, not only recorded pointer samples. This is
    // essential for picking and moving fast/long strokes between sparse samples.
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
      const t=len2?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/len2)):0;
      if(Math.hypot(x-(a.x+t*dx),y-(a.y+t*dy))<=threshold)return true;
    }
    return false;
  }
  const b=bounds(item);let hx=x,hy=y;
  if(item.rotation){const cx=b.x+b.w/2,cy=b.y+b.h/2,a=-item.rotation*Math.PI/180,dx=x-cx,dy=y-cy;hx=cx+dx*Math.cos(a)-dy*Math.sin(a);hy=cy+dx*Math.sin(a)+dy*Math.cos(a)}
  return hx>=b.x-r&&hx<=b.x+b.w+r&&hy>=b.y-r&&hy<=b.y+b.h+r
}
export function translateItem(item:BoardItem,dx:number,dy:number):BoardItem{return item.kind==='stroke'?{...item,points:item.points.map(p=>({...p,x:p.x+dx,y:p.y+dy}))}:{...item,x:item.x+dx,y:item.y+dy}}
export function resizeItem(item:BoardItem,newW:number,newH:number):BoardItem{const b=bounds(item),sx=Math.max(.05,newW/Math.max(b.w,1)),sy=Math.max(.05,newH/Math.max(b.h,1));if(item.kind==='stroke')return {...item,points:item.points.map(p=>({...p,x:b.x+(p.x-b.x)*sx,y:b.y+(p.y-b.y)*sy}))};if(item.kind==='text')return {...item,fontSize:Math.max(8,Math.round(item.fontSize*sy))};return {...item,x:b.x,y:b.y,w:Math.max(8,newW),h:Math.max(8,newH)}}
export function rotateItem(item:BoardItem,degrees:number):BoardItem{if(item.kind==='stroke'){const b=bounds(item),cx=b.x+b.w/2,cy=b.y+b.h/2,a=degrees*Math.PI/180;return {...item,points:item.points.map(p=>({...p,x:cx+(p.x-cx)*Math.cos(a)-(p.y-cy)*Math.sin(a),y:cy+(p.x-cx)*Math.sin(a)+(p.y-cy)*Math.cos(a)}))}}return {...item,rotation:((item.rotation||0)+degrees)%360}}

export function flipItems(items:BoardItem[],axis:'horizontal'|'vertical'):BoardItem[]{
  if(!items.length)return items;
  const group=unionBounds(items),horizontal=axis==='horizontal',centerX=group.x+group.w/2,centerY=group.y+group.h/2;
  return items.map(item=>{
    if(item.kind==='stroke')return {...item,points:item.points.map(p=>({...p,x:horizontal?2*centerX-p.x:p.x,y:horizontal?p.y:2*centerY-p.y}))};
    const b=bounds(item),left=horizontal?group.x+group.w-(b.x-group.x)-b.w:b.x,top=horizontal?b.y:group.y+group.h-(b.y-group.y)-b.h;
    const rotation=-(item.rotation||0),flipX=(!!item.flipX!==horizontal)!==(item.kind!=='text'&&item.w<0),flipY=(!!item.flipY!==!horizontal)!==(item.kind!=='text'&&item.h<0);
    if(item.kind==='text')return {...item,x:left,y:horizontal?item.y:top+item.fontSize,flipX,flipY,rotation};
    return {...item,x:left,y:top,w:b.w,h:b.h,flipX,flipY,rotation} as BoardItem;
  });
}
