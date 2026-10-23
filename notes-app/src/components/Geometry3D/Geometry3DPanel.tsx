import {useEffect,useMemo,useRef,useState} from 'react';
import {Box,Eye,EyeOff,Layers,Move,RotateCcw,X,Plus,PenLine,Play,Pause,Scissors,Link2} from 'lucide-react';
import './geometry-3d.css';
import type {GeometryObjectConfig,GeometryPoint3D,GeometrySegment3D,GeometryPlane3D} from '../../types/board';
import {resolveGeometryPoints} from './geometryConstraints';
import {buildSectionResult} from './sectionGeometry';
import {rigidFoldFacePositions} from './rigidUnfold';

export type GeometrySolid='cube'|'cuboid'|'pyramid'|'prism'|'oblique-prism'|'tetra'|'octahedron'|'hex-prism'|'cone'|'frustum'|'cylinder'|'sphere';
type Solid=GeometrySolid;
type CurvedSolid='cone'|'cylinder'|'sphere';
type ViewMode='solid'|'net';
type ViewPreset='free'|'standard'|'front'|'top'|'side'|'back';
type SurfaceMode='solid'|'outline'|'lateral-transparent';
type SectionMode='horizontal'|'three-points';
type Vec3=[number,number,number];
type Edge=[number,number];
type SolidDefinition={label:string;points:{name:string;p:Vec3}[];edges:Edge[];faces:number[][]};
type NetPoint={x:number;y:number;name:string};
type NetFace={points:NetPoint[]};
type Config={solid:Solid;view:ViewMode;rx:number;ry:number;labels:boolean;vertices:boolean;hidden:boolean;section:boolean;background:boolean;surfaceMode:SurfaceMode;inkColor:string;inkWidth:number;inkStyle:string;scaleX:number;scaleY:number;scaleZ:number;cameraZoom:number;showAxes:boolean;showGrid:boolean;showLengths:boolean;sectionOffset:number;sectionMode:SectionMode;sectionPointIds:[string,string,string];foldProgress:number;cutEdges:string[];fixedFaceIndex:number;constructionPoints:GeometryPoint3D[];constructionSegments:GeometrySegment3D[];constructionPlanes:GeometryPlane3D[];vertexOverrides:Record<string,Vec3>};
type RenderSample={world:Vec3;cam:Vec3;screen:{x:number;y:number;z:number}};
type XY={x:number;y:number};

const SOLIDS:Record<Solid,SolidDefinition>={
 cube:{label:'Hình lập phương ABCD.EFGH',points:[{name:'A',p:[-1,-1,-1]},{name:'B',p:[1,-1,-1]},{name:'C',p:[1,1,-1]},{name:'D',p:[-1,1,-1]},{name:'E',p:[-1,-1,1]},{name:'F',p:[1,-1,1]},{name:'G',p:[1,1,1]},{name:'H',p:[-1,1,1]}],edges:[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],faces:[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]},
 pyramid:{label:'Hình chóp tứ giác S.ABCD',points:[{name:'A',p:[-1,-.8,-.7]},{name:'B',p:[1,-.8,-.7]},{name:'C',p:[1,.8,-.7]},{name:'D',p:[-1,.8,-.7]},{name:'S',p:[0,0,1.35]}],edges:[[0,1],[1,2],[2,3],[3,0],[0,4],[1,4],[2,4],[3,4]],faces:[[0,1,2,3],[0,1,4],[1,2,4],[2,3,4],[3,0,4]]},
 prism:{label:'Lăng trụ tam giác ABC.A′B′C′',points:[{name:'A',p:[-1,-.9,-.8]},{name:'B',p:[-1,.9,-.8]},{name:'C',p:[-1,0,1]},{name:'A′',p:[1,-.9,-.8]},{name:'B′',p:[1,.9,-.8]},{name:'C′',p:[1,0,1]}],edges:[[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[0,3],[1,4],[2,5]],faces:[[0,1,2],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]]},
 tetra:{label:'Tứ diện / hình chóp tam giác S.ABC',points:[{name:'A',p:[-1,-.8,-.65]},{name:'B',p:[1,-.8,-.65]},{name:'C',p:[0,1,-.65]},{name:'S',p:[0,0,1.2]}],edges:[[0,1],[1,2],[2,0],[0,3],[1,3],[2,3]],faces:[[0,1,2],[0,1,3],[1,2,3],[2,0,3]]},
 cuboid:{label:'Hình hộp chữ nhật ABCD.EFGH',points:[{name:'A',p:[-1.2,-.78,-.7]},{name:'B',p:[1.2,-.78,-.7]},{name:'C',p:[1.2,.78,-.7]},{name:'D',p:[-1.2,.78,-.7]},{name:'E',p:[-1.2,-.78,.7]},{name:'F',p:[1.2,-.78,.7]},{name:'G',p:[1.2,.78,.7]},{name:'H',p:[-1.2,.78,.7]}],edges:[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],faces:[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]},
 'oblique-prism':{label:'Lăng trụ tam giác xiên',points:[{name:'A',p:[-.95,-.9,-.8]},{name:'B',p:[-.95,.9,-.8]},{name:'C',p:[-.95,0,1]},{name:'A′',p:[1.05,-.9,-.8]},{name:'B′',p:[1.48,.9,-.8]},{name:'C′',p:[1.28,0,1]}],edges:[[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[0,3],[1,4],[2,5]],faces:[[0,1,2],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]]},
 octahedron:{label:'Bát diện đều',points:[{name:'S',p:[0,1.2,0]},{name:'S′',p:[0,-1.2,0]},{name:'A',p:[1,0,0]},{name:'B',p:[0,0,1]},{name:'C',p:[-1,0,0]},{name:'D',p:[0,0,-1]}],edges:[[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,3],[3,4],[4,5],[5,2]],faces:[[0,2,3],[0,3,4],[0,4,5],[0,5,2],[1,3,2],[1,4,3],[1,5,4],[1,2,5]]},
 'hex-prism':{label:'Lăng trụ lục giác đều',points:[{name:'A',p:[1,-.78,0]},{name:'B',p:[.5,-.78,.866]},{name:'C',p:[-.5,-.78,.866]},{name:'D',p:[-1,-.78,0]},{name:'E',p:[-.5,-.78,-.866]},{name:'F',p:[.5,-.78,-.866]},{name:'A′',p:[1,.78,0]},{name:'B′',p:[.5,.78,.866]},{name:'C′',p:[-.5,.78,.866]},{name:'D′',p:[-1,.78,0]},{name:'E′',p:[-.5,.78,-.866]},{name:'F′',p:[.5,.78,-.866]}],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[6,7],[7,8],[8,9],[9,10],[10,11],[11,6],[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]],faces:[[0,1,2,3,4,5],[6,7,8,9,10,11],[0,1,7,6],[1,2,8,7],[2,3,9,8],[3,4,10,9],[4,5,11,10],[5,0,6,11]]},
 cone:{label:'Hình nón',points:[{name:'S',p:[0,1.14,0]},{name:'O',p:[0,-.92,0]},{name:'A',p:[.9,-.92,0]}],edges:[],faces:[]},
 frustum:{label:'Hình chóp cụt tứ giác ABCD.A′B′C′D′',points:[{name:'A',p:[-.95,-.9,-.95]},{name:'B',p:[.95,-.9,-.95]},{name:'C',p:[.95,-.9,.95]},{name:'D',p:[-.95,-.9,.95]},{name:'A′',p:[-.52,.62,-.52]},{name:'B′',p:[.52,.62,-.52]},{name:'C′',p:[.52,.62,.52]},{name:'D′',p:[-.52,.62,.52]}],edges:[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],faces:[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]},
 cylinder:{label:'Hình trụ',points:[{name:'O',p:[0,-.92,0]},{name:'O′',p:[0,.92,0]},{name:'A',p:[.8,-.92,0]},{name:'B',p:[.8,.92,0]}],edges:[],faces:[]},
 sphere:{label:'Mặt cầu',points:[],edges:[],faces:[]}
};

function solidDefinition(solid:Solid,overrides:Record<string,Vec3>={}):SolidDefinition{
 const base=SOLIDS[solid];
 if(!Object.keys(overrides).length)return base;
 return {...base,points:base.points.map(pt=>({...pt,p:overrides[pt.name]||pt.p}))};
}

function safeInkColor(value:string){return /^#[\da-f]{6}$/i.test(value)?value:'#FF1E2D'}
function mixHex(a:string,b:string,t:number){const aa=safeInkColor(a),bb=safeInkColor(b);const n=(s:string,i:number)=>parseInt(s.slice(i,i+2),16);return '#'+[1,3,5].map(i=>Math.round(n(aa,i)*(1-t)+n(bb,i)*t).toString(16).padStart(2,'0')).join('')}
// Darken RGB channels proportionally: this preserves the hue and saturation of the chosen ink instead of blending it with white.
function shadeHex(value:string,factor:number){const c=safeInkColor(value),f=Math.max(0,Math.min(1,factor));return '#'+[1,3,5].map(i=>Math.round(parseInt(c.slice(i,i+2),16)*f).toString(16).padStart(2,'0')).join('')}
function rotate(p:Vec3,rx:number,ry:number):Vec3{const x1=p[0]*Math.cos(ry)+p[2]*Math.sin(ry),z1=-p[0]*Math.sin(ry)+p[2]*Math.cos(ry);return[x1,p[1]*Math.cos(rx)-z1*Math.sin(rx),p[1]*Math.sin(rx)+z1*Math.cos(rx)]}
const VIEW_PRESETS:Record<Exclude<ViewPreset,'free'>,{label:string;rx:number;ry:number}>={standard:{label:'Chuẩn SGK',rx:-.42,ry:-.58},front:{label:'Chính diện',rx:0,ry:0},top:{label:'Từ trên',rx:Math.PI/2,ry:0},side:{label:'Bên cạnh',rx:0,ry:Math.PI/2},back:{label:'Mặt sau',rx:0,ry:Math.PI}};
function guessViewPreset(rx:number,ry:number):ViewPreset{for(const key of Object.keys(VIEW_PRESETS) as Exclude<ViewPreset,'free'>[]){const v=VIEW_PRESETS[key];if(Math.abs(rx-v.rx)<.055&&Math.abs(ry-v.ry)<.055)return key}return 'free'}
function scaleVec(p:Vec3,config:Config):Vec3{return[p[0]*config.scaleX,p[1]*config.scaleY,p[2]*config.scaleZ]}
function sceneScaleFactor(config:Config){const dimensions=Math.max(1,config.scaleX,config.scaleY,config.scaleZ);let extent=dimensions;if(config.constructionPlanes.length)extent=Math.max(extent,1.8*dimensions);let factor=Math.min(1,1/dimensions,1.35/extent);if(config.showAxes||config.showGrid)factor=Math.min(factor,.72/dimensions);return factor}
function projectionScale(config:Config,w=900,h=620){return Math.min(w*.31,h*.34)*config.cameraZoom*sceneScaleFactor(config)}
function project(p:Vec3,config:Config,w=900,h=620){const q=rotate(scaleVec(p,config),config.rx,config.ry),scale=projectionScale(config,w,h);return{x:w/2+q[0]*scale,y:h*.51-q[1]*scale,z:q[2]}}
function sortPlanePolygon(result:Vec3[],normal:Vec3):Vec3[]{
 if(result.length<3)return [];
 const center:Vec3=[0,1,2].map(k=>result.reduce((sum,p)=>sum+p[k],0)/result.length) as Vec3;
 const norm=Math.hypot(...normal);if(norm<1e-9)return [];
 const n:Vec3=normal.map(v=>v/norm) as Vec3,axis:Vec3=Math.abs(n[0])<.8?[1,0,0]:[0,1,0];
 const rawU=cross3(n,axis),u:Vec3=rawU.map(v=>v/Math.max(1e-9,Math.hypot(...rawU))) as Vec3,v=cross3(n,u);
 return result.sort((p,q)=>{const dp=sub3(p,center),dq=sub3(q,center);return Math.atan2(dot3(dp,v),dot3(dp,u))-Math.atan2(dot3(dq,v),dot3(dq,u))});
}
function intersectEdgesWithPlane(points:Vec3[],edges:Edge[],plane:{a:number;b:number;c:number;d:number}):Vec3[]{
 const {a,b,c,d}=plane;if(Math.hypot(a,b,c)<1e-9)return [];
 const result:Vec3[]=[];const add=(p:Vec3)=>{if(!result.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])<1e-5))result.push(p)};
 const value=(p:Vec3)=>a*p[0]+b*p[1]+c*p[2]-d;
 for(const [ia,ib] of edges){const p=points[ia],q=points[ib];if(!p||!q)continue;const fp=value(p),fq=value(q);if(Math.abs(fp)<1e-8)add(p);if(Math.abs(fq)<1e-8)add(q);if(fp*fq<0){const t=fp/(fp-fq);add([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,p[2]+(q[2]-p[2])*t])}}
 return sortPlanePolygon(result,[a,b,c]);
}
function planeThroughThreePoints(p:Vec3,q:Vec3,r:Vec3):{a:number;b:number;c:number;d:number}|null{
 const n=cross3(sub3(q,p),sub3(r,p));if(Math.hypot(...n)<1e-7)return null;return {a:n[0],b:n[1],c:n[2],d:dot3(n,p)};
}
function sectionPoints(def:SolidDefinition,offset=0){return intersectEdgesWithPlane(def.points.map(pt=>pt.p),def.edges,{a:0,b:1,c:0,d:offset})}
function penParams(config:Config){
 const style=config.inkStyle||'ballpoint';
 const params:{widthFactor:number;opacity:number;cap:'round'|'butt'|'square';blend:boolean;rough:boolean;dash?:string;glow:boolean}={widthFactor:1,opacity:1,cap:'round',blend:false,rough:false,glow:false};
 if(style==='ballpoint'){params.widthFactor=.94;params.opacity=1}
 else if(style==='gel'){params.widthFactor=1.12;params.opacity=1}
 else if(style==='fineliner'){params.widthFactor=.62;params.opacity=1}
 else if(style==='pencil'){params.widthFactor=.88;params.opacity=.92;params.rough=true;params.dash='13 1.2 1.3 1.2'}
 else if(style==='fountain'){params.widthFactor=1.18;params.opacity=1}
 else if(style==='brush'){params.widthFactor=1.48;params.opacity=1}
 else if(style==='calligraphy'){params.widthFactor=1.25;params.opacity=1}
 else if(style==='chalk'){params.widthFactor=1.35;params.opacity=.88;params.rough=true;params.dash='7 2 1.2 2.5'}
 else if(style==='crayon'){params.widthFactor=1.42;params.opacity=.96;params.rough=true;params.dash='11 1.1 2 1.5'}
 else if(style==='marker'){params.widthFactor=1.9;params.opacity=.56;params.cap='square';params.blend=true}
 else if(style==='felt'){params.widthFactor=1.38;params.opacity=.98}
 else if(style==='monoline'){params.widthFactor=.86;params.opacity=1}
 else if(style==='neon'){params.widthFactor=1.08;params.opacity=1;params.glow=true}
 else if(style==='highlighter'){params.widthFactor=2.8;params.opacity=.4;params.blend=true}
 else if(style==='highlighter-square'){params.widthFactor=3;params.opacity=.42;params.blend=true;params.cap='butt'}
 return params;
}
function svgDefs(config:Config){const p=penParams(config),color=safeInkColor(config.inkColor);let defs='<defs>';defs+=`<marker id="geometryArrowHead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${color}"/></marker><linearGradient id="geometryFaceGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="${shadeHex(color,.56)}"/><stop offset="28%" stop-color="${shadeHex(color,.88)}"/><stop offset="62%" stop-color="${shadeHex(color,.76)}"/><stop offset="100%" stop-color="${shadeHex(color,.52)}"/></linearGradient>`;if(p.rough)defs+='<filter id="inkRough" x="-12%" y="-12%" width="124%" height="124%"><feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.15" xChannelSelector="R" yChannelSelector="G"/></filter>';if(p.glow)defs+='<filter id="inkGlow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';defs+='</defs>';return defs}
function edgeSvg(x1:number,y1:number,x2:number,y2:number,config:Config,hidden=false,fold=false){
 const p=penParams(config),color=safeInkColor(config.inkColor),width=Math.max(.9,Math.min(22,config.inkWidth*p.widthFactor)),angle=Math.atan2(y2-y1,x2-x1),calligraphy=config.inkStyle==='calligraphy';
 const orientedWidth=calligraphy?Math.max(width*.22,width*Math.abs(Math.sin(angle-Math.PI/6))*1.55):width,dash=hidden||fold?' stroke-dasharray="8 6"':p.dash?` stroke-dasharray="${p.dash}"`:'';
 // Shape outlines use the selected hue at full saturation; the pen type still controls width, nib, texture and dash pattern.
 const opacity=1,base=`x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"`;
 if(p.glow){const core=mixHex(color,'#ffffff',.78);return `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><line ${base} stroke="${color}" stroke-width="${orientedWidth*3.2}" opacity=".44" filter="url(#inkGlow)"/><line ${base} stroke="${color}" stroke-width="${orientedWidth*1.5}" opacity=".92" ${dash}/><line ${base} stroke="${core}" stroke-width="${Math.max(.8,orientedWidth*.42)}" opacity=".98"/></g>`}
 const filter=p.rough?' filter="url(#inkRough)"':'';let out=`<line ${base} stroke="${color}" stroke-width="${orientedWidth}" opacity="${opacity}" stroke-linecap="${p.cap}" stroke-linejoin="round"${dash}${filter}/>`;
 // Do not lay a pale specular stripe over the selected ink; preserve the user's chosen saturated hue.
 if(config.inkStyle==='chalk'&&!hidden&&!fold){const midX=(x1+x2)/2,midY=(y1+y2)/2;out+=`<line x1="${midX.toFixed(2)}" y1="${midY.toFixed(2)}" x2="${(midX+.25).toFixed(2)}" y2="${(midY-.25).toFixed(2)}" stroke="${shadeHex(color,.78)}" stroke-width="${Math.max(.35,orientedWidth*.12)}" opacity=".24"/>`}
 if(config.inkStyle==='crayon'&&!hidden&&!fold)out+=`<line ${base} stroke="${shadeHex(color,.84)}" stroke-width="${Math.max(.35,orientedWidth*.09)}" opacity=".34" stroke-dasharray="9 4 1 3" stroke-linecap="round"/>`;return out;
}
function svgStart(width:number,height:number,config:Config){let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;s+=svgDefs(config);if(config.background)s+=`<rect width="${width}" height="${height}" fill="#ffffff"/>`;if(config.inkStyle==='marker'||config.inkStyle.startsWith('highlighter'))s+='<g style="mix-blend-mode:multiply">';return s}
function svgEnd(config:Config){return `${config.inkStyle==='marker'||config.inkStyle.startsWith('highlighter')?'</g>':''}</svg>`}

// Base faces stay opaque in lateral-transparent mode; only side faces become translucent.
function isLateralSolidFace(solid:Solid,index:number):boolean{
 if(solid==='cube'||solid==='cuboid')return index>=2;
 if(solid==='pyramid'||solid==='tetra')return index>0;
 if(solid==='prism'||solid==='oblique-prism'||solid==='hex-prism')return index>1;
 if(solid==='frustum')return index>1;
 if(solid==='octahedron')return true;
 return true;
}
// The unfolding order differs from the 3D face order.
function isLateralNetFace(solid:Solid,index:number):boolean{
 if(solid==='cube'||solid==='cuboid')return index!==0&&index!==2;
 if(solid==='pyramid'||solid==='tetra')return index>0;
 if(solid==='prism'||solid==='oblique-prism')return index<3; // first three are lateral faces; last two are bases
 if(solid==='hex-prism')return index>1;
 if(solid==='frustum')return index>0&&index<5; // first and last are the two bases
 return true;
}
function faceFillOpacity(mode:SurfaceMode,lateral:boolean):number{
 if(mode==='outline')return 0;
 if(mode==='lateral-transparent'&&lateral)return 0.22;
 return 1;
}

// Determine visibility from actual face orientation after rotation, rather than guessing
// from an edge midpoint's depth. An edge is hidden only when every adjacent face faces away.
function cross3(a:Vec3,b:Vec3):Vec3{return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function sub3(a:Vec3,b:Vec3):Vec3{return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function dot3(a:Vec3,b:Vec3):number{return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function getVisibleFaces(def:SolidDefinition,config:Config):boolean[]{
 if(!def.faces.length||!def.points.length)return [];
 const center:Vec3=[0,1,2].map(k=>def.points.reduce((sum,pt)=>sum+scaleVec(pt.p,config)[k],0)/def.points.length) as Vec3;
 return def.faces.map(face=>{
  if(face.length<3)return false;
  const a=scaleVec(def.points[face[0]].p,config);let normal:Vec3=[0,0,0];
  for(let i=1;i<face.length-1;i++){
   normal=cross3(sub3(scaleVec(def.points[face[i]].p,config),a),sub3(scaleVec(def.points[face[i+1]].p,config),a));
   if(Math.hypot(...normal)>1e-8)break;
  }
  if(Math.hypot(...normal)<1e-8)return false;
  const faceCenter:Vec3=[0,1,2].map(k=>face.reduce((sum,index)=>sum+scaleVec(def.points[index].p,config)[k],0)/face.length) as Vec3;
  // Face winding isn't guaranteed consistent in preset definitions; orient its normal outward.
  if(dot3(normal,sub3(faceCenter,center))<0)normal=[-normal[0],-normal[1],-normal[2]];
  return rotate(normal,config.rx,config.ry)[2]>1e-7;
 });
}
function getHiddenEdges(def:SolidDefinition,visibleFaces:boolean[]):boolean[]{
 const adjacent=new Map<string,number[]>();
 const key=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`;
 def.faces.forEach((face,faceIndex)=>{
  for(let i=0;i<face.length;i++){
   const edgeKey=key(face[i],face[(i+1)%face.length]),owners=adjacent.get(edgeKey)||[];
   owners.push(faceIndex);adjacent.set(edgeKey,owners);
  }
 });
 return def.edges.map(([a,b])=>{
  const owners=adjacent.get(key(a,b))||[];
  return owners.length>0&&owners.every(faceIndex=>!visibleFaces[faceIndex]);
 });
}

type CurvedProfile={bottomY:number;bottomR:number;topY:number;topR:number};
function curvedProfile(solid:CurvedSolid):CurvedProfile{if(solid==='cone')return {bottomY:-.92,bottomR:.9,topY:1.14,topR:0};if(solid==='sphere')return {bottomY:-.95,bottomR:0,topY:.95,topR:0};return {bottomY:-.92,bottomR:.8,topY:.92,topR:.8}}
const isCurvedSolid=(solid:Solid):solid is CurvedSolid=>solid==='cone'||solid==='cylinder'||solid==='sphere';
function makeSample(world:Vec3,config:Config):RenderSample{return {world,cam:rotate(scaleVec(world,config),config.rx,config.ry),screen:project(world,config)}}
function ringSamples(y:number,r:number,config:Config,count=96):RenderSample[]{return Array.from({length:count},(_,i)=>{const a=i/count*Math.PI*2;return makeSample([Math.cos(a)*r,y,Math.sin(a)*r],config)})}
function pathFromPoints(points:XY[],close=false){if(!points.length)return '';return `M${points.map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L')}${close?' Z':''}`}
function samplePath(samples:RenderSample[],close=false){return pathFromPoints(samples.map(p=>p.screen),close)}
function interpolateDepthCrossing(a:RenderSample,b:RenderSample):XY{const dz=a.cam[2]-b.cam[2],t=Math.abs(dz)<1e-8?.5:a.cam[2]/dz;return {x:a.screen.x+(b.screen.x-a.screen.x)*t,y:a.screen.y+(b.screen.y-a.screen.y)*t}}
function ringArc(ring:RenderSample[],front:boolean):XY[]{if(ring.length<3)return ring.map(p=>p.screen);const n=ring.length,inside=(p:RenderSample)=>front?p.cam[2]>=0:p.cam[2]<0;let start=-1;for(let i=0;i<n;i++)if(inside(ring[i])&&!inside(ring[(i+n-1)%n])){start=i;break}if(start<0)return ring.map(p=>p.screen);const result:XY[]=[interpolateDepthCrossing(ring[(start+n-1)%n],ring[start]),ring[start].screen];let prev=ring[start];for(let step=1;step<=n;step++){const curr=ring[(start+step)%n];if(inside(curr)){result.push(curr.screen);prev=curr;continue}result.push(interpolateDepthCrossing(prev,curr));break}return result}
function leftToRight(points:XY[]){return points.length>1&&points[0].x>points[points.length-1].x?[...points].reverse():points}
function geometryPathSvg(d:string,config:Config,hidden=false,widthFactor=1){const p=penParams(config),color=safeInkColor(config.inkColor),width=Math.max(.9,Math.min(22,config.inkWidth*p.widthFactor*widthFactor)),opacity=hidden ? 0.80 : 1,dash=hidden?' stroke-dasharray="8 6"':p.dash?` stroke-dasharray="${p.dash}"`:'';if(p.glow)return `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${d}" stroke="${color}" stroke-width="${width*3.2}" opacity=".44" filter="url(#inkGlow)"/><path d="${d}" stroke="${color}" stroke-width="${width*1.5}" opacity=".92"${dash}/><path d="${d}" stroke="${mixHex(color,'#ffffff',.78)}" stroke-width="${Math.max(.8,width*.42)}" opacity=".98"/></g>`;const filter=p.rough?' filter="url(#inkRough)"':'';return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}" stroke-linecap="${p.cap}" stroke-linejoin="round"${dash}${filter}/>`}
function keyPointsForCurved(solid:CurvedSolid):{name:string;p:Vec3}[]{const q=curvedProfile(solid);if(solid==='cone')return [{name:'S',p:[0,q.topY,0]},{name:'O',p:[0,q.bottomY,0]},{name:'A',p:[q.bottomR,q.bottomY,0]}];if(solid==='sphere')return [{name:'O',p:[0,0,0]},{name:'N',p:[0,.95,0]},{name:'S',p:[0,-.95,0]}];return [{name:'O',p:[0,q.bottomY,0]},{name:'O′',p:[0,q.topY,0]},{name:'A',p:[q.bottomR,q.bottomY,0]},{name:'B',p:[q.topR,q.topY,0]}]}
function baseConstructionPoints(config:Config):GeometryPoint3D[]{
 const pts=isCurvedSolid(config.solid)?keyPointsForCurved(config.solid):solidDefinition(config.solid,config.vertexOverrides).points;
 return pts.map(pt=>({id:`model:${pt.name}`,name:pt.name,p:pt.p}));
}
function allConstructionPoints(config:Config):GeometryPoint3D[]{return resolveGeometryPoints(baseConstructionPoints(config),config.constructionPoints)}

function activeSectionPoints(config:Config,def:SolidDefinition):Vec3[]{
 if(config.sectionMode==='three-points'&&!isCurvedSolid(config.solid)){
  const byId=new Map(allConstructionPoints(config).map(point=>[point.id,point]));
  const selected=config.sectionPointIds.map(id=>byId.get(id)).filter((point):point is GeometryPoint3D=>Boolean(point));
  if(selected.length===3){const plane=planeThroughThreePoints(selected[0].p,selected[1].p,selected[2].p);if(plane)return intersectEdgesWithPlane(def.points.map(pt=>pt.p),def.edges,plane)}
  return [];
 }
 return sectionPoints(def,config.sectionOffset);
}
function xmlText(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&apos;')}
function referenceSvg(config:Config){
 if(config.view!=='solid'||(!config.showAxes&&!config.showGrid))return '';
 let out='';
 const line=(a:Vec3,b:Vec3,color:string,width:number,opacity=1,dash='')=>{const p=project(a,config),q=project(b,config);out+=`<line x1="${p.x.toFixed(2)}" y1="${p.y.toFixed(2)}" x2="${q.x.toFixed(2)}" y2="${q.y.toFixed(2)}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"${dash?` stroke-dasharray="${dash}"`:''}/>`};
 if(config.showGrid){
  for(let i=-2;i<=2.001;i+=.5){line([i,-1.18,-2],[i,-1.18,2],'#cbd9e8',.8,.76);line([-2,-1.18,i],[2,-1.18,i],'#cbd9e8',.8,.76)}
 }
 if(config.showAxes){
  line([-2.15,0,0],[2.15,0,0],'#e04646',2.1,.96);
  line([0,-1.6,0],[0,1.7,0],'#1d9d68',2.1,.96);
  line([0,0,-2.15],[0,0,2.15],'#2878d0',2.1,.96);
  for(const [name,pt,color,dx,dy] of [['x',[2.23,0,0],'#e04646',5,-6],['y',[0,1.78,0],'#1d9d68',6,3],['z',[0,0,2.23],'#2878d0',6,-4]] as [string,Vec3,string,number,number][]){const q=project(pt,config);out+=`<text x="${q.x+dx}" y="${q.y+dy}" font-size="16" font-family="Arial,sans-serif" font-weight="800" fill="${color}" stroke="#fff" stroke-width="3" paint-order="stroke">${name}</text>`}
 }
 return `<g class="geometry-reference">${out}</g>`;
}
function planeIntersectionPoints(plane:GeometryPlane3D,config:Config):Vec3[]{
 if(!isCurvedSolid(config.solid)){
  const def=solidDefinition(config.solid,config.vertexOverrides);return intersectEdgesWithPlane(def.points.map(pt=>pt.p),def.edges,plane);
 }
 const r=1.8,corners:Vec3[]=[[-r,-r,-r],[r,-r,-r],[r,r,-r],[-r,r,-r],[-r,-r,r],[r,-r,r],[r,r,r],[-r,r,r]],edges:Edge[]=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
 return intersectEdgesWithPlane(corners,edges,plane);
}
function constructionSvg(config:Config){
 if(config.view!=='solid')return '';
 const ink=safeInkColor(config.inkColor);let out='';
 for(const plane of config.constructionPlanes){const poly=planeIntersectionPoints(plane,config).map(p=>project(p,config));if(poly.length<3)continue;out+=`<polygon points="${poly.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" fill="${ink}" fill-opacity=".13" stroke="${ink}" stroke-width="${Math.max(1.2,config.inkWidth*.55)}" stroke-opacity=".9"/>`;const center={x:poly.reduce((sum,p)=>sum+p.x,0)/poly.length,y:poly.reduce((sum,p)=>sum+p.y,0)/poly.length};out+=`<text x="${center.x+8}" y="${center.y-8}" font-size="15" font-weight="750" fill="${ink}" stroke="#fff" stroke-width="3" paint-order="stroke">${xmlText(plane.name||'P')}</text>`}
 const pts=allConstructionPoints(config),byId=new Map(pts.map(p=>[p.id,p]));
 for(const seg of config.constructionSegments){const a=byId.get(seg.from),b=byId.get(seg.to);if(!a||!b||a.id===b.id)continue;let p1=a.p,p2=b.p;if(seg.kind==='line'){const d:Vec3=sub3(b.p,a.p),m=Math.max(1e-8,Math.hypot(...d)),u:Vec3=d.map(n=>n/m) as Vec3;p1=[a.p[0]-u[0]*3,a.p[1]-u[1]*3,a.p[2]-u[2]*3];p2=[a.p[0]+u[0]*3,a.p[1]+u[1]*3,a.p[2]+u[2]*3]};const u=project(p1,config),v=project(p2,config),width=Math.max(1.2,config.inkWidth*.6);out+=`<line x1="${u.x.toFixed(2)}" y1="${u.y.toFixed(2)}" x2="${v.x.toFixed(2)}" y2="${v.y.toFixed(2)}" stroke="${ink}" stroke-width="${width}"${seg.kind==='line'?' stroke-dasharray="7 5"':''}${seg.kind==='vector'?' marker-end="url(#geometryArrowHead)"':''}/>`;if(seg.kind==='segment'){const mid={x:(u.x+v.x)/2,y:(u.y+v.y)/2};const len=Math.hypot((b.p[0]-a.p[0])*config.scaleX,(b.p[1]-a.p[1])*config.scaleY,(b.p[2]-a.p[2])*config.scaleZ);out+=`<text x="${mid.x+6}" y="${mid.y-6}" font-size="13" font-weight="750" fill="${ink}" stroke="#fff" stroke-width="3" paint-order="stroke">${len.toFixed(2)}</text>`}}
 for(const pt of pts.filter(point=>!point.id.startsWith('model:'))){const q=project(pt.p,config);out+=`<circle cx="${q.x.toFixed(2)}" cy="${q.y.toFixed(2)}" r="5" fill="#fff" stroke="${ink}" stroke-width="2.2"/><text x="${q.x+8}" y="${q.y-8}" font-size="16" font-weight="800" fill="${ink}" stroke="#fff" stroke-width="3.5" paint-order="stroke">${xmlText(pt.name)}</text>`}
 return out;
}
function boundsSamples(config:Config){if(isCurvedSolid(config.solid)){if(config.solid==='sphere'){const pts:RenderSample[]=[];for(let j=0;j<=18;j++){const lat=-Math.PI/2+j*Math.PI/18;for(let i=0;i<48;i++){const lon=i*Math.PI*2/48;pts.push(makeSample([Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)],config))}}return pts.map(p=>p.screen)}const q=curvedProfile(config.solid);const pts=[...ringSamples(q.bottomY,q.bottomR,config),...ringSamples(q.topY,q.topR||.001,config)];if(q.topR===0)pts.push(makeSample([0,q.topY,0],config));return pts.map(p=>p.screen)}return solidDefinition(config.solid,config.vertexOverrides).points.map(p=>project(p.p,config))}
function svgBounds(config:Config){if(config.view==='net')return {x:0,y:0,width:500,height:440};const screens=boundsSamples(config),xs=screens.map(p=>p.x),ys=screens.map(p=>p.y);if(config.labels){const labels=isCurvedSolid(config.solid)?keyPointsForCurved(config.solid).map(pt=>project(pt.p,config)):solidDefinition(config.solid,config.vertexOverrides).points.map(pt=>project(pt.p,config));for(const pt of labels){const offsetX=pt.x<450?-12:8;xs.push(pt.x+offsetX-20,pt.x+offsetX+24);ys.push(pt.y-34,pt.y+4)}}if(config.showAxes||config.showGrid||config.constructionPoints.length||config.constructionSegments.length||config.constructionPlanes.length)return{x:0,y:0,width:900,height:620};const padding=Math.max(24,config.inkWidth*penParams(config).widthFactor*2.5),x=Math.min(...xs)-padding,y=Math.min(...ys)-padding,width=Math.max(...xs)-Math.min(...xs)+padding*2,height=Math.max(...ys)-Math.min(...ys)+padding*2;return{x,y,width,height}}
function curvedSolidSvgContent(config:Config){
 const solid=config.solid as CurvedSolid,q=curvedProfile(solid),bounds=svgBounds(config),color=safeInkColor(config.inkColor),params=penParams(config);
 if(solid==='sphere'){
  const cx=450,cy=310,sphereSamples=boundsSamples(config),rx=Math.max(3,(Math.max(...sphereSamples.map(p=>p.x))-Math.min(...sphereSamples.map(p=>p.x)))/2),ry=Math.max(3,(Math.max(...sphereSamples.map(p=>p.y))-Math.min(...sphereSamples.map(p=>p.y)))/2),fill=config.surfaceMode!=='outline';let out=`<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width.toFixed(2)}" height="${bounds.height.toFixed(2)}" viewBox="${bounds.x.toFixed(2)} ${bounds.y.toFixed(2)} ${bounds.width.toFixed(2)} ${bounds.height.toFixed(2)}">${svgDefs(config)}`;
  if(config.background)out+=`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#fff"/>`;out+=referenceSvg(config);
  if(fill)out+=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${shadeHex(color,.72)}" fill-opacity="${config.surfaceMode==='lateral-transparent'?.22:1}"/>`;
  out+=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" stroke-width="${Math.max(1.2,config.inkWidth*penParams(config).widthFactor)}"/>`;
  out+=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry*.34}" fill="none" stroke="${color}" stroke-width="${Math.max(1,config.inkWidth*penParams(config).widthFactor*.8)}" stroke-dasharray="${config.hidden?'7 6':''}"/>`;
  out+=`<path d="M${cx} ${cy-ry} C${cx-rx*.55} ${cy-ry*.45} ${cx-rx*.55} ${cy+ry*.45} ${cx} ${cy+ry} M${cx} ${cy-ry} C${cx+rx*.55} ${cy-ry*.45} ${cx+rx*.55} ${cy+ry*.45} ${cx} ${cy+ry}" fill="none" stroke="${color}" stroke-width="${Math.max(1,config.inkWidth*penParams(config).widthFactor*.8)}" opacity=".82"/>`;
  if(config.section){const sy=config.sectionOffset,sr=Math.sqrt(Math.max(0,.95*.95-sy*sy)),cut=ringSamples(sy,sr,config);out+=`<path d="${samplePath(cut,true)}" fill="${shadeHex(color,.82)}" fill-opacity=".92" stroke="${color}" stroke-width="${Math.max(1.2,config.inkWidth*.65)}"/>`}
  if(config.labels)out+=`<g font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="${color}"><text x="${cx+7}" y="${cy-7}">O</text><text x="${cx+8}" y="${cy-ry+4}">N</text><text x="${cx+8}" y="${cy+ry-4}">S</text></g>`;
  out+=constructionSvg(config);return out+'</svg>';
 }
 const bottom=ringSamples(q.bottomY,q.bottomR,config),top=q.topR>0?ringSamples(q.topY,q.topR,config):[],apex=makeSample([0,q.topY,0],config),bFront=leftToRight(ringArc(bottom,true)),tFront=top.length?leftToRight(ringArc(top,true)):[];
 let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width.toFixed(2)}" height="${bounds.height.toFixed(2)}" viewBox="${bounds.x.toFixed(2)} ${bounds.y.toFixed(2)} ${bounds.width.toFixed(2)} ${bounds.height.toFixed(2)}">${svgDefs(config)}`;if(config.background)s+=`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#fff"/>`;s+=referenceSvg(config);if(params.blend)s+='<g style="mix-blend-mode:multiply">';
 const fillEnabled=config.surfaceMode!=='outline';let body='';if(solid==='cone')body=`M${apex.screen.x.toFixed(2)} ${apex.screen.y.toFixed(2)} L${bFront.map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L')} Z`;else body=`M${tFront.map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L')} L${[...bFront].reverse().map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L')} Z`;if(fillEnabled){
  // The lateral mantle is translucent on request; circular bases remain fully colored.
  s+=`<path d="${samplePath(bottom,true)}" fill="${shadeHex(color,.54)}" fill-opacity="1" stroke="none"/>`;
  s+=`<path d="${body}" fill="url(#geometryFaceGradient)" fill-opacity="${config.surfaceMode==='lateral-transparent'?.22:1}" stroke="none"/>`;
  if(top.length)s+=`<path d="${samplePath(top,true)}" fill="${shadeHex(color,.74)}" fill-opacity="1" stroke="none"/>`;
 }
 if(config.section){const y=config.sectionOffset,r=solid==='cone'?q.bottomR*(q.topY-y)/(q.topY-q.bottomY):q.topR+(q.bottomR-q.topR)*(q.topY-y)/(q.topY-q.bottomY),cut=ringSamples(y,Math.max(0,r),config);s+=`<path d="${samplePath(cut,true)}" fill="${shadeHex(color,.82)}" fill-opacity="1" stroke="none"/>${geometryPathSvg(samplePath(cut,true),config,false,.9)}`}
 // Draw circles dashed first, then solid side walls and the visible front arc.
 if(top.length)s+=geometryPathSvg(samplePath(top,true),config,config.hidden);s+=geometryPathSvg(samplePath(bottom,true),config,config.hidden);
 if(solid==='cone'){for(const end of [bFront[0],bFront[bFront.length-1]])s+=edgeSvg(apex.screen.x,apex.screen.y,end.x,end.y,config,false)}else{const lt=tFront[0],rt=tFront[tFront.length-1],lb=bFront[0],rb=bFront[bFront.length-1];s+=edgeSvg(lt.x,lt.y,lb.x,lb.y,config,false)+edgeSvg(rt.x,rt.y,rb.x,rb.y,config,false)}
 if(config.hidden){if(top.length)s+=geometryPathSvg(pathFromPoints(tFront),config,false);s+=geometryPathSvg(pathFromPoints(bFront),config,false)}
 for(const k of keyPointsForCurved(solid)){const pt=project(k.p,config);if(config.vertices)s+=`<circle cx="${pt.x}" cy="${pt.y}" r="4.5" fill="#fff" stroke="${color}" stroke-width="${Math.max(1.2,config.inkWidth*.48)}"/>`;if(config.labels){const left=pt.x>450,tx=pt.x+(left?-11:9),anchor=left?'end':'start';s+=`<text x="${tx}" y="${pt.y-9}" text-anchor="${anchor}" font-size="20" font-weight="700" fill="${color}" stroke="#fff" stroke-width="4" paint-order="stroke">${k.name}</text>`}}
 s+=constructionSvg(config);s+=`${params.blend?'</g>':''}</svg>`;return s;
}
function solidSvgContent(config:Config){if(isCurvedSolid(config.solid))return curvedSolidSvgContent(config);const def=solidDefinition(config.solid,config.vertexOverrides),v=def.points.map(pt=>({...pt,cam:rotate(scaleVec(pt.p,config),config.rx,config.ry),screen:project(pt.p,config)})),bounds=svgBounds(config),color=safeInkColor(config.inkColor),params=penParams(config);const faces=def.faces.map((face,index)=>({face,index,depth:face.reduce((sum,i)=>sum+v[i].cam[2],0)/face.length})).sort((a,b)=>a.depth-b.depth);const p=(i:number)=>`${v[i].screen.x.toFixed(2)},${v[i].screen.y.toFixed(2)}`;let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width.toFixed(2)}" height="${bounds.height.toFixed(2)}" viewBox="${bounds.x.toFixed(2)} ${bounds.y.toFixed(2)} ${bounds.width.toFixed(2)} ${bounds.height.toFixed(2)}">${svgDefs(config)}`;if(config.background)s+=`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#fff"/>`;s+=referenceSvg(config);if(params.blend)s+='<g style="mix-blend-mode:multiply">';for(const f of faces){const brightness=f.depth > 0.35 ? 0.82 : f.depth > -0.2 ? 0.68 : 0.54,lateral=isLateralSolidFace(config.solid,f.index),opacity=faceFillOpacity(config.surfaceMode,lateral),fill=opacity>0?shadeHex(color,brightness):'none';s+=`<polygon points="${f.face.map(p).join(' ')}" fill="${fill}" fill-opacity="${opacity}" stroke="none"/>`}if(config.section){const cut=activeSectionPoints(config,def).map(pt=>project(pt,config));if(cut.length>=3)s+=`<polygon points="${cut.map(pt=>`${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' ')}" fill="${shadeHex(color,.78)}" fill-opacity="1" stroke="${color}" stroke-width="${Math.max(1.2,config.inkWidth*.65)}"/>`}const visibleFaces=getVisibleFaces(def,config),hiddenEdges=getHiddenEdges(def,visibleFaces);const edgeData=def.edges.map(([a,b],index)=>({a,b,hidden:hiddenEdges[index]})).sort((a,b)=>Number(b.hidden)-Number(a.hidden));for(const e of edgeData){s+=edgeSvg(v[e.a].screen.x,v[e.a].screen.y,v[e.b].screen.x,v[e.b].screen.y,config,config.hidden&&e.hidden);if(config.showLengths){const a=def.points[e.a],b=def.points[e.b],pa=v[e.a].screen,pb=v[e.b].screen,midX=(pa.x+pb.x)/2,midY=(pa.y+pb.y)/2,len=Math.hypot((a.p[0]-b.p[0])*config.scaleX,(a.p[1]-b.p[1])*config.scaleY,(a.p[2]-b.p[2])*config.scaleZ);s+=`<text x="${midX+4}" y="${midY-5}" font-size="12" font-weight="750" fill="${color}" stroke="#fff" stroke-width="3" paint-order="stroke">${len.toFixed(2)}</text>`}}v.forEach(pt=>{if(config.vertices)s+=`<circle cx="${pt.screen.x}" cy="${pt.screen.y}" r="4.5" fill="#fff" stroke="${color}" stroke-width="${Math.max(1.1,config.inkWidth*.48)}"/>`;if(config.labels){const offsetX=pt.screen.x<450?-12:8,anchor=offsetX<0?'end':'start';s+=`<text x="${pt.screen.x+offsetX}" y="${pt.screen.y-9}" text-anchor="${anchor}" font-size="20" font-weight="700" fill="${color}" stroke="#fff" stroke-width="4" paint-order="stroke">${pt.name}</text>`}});s+=constructionSvg(config);s+=`${params.blend?'</g>':''}</svg>`;return s}

function netFaces(solid:Solid):NetFace[]{
 const p=(x:number,y:number,name:string):NetPoint=>({x,y,name});
 if(solid==='cube'||solid==='cuboid'){const s=84,x=165,y=210;return [{points:[p(x,y,'A'),p(x+s,y,'B'),p(x+s,y+s,'C'),p(x,y+s,'D')]},{points:[p(x,y,'A'),p(x+s,y,'B'),p(x+s,y-s,'F'),p(x,y-s,'E')]},{points:[p(x,y-s,'E'),p(x+s,y-s,'F'),p(x+s,y-2*s,'G'),p(x,y-2*s,'H')]},{points:[p(x,y+s,'D'),p(x+s,y+s,'C'),p(x+s,y+2*s,'G'),p(x,y+2*s,'H')]},{points:[p(x,y,'A'),p(x,y+s,'D'),p(x-s,y+s,'H'),p(x-s,y,'E')]},{points:[p(x+s,y,'B'),p(x+s,y+s,'C'),p(x+2*s,y+s,'G'),p(x+2*s,y,'F')]}]}
 if(solid==='pyramid'){const A=p(190,158,'A'),B=p(286,158,'B'),C=p(286,254,'C'),D=p(190,254,'D');return [{points:[A,B,C,D]},{points:[A,B,p(238,77,'S')]},{points:[B,C,p(367,206,'S')]},{points:[C,D,p(238,335,'S')]},{points:[D,A,p(109,206,'S')]}]}
 if(solid==='octahedron'){const s1=p(170,150,'S'),a1=p(120,236,'A'),b1=p(220,236,'B'),sp1=p(170,322,'S′'),c1=p(270,150,'C'),sp2=p(320,236,'S′'),d1=p(220,64,'D'),d2=p(370,150,'D'),a2=p(420,236,'A'),d0=p(70,150,'D');return [{points:[s1,a1,b1]},{points:[s1,b1,c1]},{points:[s1,c1,d1]},{points:[s1,d0,a1]},{points:[sp1,b1,a1]},{points:[sp2,c1,b1]},{points:[sp2,d2,c1]},{points:[sp2,a2,d2]}]}
 if(solid==='frustum'){const A=p(205,205,'A'),B=p(295,205,'B'),C=p(295,295,'C'),D=p(205,295,'D'),Ap=p(225,128,'A′'),Bp=p(275,128,'B′'),Cp=p(375,225,'C′'),BpR=p(375,275,'B′'),CpB=p(275,372,'C′'),DpB=p(225,372,'D′'),ApL=p(125,225,'A′'),DpL=p(125,275,'D′'),Ctop=p(275,78,'C′'),Dtop=p(225,78,'D′');return [{points:[A,B,C,D]},{points:[A,B,Bp,Ap]},{points:[B,C,Cp,BpR]},{points:[C,D,DpB,CpB]},{points:[D,A,ApL,DpL]},{points:[Ap,Bp,Ctop,Dtop]}]}
 if(solid==='prism'||solid==='oblique-prism'){const x=112,y=157,w=92,h=112;return [{points:[p(x,y,'A'),p(x+w,y,'B'),p(x+w,y+h,'B′'),p(x,y+h,'A′')]},{points:[p(x+w,y,'B'),p(x+2*w,y,'C'),p(x+2*w,y+h,'C′'),p(x+w,y+h,'B′')]},{points:[p(x+2*w,y,'C'),p(x+3*w,y,'A'),p(x+3*w,y+h,'A′'),p(x+2*w,y+h,'C′')]},{points:[p(x+w,y,'B'),p(x+2*w,y,'C'),p(x+1.5*w,y-79,'A')]},{points:[p(x+w,y+h,'B′'),p(x+2*w,y+h,'C′'),p(x+1.5*w,y+h+79,'A′')]}]}
 if(solid==='hex-prism'){const x=95,y=202,w=52;const base=Array.from({length:6},(_,i)=>p(x+Math.cos(i*Math.PI/3)*w,y+Math.sin(i*Math.PI/3)*w*.86,String.fromCharCode(65+i))),top=base.map((q,i)=>p(q.x+150,q.y-24,String.fromCharCode(65+i)+"′"));return [{points:base},{points:top},...base.map((q,i)=>({points:[q,base[(i+1)%6],top[(i+1)%6],top[i]]}))]}
 if(solid==='cylinder'||solid==='cone'||solid==='sphere')return [];
 const A=p(240,252,'A'),B=p(322,252,'B'),C=p(281,181,'C');return [{points:[A,B,C]},{points:[A,B,p(281,323,'S')]},{points:[B,C,p(363,181,'S')]},{points:[C,A,p(199,181,'S')]}]
}
function modelFaceKey(names:string[]){return [...names].sort().join('|')}
function supportsAnimatedNet(solid:Solid):boolean{
 if(isCurvedSolid(solid))return false;
 const def=SOLIDS[solid],validFaces=new Set(def.faces.map(face=>modelFaceKey(face.map(i=>def.points[i].name)))),faces=netFaces(solid);
 return faces.length>0&&faces.every(face=>validFaces.has(modelFaceKey(face.points.map(point=>point.name))));
}
function netEdgeKey(a:NetPoint,b:NetPoint){const one=`${a.x.toFixed(2)},${a.y.toFixed(2)}`,two=`${b.x.toFixed(2)},${b.y.toFixed(2)}`;return one<two?`${one}|${two}`:`${two}|${one}`}
type NetHinge={key:string;a:NetPoint;b:NetPoint;owners:number[]};
function listNetHinges(solid:Solid):NetHinge[]{
 const faces=netFaces(solid),map=new Map<string,NetHinge>();
 faces.forEach((face,faceIndex)=>{for(let i=0;i<face.points.length;i++){const a=face.points[i],b=face.points[(i+1)%face.points.length],key=netEdgeKey(a,b),old=map.get(key);if(old)old.owners.push(faceIndex);else map.set(key,{key,a,b,owners:[faceIndex]})}});
 return [...map.values()].filter(edge=>edge.owners.length>1);
}
function countNetComponents(solid:Solid,cutEdges:string[]):number{
 const faces=netFaces(solid),adj=new Map<number,Set<number>>();faces.forEach((_,i)=>adj.set(i,new Set()));
 for(const edge of listNetHinges(solid)){if(cutEdges.includes(edge.key))continue;for(const a of edge.owners)for(const b of edge.owners)if(a!==b)adj.get(a)?.add(b)}
 const seen=new Set<number>();let count=0;
 for(let start=0;start<faces.length;start++){if(seen.has(start))continue;count++;const queue=[start];seen.add(start);while(queue.length){const v=queue.shift()!;for(const n of adj.get(v)||[])if(!seen.has(n)){seen.add(n);queue.push(n)}}}
 return count;
}
function morphNetSvgContent(config:Config):string{
 const flatFaces=netFaces(config.solid);if(!flatFaces.length)return netSvgContent(config);
 const def=solidDefinition(config.solid,config.vertexOverrides),color=safeInkColor(config.inkColor);
 const modelFaceKeys=new Map<string,number>();def.faces.forEach((face,index)=>modelFaceKeys.set(modelFaceKey(face.map(i=>def.points[i].name)),index));
 const faceModels=flatFaces.map(face=>modelFaceKeys.get(modelFaceKey(face.points.map(p=>p.name)))??-1);
 const root=Math.max(0,Math.min(flatFaces.length-1,config.fixedFaceIndex)),rootModelFace=faceModels[root];
 if(rootModelFace<0||faceModels.some(i=>i<0))return netSvgContent(config);
 // The cut list is selected in the authored net, so convert each selected hinge to a stable
 // vertex-index key for the solid's face graph before performing the rigid rotations.
 const cutModelEdges=listNetHinges(config.solid).filter(edge=>config.cutEdges.includes(edge.key)).map(edge=>{
  const a=def.points.findIndex(p=>p.name===edge.a.name),b=def.points.findIndex(p=>p.name===edge.b.name);
  return a>=0&&b>=0?`${Math.min(a,b)}:${Math.max(a,b)}`:'';
 }).filter(Boolean);
 const folded=rigidFoldFacePositions(def.points.map(p=>p.p),def.faces,rootModelFace,Math.max(0,Math.min(100,config.foldProgress))/100,cutModelEdges);
 const cameraPoint=(p:Vec3):XY=>{const q=project(p,config,500,440);return {x:q.x,y:q.y}};
 const rawFaces=flatFaces.map((face,faceIndex)=>{
  const modelFaceIndex=faceModels[faceIndex],modelFace=def.faces[modelFaceIndex],screenByName=new Map<string,XY>();
  if(folded.connectedFaces[modelFaceIndex]){
   const values=folded.facePoints[modelFaceIndex];modelFace.forEach((vertexIndex,i)=>screenByName.set(def.points[vertexIndex].name,cameraPoint(values[i])));
  }
  return face.points.map(q=>({name:q.name,flat:{x:q.x,y:q.y},p:screenByName.get(q.name)||{x:q.x,y:q.y},connected:folded.connectedFaces[modelFaceIndex]}));
 });
 // Normalize the whole rigidly transformed net into the fixed viewBox without changing any
 // face geometry. Disconnected components after cutting stay in their authored net positions.
 const connectedCoords=rawFaces.flat().filter(p=>p.connected).map(p=>p.p),xs=connectedCoords.map(p=>p.x),ys=connectedCoords.map(p=>p.y);
 let mapPoint:(p:XY)=>XY=p=>p;
 if(xs.length&&ys.length){const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(430/Math.max(1,maxX-minX),370/Math.max(1,maxY-minY));const cx=(minX+maxX)/2,cy=(minY+maxY)/2;mapPoint=p=>({x:250+(p.x-cx)*scale,y:220+(p.y-cy)*scale});}
 const interpolated=rawFaces.map(face=>face.map(q=>({x:q.connected?mapPoint(q.p).x:q.flat.x,y:q.connected?mapPoint(q.p).y:q.flat.y,name:q.name,flat:q.flat,connected:q.connected})));
 let out=svgStart(500,440,config);
 for(let i=0;i<interpolated.length;i++){
  const pts=interpolated[i],fillOpacity=faceFillOpacity(config.surfaceMode,isLateralNetFace(config.solid,i)),fill=shadeHex(color,i===root ? .94 : .78);
  out+=`<polygon points="${pts.map(q=>`${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ')}" fill="${fillOpacity>0?fill:'none'}" fill-opacity="${fillOpacity}" stroke="${i===root?color:'none'}" stroke-width="${i===root?2.5:0}"/>`;
 }
 const activeNetHinges=new Set<string>();
 for(const hinge of folded.hingeEdges){const [a,b]=hinge.split(':').map(Number);if(!Number.isFinite(a)||!Number.isFinite(b))continue;const pa=def.points[a],pb=def.points[b];if(!pa||!pb)continue;const edge=flatFaces.findIndex(face=>face.points.some((p,i)=>{const q=face.points[(i+1)%face.points.length];return (p.name===pa.name&&q.name===pb.name)||(p.name===pb.name&&q.name===pa.name)}));if(edge>=0){const face=flatFaces[edge],i=face.points.findIndex((p,j)=>{const q=face.points[(j+1)%face.points.length];return (p.name===pa.name&&q.name===pb.name)||(p.name===pb.name&&q.name===pa.name)});if(i>=0)activeNetHinges.add(netEdgeKey(face.points[i],face.points[(i+1)%face.points.length]));}}
 const drawnHinges=new Set<string>();
 flatFaces.forEach((face,fi)=>{const pts=interpolated[fi];for(let i=0;i<face.points.length;i++){const a=face.points[i],b=face.points[(i+1)%face.points.length],key=netEdgeKey(a,b),isHinge=activeNetHinges.has(key),isFold=isHinge&&config.foldProgress<99.999;if(isHinge){if(drawnHinges.has(key))continue;drawnHinges.add(key);}out+=edgeSvg(pts[i].x,pts[i].y,pts[(i+1)%pts.length].x,pts[(i+1)%pts.length].y,config,false,isFold);}});
 const seen=new Set<string>();for(const face of interpolated)for(const q of face){if(!config.labels)continue;const key=`${q.x.toFixed(1)},${q.y.toFixed(1)},${q.name}`;if(seen.has(key))continue;seen.add(key);out+=`<text x="${q.x+5}" y="${q.y-5}" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="${color}" stroke="#fff" stroke-width="3" paint-order="stroke">${xmlText(q.name)}</text>`}
 return out+svgEnd(config);
}

function sectorPath(cx:number,cy:number,r:number,start:number,end:number){const sx=cx+r*Math.cos(start),sy=cy+r*Math.sin(start),ex=cx+r*Math.cos(end),ey=cy+r*Math.sin(end),delta=end-start,large=Math.abs(delta)>Math.PI?1:0,sweep=delta>=0?1:0;return `M${cx} ${cy} L${sx.toFixed(2)} ${sy.toFixed(2)} A${r} ${r} 0 ${large} ${sweep} ${ex.toFixed(2)} ${ey.toFixed(2)} Z`}
function ellipsePath(cx:number,cy:number,rx:number,ry:number){return `M${(cx-rx).toFixed(2)} ${cy.toFixed(2)} A${rx} ${ry} 0 1 0 ${(cx+rx).toFixed(2)} ${cy.toFixed(2)} A${rx} ${ry} 0 1 0 ${(cx-rx).toFixed(2)} ${cy.toFixed(2)} Z`}
function curvedNetSvgContent(config:Config){
 const color=safeInkColor(config.inkColor),fillEnabled=config.surfaceMode!=='outline';
 let s=svgStart(500,440,config);
 if(config.solid==='sphere'){for(let i=0;i<8;i++){const x=40+i*52;const d=`M${x} 70 C${x-22} 145 ${x-22} 295 ${x} 370 C${x+22} 295 ${x+22} 145 ${x} 70 Z`;if(fillEnabled)s+=`<path d="${d}" fill="${shadeHex(color,.78)}" fill-opacity="${config.surfaceMode==='lateral-transparent'?.22:1}"/>`;s+=geometryPathSvg(d,config,false)}return s+svgEnd(config)}
 if(config.solid==='cylinder'){
  const rect='M112 122 H388 V316 H112 Z',top=ellipsePath(250,76,43,30),bottom=ellipsePath(250,362,43,30);
  if(fillEnabled){const sideOpacity=config.surfaceMode==='lateral-transparent'?.22:1;s+=`<path d="${rect}" fill="${shadeHex(color,.78)}" fill-opacity="${sideOpacity}"/><path d="${top}" fill="${shadeHex(color,.68)}" fill-opacity="1"/><path d="${bottom}" fill="${shadeHex(color,.54)}" fill-opacity="1"/>`;}
  s+=geometryPathSvg(rect,config,false)+geometryPathSvg(top,config,false)+geometryPathSvg(bottom,config,false);
  s+=`<path d="M112 122 V316 M388 122 V316" fill="none" stroke="${color}" stroke-width="${Math.max(1.2,config.inkWidth*penParams(config).widthFactor)}" stroke-dasharray="6 5" opacity="1"/>`;
 }else{
  const sector=sectorPath(250,236,158,-2.35,-.79),base=ellipsePath(250,356,36,29);
  if(fillEnabled){const sideOpacity=config.surfaceMode==='lateral-transparent'?.22:1;s+=`<path d="${sector}" fill="${shadeHex(color,.78)}" fill-opacity="${sideOpacity}"/><path d="${base}" fill="${shadeHex(color,.54)}" fill-opacity="1"/>`;}
  s+=geometryPathSvg(sector,config,false)+geometryPathSvg(base,config,false);
  s+=`<path d="M250 236 L${(250+158*Math.cos(-2.35)).toFixed(2)} ${(236+158*Math.sin(-2.35)).toFixed(2)} M250 236 L${(250+158*Math.cos(-.79)).toFixed(2)} ${(236+158*Math.sin(-.79)).toFixed(2)}" stroke="${color}" stroke-width="${Math.max(1.2,config.inkWidth*penParams(config).widthFactor)}" fill="none"/>`;
 }
 if(config.labels){s+=`<g font-family="Arial,sans-serif" font-size="14" fill="${color}">${config.solid==='cone'?'<text x="260" y="82">S</text><text x="260" y="390">O</text>':'<text x="260" y="96">O′</text><text x="260" y="422">O</text>'}</g>`}
 return s+svgEnd(config)
}
function netSvgContent(config:Config){if(isCurvedSolid(config.solid))return curvedNetSvgContent(config);const faces=netFaces(config.solid),color=safeInkColor(config.inkColor);let s=svgStart(500,440,config);const map=new Map<string,{a:NetPoint;b:NetPoint;count:number}>();const edgeKey=netEdgeKey;for(let faceIndex=0;faceIndex<faces.length;faceIndex++){const face=faces[faceIndex],pts=face.points,lateral=isLateralNetFace(config.solid,faceIndex),fillOpacity=faceFillOpacity(config.surfaceMode,lateral),fill=fillOpacity>0?shadeHex(color,.78):'none';s+=`<polygon points="${pts.map(q=>`${q.x},${q.y}`).join(' ')}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${faceIndex===config.fixedFaceIndex?color:'none'}" stroke-width="${faceIndex===config.fixedFaceIndex?2.5:0}"/>`;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],key=edgeKey(a,b),existing=map.get(key);if(existing)existing.count++;else map.set(key,{a,b,count:1})}}for(const [key,e] of map.entries())s+=edgeSvg(e.a.x,e.a.y,e.b.x,e.b.y,config,false,e.count>1&&!config.cutEdges.includes(key));if(config.labels){const seen=new Set<string>();for(const face of faces)for(const q of face.points){const key=`${q.x.toFixed(2)},${q.y.toFixed(2)}`;if(seen.has(key))continue;seen.add(key);s+=`<text x="${q.x+5}" y="${q.y-5}" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="${color}" stroke="#fff" stroke-width="3" paint-order="stroke">${q.name}</text>`}}return s+svgEnd(config)}
function svgContent(config:Config){if(config.view!=='net')return solidSvgContent(config);if(!isCurvedSolid(config.solid)&&config.foldProgress<99.999)return morphNetSvgContent(config);return netSvgContent(config)}

type Props={onClose:()=>void;onInsert:(src:string,label:string,aspectRatio?:number,geometry?:GeometryObjectConfig)=>void;inkColor:string;inkWidth:number;inkStyle:string;initialSolid?:GeometrySolid;initialConfig?:GeometryObjectConfig;isEditing?:boolean};
export default function Geometry3DPanel({onClose,onInsert,inkColor,inkWidth,inkStyle,initialSolid='cube',initialConfig,isEditing=false}:Props){
 const [solid,setSolid]=useState<Solid>((initialConfig?.solid as Solid|undefined)||initialSolid),[view,setView]=useState<ViewMode>(initialConfig?.view||'solid'),[rx,setRx]=useState(initialConfig?.rx??-.42),[ry,setRy]=useState(initialConfig?.ry??-.58),[viewPreset,setViewPreset]=useState<ViewPreset>(initialConfig?guessViewPreset(initialConfig.rx,initialConfig.ry):'standard'),[labels,setLabels]=useState(initialConfig?.labels??false),[vertices,setVertices]=useState(initialConfig?.vertices??false),[hidden,setHidden]=useState(initialConfig?.hidden??true),[section,setSection]=useState(initialConfig?.section??false),[background,setBackground]=useState(initialConfig?.background??false),[surfaceMode,setSurfaceMode]=useState<SurfaceMode>(initialConfig?.surfaceMode||'solid');
 const [scaleX,setScaleX]=useState(initialConfig?.scaleX??1),[scaleY,setScaleY]=useState(initialConfig?.scaleY??1),[scaleZ,setScaleZ]=useState(initialConfig?.scaleZ??1),[cameraZoom,setCameraZoom]=useState(initialConfig?.cameraZoom??1),[showAxes,setShowAxes]=useState(initialConfig?.showAxes??false),[showGrid,setShowGrid]=useState(initialConfig?.showGrid??false),[showLengths,setShowLengths]=useState(initialConfig?.showLengths??false),[sectionOffset,setSectionOffset]=useState(initialConfig?.sectionOffset??0),[sectionMode,setSectionMode]=useState<SectionMode>(initialConfig?.sectionMode||'horizontal'),[sectionPointIds,setSectionPointIds]=useState<[string,string,string]>(initialConfig?.sectionPointIds||['model:A','model:B','model:C']),[foldProgress,setFoldProgress]=useState(initialConfig?.foldProgress??(initialConfig?.view==='net'?100:0)),[cutEdges,setCutEdges]=useState<string[]>(initialConfig?.cutEdges||[]),[fixedFaceIndex,setFixedFaceIndex]=useState(initialConfig?.fixedFaceIndex??0),[animating,setAnimating]=useState(false),[editPoints,setEditPoints]=useState(false);
 const [constructionPoints,setConstructionPoints]=useState<GeometryPoint3D[]>(initialConfig?.constructionPoints||[]),[constructionSegments,setConstructionSegments]=useState<GeometrySegment3D[]>(initialConfig?.constructionSegments||[]),[constructionPlanes,setConstructionPlanes]=useState<GeometryPlane3D[]>(initialConfig?.constructionPlanes||[]),[vertexOverrides,setVertexOverrides]=useState<Record<string,Vec3>>(initialConfig?.vertexOverrides||{}),[pointMode,setPointMode]=useState<'free'|'segment'|'midpoint'>('free'),[pointRefA,setPointRefA]=useState('model:A'),[pointRefB,setPointRefB]=useState('model:B'),[pointT,setPointT]=useState('0.5');
 const [pointName,setPointName]=useState('P'),[pointX,setPointX]=useState('0'),[pointY,setPointY]=useState('0'),[pointZ,setPointZ]=useState('0'),[segmentFrom,setSegmentFrom]=useState('model:0'),[segmentTo,setSegmentTo]=useState('model:1'),[segmentKind,setSegmentKind]=useState<'segment'|'line'|'vector'>('segment'),[planeName,setPlaneName]=useState('α'),[planeA,setPlaneA]=useState('0'),[planeB,setPlaneB]=useState('1'),[planeC,setPlaneC]=useState('0'),[planeD,setPlaneD]=useState('0');
 const geometryInkColor=initialConfig?.inkColor||inkColor,geometryInkWidth=initialConfig?.inkWidth??inkWidth,geometryInkStyle=initialConfig?.inkStyle||inkStyle;const drag=useRef<{mode:'rotate';x:number;y:number;rx:number;ry:number}|{mode:'point';id:string;depth:number;projectionScale:number}|null>(null);
 const applyViewPreset=(preset:ViewPreset)=>{setViewPreset(preset);if(preset!=='free'){setRx(VIEW_PRESETS[preset].rx);setRy(VIEW_PRESETS[preset].ry)}};
 const rawPoints=allConstructionPoints({solid,view,rx,ry,labels,vertices,hidden,section,background,surfaceMode,inkColor:safeInkColor(geometryInkColor),inkWidth:Math.max(1,Math.min(40,geometryInkWidth)),inkStyle:geometryInkStyle,scaleX,scaleY,scaleZ,cameraZoom,showAxes,showGrid,showLengths,sectionOffset,sectionMode,sectionPointIds,foldProgress,cutEdges,fixedFaceIndex,constructionPoints,constructionSegments,constructionPlanes,vertexOverrides});
 const availablePoints=rawPoints,validSectionPointIds=sectionPointIds.map((id,i)=>availablePoints.some(p=>p.id===id)?id:(availablePoints[i]?.id||'')) as [string,string,string];
 const config:Config={solid,view,rx,ry,labels,vertices,hidden,section,background,surfaceMode,inkColor:safeInkColor(geometryInkColor),inkWidth:Math.max(1,Math.min(40,geometryInkWidth)),inkStyle:geometryInkStyle,scaleX:Math.max(.25,Math.min(2.5,scaleX)),scaleY:Math.max(.25,Math.min(2.5,scaleY)),scaleZ:Math.max(.25,Math.min(2.5,scaleZ)),cameraZoom:Math.max(.5,Math.min(2,cameraZoom)),showAxes,showGrid,showLengths,sectionOffset:Math.max(-.9,Math.min(.9,sectionOffset)),sectionMode,sectionPointIds:validSectionPointIds,foldProgress:Math.max(0,Math.min(100,foldProgress)),cutEdges,fixedFaceIndex,constructionPoints,constructionSegments,constructionPlanes,vertexOverrides};
 const svg=useMemo(()=>svgContent(config),[solid,view,rx,ry,labels,vertices,hidden,section,background,surfaceMode,geometryInkColor,geometryInkWidth,geometryInkStyle,scaleX,scaleY,scaleZ,cameraZoom,showAxes,showGrid,showLengths,sectionOffset,sectionMode,validSectionPointIds,foldProgress,cutEdges,fixedFaceIndex,constructionPoints,constructionSegments,constructionPlanes,vertexOverrides]);
 const fromOptions=availablePoints.some(p=>p.id===segmentFrom)?segmentFrom:(availablePoints[0]?.id||''),toOptions=availablePoints.some(p=>p.id===segmentTo)?segmentTo:(availablePoints[1]?.id||availablePoints[0]?.id||''),pointAOptions=availablePoints.some(p=>p.id===pointRefA)?pointRefA:(availablePoints[0]?.id||''),pointBOptions=availablePoints.some(p=>p.id===pointRefB&&p.id!==pointAOptions)?pointRefB:(availablePoints.find(p=>p.id!==pointAOptions)?.id||'');
 const sectionSolution=useMemo(()=>{if(sectionMode!=='three-points'||isCurvedSolid(solid))return null;const def=solidDefinition(solid,vertexOverrides),chosen=validSectionPointIds.map(id=>availablePoints.find(p=>p.id===id));if(chosen.some(p=>!p))return null;const modelPoints=def.points.map(p=>p.p),modelNames=def.points.map(p=>p.name),selected=chosen as GeometryPoint3D[];const allPoints=[...modelPoints,...selected.map(p=>p.p)],allNames=[...modelNames,...selected.map(p=>p.name)],edgeList=def.edges.map(([a,b])=>({a,b,label:`${def.points[a]?.name||a}${def.points[b]?.name||b}`}));return buildSectionResult(allPoints,allNames,edgeList,[modelPoints.length,modelPoints.length+1,modelPoints.length+2]);},[sectionMode,solid,vertexOverrides,validSectionPointIds,availablePoints]);
 const hinges=useMemo(()=>listNetHinges(solid),[solid]);
 const netFaceLabels=useMemo(()=>netFaces(solid).map((face,i)=>({index:i,label:`Mặt ${i+1} · ${face.points.slice(0,3).map(p=>p.name).join('–')}`})),[solid]);
 const netComponentCount=useMemo(()=>countNetComponents(solid,cutEdges),[solid,cutEdges]);
 const isCurved=isCurvedSolid(solid),supportsNetAnimation=supportsAnimatedNet(solid);
 useEffect(()=>{if(!animating)return;let value=foldProgress;const direction=value>=100?-1:1;const timer=window.setInterval(()=>{value=Math.max(0,Math.min(100,value+direction*2));setFoldProgress(value);if(value===0||value===100){window.clearInterval(timer);setAnimating(false)}},22);return()=>window.clearInterval(timer)},[animating]);
 const openNet=()=>{setAnimating(false);setFoldProgress(100);setView('net')};
 const addPoint=()=>{if(constructionPoints.length>=80)return;const rawName=pointName.trim()||`P${constructionPoints.length+1}`,used=new Set(allConstructionPoints(config).map(p=>p.name));let finalName=rawName,n=2;while(used.has(finalName)){finalName=`${rawName}${n}`;n++}const value=(v:string)=>Math.max(-2.5,Math.min(2.5,Number.isFinite(Number(v))?Number(v):0));let p:Vec3=[value(pointX),value(pointY),value(pointZ)];let constraint:GeometryPoint3D['constraint'];if(pointMode!=='free'){const from=availablePoints.find(point=>point.id===pointAOptions),to=availablePoints.find(point=>point.id===pointBOptions);if(!from||!to||from.id===to.id)return;const t=pointMode==='midpoint' ? .5 : Math.max(0,Math.min(1,Number.isFinite(Number(pointT))?Number(pointT):.5));p=[from.p[0]+(to.p[0]-from.p[0])*t,from.p[1]+(to.p[1]-from.p[1])*t,from.p[2]+(to.p[2]-from.p[2])*t];constraint={type:pointMode==='midpoint'?'midpoint':'segment',from:from.id,to:to.id,t};}setConstructionPoints(prev=>[...prev,{id:crypto.randomUUID(),name:finalName,p,...(constraint?{constraint}:{})}]);setPointName(`P${constructionPoints.length+2}`)};
 const addSegment=()=>{if(!fromOptions||!toOptions||fromOptions===toOptions)return;setConstructionSegments(prev=>[...prev,{id:crypto.randomUUID(),from:fromOptions,to:toOptions,kind:segmentKind}])};
 const addPlane=()=>{const a=Number(planeA),b=Number(planeB),c=Number(planeC),d=Number(planeD);if(![a,b,c,d].every(Number.isFinite)||Math.hypot(a,b,c)<1e-8)return;setConstructionPlanes(prev=>[...prev,{id:crypto.randomUUID(),name:planeName.trim()||`π${prev.length+1}`,a,b,c,d}])};
 const deleteConstructionPoint=(id:string)=>{const removed=new Set([id]);let changed=true;while(changed){changed=false;for(const point of constructionPoints){if(!removed.has(point.id)&&point.constraint&&(removed.has(point.constraint.from)||removed.has(point.constraint.to))){removed.add(point.id);changed=true}}}setConstructionPoints(prev=>prev.filter(point=>!removed.has(point.id)));setConstructionSegments(prev=>prev.filter(seg=>!removed.has(seg.from)&&!removed.has(seg.to)))};
 const onDown=(e:React.PointerEvent<SVGSVGElement>)=>{if(view!=='solid')return;const rect=e.currentTarget.getBoundingClientRect(),sx=(e.clientX-rect.left)/Math.max(1,rect.width)*900,sy=(e.clientY-rect.top)/Math.max(1,rect.height)*620;if(editPoints){let nearest:GeometryPoint3D|undefined,dist=20;const candidates=isCurvedSolid(solid)?constructionPoints:availablePoints;for(const point of candidates){const screen=project(point.p,config),d=Math.hypot(screen.x-sx,screen.y-sy);if(d<dist){nearest=point;dist=d}}if(!nearest)return;const q=rotate(scaleVec(nearest.p,config),rx,ry);drag.current={mode:'point',id:nearest.id,depth:q[2],projectionScale:projectionScale(config)};}else drag.current={mode:'rotate',x:e.clientX,y:e.clientY,rx,ry};e.currentTarget.setPointerCapture(e.pointerId)};
 const onMove=(e:React.PointerEvent<SVGSVGElement>)=>{const active=drag.current;if(!active||view!=='solid')return;if(active.mode==='rotate'){const dx=e.clientX-active.x,dy=e.clientY-active.y;if(Math.abs(dx)+Math.abs(dy)>2)setViewPreset('free');setRy(active.ry+dx*.009);setRx(Math.max(-Math.PI/2,Math.min(Math.PI/2,active.rx+dy*.009)));return;}const rect=e.currentTarget.getBoundingClientRect(),sx=(e.clientX-rect.left)/Math.max(1,rect.width)*900,sy=(e.clientY-rect.top)/Math.max(1,rect.height)*620,qx=(sx-450)/active.projectionScale,qy=(310-sy)/active.projectionScale;const yScaled=qy*Math.cos(rx)+active.depth*Math.sin(rx),z1=-qy*Math.sin(rx)+active.depth*Math.cos(rx),xScaled=qx*Math.cos(ry)-z1*Math.sin(ry),zScaled=qx*Math.sin(ry)+z1*Math.cos(ry);const value=(n:number)=>Math.max(-2.5,Math.min(2.5,n));const next:Vec3=[value(xScaled/config.scaleX),value(yScaled/config.scaleY),value(zScaled/config.scaleZ)];if(active.id.startsWith('model:')){const pointName=active.id.slice('model:'.length);setVertexOverrides(prev=>({...prev,[pointName]:next}));}else{const target=constructionPoints.find(point=>point.id===active.id);if(target?.constraint){const refs=new Map(allConstructionPoints(config).map(point=>[point.id,point])),from=refs.get(target.constraint.from),to=refs.get(target.constraint.to);if(from&&to){const d:Vec3=[to.p[0]-from.p[0],to.p[1]-from.p[1],to.p[2]-from.p[2]],den=d[0]*d[0]+d[1]*d[1]+d[2]*d[2],t=den<1e-9?.5:Math.max(0,Math.min(1,((next[0]-from.p[0])*d[0]+(next[1]-from.p[1])*d[1]+(next[2]-from.p[2])*d[2])/den));setConstructionPoints(prev=>prev.map(point=>point.id===active.id?{...point,constraint:{type:'segment',from:target.constraint!.from,to:target.constraint!.to,t}}:point));}else setConstructionPoints(prev=>prev.map(point=>point.id===active.id?{...point,p:next,constraint:undefined}:point));}else setConstructionPoints(prev=>prev.map(point=>point.id===active.id?{...point,p:next}:point))}};
 const onWheel=(e:React.WheelEvent<SVGSVGElement>)=>{if(view!=='solid')return;e.preventDefault();setCameraZoom(prev=>Math.max(.5,Math.min(2,prev*Math.exp(-e.deltaY*.0012))))};
 const insert=(withSteps=false)=>{const bounds=view==='net'?{x:0,y:0,width:500,height:440}:svgBounds(config),label=view==='net'?`Trải phẳng ${SOLIDS[solid].label}`:SOLIDS[solid].label;const geometry:GeometryObjectConfig={solid,view,rx,ry,labels,vertices,hidden,section,background,surfaceMode,inkColor:config.inkColor,inkWidth:config.inkWidth,inkStyle:config.inkStyle,scaleX:config.scaleX,scaleY:config.scaleY,scaleZ:config.scaleZ,cameraZoom:config.cameraZoom,showAxes,showGrid,showLengths,sectionOffset:config.sectionOffset,sectionMode,sectionPointIds:config.sectionPointIds,foldProgress,cutEdges,fixedFaceIndex,constructionPoints,constructionSegments,constructionPlanes,vertexOverrides};let finalSvg=svg;let finalRatio=bounds.width/bounds.height;if(withSteps&&sectionSolution&&!sectionSolution.error){const extraH=185,w=Math.max(680,bounds.width),h=bounds.height+extraH;const stepLines=sectionSolution.steps.map((st,idx)=>`<text x="${bounds.x+18}" y="${bounds.y+bounds.height+26+idx*24}" font-family="Arial,sans-serif" font-size="14" fill="#1e293b">${xmlText(st)}</text>`).join("");finalSvg=svg.replace(/^<svg[^>]*>/,`<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}" height="${h.toFixed(2)}" viewBox="${bounds.x.toFixed(2)} ${bounds.y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}">`).replace(/<\/svg>$/,`<rect x="${bounds.x+8}" y="${bounds.y+bounds.height+4}" width="${w-16}" height="${extraH-12}" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>${stepLines}</svg>`);finalRatio=w/h;}onInsert(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(finalSvg)}`,withSteps?`${label} (kèm bước dựng)`:label,finalRatio,geometry)};
 return <div className="geo3d-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="geo3d-panel" role="dialog" aria-modal="true" aria-label="Dựng hình hình học không gian"><header className="geo3d-head"><div className="geo3d-icon"><Box size={22}/></div><div className="geo3d-heading"><h2>Hình học không gian</h2><p>{view==='solid'?'Dựng khối 3D rồi chèn vào trang':'Trải phẳng khối hình thành khai triển để học hình học'}</p></div><span className="geo3d-ink-chip" title={`Nét hiện hành: ${inkStyle}`}><i style={{background:config.inkColor,height:Math.max(2,Math.min(8,config.inkWidth))}}/><span>Nét hiện hành</span></span><span className="geo3d-offline"><i/> Offline</span><button className="geo3d-close" onClick={onClose} title="Đóng"><X size={20}/></button></header>
 <div className="geo3d-mode-tabs"><button type="button" className={view==='solid'?'active':''} onClick={()=>{setAnimating(false);setView('solid')}}><Box size={15}/> Dựng hình 3D</button><button type="button" className={view==='net'?'active':''} onClick={openNet}><Layers size={15}/> Trải phẳng</button></div>
 <div className="geo3d-toolbar"><label>Khối hình<select value={solid} onChange={e=>{setSolid(e.target.value as Solid);setVertexOverrides({});setCutEdges([]);setFoldProgress(100);setFixedFaceIndex(0);setAnimating(false)}}><option value="cube">Hình lập phương</option><option value="cuboid">Hình hộp chữ nhật</option><option value="pyramid">Hình chóp tứ giác đều</option><option value="tetra">Hình chóp tam giác / tứ diện</option><option value="prism">Lăng trụ tam giác đều</option><option value="oblique-prism">Lăng trụ tam giác xiên</option><option value="hex-prism">Lăng trụ lục giác đều</option><option value="octahedron">Bát diện đều</option><option value="cone">Hình nón</option><option value="frustum">Hình chóp cụt tứ giác</option><option value="cylinder">Hình trụ</option><option value="sphere">Mặt cầu</option></select></label>{view==='solid'&&<button type="button" onClick={()=>applyViewPreset('standard')}><RotateCcw size={15}/> Góc mặc định</button>}{view==='net'&&<span className="geo3d-net-note">Nét liền: đường cắt · nét đứt: đường gấp</span>}</div>
 {view==='solid'&&<div className="geo3d-camera-controls" role="group" aria-label="Điều khiển góc nhìn hình 3D"><button type="button" className={viewPreset==='free'?'active':''} onClick={()=>applyViewPreset('free')}>Tự do</button><label>Góc nhìn<select value={viewPreset} onChange={e=>applyViewPreset(e.target.value as ViewPreset)}><option value="standard">Chuẩn SGK</option><option value="front">Chính diện</option><option value="top">Từ trên</option><option value="side">Bên cạnh</option><option value="back">Mặt sau</option><option value="free">Góc đang xoay</option></select></label><button type="button" className={viewPreset==='front'?'active':''} onClick={()=>applyViewPreset('front')}>Chính diện</button><button type="button" className={viewPreset==='top'?'active':''} onClick={()=>applyViewPreset('top')}>Từ trên</button><button type="button" className={viewPreset==='side'?'active':''} onClick={()=>applyViewPreset('side')}>Bên cạnh</button><button type="button" onClick={openNet}><Layers size={14}/> Trải hình</button></div>}
 <div className="geo3d-view"><svg className={`geo3d-canvas ${editPoints?'geo3d-canvas-edit-points':''}`} viewBox={view==='net'?'0 0 500 440':'0 0 900 620'} role="img" aria-label={view==='solid'?'Mô hình hình học 3D tương tác; kéo để xoay':'Bản trải phẳng của khối đa diện'} onPointerDown={onDown} onPointerMove={onMove} onWheel={onWheel} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}} dangerouslySetInnerHTML={{__html:svg.replace(/^<svg[^>]*>|<\/svg>$/g,'')}}/><div className="geo3d-tip"><Move size={15}/>{view==='solid'?'Kéo để xoay · lăn chuột để zoom':'Bản triển khai 2D · chèn không kèm tiêu đề'}</div></div>
 {view==='net'&&<div className="geo3d-unfold-controls">
  <div className="geo3d-unfold-top"><strong><Layers size={16}/> Hoạt ảnh mô phỏng gấp ↔ trải</strong><span>{isCurved?'Khối tròn xoay hiện dùng hình khai triển minh họa tĩnh':!supportsNetAnimation?'Mẫu này hiện là hình trải tĩnh':`Mức trải: ${Math.round(foldProgress)}% · ${netComponentCount} cụm mặt`}</span></div>
  <div className="geo3d-unfold-range"><span>Gấp</span><input aria-label="Mức gấp hoặc trải khối" type="range" min="0" max="100" step="1" value={foldProgress} disabled={isCurved||!supportsNetAnimation||animating} onChange={e=>setFoldProgress(Number(e.target.value))}/><span>Trải</span><button type="button" disabled={isCurved||!supportsNetAnimation} onClick={()=>setAnimating(v=>!v)}>{animating?<><Pause size={15}/> Tạm dừng</>:<><Play size={15}/> Phát</>}</button></div>
  {!isCurved&&<div className="geo3d-net-options"><label>Mặt cố định<select value={fixedFaceIndex} onChange={e=>setFixedFaceIndex(Number(e.target.value))}>{netFaceLabels.map(face=><option key={face.index} value={face.index}>{face.label}</option>)}</select></label><div className="geo3d-cut-list"><span><Scissors size={14}/> Cạnh gấp/cắt (nhấn để đổi)</span><div>{hinges.map((edge,i)=>{const cut=cutEdges.includes(edge.key);return <button type="button" key={edge.key} className={cut?'cut':''} aria-pressed={cut} title={`Cạnh ${i+1}: ${cut?'đang cắt; nhấn để nối':'đang nối; nhấn để cắt'}`} onClick={()=>setCutEdges(prev=>cut?prev.filter(k=>k!==edge.key):[...prev,edge.key])}>{cut?<Scissors size={12}/>:<Link2 size={12}/>} Cạnh {i+1}: {cut?'Cắt':'Nối'}</button>})}</div></div></div>}
  <p className="geo3d-unfold-note">Với các đa diện có ánh xạ mặt, các mặt thuộc cụm nối với mặt cố định được biến đổi bằng phép quay cứng quanh cạnh bản lề; khi cắt cạnh, số cụm mặt được tính lại ở trên. Các cụm đã tách hiện giữ vị trí trong mẫu trải và chưa có thuật toán tự động sắp xếp để tránh chồng lấn trong mọi cấu hình cắt. Khối tròn xoay chỉ hiển thị bản trải minh họa tĩnh. Chèn lên trang sẽ chèn ảnh tĩnh ở trạng thái đang xem.</p>
 </div>}
 {view==='solid'&&<details className="geo3d-advanced" open>
  <summary>Tham số, hệ trục và công cụ dựng hình</summary>
  <div className="geo3d-parameter-grid">
   <label>Kích thước X <output>{config.scaleX.toFixed(2)}</output><input type="range" min="0.25" max="2.5" step="0.05" value={scaleX} onChange={e=>setScaleX(Number(e.target.value))}/></label>
   <label>Chiều cao Y <output>{config.scaleY.toFixed(2)}</output><input type="range" min="0.25" max="2.5" step="0.05" value={scaleY} onChange={e=>setScaleY(Number(e.target.value))}/></label>
   <label>Kích thước Z <output>{config.scaleZ.toFixed(2)}</output><input type="range" min="0.25" max="2.5" step="0.05" value={scaleZ} onChange={e=>setScaleZ(Number(e.target.value))}/></label>
   <label>Thu phóng camera <output>{config.cameraZoom.toFixed(2)}×</output><input type="range" min="0.5" max="2" step="0.05" value={cameraZoom} onChange={e=>setCameraZoom(Number(e.target.value))}/></label>
  </div>
  <div className="geo3d-advanced-toggles">
   <label className="geo3d-toggle"><input type="checkbox" checked={showAxes} onChange={e=>setShowAxes(e.target.checked)}/> Hệ trục Oxyz</label>
   <label className="geo3d-toggle"><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/> Lưới tọa độ</label>
   <label className="geo3d-toggle"><input type="checkbox" checked={showLengths} onChange={e=>setShowLengths(e.target.checked)}/> Độ dài cạnh</label>
   <label className="geo3d-toggle"><input type="checkbox" checked={editPoints} onChange={e=>setEditPoints(e.target.checked)}/> Kéo để di chuyển đỉnh và điểm tự tạo</label>
   {section&&!isCurved&&<div className="geo3d-section-tools"><label>Kiểu thiết diện<select value={sectionMode} onChange={e=>setSectionMode(e.target.value as SectionMode)}><option value="horizontal">Mặt phẳng ngang di động</option><option value="three-points">Mặt phẳng qua 3 điểm</option></select></label>{sectionMode==='horizontal'?<label className="geo3d-section-range">Vị trí mặt cắt <output>{sectionOffset.toFixed(2)}</output><input type="range" min="-0.9" max="0.9" step="0.05" value={sectionOffset} onChange={e=>setSectionOffset(Number(e.target.value))}/></label>:<div className="geo3d-section-point-row">{(['P','Q','R'] as const).map((name,i)=><label key={name}>{name}<select value={validSectionPointIds[i]} onChange={e=>setSectionPointIds(prev=>prev.map((id,j)=>j===i?e.target.value:id) as [string,string,string])}>{availablePoints.map(point=><option key={point.id} value={point.id}>{point.name} ({point.p.map(v=>v.toFixed(1)).join('; ')})</option>)}</select></label>)}</div>}<p className="geo3d-section-note">Thiết diện được tính bằng giao của mặt phẳng với cạnh đa diện; kéo điểm tự tạo sẽ cập nhật lại. Chọn ba điểm không thẳng hàng.</p>{sectionMode==='three-points'&&sectionSolution&&<details className="geo3d-section-solution" open><summary>Lời giải dựng thiết diện</summary>{sectionSolution.error?<p className="geo3d-section-error">{sectionSolution.error}</p>:<><ol>{sectionSolution.steps.map((step,i)=><li key={i}>{step}</li>)}</ol><p><b>Cạnh cắt xuyên:</b> {sectionSolution.crossingEdges.length?sectionSolution.crossingEdges.join(', '):'Không có'}</p><p><b>Cạnh đồng phẳng:</b> {sectionSolution.coplanarEdges.length?sectionSolution.coplanarEdges.join(', '):'Không có'}</p><p><b>Cạnh chạm tại đỉnh:</b> {sectionSolution.touchingEdges.length?sectionSolution.touchingEdges.join(', '):'Không có'}</p><button type="button" className="geo3d-secondary" style={{marginTop:6}} onClick={()=>insert(true)}><Plus size={14}/> Xuất hình kèm các bước dựng lên trang</button></>}</details>}</div>}
  </div>
  <div className="geo3d-construction-tools">
   {Object.keys(vertexOverrides).length>0&&<div className="geo3d-object-list"><strong>Đỉnh đã chỉnh: {Object.keys(vertexOverrides).join(', ')}</strong><button type="button" onClick={()=>setVertexOverrides({})}>Khôi phục hình chuẩn</button></div>}
   <div className="geo3d-tool-title">Điểm tự do và điểm phụ thuộc</div>
   <div className="geo3d-inline-form"><input aria-label="Tên điểm" value={pointName} onChange={e=>setPointName(e.target.value)} placeholder="Tên điểm" maxLength={12}/><select aria-label="Kiểu điểm mới" value={pointMode} onChange={e=>setPointMode(e.target.value as 'free'|'segment'|'midpoint')}><option value="free">Điểm tự do (x,y,z)</option><option value="segment">Điểm trên đoạn</option><option value="midpoint">Trung điểm hai điểm</option></select>{pointMode==='free'?<><input aria-label="Tọa độ x" type="number" step="0.1" min="-2.5" max="2.5" value={pointX} onChange={e=>setPointX(e.target.value)}/><input aria-label="Tọa độ y" type="number" step="0.1" min="-2.5" max="2.5" value={pointY} onChange={e=>setPointY(e.target.value)}/><input aria-label="Tọa độ z" type="number" step="0.1" min="-2.5" max="2.5" value={pointZ} onChange={e=>setPointZ(e.target.value)}/></>:<><select aria-label="Điểm gốc A" value={pointAOptions} onChange={e=>setPointRefA(e.target.value)}>{availablePoints.map(point=><option key={point.id} value={point.id}>{point.name}</option>)}</select><select aria-label="Điểm gốc B" value={pointBOptions} onChange={e=>setPointRefB(e.target.value)}>{availablePoints.filter(point=>point.id!==pointAOptions).map(point=><option key={point.id} value={point.id}>{point.name}</option>)}</select>{pointMode==='segment'&&<label className="geo3d-point-ratio">t <input aria-label="Tỉ lệ trên đoạn" type="number" min="0" max="1" step="0.05" value={pointT} onChange={e=>setPointT(e.target.value)}/></label>}</>}<button type="button" onClick={addPoint} disabled={constructionPoints.length>=80||(pointMode!=='free'&&(!pointAOptions||!pointBOptions||pointAOptions===pointBOptions))}>+ Điểm</button></div>
   <div className="geo3d-tool-title">Dựng đoạn thẳng, đường thẳng hoặc vectơ</div>
   <div className="geo3d-inline-form"><select aria-label="Điểm đầu" value={fromOptions} onChange={e=>setSegmentFrom(e.target.value)}>{availablePoints.map(p=><option key={p.id} value={p.id}>{p.name} ({p.p.map(v=>v.toFixed(1)).join(', ')})</option>)}</select><select aria-label="Điểm cuối" value={toOptions} onChange={e=>setSegmentTo(e.target.value)}>{availablePoints.map(p=><option key={p.id} value={p.id}>{p.name} ({p.p.map(v=>v.toFixed(1)).join(', ')})</option>)}</select><select aria-label="Loại đối tượng" value={segmentKind} onChange={e=>setSegmentKind(e.target.value as 'segment'|'line'|'vector')}><option value="segment">Đoạn thẳng</option><option value="line">Đường thẳng</option><option value="vector">Vectơ</option></select><button type="button" onClick={addSegment} disabled={!fromOptions||!toOptions||fromOptions===toOptions}>+ Dựng</button></div>
   <div className="geo3d-tool-title">Mặt phẳng theo phương trình ax + by + cz = d</div>
   <div className="geo3d-inline-form geo3d-plane-form"><input aria-label="Tên mặt phẳng" value={planeName} onChange={e=>setPlaneName(e.target.value)} maxLength={12}/><span>a</span><input aria-label="Hệ số a" type="number" step="0.5" value={planeA} onChange={e=>setPlaneA(e.target.value)}/><span>b</span><input aria-label="Hệ số b" type="number" step="0.5" value={planeB} onChange={e=>setPlaneB(e.target.value)}/><span>c</span><input aria-label="Hệ số c" type="number" step="0.5" value={planeC} onChange={e=>setPlaneC(e.target.value)}/><span>d</span><input aria-label="Hằng số d" type="number" step="0.5" value={planeD} onChange={e=>setPlaneD(e.target.value)}/><button type="button" onClick={addPlane} disabled={Math.hypot(Number(planeA)||0,Number(planeB)||0,Number(planeC)||0)<1e-8}>+ Mặt phẳng</button></div>
   {(constructionPoints.length+constructionSegments.length+constructionPlanes.length)>0&&<div className="geo3d-object-list"><strong>Đối tượng phụ đã dựng</strong>{constructionPoints.map(p=><span key={p.id}>Điểm {p.name}{p.constraint?.type==='midpoint'?' · trung điểm':p.constraint?.type==='segment'?' · trên đoạn':''} <button type="button" aria-label={`Xóa điểm ${p.name}`} onClick={()=>deleteConstructionPoint(p.id)}>×</button></span>)}{constructionSegments.map(seg=><span key={seg.id}>{seg.kind==='line'?'Đường thẳng':seg.kind==='vector'?'Vectơ':'Đoạn thẳng'} <button type="button" aria-label="Xóa đối tượng" onClick={()=>setConstructionSegments(prev=>prev.filter(q=>q.id!==seg.id))}>×</button></span>)}{constructionPlanes.map(pl=><span key={pl.id}>Mặt phẳng {pl.name} <button type="button" aria-label={`Xóa mặt phẳng ${pl.name}`} onClick={()=>setConstructionPlanes(prev=>prev.filter(q=>q.id!==pl.id))}>×</button></span>)}</div>}
  </div>
  <p className="geo3d-advanced-hint">Mẹo: {editPoints?'bật chế độ này rồi kéo một đỉnh A/B/C hoặc điểm P/Q; các cạnh, mặt cắt và đường phụ cập nhật theo.':'kéo vùng trống để xoay khối, lăn chuột để zoom.'} Tọa độ dùng hệ Oxyz; mặt phẳng được cắt với hộp hiển thị để vẽ đa giác giao.</p>
 </details>}
 <div className="geo3d-options"><div className="geo3d-surface-modes" role="group" aria-label="Chế độ bề mặt"><button type="button" className={`geo3d-surface-mode ${surfaceMode==='solid'?'active':''}`} aria-pressed={surfaceMode==='solid'} onClick={()=>setSurfaceMode('solid')}><Layers size={14}/> Tô khối</button><button type="button" className={`geo3d-surface-mode ${surfaceMode==='outline'?'active':''}`} aria-pressed={surfaceMode==='outline'} onClick={()=>setSurfaceMode('outline')}><EyeOff size={14}/> Chỉ viền</button><button type="button" className={`geo3d-surface-mode ${surfaceMode==='lateral-transparent'?'active':''}`} aria-pressed={surfaceMode==='lateral-transparent'} onClick={()=>setSurfaceMode('lateral-transparent')}><Eye size={14}/> Mặt xung quanh trong suốt</button></div><label className="geo3d-toggle"><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/> Hiện tên đỉnh</label>{view==='solid'&&<><label className="geo3d-toggle"><input type="checkbox" checked={vertices} onChange={e=>setVertices(e.target.checked)}/> Chấm đỉnh</label><label className="geo3d-toggle"><input type="checkbox" checked={hidden} onChange={e=>setHidden(e.target.checked)}/>{hidden?<Eye size={15}/>:<EyeOff size={15}/>} Cạnh khuất nét đứt</label><label className="geo3d-toggle"><input type="checkbox" checked={section} onChange={e=>setSection(e.target.checked)}/><Layers size={15}/> Mặt phẳng cắt</label></>}<label className="geo3d-toggle"><input type="checkbox" checked={background} onChange={e=>setBackground(e.target.checked)}/> Nền trắng</label></div>
 <footer className="geo3d-footer"><div className="geo3d-footnote"><PenLine size={14}/> Màu mực bão hòa theo màu bút đang chọn · SVG nền trong suốt.</div><button className="geo3d-secondary" onClick={onClose}>Để sau</button><button className="geo3d-insert" onClick={()=>insert(false)}><Plus size={17}/> {isEditing?(view==='net'?'Cập nhật bản trải phẳng':'Cập nhật hình đã chèn'):(view==='net'?'Chèn bản trải phẳng':'Chèn hình vào trang')}</button></footer></section></div>
}
