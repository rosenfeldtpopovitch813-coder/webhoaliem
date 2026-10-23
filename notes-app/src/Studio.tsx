import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {PenLine,Eraser,MousePointer2,Shapes,Type,Sigma,Hand,Undo2,Redo2,Plus,ChevronLeft,ChevronRight,ZoomIn,ZoomOut,Maximize,Upload,Download,Moon,Sun,SlidersHorizontal,Crosshair,Calculator,CircleHelp,Save,Trash2,Copy,Check,X,Highlighter,RotateCcw,House,PanelLeftClose,PanelLeftOpen,LineChart,Box,Ruler,Grid2X2} from 'lucide-react';
import katex from 'katex';
import {ActiveTool,BoardSettings} from './components/Whiteboard/Whiteboard';
import ContinuousPages from './components/Whiteboard/ContinuousPages';
import ToolPopup,{PopupTool} from './components/Toolbar/ToolPopup';
import PageThumbnail from './components/Whiteboard/PageThumbnail';
import {BoardDocument,BoardPage,BoardItem,GeometryObjectConfig,createPage,W,H} from './types/board';
import {exportPages} from './utils/export';
import {pdfToPages} from './utils/pdfImport';
import {docImageWeight} from './utils/docWeight';
import {formatFormula} from './utils/chemistry';
import {rotateItem,translateItem,flipItems} from './utils/render';
import {registerBoardTools} from './services/webMcp';
import GraphPanel from './components/Graphing/GraphPanel';
import Geometry3DPanel, { type GeometrySolid } from './components/Geometry3D/Geometry3DPanel';
import GeometryLibraryPanel from './components/GeometryLibraryPanel';
import ScientificCalculator from './components/Calculator/ScientificCalculator';
import GeometryTools from './components/GeometryTools/GeometryTools';
import MathHub from './components/MathHub';
import './styles.css';
import './studio.css';
import './scrble.css';
const toolOptions:{id:ActiveTool;label:string;key:string;icon:typeof PenLine}[]=[{id:'pen',label:'Bút viết',key:'P',icon:PenLine},{id:'eraser',label:'Tẩy',key:'E',icon:Eraser},{id:'select',label:'Chọn',key:'V',icon:MousePointer2},{id:'shape',label:'Hình học',key:'R',icon:Shapes},{id:'text',label:'Văn bản',key:'T',icon:Type},{id:'math',label:'Công thức',key:'M',icon:Sigma},{id:'pan',label:'Di chuyển',key:'Space',icon:Hand},{id:'laser',label:'Bút laser',key:'Q',icon:Crosshair}];
const DEFAULT_INK_SWATCHES=['#FFE600','#FF0000','#00D943','#005BFF'];
const LEGACY_DEFAULT_INK_SWATCHES=['#FFEB3B','#F44336','#4CAF50','#304FFE'];
const PREVIOUS_VIVID_INK_SWATCHES=['#FFE600','#FF1E2D','#08B848','#145DFF'];
const DEFAULT_HIGHLIGHT_SWATCHES=['#00E5FF','#FFEB3B'];
type PaletteKind='ink'|'highlight';
type PaletteTarget={kind:PaletteKind;index:number};
const DEFAULT_BOARD_SETTINGS:BoardSettings={color:'#171717',width:4,opacity:1,style:'ballpoint',shape:'rectangle',eraser:'stroke',eraserSize:18,fill:'transparent',dash:'solid',ignorePressure:false,allowFinger:true,recognize:false,textSize:24,laserStyle:'ring',laserColor:'#e84043',laserSize:18,highlightColor:'#FFEB3B'};
function loadBoardSettings():BoardSettings{
 try{const raw=localStorage.getItem('muc-board-settings');const parsed=raw?JSON.parse(raw):{};const saved=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed as Partial<BoardSettings>:{};return {...DEFAULT_BOARD_SETTINGS,...saved,highlightColor:saved.highlightColor||DEFAULT_BOARD_SETTINGS.highlightColor}}
 catch{return {...DEFAULT_BOARD_SETTINGS}}
}
function loadSwatches(key:string,defaults:string[],legacyDefaults?:string[]):string[]{
 try{
  const value=JSON.parse(localStorage.getItem(key)||'null');
  if(Array.isArray(value)&&value.length===defaults.length&&value.every((c)=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c))){
   const matches=(palette:string[])=>value.every((c,i)=>String(c).toLowerCase()===palette[i]?.toLowerCase());
   // Migrate known built-in palettes to the saturated reference palette, while preserving
   // genuinely customized user palettes.
   if(legacyDefaults&&matches(legacyDefaults))return [...defaults];
   if(key==='muc-ink-swatches'&&matches(PREVIOUS_VIVID_INK_SWATCHES))return [...defaults];
   return value;
  }
  return [...defaults];
 }catch{return [...defaults]}
}
const fitZoom=(showThumbnails=true)=>Math.max(.3,Math.min(1,(window.innerWidth-(window.innerWidth>760?(showThumbnails?250:20):20))/W)*.92);
type Modal='text'|'math'|'shortcuts'|'export'|'mini'|null;
function clone<T>(v:T):T{return structuredClone(v)}
function saveErrorText(e:unknown){const name=e instanceof Error?e.name+': '+e.message:String(e);console.error('Lỗi lưu',e);return /quota|full|dung lượng/i.test(name)?'Không lưu được: đầy bộ nhớ thiết bị':'Không lưu được ('+name.slice(0,80)+')'}
function readFile(file:File):Promise<string>{return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)})}
function clipboardImageFingerprint(dataUrl:string|null):string|null{return dataUrl?`${dataUrl.length}:${dataUrl.slice(0,96)}:${dataUrl.slice(-96)}`:null}
type StudioProps={projectId:string;initialDoc:BoardDocument;onSave:(id:string,document:BoardDocument)=>Promise<void>;onHome:()=>void};
export default function Studio({projectId,initialDoc,onSave,onHome}:StudioProps){
 const [doc,setDoc]=useState<BoardDocument>(initialDoc);const [saveState,setSaveState]=useState('Đã lưu trên thiết bị');const [showPages,setShowPages]=useState(()=>localStorage.getItem('muc-show-pages')!=='false');const past=useRef<BoardDocument[]>([]),future=useRef<BoardDocument[]>([]),docRef=useRef(doc);docRef.current=doc;
 const saveFnRef=useRef(onSave);saveFnRef.current=onSave;const projectIdRef=useRef(projectId);projectIdRef.current=projectId;const saveTimer=useRef<number|null>(null);const flushSaveRef=useRef<()=>void>(()=>{});
 const saveSeq=useRef(0),dirtyRef=useRef(false),touched=useRef(false),initialRef=useRef(initialDoc);const [saveKind,setSaveKind]=useState<'saved'|'dirty'|'saving'|'error'>('saved');
 const writeEmergency=()=>{
  const key=`muc-emergency-project:${projectIdRef.current}`;
  try{
   // Keep a synchronous recovery journal alongside IndexedDB. This protects edits
   // made immediately before refresh/closing the tab, while staying within storage limits.
   if(docImageWeight(docRef.current)>1.5*1024*1024){localStorage.removeItem(key);return}
   const snapshot=JSON.stringify({savedAt:Date.now(),document:docRef.current});
   const bytes=typeof Blob!=='undefined'?new Blob([snapshot]).size:snapshot.length*2;
   if(bytes>2.5*1024*1024){localStorage.removeItem(key);return}
   try{localStorage.setItem(key,snapshot)}catch{
    // Free the previous journal before one retry; never let a stale snapshot win after reload.
    try{localStorage.removeItem(key);localStorage.setItem(key,snapshot)}catch{/* IndexedDB remains the primary store. */}
   }
  }catch{/* IndexedDB remains the primary store. */}
 };
 // Một lần lưu: chỉ báo "Đã lưu" khi kho đã xác nhận VÀ bài không bị sửa tiếp trong lúc lưu.
 const persist=():Promise<boolean>=>{const seq=++saveSeq.current,snap=docRef.current;setSaveKind('saving');setSaveState('Đang lưu…');return saveFnRef.current(projectIdRef.current,snap).then(()=>{if(seq===saveSeq.current&&docRef.current===snap){dirtyRef.current=false;setSaveKind('saved');setSaveState('Đã lưu lúc '+new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))}return true}).catch(e=>{if(seq===saveSeq.current){setSaveKind('error');setSaveState(saveErrorText(e))}return false})};
 const clearSaveTimer=()=>{if(saveTimer.current!==null){window.clearTimeout(saveTimer.current);saveTimer.current=null}};
 const saveLatest=async()=>{
  clearSaveTimer();
  // If the board changes while IndexedDB is writing, immediately write the newer snapshot too.
  // The Save button only reports success after the latest visible document is confirmed.
  for(let attempt=0;attempt<3;attempt++){
   writeEmergency();const snapshot=docRef.current;const ok=await persist();
   if(!ok)return false;
   if(docRef.current===snapshot&&!dirtyRef.current)return true;
   clearSaveTimer();
  }
  return false;
 };
 const saveNow=async()=>{const ok=await saveLatest();setMessage(ok?'Đã lưu bài vào thiết bị':'Chưa xác nhận được bản lưu mới nhất. Hãy thử lại hoặc xuất bài để giữ bản sao')};
 flushSaveRef.current=()=>{clearSaveTimer();if(!touched.current)return;writeEmergency();void persist()};
 const [tool,setTool]=useState<ActiveTool>(()=>{try{const saved=JSON.parse(localStorage.getItem('muc-board-settings')||'{}');return typeof saved.style==='string'&&saved.style.startsWith('highlighter')?'highlighter':'pen'}catch{return 'pen'}}),[theme,setTheme]=useState<'dark'|'light'>('light'),[popover,setPopover]=useState<PopupTool|null>(null),[popoverLeft,setPopoverLeft]=useState(12),[settings,setSettings]=useState<BoardSettings>(loadBoardSettings()),[zoom,setZoom]=useState(fitZoom),[selected,setSelected]=useState<string|null>(null),[selectedIds,setSelectedIds]=useState<string[]>([]),[modal,setModal]=useState<Modal>(null),[draftText,setDraftText]=useState(''),[insertAt,setInsertAt]=useState({x:140,y:150}),[format,setFormat]=useState<'png'|'jpg'|'pdf'|'svg'>('png'),[allPages,setAllPages]=useState(false),[message,setMessage]=useState(''),[mini,setMini]=useState<'calculator'|'timer'|'dice'|'notes'>('calculator'),[seconds,setSeconds]=useState(300),[running,setRunning]=useState(false),[dice,setDice]=useState(1),[notes,setNotes]=useState(localStorage.getItem('muc-notes')||'');
 const [mathHubOpen,setMathHubOpen]=useState(false);const input=useRef<HTMLInputElement>(null),editInput=useRef<HTMLInputElement>(null),paletteColorInput=useRef<HTMLInputElement>(null),paletteEditTarget=useRef<PaletteTarget|null>(null),lastPaletteClick=useRef<PaletteTarget|null>(null);const boardAreaRef=useRef<HTMLDivElement>(null);const [graphOpen,setGraphOpen]=useState(false),[geometryOpen,setGeometryOpen]=useState(false),[geometryLibraryOpen,setGeometryLibraryOpen]=useState(false),[geometryInitialSolid,setGeometryInitialSolid]=useState<GeometrySolid>('cube'),[geometryInitialConfig,setGeometryInitialConfig]=useState<GeometryObjectConfig|undefined>(undefined),[geometryEditTargetId,setGeometryEditTargetId]=useState<string|null>(null),[geometryKitOpen,setGeometryKitOpen]=useState(false);
 const [inkSwatches,setInkSwatches]=useState<string[]>(()=>loadSwatches('muc-ink-swatches',DEFAULT_INK_SWATCHES,LEGACY_DEFAULT_INK_SWATCHES));
 const [highlightSwatches,setHighlightSwatches]=useState<string[]>(()=>loadSwatches('muc-highlight-swatches',DEFAULT_HIGHLIGHT_SWATCHES));
 const zoomRef=useRef(1),zoomAnchor=useRef<{cx:number;cy:number;px:number;py:number}|null>(null);
 const clipboard=useRef<BoardItem[]>([]);const pendingInternalPaste=useRef(false);const internalCopyImageFingerprint=useRef<string|null>(null);const lastPastePosition=useRef<{pageId:string;x:number;y:number}|null>(null);const draggedPage=useRef<string|null>(null);
 const page=doc.pages.find(p=>p.id===doc.activeId)||doc.pages[0];const pageIndex=doc.pages.findIndex(p=>p.id===page.id);
 const selectedItem=page.items.find(i=>i.id===selected);const selectionIds=selectedIds.length?selectedIds:(selected?[selected]:[]);const setSelection=(ids:string[])=>{const unique=[...new Set(ids)];setSelectedIds(unique);setSelected(unique[0]||null)};
 useEffect(()=>{try{localStorage.setItem('muc-board-settings',JSON.stringify(settings))}catch{}},[settings]);
 useEffect(()=>{if(settings.style&&!settings.style.startsWith('highlighter')){try{localStorage.setItem('muc-last-ink-style',settings.style)}catch{}}},[settings.style]);
 useEffect(()=>{try{localStorage.setItem('muc-ink-swatches',JSON.stringify(inkSwatches))}catch{}},[inkSwatches]);
 useEffect(()=>{try{localStorage.setItem('muc-highlight-swatches',JSON.stringify(highlightSwatches))}catch{}},[highlightSwatches]);
 zoomRef.current=zoom;
 // Giữ điểm giấy dưới con trỏ đứng yên khi zoom (không dịch/xoay giấy, chỉ cuộn).
 useLayoutEffect(()=>{
  const a=zoomAnchor.current;zoomAnchor.current=null;
  const area=boardAreaRef.current;const stack=area?.querySelector<HTMLElement>('.continuous-stack');
  if(!a||!area||!stack)return;
  const rect=stack.getBoundingClientRect();
  area.scrollLeft+=rect.left+a.px*zoom-a.cx;
  area.scrollTop+=rect.top+a.py*zoom-a.cy;
 },[zoom]);
 // Chế độ toàn trang: giấy luôn vừa khít chiều ngang cửa sổ, chính diện, không lề thừa.
 useLayoutEffect(()=>{
  if(showPages)return;
  const area=boardAreaRef.current;if(!area)return;
  const fit=()=>{const w=area.clientWidth;if(w>0)setZoom(Math.max(.25,Math.min(8,w/W)))};
  fit();const ro=new ResizeObserver(fit);ro.observe(area);return()=>ro.disconnect();
 },[showPages]);
 useEffect(()=>{
  if(doc===initialRef.current&&!touched.current)return;
  touched.current=true;dirtyRef.current=true;setSaveKind('dirty');setSaveState('Chưa lưu…');
  // Synchronous fallback is written as soon as React commits an edit, not only
  // when the debounce finishes. F5 during the debounce can then recover the latest edit.
  writeEmergency();
  clearSaveTimer();const weight=docImageWeight(docRef.current);
  saveTimer.current=window.setTimeout(()=>{saveTimer.current=null;void persist()},weight>8e6?1000:weight>2e6?500:220);
  return clearSaveTimer
 },[doc]);
 useEffect(()=>{const flush=()=>flushSaveRef.current();const visibility=()=>{if(document.visibilityState==='hidden')flush()};const beforeUnload=(e:BeforeUnloadEvent)=>{if(dirtyRef.current){flush();e.preventDefault();e.returnValue=''}};document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',flush);window.addEventListener('beforeunload',beforeUnload);return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',flush);window.removeEventListener('beforeunload',beforeUnload);flush()}},[]);
 useEffect(()=>{try{void navigator.storage?.persist?.().catch(()=>undefined)}catch{/* trình duyệt không hỗ trợ */}},[]);
 useEffect(()=>{localStorage.setItem('muc-show-pages',String(showPages))},[showPages]);
 useEffect(()=>{if(!running)return;const t=setInterval(()=>setSeconds(s=>{if(s<=1){setRunning(false);return 0}return s-1}),1000);return()=>clearInterval(t)},[running]);
 useEffect(()=>{if(!message)return;const t=setTimeout(()=>setMessage(''),3500);return()=>clearTimeout(t)},[message]);
 const apply=(next:BoardDocument)=>{past.current.push(docRef.current);if(past.current.length>100)past.current.shift();future.current=[];docRef.current=next;setDoc(next)};
 const updatePage=(change:(p:BoardPage)=>BoardPage)=>{const current=docRef.current;apply({...current,pages:current.pages.map(p=>p.id===page.id?change(p):p)})};
 const showPage=(id:string)=>{setDoc(d=>({...d,activeId:id}));setSelection([]);requestAnimationFrame(()=>document.getElementById('sheet-'+id)?.scrollIntoView({block:'start',behavior:'smooth'}))};
 const commitPage=(id:string,items:BoardItem[],overflow?:BoardItem|BoardItem[],_nearBottom=false)=>{
  const current=docRef.current,index=current.pages.findIndex(p=>p.id===id);if(index<0)return;
  const pages=current.pages.map(p=>p.id===id?{...p,items}:p);
  let activeId=id;
  const continuations=overflow?(Array.isArray(overflow)?overflow:[overflow]):[];
  // A page advances only after actual content crosses the page boundary.
  if(continuations.length){let next=pages[index+1];if(!next){next=createPage(pages.length+1);pages.push(next)}
   pages[index+1]={...next,items:[...next.items,...continuations]};
   activeId=next.id;setSelection([]);
   requestAnimationFrame(()=>requestAnimationFrame(()=>document.getElementById('sheet-'+activeId)?.scrollIntoView({block:'start',behavior:'smooth'})));
  }
  apply({...current,pages,activeId});
 };
 const moveSelectedToPage=(targetPageId:string)=>{
  const current=docRef.current,sourceId=current.activeId;
  if(!selectionIds.length||targetPageId===sourceId)return;
  const source=current.pages.find(p=>p.id===sourceId),target=current.pages.find(p=>p.id===targetPageId);
  if(!source||!target)return;
  const chosen=source.items.filter(item=>selectionIds.includes(item.id));if(!chosen.length)return;
  const moved=chosen.map(item=>({...clone(item),id:crypto.randomUUID()} as BoardItem));
  const chosenIds=new Set(chosen.map(item=>item.id));
  const pages=current.pages.map(p=>p.id===sourceId?{...p,items:p.items.filter(item=>!chosenIds.has(item.id))}:p.id===targetPageId?{...p,items:[...p.items,...moved]}:p);
  apply({...current,pages,activeId:targetPageId});setSelection(moved.map(item=>item.id));
  requestAnimationFrame(()=>document.getElementById('sheet-'+targetPageId)?.scrollIntoView({block:'start',behavior:'smooth'}));
  setMessage(`Đã chuyển ${moved.length} đối tượng sang ${target.name}`);
 };
 const editSelected=(patch:Record<string,unknown>)=>{if(!selectionIds.length)return;const ids=new Set(selectionIds);updatePage(p=>({...p,items:p.items.map(i=>ids.has(i.id)?{...i,...patch} as BoardItem:i)}))};
 const chooseColor=(color:string)=>{const remembered=localStorage.getItem('muc-last-ink-style');setTool('pen');setPopover(null);setSettings(s=>({...s,color,opacity:1,style:s.style.startsWith('highlighter')?(remembered&&!remembered.startsWith('highlighter')?remembered:'ballpoint'):s.style}))};
 const chooseHighlightColor=(color:string)=>{setTool('highlighter');setPopover(null);setSettings(s=>({...s,highlightColor:color,style:s.style==='highlighter-square'?'highlighter-square':'highlighter'}))};
 const openPaletteColor=(kind:PaletteKind,index:number,color:string)=>{lastPaletteClick.current=null;paletteEditTarget.current={kind,index};const picker=paletteColorInput.current;if(picker){picker.value=color;try{picker.click()}catch{}}};
 const handlePaletteSwatchClick=(kind:PaletteKind,index:number,color:string)=>{const last=lastPaletteClick.current;if(last?.kind===kind&&last.index===index){openPaletteColor(kind,index,color);return}lastPaletteClick.current={kind,index};if(kind==='ink')chooseColor(color);else chooseHighlightColor(color)};
 const replacePaletteColor=(kind:PaletteKind,index:number,color:string)=>{if(kind==='ink'){setInkSwatches(old=>old.map((c,i)=>i===index?color:c));chooseColor(color)}else{setHighlightSwatches(old=>old.map((c,i)=>i===index?color:c));chooseHighlightColor(color)}};
 const applyPaletteColor=(color:string)=>{const target=paletteEditTarget.current;if(!target)return;replacePaletteColor(target.kind,target.index,color)};
 const undo=()=>{const prev=past.current.pop();if(!prev)return;future.current.push(docRef.current);docRef.current=prev;setDoc(prev);setSelection([])};
 const redo=()=>{const next=future.current.pop();if(!next)return;past.current.push(docRef.current);docRef.current=next;setDoc(next);setSelection([])};
 const addPage=()=>{const current=docRef.current,p=createPage(current.pages.length+1);apply({...current,pages:[...current.pages,p],activeId:p.id});setSelection([]);requestAnimationFrame(()=>document.getElementById('sheet-'+p.id)?.scrollIntoView({block:'start',behavior:'smooth'}))};
 const duplicatePage=()=>{const p={...clone(page),id:crypto.randomUUID(),name:page.name+' — bản sao'};const pages=[...doc.pages];pages.splice(pageIndex+1,0,p);apply({...doc,pages,activeId:p.id});setMessage('Đã nhân đôi trang')};
 const reorderPage=(targetId:string)=>{const sourceId=draggedPage.current;draggedPage.current=null;if(!sourceId||sourceId===targetId)return;const pages=[...doc.pages],source=pages.findIndex(p=>p.id===sourceId),target=pages.findIndex(p=>p.id===targetId);if(source<0||target<0)return;const [moved]=pages.splice(source,1);pages.splice(target,0,moved);apply({...doc,pages})};
 const deletePage=()=>{if(doc.pages.length===1){setMessage('Bài giảng cần ít nhất một trang');return}const pages=doc.pages.filter(p=>p.id!==page.id);apply({...doc,pages,activeId:pages[Math.max(0,pageIndex-1)].id});setSelection([])};
 const deleteSelected=()=>{if(!selectionIds.length)return;const ids=new Set(selectionIds);updatePage(p=>({...p,items:p.items.filter(i=>!ids.has(i.id))}));setSelection([])};
 const duplicateSelected=()=>{if(!selectionIds.length)return;const copies=page.items.filter(i=>selectionIds.includes(i.id)).map(item=>{const copy=clone(item);copy.id=crypto.randomUUID();return translateItem(copy,24,24)});updatePage(p=>({...p,items:[...p.items,...copies]}));setSelection(copies.map(i=>i.id))};
 const rotateSelected=()=>{if(!selectionIds.length)return;const ids=new Set(selectionIds);updatePage(p=>({...p,items:p.items.map(i=>ids.has(i.id)?rotateItem(i,15):i)}))};
 const flipSelected=(axis:'horizontal'|'vertical')=>{if(!selectionIds.length)return;const ids=new Set(selectionIds),chosen=page.items.filter(i=>ids.has(i.id)),flipped=flipItems(chosen,axis),byId=new Map(flipped.map(i=>[i.id,i] as const));updatePage(p=>({...p,items:p.items.map(i=>byId.get(i.id)||i)}))};

 const insertText=(x:number,y:number,math:boolean)=>{setInsertAt({x,y});setDraftText(math?'H_2SO_4':'');setModal(math?'math':'text')};
 const [editingId,setEditingId]=useState<string|null>(null);
 const editText=(pageId:string,id:string)=>{const target=docRef.current.pages.find(p=>p.id===pageId)?.items.find(i=>i.id===id);if(!target||target.kind!=='text')return;setDoc(d=>d.activeId===pageId?d:{...d,activeId:pageId});setEditingId(id);setDraftText(target.text);setModal('text')};
 const confirmText=()=>{
  if(!draftText.trim())return;
  if(editingId){const id=editingId;const current=docRef.current;apply({...current,pages:current.pages.map(p=>p.items.some(i=>i.id===id)?{...p,items:p.items.map(i=>i.id===id&&i.kind==='text'?{...i,text:draftText}:i)}:p)});setEditingId(null);setModal(null);setDraftText('');return}
  const formatted=modal==='math'?formatFormula(draftText):draftText;
  const current=docRef.current;let targetId=current.activeId;const x=Math.max(0,Math.min(W-20,insertAt.x));let y=insertAt.y;
  const lineCount=Math.max(1,formatted.split('\n').length),estimatedBottom=y+(lineCount-1)*settings.textSize*1.3+settings.textSize*.28;
  let pages=[...current.pages];
  if(estimatedBottom>H-4){
   const sourceIndex=pages.findIndex(p=>p.id===targetId);let next=pages[sourceIndex+1];
   if(!next){next=createPage(pages.length+1);pages.push(next)}
   targetId=next.id;y=Math.max(40,settings.textSize*1.5);
  }
  const item:BoardItem={id:crypto.randomUUID(),kind:'text',x,y,text:formatted,color:settings.color,fontSize:settings.textSize,math:modal==='math'};
  pages=pages.map(p=>p.id===targetId?{...p,items:[...p.items,item]}:p);
  apply({...current,pages,activeId:targetId});setModal(null);setDraftText('');setSelection([item.id]);
  if(targetId!==current.activeId)requestAnimationFrame(()=>document.getElementById('sheet-'+targetId)?.scrollIntoView({block:'start',behavior:'smooth'}));
 };

 const importFile=async(file:File,editable=false)=>{try{if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){setMessage('Đang mở PDF…');const {pages,textRuns}=await pdfToPages(file,doc.pages.length,editable,(i,n)=>setMessage(`Đang mở PDF… trang ${i}/${n}`));apply({...doc,pages:[...doc.pages,...pages],activeId:pages[0].id});setMessage(editable?(textRuns?`Đã nhập ${pages.length} trang, ${textRuns} khối chữ sửa được (dùng công cụ Chọn, bấm đúp để sửa)`:`Đã nhập ${pages.length} trang. PDF này là ảnh scan nên không có chữ để tách`):`Đã nhập ${pages.length} trang PDF`)}else if(file.type.startsWith('image/')){const src=await readFile(file);const img=new Image();img.src=src;await img.decode();const scale=Math.min(W*.8/img.width,H*.8/img.height,1);const item:BoardItem={id:crypto.randomUUID(),kind:'image',x:80,y:80,w:img.width*scale,h:img.height*scale,src};updatePage(p=>({...p,items:[...p.items,item]}));setMessage('Đã thêm hình ảnh vào bảng')}else setMessage('Hãy chọn PDF, PNG hoặc JPG')}catch(e){console.error('Lỗi nhập tệp',e);setMessage('Không mở được tệp'+(e instanceof Error&&e.message?': '+e.message.slice(0,90):'')+'. Hãy thử tệp PDF hoặc ảnh khác.')}};
 const pasteExternalImage=async(file:File)=>{
  try{
   const src=await readFile(file);const image=new Image();image.src=src;await image.decode();
   if(!image.naturalWidth||!image.naturalHeight)throw new Error('Ảnh clipboard không có kích thước hợp lệ');
   const scale=Math.min((W*.78)/image.naturalWidth,(H*.68)/image.naturalHeight,1);
   const w=Math.max(1,image.naturalWidth*scale),h=Math.max(1,image.naturalHeight*scale);
   const current=docRef.current,anchor=lastPastePosition.current;
   const targetId=anchor&&current.pages.some(p=>p.id===anchor.pageId)?anchor.pageId:current.activeId;
   const x=anchor?Math.max(0,Math.min(W-w,anchor.x-w/2)):(W-w)/2;
   const y=anchor?Math.max(0,Math.min(H-h,anchor.y-h/2)):(H-h)/2;
   const item:BoardItem={id:crypto.randomUUID(),kind:'image',x,y,w,h,src};
   const pages=current.pages.map(p=>p.id===targetId?{...p,items:[...p.items,item]}:p);
   apply({...current,pages,activeId:targetId});setSelection([item.id]);setMessage('Đã dán ảnh từ clipboard vào bài giảng');
   if(targetId!==current.activeId)requestAnimationFrame(()=>document.getElementById('sheet-'+targetId)?.scrollIntoView({block:'start',behavior:'smooth'}));
  }catch(error){console.error('Paste image failed',error);setMessage('Không dán được ảnh từ clipboard. Hãy thử sao chép ảnh rồi nhấn Ctrl+V lần nữa.')}
 };
 const pasteInternalItems=()=>{
  const current=docRef.current,targetId=current.activeId;if(!clipboard.current.length)return;
  const copies=clipboard.current.map(source=>{const item=clone(source);item.id=crypto.randomUUID();return translateItem(item,24,24)});
  const pages=current.pages.map(p=>p.id===targetId?{...p,items:[...p.items,...copies]}:p);
  apply({...current,pages});setSelection(copies.map(item=>item.id));setMessage(`Đã dán ${copies.length} đối tượng`);
 };
 useEffect(()=>{
  const trackPointer=(event:PointerEvent)=>{
   const target=event.target;const sheet=target instanceof Element?target.closest<HTMLElement>('.continuous-sheet'):null;
   const pageId=sheet?.dataset.pageId;
   if(!sheet||!pageId){lastPastePosition.current=null;return}
   const rect=sheet.getBoundingClientRect(),z=zoomRef.current||1;
   lastPastePosition.current={pageId,x:Math.max(0,Math.min(W,(event.clientX-rect.left)/z)),y:Math.max(0,Math.min(H,(event.clientY-rect.top)/z))};
  };
  const handlePaste=(event:ClipboardEvent)=>{
   const target=event.target as HTMLElement|null;
   if(target&&(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable)){pendingInternalPaste.current=false;return}
   const data=event.clipboardData;
   if(data){
    const items=Array.from(data.items||[]);
    const directImage=items.find(item=>item.kind==='file'&&item.type.startsWith('image/'))?.getAsFile()||Array.from(data.files||[]).find(file=>file.type.startsWith('image/'))||null;
    if(directImage){event.preventDefault();pendingInternalPaste.current=false;void pasteExternalImage(directImage);return}
    const html=data.getData('text/html');
    const src=html?new DOMParser().parseFromString(html,'text/html').querySelector('img')?.getAttribute('src'):null;
    if(src&&src.startsWith('data:image/')){event.preventDefault();pendingInternalPaste.current=false;void fetch(src).then(response=>response.blob()).then(blob=>pasteExternalImage(new File([blob],'clipboard-image.'+(blob.type.split('/')[1]||'png'),{type:blob.type}))).catch(error=>{console.error(error);setMessage('Không đọc được ảnh trong clipboard')});return}
   }
   // On Electron, Chromium does not expose every native clipboard image format in ClipboardEvent.
   // Ask the main process for image pixels through a narrow, read-only bridge and paste only if present.
   const desktop=window.mucDesktop;
   if(desktop?.readClipboardImage){
    event.preventDefault();
    const hadInternalCopy=pendingInternalPaste.current&&clipboard.current.length>0;
    const previousImageFingerprint=internalCopyImageFingerprint.current;
    pendingInternalPaste.current=false;
    void desktop.readClipboardImage().then(async dataUrl=>{
     const newFingerprint=clipboardImageFingerprint(dataUrl);
     const nativeImageWasChanged=!!dataUrl&&newFingerprint!==previousImageFingerprint;
     if(dataUrl&&dataUrl.startsWith('data:image/')&&(!hadInternalCopy||nativeImageWasChanged)){
      const response=await fetch(dataUrl);const blob=await response.blob();
      await pasteExternalImage(new File([blob],'clipboard-image.'+(blob.type.split('/')[1]||'png'),{type:blob.type||'image/png'}));
     }else if(hadInternalCopy){pasteInternalItems()}
    }).catch(error=>{
     console.error('Clipboard image fallback failed',error);
     if(hadInternalCopy)pasteInternalItems();else setMessage('Không đọc được ảnh từ clipboard');
    });
    return;
   }
   if(pendingInternalPaste.current&&clipboard.current.length){event.preventDefault();pendingInternalPaste.current=false;pasteInternalItems();return}
   pendingInternalPaste.current=false;
  };
  document.addEventListener('pointermove',trackPointer,true);window.addEventListener('paste',handlePaste);
  return()=>{document.removeEventListener('pointermove',trackPointer,true);window.removeEventListener('paste',handlePaste)};
 },[]);
 const onKey=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;const typing=['INPUT','TEXTAREA'].includes(target.tagName)||target.isContentEditable;if(e.ctrlKey||e.metaKey){if(e.shiftKey&&e.key.toLowerCase()==='c'&&!typing){e.preventDefault();setMini('calculator');setModal('mini')}else if(e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}else if(e.key.toLowerCase()==='y'){e.preventDefault();redo()}else if(e.key.toLowerCase()==='s'){e.preventDefault();void saveNow()}else if(e.key==='+'||e.key==='='){e.preventDefault();setZoom(z=>Math.min(8,z*1.25))}else if(e.key==='-'){e.preventDefault();setZoom(z=>Math.max(.25,z/1.25))}else if(e.key==='0'){e.preventDefault();setZoom(fitZoom(showPages))}else if(e.key.toLowerCase()==='a'&&!typing){e.preventDefault();setSelection(page.items.map(i=>i.id))}else if(e.key.toLowerCase()==='c'&&!typing&&selectionIds.length){e.preventDefault();clipboard.current=clone(page.items.filter(i=>selectionIds.includes(i.id)));const desktop=window.mucDesktop;if(desktop?.readClipboardImage){void desktop.readClipboardImage().then(data=>{internalCopyImageFingerprint.current=clipboardImageFingerprint(data)}).catch(()=>{internalCopyImageFingerprint.current=null})}else internalCopyImageFingerprint.current=null}else if(e.key.toLowerCase()==='v'&&!typing){pendingInternalPaste.current=clipboard.current.length>0;window.setTimeout(()=>{pendingInternalPaste.current=false},800)}return}if(typing)return;if(e.key==='Escape'){setPopover(null);setSelection([]);return}if(e.key==='F11'){e.preventDefault();if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen();return}if(e.key==='Delete'||e.key==='Backspace'){deleteSelected();return}if(e.key==='PageDown'){showPage(doc.pages[Math.min(doc.pages.length-1,pageIndex+1)].id);return}if(e.key==='PageUp'){showPage(doc.pages[Math.max(0,pageIndex-1)].id);return}if(e.key==='?'){setModal('shortcuts');return}const keys:Record<string,ActiveTool>={p:'pen',h:'highlighter',e:'eraser',v:'select',t:'text',r:'shape',l:'shape',a:'shape',m:'math',q:'laser'};if(keys[e.key.toLowerCase()]){const nextTool=keys[e.key.toLowerCase()];setTool(nextTool);setPopover(null);if(nextTool==='highlighter')setSettings(s=>({...s,style:s.style==='highlighter-square'?'highlighter-square':'highlighter'}));else if(nextTool==='pen'&&settings.style.startsWith('highlighter')){const remembered=localStorage.getItem('muc-last-ink-style');setSettings(s=>({...s,style:remembered&&!remembered.startsWith('highlighter')?remembered:'ballpoint'}))}if(e.key.toLowerCase()==='l')setSettings(s=>({...s,shape:'line'}));if(e.key.toLowerCase()==='a')setSettings(s=>({...s,shape:'arrow'}))}};
 useEffect(()=>{window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)});
 const latexPreview=()=>{try{return katex.renderToString(draftText,{throwOnError:false,trust:false,output:'html'})}catch{return draftText}};
 useEffect(()=>registerBoardTools(addPage,(text)=>{const item:BoardItem={id:crypto.randomUUID(),kind:'text',x:140,y:150,text:formatFormula(text),color:settings.color,fontSize:28,math:true};updatePage(p=>({...p,items:[...p.items,item]}))}),[doc,settings.color]);
 const returnHome=async()=>{try{const ok=await saveLatest();if(ok)onHome();else setSaveState('Chưa xác nhận được bản lưu mới nhất')}catch{setSaveState('Không lưu được trên thiết bị')}};
 return <div className={'app '+theme}>
 <header className="topbar"><button className="home-return" title="Về thư viện" aria-label="Về thư viện" onClick={returnHome}><House size={18}/></button><div className="brand"><span className="brand-mark"><PenLine size={19}/></span><span>Lớp học <b>Mực</b></span></div><input className="document-input" aria-label="Tên bài giảng" value={doc.title} onChange={e=>setDoc({...doc,title:e.target.value})}/><div className="top-actions"><span className="save-status"><Save size={14}/>{saveState}</span><button className={'top-button save-button '+saveKind} onClick={()=>void saveNow()} title="Lưu ngay (Ctrl + S)" aria-label="Lưu ngay"><Save size={16}/><span>Lưu</span></button><button className="icon-button" title="Toàn màn hình" onClick={()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}><Maximize size={18}/></button><button className="icon-button" title="Đổi giao diện" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button><button className="top-button" onClick={()=>input.current?.click()} title="Nhập PDF hoặc hình ảnh"><Upload size={16}/><span>Nhập tài liệu</span></button><button className="top-button" onClick={()=>editInput.current?.click()} title="Nhập PDF và tách chữ thành văn bản sửa được"><Type size={16}/><span>PDF sửa chữ</span></button><input ref={editInput} hidden type="file" accept=".pdf,application/pdf" onChange={e=>{const f=e.target.files?.[0];if(f)importFile(f,true);e.currentTarget.value=''}}/><input ref={input} hidden type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)importFile(f);e.currentTarget.value=''}}/><button className="top-button primary" onClick={()=>setModal('export')}><Download size={16}/><span>Xuất bài giảng</span></button></div></header>
 <main className={'main '+(showPages?'':'pages-hidden')}><aside className="tool-rail"><div className="rail-group">{toolOptions.map(t=>{
 const visuallyActive=tool===t.id;
 return <button key={t.id} className={'tool-button '+(visuallyActive?'active':'')} title={`${t.label} · ${t.key} · nhấn lần nữa để tùy chỉnh`} aria-label={t.label} onClick={e=>{
   const alreadyActive=tool===t.id;
   if(alreadyActive){
     setPopover(prev=>prev===t.id?null:t.id);
     setPopoverLeft(Math.max(8,Math.min(e.currentTarget.getBoundingClientRect().left,window.innerWidth-478)));
   }else{
     setTool(t.id);
     setPopover(null);
     if(t.id==='pen'&&settings.style.startsWith('highlighter')){
       const remembered=localStorage.getItem('muc-last-ink-style');
       setSettings(prev=>({...prev,style:remembered&&!remembered.startsWith('highlighter')?remembered:'ballpoint'}));
     }
   }
 }}><t.icon size={21} strokeWidth={1.8}/></button>;
})}<button className="tool-button" title="Đồ thị & nhận diện công thức viết tay" aria-label="Đồ thị và nhận diện công thức" onClick={()=>setGraphOpen(true)}><LineChart size={21}/></button><button className="tool-button mathhub-launch" title="Trung tâm Toán Σ: hình học, đồ thị, Oxyz, ma trận, thống kê và xác suất" aria-label="Trung tâm Toán Sigma" onClick={()=>setMathHubOpen(true)}><Sigma size={21}/></button><button className="tool-button" title="Thư viện hình học: hình phẳng, khối đa diện, mẫu toán" aria-label="Thư viện hình học" onClick={()=>setGeometryLibraryOpen(true)}><Grid2X2 size={21}/></button><button className="tool-button" title="Dựng hình hình học không gian 3D" aria-label="Hình học không gian 3D" onClick={()=>{setGeometryInitialSolid('cube');setGeometryInitialConfig(undefined);setGeometryEditTargetId(null);setGeometryOpen(true)}}><Box size={21}/></button><button className="tool-button" title="Bộ dụng cụ: thước, đo góc, ê ke, compa" aria-label="Mở dụng cụ hình học" onClick={()=>setGeometryKitOpen(v=>!v)}><Ruler size={21}/></button><span className="rail-separator"/><button className={'tool-button '+(tool==='highlighter'?'active':'')} title="Dạ quang · nhấn để dùng, nhấn lần nữa để chọn loại dạ quang" aria-label="Dạ quang" onClick={e=>{if(tool==='highlighter'){setPopover(p=>p==='highlighter'?null:'highlighter');setPopoverLeft(Math.max(8,Math.min(e.currentTarget.getBoundingClientRect().left,window.innerWidth-478)))}else{setTool('highlighter');setSettings(s=>({...s,style:s.style==='highlighter-square'?'highlighter-square':'highlighter'}));setPopover(null)}}}><Highlighter size={21}/></button><span className="rail-separator"/><div className="quick-palette-group ink-palette" title="Màu bút viết — nhấp để dùng; nhấp lại ô đang dùng để đổi màu"><span className="palette-caption"><PenLine size={12}/></span><div className="quick-colors ink-colors">{inkSwatches.map((c,i)=><button key={i} className={settings.color.toLowerCase()===c.toLowerCase()?"on":""} style={{background:c}} title={`${c} · nhấp để dùng; nhấp lại ô đang dùng để đổi màu`} aria-label={`Màu bút ${i+1}: ${c}`} onClick={()=>handlePaletteSwatchClick('ink',i,c)}/> )}</div></div><div className="quick-palette-group highlight-palette" title="Màu dạ quang — nhấp để dùng; nhấp lại ô đang dùng để đổi màu"><span className="palette-caption"><Highlighter size={13}/></span><div className="quick-colors highlight-colors">{highlightSwatches.map((c,i)=><button key={i} className={settings.highlightColor.toLowerCase()===c.toLowerCase()?"on":""} style={{background:c}} title={`${c} · nhấp để dùng; nhấp lại ô đang dùng để đổi màu`} aria-label={`Màu highlight ${i+1}: ${c}`} onClick={()=>handlePaletteSwatchClick('highlight',i,c) }/> )}</div></div><input ref={paletteColorInput} className="palette-color-editor" type="color" aria-label="Đổi màu ô bảng màu đang chọn" tabIndex={-1} onChange={e=>applyPaletteColor(e.target.value)} onBlur={()=>{paletteEditTarget.current=null;lastPaletteClick.current=null}}/><button className="tool-button tune-button" title="Tùy chỉnh giấy" onClick={e=>{setPopover('paper');setPopoverLeft(Math.max(8,Math.min(e.currentTarget.getBoundingClientRect().left,window.innerWidth-478)))}}><SlidersHorizontal size={20}/></button></div><div className="rail-bottom"><button className="tool-button" title="Tiện ích" onClick={()=>{setMini('calculator');setModal('mini')}}><Calculator size={21}/></button><button className="tool-button" title="Phím tắt" onClick={()=>setModal('shortcuts')}><CircleHelp size={21}/></button></div></aside>
 <section className="workspace"><div className="workspace-top"><div className="crumb">{doc.title} <span>·</span> {pageIndex+1} / {doc.pages.length} <span>·</span> {Math.round(zoom*100)}% <span>·</span> A4</div><div className="board-actions"><button title={showPages?'Bật chế độ toàn trang giấy':'Thoát chế độ toàn trang giấy'} aria-label={showPages?'Bật chế độ toàn trang giấy':'Thoát chế độ toàn trang giấy'} onClick={()=>{const next=!showPages;setShowPages(next);setZoom(fitZoom(next))}}>{showPages?<PanelLeftClose size={18}/>:<PanelLeftOpen size={18}/>}</button><span className="sep"/><button title="Hoàn tác" onClick={undo} disabled={!past.current.length}><Undo2 size={17}/></button><button title="Làm lại" onClick={redo} disabled={!future.current.length}><Redo2 size={17}/></button><span className="sep"/><button title="Tùy chỉnh giấy" onClick={()=>{setPopover('paper');setPopoverLeft(Math.max(8,window.innerWidth-490))}}><SlidersHorizontal size={18}/></button></div></div><ContinuousPages pages={doc.pages} activeId={doc.activeId} zoom={zoom} tool={tool} settings={settings} selected={selected} selectedIds={selectedIds} areaRef={boardAreaRef}
 onActivate={id=>{if(docRef.current.activeId!==id){setSelection([]);setDoc(d=>({...d,activeId:id}))}}}
 onSelect={id=>setSelection(id?[id]:[])} onSelectMany={setSelection} onCommit={commitPage}
 onEditText={editText}
 onInsertText={(id,x,y,math)=>{const current=docRef.current;if(!current.pages.some(p=>p.id===id))return;if(current.activeId!==id)setDoc(d=>({...d,activeId:id}));insertText(Math.max(0,Math.min(W-20,x)),Math.max(20,Math.min(H,y)),math)}}
 onPan={(dx,dy)=>boardAreaRef.current?.scrollBy({left:-dx,top:-dy})}
 onZoomDrag={(delta,clientX,clientY)=>{
  const current=zoomRef.current;
  const next=Math.max(.25,Math.min(8,current*Math.exp(delta*.008)));
  if(Math.abs(next-current)<0.0001)return;
  const area=boardAreaRef.current;
  const stack=area?.querySelector<HTMLElement>('.continuous-stack');
  const rect=stack?.getBoundingClientRect();
  // Ghi lại điểm trên giấy đang nằm dưới con trỏ; useLayoutEffect cuộn lại ngay sau khi zoom render xong.
  zoomAnchor.current=rect&&clientX!==undefined&&clientY!==undefined?{cx:clientX,cy:clientY,px:(clientX-rect.left)/current,py:(clientY-rect.top)/current}:null;
  zoomRef.current=next;setZoom(next);
 }}
 onInteracting={()=>setPopover(null)}/><div className="zoom-controls"><button onClick={()=>setZoom(z=>Math.max(.25,z/1.25))} title="Thu nhỏ"><ZoomOut size={18}/></button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.min(8,z*1.25))} title="Phóng to"><ZoomIn size={18}/></button><button onClick={()=>{const area=boardAreaRef.current;setZoom(!showPages&&area&&area.clientWidth>0?Math.max(.25,Math.min(8,area.clientWidth/W)):fitZoom(showPages))}} title="Vừa màn hình"><Maximize size={17}/></button></div></section>
 <footer className="pages-bar"><div className="pages-label"><span>TRANG BẢNG</span><b>{doc.pages.length}</b></div><div className="pages-list"><button className="page-nav" onClick={()=>showPage(doc.pages[Math.max(0,pageIndex-1)].id)} title="Trang trước"><ChevronLeft size={18}/></button>{doc.pages.map((p,index)=><button key={p.id} draggable onDragStart={()=>draggedPage.current=p.id} onDragOver={e=>e.preventDefault()} onDrop={()=>reorderPage(p.id)} className={'page-item '+(page.id===p.id?'current':'')} onClick={()=>showPage(p.id)} title={p.name}><span className="page-index">{index+1}</span><PageThumbnail page={p}/><span>{p.name.length>13?p.name.slice(0,12)+'…':p.name}</span></button>)}<button className="add-page" title="Thêm trang" onClick={addPage}><Plus size={21}/></button><button className="page-nav" onClick={()=>showPage(doc.pages[Math.min(doc.pages.length-1,pageIndex+1)].id)} title="Trang sau"><ChevronRight size={18}/></button></div><div className="page-actions"><button onClick={()=>{const name=prompt('Tên trang',page.name);if(name?.trim())updatePage(p=>({...p,name:name.trim()}))}} title="Đổi tên trang"><Type size={16}/></button><button onClick={duplicatePage} title="Nhân đôi trang"><Copy size={16}/></button><button onClick={deletePage} title="Xóa trang"><Trash2 size={16}/></button></div></footer></main>
 {popover&&<ToolPopup tool={popover} settings={settings} setSettings={setSettings} page={page} pages={doc.pages} activePageId={page.id} selectedCount={selectionIds.length} onMoveSelectedToPage={moveSelectedToPage} onPage={updatePage} inkSwatches={inkSwatches} highlightSwatches={highlightSwatches} onPaletteColorChange={replacePaletteColor} onSelectShape={(shape,fill)=>{setSettings(s=>({...s,shape,fill}));setTool('shape');setPopover(null)}}
 onPaperImage={async file=>{try{const src=await readFile(file);updatePage(p=>({...p,background:'white',backgroundImage:src}));setMessage('Đã đổi nền giấy')}catch{setMessage('Không mở được ảnh nền')}}}
 onClose={()=>setPopover(null)} left={popoverLeft} selectedItem={selectedItem||null} onEditSelected={editSelected} onDuplicate={duplicateSelected} onRotate={rotateSelected} onFlipHorizontal={()=>flipSelected('horizontal')} onFlipVertical={()=>flipSelected('vertical')} onDelete={deleteSelected} onEditGeometry={()=>{if(selectedItem?.kind==='image'&&selectedItem.geometry){setGeometryInitialSolid(selectedItem.geometry.solid as GeometrySolid);setGeometryInitialConfig(selectedItem.geometry);setGeometryEditTargetId(selectedItem.id);setGeometryOpen(true);setPopover(null)}}}/>}
 {message&&<div className="toast" role="status">{message}</div>}
 <>{mathHubOpen&&<MathHub onClose={()=>setMathHubOpen(false)} onOpenGraph={()=>setGraphOpen(true)} onOpenLibrary={()=>setGeometryLibraryOpen(true)} onOpen3D={()=>{setGeometryInitialSolid('cube');setGeometryInitialConfig(undefined);setGeometryEditTargetId(null);setGeometryOpen(true)}} onOpenCalculator={()=>{setMini('calculator');setModal('mini')}} onInsert={(src,label,aspectRatio)=>{const ratio=aspectRatio&&Number.isFinite(aspectRatio)?aspectRatio:600/440;const w=Math.min(640,440*ratio),h=w/ratio;const item:BoardItem={id:crypto.randomUUID(),kind:'image',x:72,y:105,w,h,src};updatePage(p=>({...p,items:[...p.items,item]}));setSelection([item.id]);setMessage(`Đã chèn ${label} vào trang hiện tại`)}}/>}</>
 {graphOpen&&<GraphPanel onClose={()=>setGraphOpen(false)} onInsertGraph={(src,formula)=>{const item:BoardItem={id:crypto.randomUUID(),kind:'image',x:72,y:112,w:650,h:335,src};updatePage(p=>({...p,items:[...p.items,item]}));setSelection([item.id]);setMessage(`Đã chèn đồ thị ${formula} vào trang hiện tại`)}}/>}
 {geometryKitOpen&&<GeometryTools onClose={()=>setGeometryKitOpen(false)} onDraw={(kind,angle,length,radius)=>{
  const rad=angle*Math.PI/180;const center={x:W/2,y:H/2};
  const rotate=(x:number,y:number)=>({x:center.x+x*Math.cos(rad)-y*Math.sin(rad),y:center.y+x*Math.sin(rad)+y*Math.cos(rad),p:.6});
  const segments:Array<Array<{x:number;y:number;p:number}>>=[];
  if(kind==='compass'){segments.push(Array.from({length:129},(_,i)=>rotate(radius*Math.cos(i*Math.PI/64),radius*Math.sin(i*Math.PI/64))))}
  else if(kind==='protractor'){segments.push([rotate(0,0),rotate(length*.65,0)]);segments.push([rotate(0,0),rotate(length*.65*Math.cos(Math.PI/3),-length*.65*Math.sin(Math.PI/3))]);segments.push(Array.from({length:25},(_,i)=>rotate(55*Math.cos(-i*Math.PI/72),55*Math.sin(-i*Math.PI/72))))}
  else if(kind==='setSquare'){segments.push([rotate(0,0),rotate(length,0)]);segments.push([rotate(0,0),rotate(0,-length*.7)]);segments.push([rotate(length,0),rotate(0,-length*.7)])}
  else segments.push([rotate(-length/2,0),rotate(length/2,0)]);
  const strokes:BoardItem[]=segments.map(points=>({id:crypto.randomUUID(),kind:'stroke',points,color:settings.color,width:Math.max(1.5,settings.width),opacity:1,style:'ballpoint'}));
  updatePage(p=>({...p,items:[...p.items,...strokes]}));setMessage('Đã vẽ bằng '+({ruler:'thước thẳng',protractor:'thước đo góc',setSquare:'ê ke',compass:'compa'}[kind]));
 }}/>}
 {geometryLibraryOpen&&<GeometryLibraryPanel onClose={()=>setGeometryLibraryOpen(false)} inkColor={settings.color} inkWidth={settings.width} onOpen3D={solid=>{setGeometryInitialSolid(solid);setGeometryInitialConfig(undefined);setGeometryEditTargetId(null);setGeometryOpen(true)}} onInsert={(src,label,aspectRatio)=>{const ratio=aspectRatio&&Number.isFinite(aspectRatio)?aspectRatio:600/440;const w=Math.min(640,440*ratio),h=w/ratio;const item:BoardItem={id:crypto.randomUUID(),kind:'image',x:72,y:105,w,h,src};updatePage(p=>({...p,items:[...p.items,item]}));setSelection([item.id]);setMessage(`Đã chèn ${label} vào trang hiện tại`)}}/>}
 {geometryOpen&&<Geometry3DPanel initialSolid={geometryInitialSolid} initialConfig={geometryInitialConfig} isEditing={Boolean(geometryEditTargetId)} inkColor={tool==='highlighter'?settings.highlightColor:settings.color} inkWidth={settings.width} inkStyle={settings.style} onClose={()=>{setGeometryOpen(false);setGeometryEditTargetId(null);setGeometryInitialConfig(undefined)}} onInsert={(src,label,aspectRatio,geometryConfig)=>{const ratio=aspectRatio&&Number.isFinite(aspectRatio)?aspectRatio:640/440;if(geometryEditTargetId){const targetId=geometryEditTargetId;updatePage(p=>({...p,items:p.items.map(it=>it.id===targetId&&it.kind==='image'?({...it,src,geometry:geometryConfig||it.geometry,h:(it.w)/ratio}):it)}));setSelection([targetId]);setMessage(`Đã cập nhật ${label}`)}else{const w=Math.min(640,440*ratio);const h=w/ratio;const item:BoardItem={id:crypto.randomUUID(),kind:'image',x:72,y:105,w,h,src,geometry:geometryConfig};updatePage(p=>({...p,items:[...p.items,item]}));setSelection([item.id]);setMessage(`Đã chèn ${label} vào trang hiện tại`)}setGeometryOpen(false);setGeometryEditTargetId(null);setGeometryInitialConfig(undefined)}}/>}
 {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setModal(null);setEditingId(null)}}}><div className={'modal '+(modal==='mini'&&mini==='calculator'?'modal-scientific':'')} role="dialog" aria-modal="true"><div className="modal-head"><b>{modal==='text'?(editingId?'Sửa văn bản':'Thêm văn bản'):modal==='math'?'Trình soạn công thức':modal==='shortcuts'?'Phím tắt':modal==='export'?'Xuất bài giảng':modal==='mini'&&mini==='calculator'?'Máy tính khoa học Mực · Chế độ 580/880':'Công cụ giáo viên'}</b><button onClick={()=>{setModal(null);setEditingId(null)}} title="Đóng"><X size={19}/></button></div>{(modal==='text'||modal==='math')&&<div className="modal-body"><label>{modal==='math'?'Nhập công thức Hóa học hoặc LaTeX':'Nội dung'}</label><textarea autoFocus value={draftText} onChange={e=>setDraftText(e.target.value)} placeholder={modal==='math'?'Ví dụ: 2H_2 + O_2 → 2H_2O':'Nhập chữ trên bảng'}/>{modal==='math'&&<><div className="math-tips"><button onClick={()=>setDraftText('2H_2 + O_2 → 2H_2O')}>Phản ứng Hóa</button><button onClick={()=>setDraftText('CH_3COOH + NaOH → CH_3COONa + H_2O')}>Este</button><button onClick={()=>setDraftText('\\frac{1}{2}mv^2')}>Phân số</button></div><div className="math-preview" dangerouslySetInnerHTML={{__html:latexPreview()}}/><p className="panel-hint">Trên bảng, công thức dùng chỉ số Unicode để giữ nét chữ khi xuất ảnh.</p></>}<button className="modal-primary" onClick={confirmText}><Check size={16}/> {editingId?'Lưu thay đổi':'Chèn lên bảng'}</button></div>}{modal==='shortcuts'&&<div className="modal-body shortcut-list">{[['P','Bút viết'],['H','Dạ quang'],['E','Tẩy'],['V','Chọn'],['T','Văn bản'],['R','Hình chữ nhật'],['L','Đường thẳng'],['A','Mũi tên'],['M','Công thức'],['PageUp / PageDown','Chuyển trang'],['Ctrl + A','Chọn toàn bộ đối tượng trên trang'],['Ctrl + C / V','Sao chép / dán nhóm hoặc dán ảnh từ clipboard'],['Ctrl + Shift + C','Mở máy tính khoa học'],['Ctrl + Z / Y','Hoàn tác / Làm lại'],['Ctrl + S','Lưu'],['Ctrl + kéo chuột','Phóng to / thu nhỏ'],['Ctrl + lăn chuột','Phóng to / thu nhỏ giấy'],['Ctrl + + / - / 0','Zoom']].map(([key,label])=><div key={key}><kbd>{key}</kbd><span>{label}</span></div>)}</div>}{modal==='export'&&<div className="modal-body"><label>Định dạng</label><div className="choice-row">{(['png','jpg','pdf','svg'] as const).map(f=><button key={f} className={format===f?'on':''} onClick={()=>setFormat(f)}>{f.toUpperCase()}</button>)}</div><label>Phạm vi</label><div className="choice-row"><button className={!allPages?'on':''} onClick={()=>setAllPages(false)}>Trang hiện tại</button><button className={allPages?'on':''} onClick={()=>setAllPages(true)}>Tất cả trang</button></div><button className="modal-primary" onClick={async()=>{await exportPages(allPages?doc.pages:[page],format,doc.title);setModal(null);setMessage('Đã xuất bài giảng')}}><Download size={16}/> Tải về</button></div>}{modal==='mini'&&<div className="modal-body"><div className="choice-row">{(['calculator','timer','dice','notes'] as const).map(m=><button key={m} className={mini===m?'on':''} onClick={()=>setMini(m)}>{({calculator:'Máy tính',timer:'Hẹn giờ',dice:'Xúc xắc',notes:'Ghi chú'})[m]}</button>)}</div>{mini==='calculator'&&<ScientificCalculator onInsertToPage={(text)=>{const item:BoardItem={id:crypto.randomUUID(),kind:'text',x:96,y:135,text,color:settings.color,fontSize:settings.textSize,math:false};updatePage(p=>({...p,items:[...p.items,item]}));setSelection([item.id]);setModal(null);setMessage('Đã chèn nội dung từ máy tính vào trang hiện tại')}}/>}{mini==='timer'&&<div className="mini-box"><div className="timer-display">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</div><button onClick={()=>setRunning(!running)}>{running?'Tạm dừng':'Bắt đầu'}</button><button onClick={()=>{setRunning(false);setSeconds(300)}}><RotateCcw size={15}/> Đặt lại</button></div>}{mini==='dice'&&<div className="mini-box"><div className="dice-display">{dice}</div><button onClick={()=>setDice(Math.floor(Math.random()*6)+1)}>Tung xúc xắc</button></div>}{mini==='notes'&&<textarea value={notes} onChange={e=>{setNotes(e.target.value);localStorage.setItem('muc-notes',e.target.value)}} placeholder="Ghi chú riêng cho giáo viên"/>}</div>}</div></div>}
 </div>
}


