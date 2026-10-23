import {Shape} from '../types/board';

export const shapeOptions = [
  {id:'line',label:'Đường thẳng'}, {id:'arrow',label:'Mũi tên'},
  {id:'rectangle',label:'Chữ nhật'}, {id:'rounded',label:'Bo góc'},
  {id:'circle',label:'Tròn'}, {id:'ellipse',label:'Elip'},
  {id:'triangle',label:'Tam giác'}, {id:'diamond',label:'Hình thoi'},
  {id:'pentagon',label:'Ngũ giác'}, {id:'hexagon',label:'Lục giác'},
  {id:'octagon',label:'Bát giác'}, {id:'star',label:'Ngôi sao'},
  {id:'parallelogram',label:'Bình hành'}, {id:'trapezoid',label:'Hình thang'},
  {id:'chevron',label:'Chữ V'}, {id:'cross',label:'Dấu cộng'},
  {id:'heart',label:'Trái tim'}, {id:'speech',label:'Chú thích'},
  {id:'arc',label:'Cung cong'},
] as const;

export const openShapes = new Set(['line','arrow','arc']);
const n=(value:number)=>Math.round(value*100)/100;

function polygon(cx:number,cy:number,rx:number,ry:number,sides:number,inner=1){
  const count=inner===1?sides:sides*2;
  return Array.from({length:count},(_,i)=>{
    const a=-Math.PI/2+i*Math.PI*2/count;
    const scale=inner!==1&&i%2?inner:1;
    return `${i?'L':'M'}${n(cx+Math.cos(a)*rx*scale)} ${n(cy+Math.sin(a)*ry*scale)}`;
  }).join(' ')+' Z';
}

export function shapePath(shape:Pick<Shape,'shape'|'x'|'y'|'w'|'h'>):string{
  const {x,y,w,h}=shape;
  const l=Math.min(x,x+w),r=Math.max(x,x+w),t=Math.min(y,y+h),b=Math.max(y,y+h);
  const ww=r-l,hh=b-t,cx=(l+r)/2,cy=(t+b)/2;
  switch(shape.shape){
    case 'line': return `M${n(x)} ${n(y)} L${n(x+w)} ${n(y+h)}`;
    case 'arrow': {
      const ex=x+w,ey=y+h,a=Math.atan2(h,w),len=Math.min(20,Math.max(9,Math.hypot(w,h)*.2));
      return `M${n(x)} ${n(y)} L${n(ex)} ${n(ey)} M${n(ex-len*Math.cos(a-.48))} ${n(ey-len*Math.sin(a-.48))} L${n(ex)} ${n(ey)} L${n(ex-len*Math.cos(a+.48))} ${n(ey-len*Math.sin(a+.48))}`;
    }
    case 'rectangle': return `M${n(l)} ${n(t)} H${n(r)} V${n(b)} H${n(l)} Z`;
    case 'rounded': {
      const radius=Math.min(ww,hh)*.16;
      return `M${n(l+radius)} ${n(t)} H${n(r-radius)} Q${n(r)} ${n(t)} ${n(r)} ${n(t+radius)} V${n(b-radius)} Q${n(r)} ${n(b)} ${n(r-radius)} ${n(b)} H${n(l+radius)} Q${n(l)} ${n(b)} ${n(l)} ${n(b-radius)} V${n(t+radius)} Q${n(l)} ${n(t)} ${n(l+radius)} ${n(t)} Z`;
    }
    case 'circle':
    case 'ellipse': {
      const rx=Math.max(1,shape.shape==='circle'?Math.min(ww,hh)/2:ww/2);
      const ry=Math.max(1,shape.shape==='circle'?rx:hh/2);
      return `M${n(cx+rx)} ${n(cy)} A${n(rx)} ${n(ry)} 0 1 0 ${n(cx-rx)} ${n(cy)} A${n(rx)} ${n(ry)} 0 1 0 ${n(cx+rx)} ${n(cy)} Z`;
    }
    case 'triangle': return polygon(cx,cy,ww/2,hh/2,3);
    case 'pentagon': return polygon(cx,cy,ww/2,hh/2,5);
    case 'hexagon': case 'polygon': return polygon(cx,cy,ww/2,hh/2,6);
    case 'octagon': return polygon(cx,cy,ww/2,hh/2,8);
    case 'star': return polygon(cx,cy,ww/2,hh/2,5,.44);
    case 'diamond': return `M${n(cx)} ${n(t)} L${n(r)} ${n(cy)} L${n(cx)} ${n(b)} L${n(l)} ${n(cy)} Z`;
    case 'parallelogram': return `M${n(l+ww*.25)} ${n(t)} H${n(r)} L${n(r-ww*.25)} ${n(b)} H${n(l)} Z`;
    case 'trapezoid': return `M${n(l+ww*.2)} ${n(t)} H${n(r-ww*.2)} L${n(r)} ${n(b)} H${n(l)} Z`;
    case 'chevron': return `M${n(l)} ${n(t)} H${n(l+ww*.32)} L${n(r)} ${n(cy)} L${n(l+ww*.32)} ${n(b)} H${n(l)} L${n(l+ww*.66)} ${n(cy)} Z`;
    case 'cross': return `M${n(l+ww*.35)} ${n(t)} H${n(l+ww*.65)} V${n(t+hh*.35)} H${n(r)} V${n(t+hh*.65)} H${n(l+ww*.65)} V${n(b)} H${n(l+ww*.35)} V${n(t+hh*.65)} H${n(l)} V${n(t+hh*.35)} H${n(l+ww*.35)} Z`;
    case 'heart': return `M${n(cx)} ${n(b)} C${n(l-ww*.1)} ${n(t+hh*.48)} ${n(l)} ${n(t-hh*.05)} ${n(cx)} ${n(t+hh*.28)} C${n(r)} ${n(t-hh*.05)} ${n(r+ww*.1)} ${n(t+hh*.48)} ${n(cx)} ${n(b)} Z`;
    case 'speech': return `M${n(l+ww*.08)} ${n(t)} H${n(r-ww*.08)} Q${n(r)} ${n(t)} ${n(r)} ${n(t+hh*.1)} V${n(b-hh*.3)} Q${n(r)} ${n(b-hh*.2)} ${n(r-ww*.1)} ${n(b-hh*.2)} H${n(l+ww*.3)} L${n(l+ww*.12)} ${n(b)} V${n(b-hh*.2)} Q${n(l)} ${n(b-hh*.2)} ${n(l)} ${n(b-hh*.3)} V${n(t+hh*.1)} Q${n(l)} ${n(t)} ${n(l+ww*.08)} ${n(t)} Z`;
    case 'arc': return `M${n(l)} ${n(b)} Q${n(cx)} ${n(t-hh*.5)} ${n(r)} ${n(b)}`;
    default: return `M${n(l)} ${n(t)} H${n(r)} V${n(b)} H${n(l)} Z`;
  }
}
