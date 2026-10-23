import { useMemo, useState } from 'react';
import { Axis3D, Box, Circle, Layers, Shapes, Table2, X, Plus, Rotate3D, Ruler } from 'lucide-react';
import type { GeometrySolid } from './Geometry3D/Geometry3DPanel';
import './geometry-library.css';

type Category = 'flat'|'polyhedra'|'revolution'|'rotatable'|'templates';
type Entry = {id:string;label:string;hint:string;category:Category;svg?:string;solid?:GeometrySolid};
type Props = {onClose:()=>void;onInsert:(src:string,label:string,aspectRatio?:number)=>void;onOpen3D:(solid:GeometrySolid)=>void;inkColor:string;inkWidth:number};

const entries:Entry[]=[
 {id:'triangle',label:'Tam giác',hint:'Ba cạnh, ba đỉnh',category:'flat'},
 {id:'right-triangle',label:'Tam giác vuông',hint:'Có góc vuông',category:'flat'},
 {id:'isosceles',label:'Tam giác cân',hint:'Hai cạnh bên bằng nhau',category:'flat'},
 {id:'altitude',label:'Tam giác có đường cao',hint:'Kèm đường cao',category:'flat'},
 {id:'regular-hexagon',label:'Lục giác đều',hint:'Đa giác đều n = 6',category:'flat'},
 {id:'rectangle',label:'Hình chữ nhật',hint:'Bốn góc vuông',category:'flat'},
 {id:'parallelogram',label:'Hình bình hành',hint:'Hai cặp cạnh song song',category:'flat'},
 {id:'trapezoid',label:'Hình thang',hint:'Một cặp cạnh song song',category:'flat'},
 {id:'circle',label:'Đường tròn',hint:'Chỉ đường bao',category:'flat'},
 {id:'disk',label:'Hình tròn',hint:'Miền bên trong',category:'flat'},
 {id:'ellipse',label:'Elip',hint:'Đường cong kín',category:'flat'},
 {id:'hyperbola',label:'Hypebol',hint:'Hai nhánh đối xứng',category:'flat'},
 {id:'parabola',label:'Parabol',hint:'Đường cong bậc hai',category:'flat'},
 {id:'annulus',label:'Miền vành khăn',hint:'Hai đường tròn đồng tâm',category:'flat'},
 {id:'square',label:'Hình vuông',hint:'Bốn cạnh bằng nhau, bốn góc vuông',category:'flat'},
 {id:'regular-pentagon',label:'Ngũ giác đều',hint:'Năm cạnh và năm góc bằng nhau',category:'flat'},
 {id:'regular-octagon',label:'Bát giác đều',hint:'Tám cạnh và tám góc bằng nhau',category:'flat'},
 {id:'diameter-circle',label:'Đường kính đường tròn',hint:'Đường kính và tâm O',category:'flat'},
 {id:'tangent-circle',label:'Tiếp tuyến đường tròn',hint:'Tiếp tuyến vuông góc với bán kính tại tiếp điểm',category:'flat'},
 {id:'secant-circle',label:'Cát tuyến đường tròn',hint:'Đường thẳng cắt đường tròn tại hai điểm',category:'flat'},
 {id:'triangle-median',label:'Tam giác và trung tuyến',hint:'Ba đường trung tuyến',category:'flat'},
 {id:'angle-bisectors',label:'Tam giác và phân giác',hint:'Ba đường phân giác',category:'flat'},
 {id:'perpendicular-bisectors',label:'Các đường trung trực',hint:'Ba đường trung trực cạnh tam giác',category:'flat'},
 {id:'cube-net',label:'Khai triển hình lập phương',hint:'Mẫu 6 hình vuông để gấp thành khối',category:'templates'},
 {id:'inequality-chart',label:'Miền nghiệm bất phương trình',hint:'Minh họa miền nghiệm nửa mặt phẳng',category:'templates'},
 {id:'variation-table',label:'Bảng biến thiên',hint:'Khung x, f′(x), f(x)',category:'templates'},
 {id:'venn-diagram',label:'Giản đồ Ven',hint:'Hai tập hợp và phần giao',category:'templates'},
 {id:'coordinate-3d',label:'Hệ trục Oxyz',hint:'Ba trục tọa độ không gian',category:'templates'},
 {id:'pascal-triangle',label:'Tam giác Pascal',hint:'Các hệ số nhị thức',category:'templates'},
 {id:'function-sign-chart',label:'Bảng xét dấu đa thức',hint:'Mốc nghiệm và dấu các khoảng',category:'templates'},
 {id:'pyramid',label:'Hình chóp tứ giác',hint:'Khối đa diện',category:'polyhedra',solid:'pyramid'},
 {id:'regular-pyramid',label:'Hình chóp đều',hint:'Đáy đều, đỉnh trên tâm',category:'polyhedra',solid:'pyramid'},
 {id:'cuboid',label:'Hình hộp chữ nhật',hint:'Ba kích thước khác nhau',category:'polyhedra',solid:'cuboid'},
 {id:'triangular-prism',label:'Lăng trụ tam giác',hint:'Hai đáy tam giác song song',category:'polyhedra',solid:'prism'},
 {id:'oblique-prism',label:'Lăng trụ xiên',hint:'Cạnh bên nghiêng',category:'polyhedra',solid:'oblique-prism'},
 {id:'octahedron',label:'Bát diện đều',hint:'Tám mặt tam giác',category:'polyhedra',solid:'octahedron'},
 {id:'frustum',label:'Hình chóp cụt',hint:'Hai đáy song song',category:'polyhedra',solid:'frustum'},
 {id:'wedge',label:'Hình nêm — kiểu 1',hint:'Khối nêm có mặt nghiêng',category:'polyhedra'},
 {id:'wedge2',label:'Hình nêm — kiểu 2',hint:'Biến thể mặt cắt nghiêng',category:'polyhedra'},
 {id:'plane',label:'Mặt phẳng',hint:'Mặt phẳng minh họa',category:'polyhedra'},
 {id:'cone',label:'Hình nón',hint:'Khối tròn xoay',category:'revolution',solid:'cone'},
 {id:'cylinder',label:'Hình trụ',hint:'Khối tròn xoay',category:'revolution',solid:'cylinder'},
 {id:'sphere',label:'Mặt cầu',hint:'Đường kinh tuyến minh họa',category:'revolution'},
 {id:'cone-frustum',label:'Hình nón cụt',hint:'Hai đáy tròn khác bán kính',category:'revolution'},
 {id:'cylinder-frustum',label:'Hình trụ cụt',hint:'Mặt cắt xiên',category:'revolution'},
 {id:'spherical-cap',label:'Chỏm cầu',hint:'Một phần mặt cầu',category:'revolution'},
 {id:'cube',label:'Hình lập phương',hint:'Kéo xoay mô hình 3D',category:'rotatable',solid:'cube'},
 {id:'rotatable-cuboid',label:'Hình hộp chữ nhật',hint:'Kéo xoay mô hình 3D',category:'rotatable',solid:'cuboid'},
 {id:'rotatable-pyramid',label:'Hình chóp tứ giác đều',hint:'Kéo xoay mô hình 3D',category:'rotatable',solid:'pyramid'},
 {id:'rotatable-tetra',label:'Hình chóp tam giác',hint:'Kéo xoay mô hình 3D',category:'rotatable',solid:'tetra'},
 {id:'rotatable-prism',label:'Lăng trụ tam giác đều',hint:'Kéo xoay mô hình 3D',category:'rotatable',solid:'prism'},
 {id:'hex-prism',label:'Lăng trụ lục giác đều',hint:'Kéo xoay mô hình 3D',category:'rotatable',solid:'hex-prism'},
 {id:'rotatable-octahedron',label:'Bát diện đều',hint:'Kéo xoay mô hình 3D',category:'rotatable',solid:'octahedron'},
 {id:'rotatable-frustum',label:'Hình chóp cụt đều',hint:'Kéo xoay mô hình 3D',category:'rotatable',solid:'frustum'},
 {id:'rotatable-cone',label:'Hình nón',hint:'Kéo xoay mô hình 3D',category:'rotatable',solid:'cone'},
 {id:'rotatable-cylinder',label:'Hình trụ',hint:'Kéo xoay mô hình 3D',category:'rotatable',solid:'cylinder'},
 {id:'rotatable-sphere',label:'Mặt cầu',hint:'Mô hình mặt cầu với kinh tuyến',category:'rotatable',solid:'sphere'},
 {id:'number-line',label:'Trục số',hint:'Mốc 0 và vạch chia',category:'templates'},
 {id:'coordinate',label:'Hệ trục tọa độ',hint:'Trục Ox, Oy có lưới',category:'templates'},
 {id:'table',label:'Bảng trống',hint:'Bảng 4 × 4',category:'templates'},
 {id:'sign-chart',label:'Bảng xét dấu',hint:'Bảng dấu +, − và mốc',category:'templates'},
 {id:'solution-frame',label:'Khung bài giải',hint:'Khung gọn để trình bày lời giải',category:'templates'},
 {id:'theorem',label:'Khung định lý',hint:'Khung phát biểu và kết luận',category:'templates'},
];
const categories:{id:Category;label:string;icon:typeof Circle;description:string}[]=[
 {id:'flat',label:'Hình phẳng',icon:Circle,description:'Các hình cơ bản để dựng hình học phẳng'},
 {id:'polyhedra',label:'Khối đa diện',icon:Box,description:'Các khối có mặt phẳng, cạnh và đỉnh'},
 {id:'revolution',label:'Khối tròn xoay',icon:Rotate3D,description:'Nón, trụ, cầu và các dạng cụt'},
 {id:'rotatable',label:'Hình 3D xoay được',icon:Axis3D,description:'Mở mô hình 3D để xoay trước khi chèn'},
 {id:'templates',label:'Mẫu toán',icon:Table2,description:'Các khung và mẫu thường dùng khi giảng dạy'},
];
const safeColor=(c:string)=>/^#[0-9a-f]{6}$/i.test(c)?c:'#FF0000';
const choose=(n:number,r:number)=>{let v=1;for(let i=1;i<=r;i++)v=v*(n-i+1)/i;return Math.round(v)};
function buildSvg(id:string,colorRaw:string,width:number){
 const color=safeColor(colorRaw),stroke=Math.max(1.7,Math.min(width*1.15,5)),common=`fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"`;
 let body='';
 switch(id){
  case'triangle':body='<path d="M300 55 L520 350 L90 350 Z"/>';break;
  case'right-triangle':body='<path d="M100 350 L100 65 L520 350 Z"/><path d="M100 315 L135 315 L135 350"/>';break;
  case'isosceles':body='<path d="M300 55 L520 350 L80 350 Z"/><path d="M185 205 l24 15 M390 220 l24 -15" stroke-dasharray="5 5"/>';break;
  case'altitude':body='<path d="M300 55 L520 350 L80 350 Z"/><path d="M300 55 L300 350" stroke-dasharray="8 6"/><path d="M300 330 h20 v20"/>';break;
  case'regular-hexagon':body=`<polygon points="${Array.from({length:6},(_,i)=>`${300+195*Math.cos(-Math.PI/2+i*Math.PI/3)},${225+180*Math.sin(-Math.PI/2+i*Math.PI/3)}`).join(' ')}"/>`;break;
  case'rectangle':body='<rect x="90" y="85" width="420" height="280" rx="1"/>';break;
  case'parallelogram':body='<path d="M170 85 H535 L430 365 H65 Z"/>';break;
  case'trapezoid':body='<path d="M190 85 H430 L535 365 H85 Z"/>';break;
  case'circle':body='<circle cx="300" cy="225" r="150"/>';break;
  case'disk':body=`<circle cx="300" cy="225" r="150" fill="${color}" fill-opacity=".15"/><circle cx="300" cy="225" r="150"/>`;break;
  case'ellipse':body='<ellipse cx="300" cy="225" rx="205" ry="125"/>';break;
  case'hyperbola':body='<path d="M300 60 C280 130 280 320 300 390 M300 60 C320 130 320 320 300 390" opacity="0"/><path d="M280 50 C180 135 180 315 280 400 M320 50 C420 135 420 315 320 400" opacity="0"/><path d="M300 220 C270 180 230 135 100 75 M300 220 C330 180 370 135 500 75 M300 220 C270 260 230 305 100 365 M300 220 C330 260 370 305 500 365" opacity="0"/><path d="M300 40 C230 100 205 145 195 225 C205 305 230 350 300 410 M300 40 C370 100 395 145 405 225 C395 305 370 350 300 410" opacity="0"/><path d="M45 225 H555 M300 35 V415" stroke-dasharray="4 7" opacity=".45"/><path d="M300 225 C260 225 210 195 155 95 M300 225 C340 225 390 195 445 95 M300 225 C260 225 210 255 155 355 M300 225 C340 225 390 255 445 355" opacity="0"/><path d="M130 55 C220 120 220 330 130 395 M470 55 C380 120 380 330 470 395"/>';break;
  case'parabola':body='<path d="M55 350 H555 M300 35 V405" stroke-dasharray="4 7" opacity=".45"/><path d="M120 55 Q300 505 480 55"/>';break;
  case'annulus':body='<circle cx="300" cy="225" r="155"/><circle cx="300" cy="225" r="82"/>';break;
  case'square':body='<rect x="145" y="70" width="300" height="300"/><path d="M145 90 H165 V70"/>';break;
  case'regular-pentagon':body=`<polygon points="${Array.from({length:5},(_,i)=>`${300+160*Math.cos(-Math.PI/2+i*2*Math.PI/5)},${225+160*Math.sin(-Math.PI/2+i*2*Math.PI/5)}`).join(' ')}"/>`;break;
  case'regular-octagon':body=`<polygon points="${Array.from({length:8},(_,i)=>`${300+155*Math.cos(-Math.PI/8+i*Math.PI/4)},${225+155*Math.sin(-Math.PI/8+i*Math.PI/4)}`).join(' ')}"/>`;break;
  case'diameter-circle':body='<circle cx="300" cy="225" r="140"/><path d="M160 225 H440"/><circle cx="300" cy="225" r="4" fill="currentColor"/><text x="292" y="246" font-size="20" stroke="none" fill="currentColor">O</text><text x="285" y="209" font-size="20" stroke="none" fill="currentColor">d</text>';break;
  case'tangent-circle':body='<circle cx="280" cy="230" r="125"/><path d="M405 45 V410 M280 230 L405 230"/><path d="M389 230 V246 H405" stroke-dasharray="4 4"/><circle cx="405" cy="230" r="5" fill="currentColor"/>';break;
  case'secant-circle':body='<circle cx="300" cy="225" r="135"/><path d="M60 135 L540 315"/><circle cx="190" cy="184" r="5" fill="currentColor"/><circle cx="410" cy="266" r="5" fill="currentColor"/>';break;
  case'triangle-median':body='<path d="M300 55 L520 355 L80 355 Z M300 55 L300 355 M520 355 L190 205 M80 355 L410 205"/><path d="M270 355 H330" stroke-dasharray="4 4"/>';break;
  case'angle-bisectors':body='<path d="M300 55 L520 355 L80 355 Z M300 55 L300 355 M520 355 L185 207 M80 355 L411 207" stroke-dasharray="7 5"/>';break;
  case'perpendicular-bisectors':body='<path d="M300 55 L520 355 L80 355 Z M190 205 L410 205 M300 355 L300 55 M190 205 L410 205" stroke-dasharray="7 5"/>';break;
  case'cube-net':body='<path d="M220 55 H340 V175 H460 V295 H340 V415 H220 V295 H100 V175 H220 Z M220 175 H340 V295 H220 Z"/>';break;
  case'inequality-chart':body='<path d="M60 350 H550 M300 400 V35" stroke-dasharray="5 6" opacity=".55"/><path d="M150 350 L480 70 L480 350 Z" fill="currentColor" fill-opacity=".12"/><path d="M150 350 L480 70" stroke-dasharray="8 6"/>';break;
  case'variation-table':body='<rect x="80" y="75" width="440" height="290"/><path d="M80 145 H520 M80 235 H520 M160 75 V365"/><text x="104" y="120" font-size="23" stroke="none" fill="currentColor">x</text><text x="104" y="200" font-size="23" stroke="none" fill="currentColor">f′</text><text x="104" y="300" font-size="23" stroke="none" fill="currentColor">f</text><path d="M200 315 L300 265 L400 315" stroke-width="3"/>';break;
  case'venn-diagram':body='<circle cx="235" cy="220" r="120" fill="currentColor" fill-opacity=".10"/><circle cx="365" cy="220" r="120" fill="currentColor" fill-opacity=".08"/><text x="180" y="115" font-size="25" fill="currentColor" stroke="none">A</text><text x="415" y="115" font-size="25" fill="currentColor" stroke="none">B</text>';break;
  case'coordinate-3d':body='<path d="M270 350 L270 45 M270 350 L535 350 M270 350 L100 420"/><path d="M270 45 L258 63 M270 45 L282 63 M535 350 L515 339 M535 350 L515 361 M100 420 L122 415 M100 420 L113 401"/><text x="280" y="50" font-size="20" fill="currentColor" stroke="none">z</text><text x="535" y="335" font-size="20" fill="currentColor" stroke="none">x</text><text x="80" y="415" font-size="20" fill="currentColor" stroke="none">y</text>';break;
  case'pascal-triangle':body=Array.from({length:5},(_,r)=>Array.from({length:r+1},(_,c)=>`<text x="${300+(c-r/2)*45}" y="${70+r*65}" font-size="22" stroke="none" fill="currentColor">${choose(r,c)}</text>`).join('')).join('');break;
  case'function-sign-chart':body='<rect x="70" y="100" width="470" height="235"/><path d="M70 175 H540 M70 255 H540 M170 100 V335 M300 100 V335 M430 100 V335"/><text x="94" y="145" font-size="22" stroke="none" fill="currentColor">x</text><text x="94" y="220" font-size="22" stroke="none" fill="currentColor">f(x)</text><text x="170" y="220" font-size="20" stroke="none" fill="currentColor">+</text><text x="300" y="220" font-size="20" stroke="none" fill="currentColor">−</text><text x="430" y="220" font-size="20" stroke="none" fill="currentColor">+</text>';break;
  case'plane':body=`<polygon points="115,275 245,90 510,150 380,335" fill="${color}" fill-opacity=".11"/>`;break;
  case'wedge':body='<path d="M100 330 L100 160 L500 85 L500 330 Z M100 160 L200 210 L500 85 M200 210 L200 330 M200 330 L500 330"/>';break;
  case'wedge2':body='<path d="M80 340 L150 120 L500 120 L430 340 Z M80 340 L215 260 L500 120 M215 260 V340 M215 340 L430 340"/>';break;
  case'sphere':body='<circle cx="300" cy="225" r="145"/><ellipse cx="300" cy="225" rx="145" ry="48"/><path d="M300 80 C220 120 220 330 300 370 M300 80 C380 120 380 330 300 370"/>';break;
  case'cone-frustum':body='<path d="M150 145 L220 315 M450 145 L380 315"/><ellipse cx="300" cy="145" rx="150" ry="45"/><path d="M150 145 A150 45 0 0 0 450 145" stroke-dasharray="7 6"/><ellipse cx="300" cy="315" rx="80" ry="28"/>';break;
  case'cylinder-frustum':body='<path d="M140 125 L220 330 M460 125 L380 330"/><ellipse cx="300" cy="125" rx="160" ry="42"/><ellipse cx="300" cy="330" rx="80" ry="26"/>';break;
  case'spherical-cap':body='<path d="M120 260 Q300 65 480 260"/><ellipse cx="300" cy="260" rx="180" ry="48"/><path d="M120 260 Q300 375 480 260" stroke-dasharray="7 6"/>';break;
  case'number-line':body='<path d="M65 230 H535 M520 216 L535 230 L520 244"/><path d="M110 216 V244 M185 216 V244 M260 216 V244 M335 216 V244 M410 216 V244 M485 216 V244"/><text x="100" y="275" font-size="24" fill="currentColor" stroke="none">−2</text><text x="175" y="275" font-size="24" fill="currentColor" stroke="none">−1</text><text x="253" y="275" font-size="24" fill="currentColor" stroke="none">0</text><text x="328" y="275" font-size="24" fill="currentColor" stroke="none">1</text><text x="403" y="275" font-size="24" fill="currentColor" stroke="none">2</text>';break;
  case'coordinate':body=Array.from({length:9},(_,i)=>`<path d="M${80+i*55} 55 V395" stroke-opacity=".2"/>`).join('')+Array.from({length:7},(_,i)=>`<path d="M65 ${65+i*52} H535" stroke-opacity=".2"/>`).join('')+'<path d="M50 225 H555 M540 210 L555 225 L540 240 M300 405 V40 M285 55 L300 40 L315 55"/><text x="520" y="211" font-size="19" fill="currentColor" stroke="none">x</text><text x="311" y="58" font-size="19" fill="currentColor" stroke="none">y</text><text x="307" y="246" font-size="16" fill="currentColor" stroke="none">O</text>';break;
  case'table':body='<rect x="60" y="75" width="480" height="300"/><path d="M60 150 H540 M60 225 H540 M60 300 H540 M180 75 V375 M300 75 V375 M420 75 V375"/>';break;
  case'sign-chart':body='<rect x="55" y="78" width="490" height="285"/><path d="M55 150 H545 M55 242 H545 M175 78 V363 M300 78 V363 M425 78 V363"/><text x="92" y="125" font-size="21" fill="currentColor" stroke="none">x</text><text x="92" y="201" font-size="21" fill="currentColor" stroke="none">f(x)</text><text x="92" y="296" font-size="21" fill="currentColor" stroke="none">Dấu</text><text x="230" y="205" font-size="26" fill="currentColor" stroke="none">+</text><text x="350" y="205" font-size="26" fill="currentColor" stroke="none">−</text>';break;
  case'solution-frame':body='<rect x="55" y="55" width="490" height="310" rx="12"/><path d="M55 125 H545"/><text x="78" y="102" font-size="25" fill="currentColor" stroke="none">Bài giải</text>';break;
  case'theorem':body='<rect x="55" y="75" width="490" height="270" rx="18"/><rect x="90" y="48" width="180" height="54" rx="12" fill="#ffffff" stroke="currentColor"/><text x="115" y="82" font-size="22" fill="currentColor" stroke="none">Định lý</text><path d="M88 150 H510 M88 210 H510 M88 270 H430" opacity=".25"/>';break;
  default:body='<path d="M100 350 L300 70 L500 350 Z"/>';
 }
 const content=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="440" viewBox="0 0 600 440"><g ${common}>${body}</g></svg>`;
 return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`;
}
const categoryById=(id:Category)=>categories.find(c=>c.id===id)!;
export default function GeometryLibraryPanel({onClose,onInsert,onOpen3D,inkColor,inkWidth}:Props){
 const [active,setActive]=useState<Category>('flat');const [query,setQuery]=useState('');
 const visible=useMemo(()=>entries.filter(e=>e.category===active&&(!query||`${e.label} ${e.hint}`.toLowerCase().includes(query.toLowerCase()))),[active,query]);
 const choose=(entry:Entry)=>{if(entry.solid){onClose();onOpen3D(entry.solid);return}onInsert(buildSvg(entry.id,inkColor,inkWidth),entry.label,600/440);onClose()};
 const ActiveIcon=categoryById(active).icon;
 return <div className="geolib-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="geolib-panel" role="dialog" aria-modal="true" aria-label="Thư viện hình học"><header className="geolib-head"><div className="geolib-mark"><Shapes size={22}/></div><div className="geolib-title"><h2>Thư viện hình học</h2><p>Chọn mẫu để chèn nhanh hoặc mở mô hình 3D có thể xoay</p></div><span className="geolib-ink"><i style={{background:safeColor(inkColor),height:Math.max(2,Math.min(8,inkWidth))}}/>Theo nét bút hiện tại</span><button className="geolib-close" onClick={onClose} title="Đóng"><X size={19}/></button></header>
 <div className="geolib-body"><nav className="geolib-categories">{categories.map(c=>{const Icon=c.icon;return <button key={c.id} type="button" className={active===c.id?'active':''} onClick={()=>setActive(c.id)}><Icon size={17}/><span>{c.label}</span><small>{entries.filter(e=>e.category===c.id).length}</small></button>})}</nav><div className="geolib-content"><div className="geolib-section-head"><div><h3><ActiveIcon size={18}/>{categoryById(active).label}</h3><p>{categoryById(active).description}</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm hình…" aria-label="Tìm hình trong thư viện"/></div><div className="geolib-grid">{visible.map(entry=><button key={entry.id} className="geolib-card" type="button" onClick={()=>choose(entry)}><div className="geolib-preview">{entry.solid?<ShapePreview solid={entry.solid} color={inkColor}/>:<StaticPreview id={entry.id} color={inkColor}/>}</div><span className="geolib-card-title">{entry.label}</span><span className="geolib-card-hint">{entry.hint}</span><span className="geolib-action">{entry.solid?<><Rotate3D size={13}/> Mở 3D</>:<><Plus size={13}/> Chèn vào trang</>}</span></button>)}</div><div className="geolib-note"><Layers size={15}/><span>Hình phẳng và mẫu toán được chèn dưới dạng SVG sắc nét; mô hình 3D mở trình dựng để xoay, đổi mặt và bật/tắt nhãn trước khi chèn.</span></div></div></div>
 <footer className="geolib-footer"><span><Ruler size={15}/> Mẫu dùng màu và độ dày theo bút hiện hành</span><button onClick={onClose}>Đóng</button></footer></section></div>
}
function StaticPreview({id,color}:{id:string;color:string}){const data=useMemo(()=>buildSvg(id,color,2.4),[id,color]);return <img src={data} alt="" draggable={false}/>}
function ShapePreview({solid,color}:{solid:GeometrySolid;color:string}){const preview:Record<string,string>={cube:'<path d="M55 70 L135 45 L205 85 L125 112 Z M55 70 V160 L125 200 L125 112 M125 200 L205 170 V85 M55 160 L135 135 L205 170 M135 135 V45"/>',cuboid:'<path d="M50 83 L130 50 L208 83 L128 119 Z M50 83 V158 L128 198 L208 158 V83 M128 198 V119"/>',pyramid:'<path d="M45 155 L120 115 L205 150 L130 190 Z M45 155 L125 45 L120 115 M125 45 L205 150 M125 45 L130 190"/>',tetra:'<path d="M70 160 L185 170 L140 60 Z M70 160 L105 115 L185 170 M105 115 L140 60"/>',prism:'<path d="M45 145 L75 65 L120 145 Z M125 180 L155 100 L200 180 Z M45 145 L125 180 M75 65 L155 100 M120 145 L200 180"/>', 'hex-prism':'<path d="M45 90 L80 65 L120 80 L120 120 L80 140 L45 120 Z M125 120 L160 95 L200 110 L200 150 L160 170 L125 150 Z M45 90 L125 120 M80 65 L160 95 M120 80 L200 110 M120 120 L200 150 M80 140 L160 170 M45 120 L125 150"/>', 'oblique-prism':'<path d="M45 150 L75 70 L120 150 Z M125 180 L165 105 L210 180 Z M45 150 L125 180 M75 70 L165 105 M120 150 L210 180"/>',octahedron:'<path d="M125 40 L190 100 L125 160 L60 100 Z M125 40 L125 220 L60 100 M125 220 L190 100 M125 40 L125 160"/>',frustum:'<path d="M70 95 L155 70 L205 95 L120 120 Z M70 95 L90 185 L140 210 L120 120 M90 185 L175 155 L205 95 M175 155 L140 210"/>',cone:'<path d="M125 40 L60 180 M125 40 L190 180 M60 180 A65 22 0 0 0 190 180 M60 180 A65 22 0 0 1 190 180"/>',sphere:'<circle cx="125" cy="120" r="78"/><ellipse cx="125" cy="120" rx="78" ry="26"/><path d="M125 42 C82 70 82 170 125 198 M125 42 C168 70 168 170 125 198"/>',cylinder:'<path d="M55 75 A70 24 0 0 1 195 75 A70 24 0 0 1 55 75 M55 75 V175 M195 75 V175 M55 175 A70 24 0 0 0 195 175 M55 175 A70 24 0 0 1 195 175"/>'};
 return <svg viewBox="0 0 250 240" role="img" aria-label={solid} xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke={safeColor(color)} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="none" dangerouslySetInnerHTML={{__html:preview[solid]||preview.cube}}/></svg>}
