import {Dispatch,SetStateAction,useRef} from 'react';
import {X} from 'lucide-react';
import {Background,BoardItem,BoardPage,LinePattern} from '../../types/board';
import {ActiveTool,BoardSettings} from '../Whiteboard/Whiteboard';
import {shapeOptions,shapePath} from '../../utils/shapes';
import {COLOR_PALETTE} from '../../utils/palette';
import './tool-popup.css';

export type PopupTool=ActiveTool|'paper';
type PaletteKind='ink'|'highlight';
type PaletteClick={kind:PaletteKind;index:number};
type Props={
  tool:PopupTool;settings:BoardSettings;setSettings:Dispatch<SetStateAction<BoardSettings>>;inkSwatches:string[];highlightSwatches:string[];onPaletteColorChange:(kind:PaletteKind,index:number,color:string)=>void;onSelectShape:(shape:string,fill:string)=>void;
  page:BoardPage;pages:BoardPage[];activePageId:string;selectedCount:number;onMoveSelectedToPage:(targetPageId:string)=>void;onPage:(change:(page:BoardPage)=>BoardPage)=>void;
  onPaperImage:(file:File)=>void;onClose:()=>void;left:number;
  selectedItem:BoardItem|null;onEditSelected:(patch:Record<string,unknown>)=>void;
  onDuplicate:()=>void;onRotate:()=>void;onFlipHorizontal:()=>void;onFlipVertical:()=>void;onDelete:()=>void;onEditGeometry:()=>void;
};
const colors=[...COLOR_PALETTE];
const penStyles=[
  ['ballpoint','Bút bi'],['gel','Bút gel'],['fineliner','Bút kim'],['pencil','Bút chì'],
  ['fountain','Bút máy'],['marker','Marker'],['felt','Bút dạ'],['brush','Bút cọ'],
  ['calligraphy','Thư pháp'],['chalk','Phấn'],['crayon','Sáp màu'],
  ['monoline','Nét đều'],['neon','Bút neon'],
] as const;
const highlighterStyles=[['highlighter','Dạ quang'],['highlighter-square','Dạ quang vuông']] as const;
const patterns:{id:LinePattern;label:string;dash?:string}[]=[
  {id:'solid',label:'Liền'}, {id:'dashed',label:'Đứt',dash:'8 5'}, {id:'dotted',label:'Chấm',dash:'1 5'},
];
const backgrounds:{id:Background;label:string}[]=[
  {id:'white',label:'Trắng'},{id:'black',label:'Đen'},{id:'lined',label:'Kẻ dòng'},
  {id:'grid',label:'Ô vuông'},{id:'dots',label:'Chấm'},{id:'graph',label:'Đồ thị'},
  {id:'chemistry',label:'Giấy Hóa'},{id:'physics',label:'Giấy Lý'},{id:'notebook',label:'Vở ghi'},
];

function PatternPicker({value,onChange}:{value:LinePattern;onChange:(value:LinePattern)=>void}){
  return <div className="popup-patterns">{patterns.map(p=><button key={p.id} type="button" className={value===p.id?'picked':''} onClick={()=>onChange(p.id)}>
    <svg width="50" height="15" viewBox="0 0 50 15" aria-hidden="true"><path d="M2 7.5H48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={p.dash}/></svg><span>{p.label}</span>
  </button>)}</div>;
}

export default function ToolPopup({tool,settings,setSettings,page,pages,activePageId,selectedCount,onMoveSelectedToPage,onPage,onPaperImage,onClose,left,selectedItem,onEditSelected,onDuplicate,onRotate,onFlipHorizontal,onFlipVertical,onDelete,onEditGeometry,inkSwatches,highlightSwatches,onPaletteColorChange,onSelectShape}:Props){
  const title=({pen:'Bút viết',highlighter:'Dạ quang',eraser:'Tẩy',shape:'Hình học',select:'Chọn đối tượng',text:'Văn bản',math:'Công thức',pan:'Di chuyển',laser:'Bút laser',paper:'Giấy A4'})[tool];
  const update=(patch:Partial<BoardSettings>)=>setSettings(s=>({...s,...patch}));
  type ColorMode='ink'|'highlight'|'laser';
  const colorInput=useRef<HTMLInputElement>(null);
  const lastColorClick=useRef<PaletteClick|null>(null);
  const colorEditTarget=useRef<PaletteClick|null>(null);
  const activeColorMode:ColorMode=tool==='laser'?'laser':tool==='highlighter'?'highlight':'ink';
  const getColor=(mode:ColorMode)=>mode==='laser'?settings.laserColor:mode==='highlight'?settings.highlightColor:settings.color;
  const setColor=(mode:ColorMode,color:string)=>update(mode==='laser'?{laserColor:color}:mode==='highlight'?{highlightColor:color}:{color,opacity:1});
  const colorPicker=(mode:ColorMode=activeColorMode)=>{const kind:PaletteKind=mode==='highlight'?'highlight':'ink';const swatches=kind==='highlight'?highlightSwatches:inkSwatches;return <div className="popup-colors">{swatches.map((c,i)=><button key={`${kind}-${i}`} type="button" style={{background:c}} className={getColor(mode).toLowerCase()===c.toLowerCase()?'picked':''} aria-label={`Màu ${c}`} title={`${c} · nhấp để chọn; nhấp lại để đổi màu`} onClick={()=>{const last=lastColorClick.current;if(last?.kind===kind&&last.index===i){lastColorClick.current=null;colorEditTarget.current={kind,index:i};if(colorInput.current){colorInput.current.value=getColor(mode);colorInput.current.click()}return}lastColorClick.current={kind,index:i};setColor(mode,c)}}/>)}<input ref={colorInput} type="color" aria-label="Màu tùy chỉnh" value={getColor(mode)} onChange={e=>{const target=colorEditTarget.current;if(target){onPaletteColorChange(target.kind,target.index,e.target.value)}else setColor(mode,e.target.value)}} onBlur={()=>{colorEditTarget.current=null;lastColorClick.current=null}}/></div>};
  return <div className="tool-popup" style={{left}} role="dialog" aria-label={`Tùy chọn ${title}`}>
    <header><strong>{title}</strong><button type="button" onClick={onClose} aria-label="Đóng tùy chọn"><X size={18}/></button></header>
    <div className="tool-popup-body">
      {tool==='pen'&&<>
        <label>Loại bút</label><div className="popup-pen-grid">{penStyles.map(([id,name])=><button key={id} type="button" className={settings.style===id?'picked':''} onClick={()=>update({style:id})}><span className={'pen-sample '+id}/>{name}</button>)}</div>
        <label>Màu bút</label>{colorPicker('ink')}
        <label>Cỡ nét <b>{settings.width}px</b></label><svg className="popup-stroke-preview" viewBox="0 0 280 48" aria-hidden="true"><path d="M4 30 C60 4 115 43 165 23 S240 20 276 30" fill="none" stroke={settings.color} strokeOpacity={1} strokeWidth={Math.max(1,settings.width)} strokeLinecap="round"/></svg>
        <input type="range" min="1" max="40" value={settings.width} onChange={e=>update({width:+e.target.value})}/>
        <label>Kiểu đường</label><PatternPicker value={settings.dash} onChange={dash=>update({dash})}/>
        <label>Độ mờ <b>{Math.round(settings.opacity*100)}%</b></label><input type="range" min="10" max="100" value={settings.opacity*100} onChange={e=>update({opacity:+e.target.value/100})}/>
        <div className="popup-toggles"><label><input type="checkbox" checked={settings.ignorePressure} onChange={e=>update({ignorePressure:e.target.checked})}/> Bỏ qua lực nhấn</label><label><input type="checkbox" checked={settings.allowFinger} onChange={e=>update({allowFinger:e.target.checked})}/> Viết bằng ngón tay</label><label><input type="checkbox" checked={settings.recognize} onChange={e=>update({recognize:e.target.checked})}/> Nhận dạng hình</label></div>
      </>}
      {tool==='highlighter'&&<>
        <label>Loại dạ quang</label><div className="popup-pen-grid popup-highlighter-grid">{highlighterStyles.map(([id,name])=><button key={id} type="button" className={settings.style===id?'picked':''} onClick={()=>update({style:id})}><span className={'pen-sample '+id}/>{name}</button>)}</div>
        <label>Màu dạ quang</label>{colorPicker('highlight')}
        <label>Bề rộng <b>{settings.width}px</b></label><svg className="popup-stroke-preview" viewBox="0 0 280 48" aria-hidden="true"><path d="M4 30 C60 4 115 43 165 23 S240 20 276 30" fill="none" stroke={settings.highlightColor} strokeWidth={Math.max(8,settings.width*4.4)} strokeLinecap={settings.style==='highlighter-square'?'butt':'round'}/></svg>
        <input type="range" min="3" max="32" value={settings.width} onChange={e=>update({width:+e.target.value})}/>
        <label>Kiểu nét</label><PatternPicker value={settings.dash} onChange={dash=>update({dash})}/>
        <p className="popup-hint">Dạ quang được hòa trộn với tài liệu bên dưới để chữ trong PDF/ảnh vẫn dễ đọc. Nét mực và chữ chú thích sẽ luôn hiển thị phía trên.</p>
      </>}
      {tool==='eraser'&&<>
        <label>Cách tẩy</label><div className="popup-choice-list">{([{id:'stroke',label:'Tẩy cả nét'},{id:'pixel',label:'Tẩy từng phần'},{id:'object',label:'Tẩy đối tượng'}] as const).map(o=><button key={o.id} className={settings.eraser===o.id?'picked':''} onClick={()=>update({eraser:o.id})}>{o.label}</button>)}</div>
        <label>Kích thước tẩy <b>{settings.eraserSize}px</b></label><input type="range" min="5" max="80" value={settings.eraserSize} onChange={e=>update({eraserSize:+e.target.value})}/>
      </>}
      {tool==='shape'&&<>
        <label>Hình nhanh · nét viền</label><div className="popup-shape-grid shape-presets">{([{id:'rectangle',label:'Chữ nhật',fill:'transparent'},{id:'circle',label:'Hình tròn',fill:'transparent'},{id:'triangle',label:'Tam giác',fill:'transparent'}] as const).map(o=><button key={o.id} className={settings.shape===o.id&&settings.fill==='transparent'?'picked':''} onClick={()=>onSelectShape(o.id,o.fill)} title={`${o.label} rỗng`}><svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true"><path d={shapePath({shape:o.id,x:5,y:5,w:34,h:24})} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg><span>{o.label}</span></button>)}</div>
        <label>Hình nhanh · tô màu nhẹ</label><div className="popup-shape-grid shape-presets">{([{id:'rectangle',label:'Chữ nhật',fill:'#1687c42e'},{id:'circle',label:'Hình tròn',fill:'#1687c42e'},{id:'triangle',label:'Tam giác',fill:'#1687c42e'}] as const).map(o=><button key={o.id} className={settings.shape===o.id&&settings.fill===o.fill?'picked':''} onClick={()=>onSelectShape(o.id,o.fill)} title={`${o.label} có màu nền`}><svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true"><path d={shapePath({shape:o.id,x:5,y:5,w:34,h:24})} fill={o.fill} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg><span>{o.label}</span></button>)}</div>
        <label>Đường và mũi tên</label><div className="popup-shape-grid shape-presets">{([{id:'line',label:'Đường thẳng',fill:'transparent'},{id:'arrow',label:'Mũi tên',fill:'transparent'}] as const).map(o=><button key={o.id} className={settings.shape===o.id?'picked':''} onClick={()=>onSelectShape(o.id,o.fill)} title={o.label}><svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true"><path d={shapePath({shape:o.id,x:5,y:5,w:34,h:24})} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg><span>{o.label}</span></button>)}</div>
        <label>Hình khác</label><div className="popup-shape-grid">{shapeOptions.filter(o=>!['rectangle','circle','triangle','line','arrow'].includes(o.id)).map(o=><button key={o.id} className={settings.shape===o.id?'picked':''} onClick={()=>onSelectShape(o.id,settings.fill)} title={o.label}>
          <svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true"><path d={shapePath({shape:o.id,x:5,y:5,w:34,h:24})} fill={settings.fill==='transparent'?'none':settings.fill} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg><span>{o.label}</span>
        </button>)}</div>
        <label>Màu viền</label>{colorPicker()}
        <label>Kiểu viền</label><PatternPicker value={settings.dash} onChange={dash=>update({dash})}/>
        <label>Độ dày viền <b>{settings.width}px</b></label><input type="range" min="1" max="40" value={settings.width} onChange={e=>update({width:+e.target.value})}/>
        <label>Tô màu</label><div className="popup-fill"><button className={settings.fill==='transparent'?'picked':''} onClick={()=>update({fill:'transparent'})}>Không tô</button><input type="color" aria-label="Màu tô" value={settings.fill==='transparent'?'#ffffff':settings.fill.slice(0,7)} onChange={e=>update({fill:settings.fill==='transparent'?e.target.value:(settings.fill.length===9?e.target.value+settings.fill.slice(7):e.target.value)})}/></div>
      </>}
      {tool==='laser'&&<>
        <label>Hiệu ứng</label><div className="laser-effect-preview"><span className="laser-glow-sample" style={{background:settings.laserColor,boxShadow:`0 0 5px ${settings.laserColor},0 0 12px ${settings.laserColor},0 0 22px ${settings.laserColor}`}}/><span>Neon phát sáng · tự mờ dần sau khi nhấc bút</span></div>
        <label>Màu laser</label>{colorPicker('laser')}
        <label>Độ dày <b>{settings.laserSize}px</b></label><input type="range" min="3" max="32" value={settings.laserSize} onChange={e=>update({laserSize:+e.target.value})}/>
        <p className="popup-hint">Kéo để viết một nét neon tạm thời. Nét không được lưu vào bài và sẽ mờ dần rồi biến mất giống laser khi trình chiếu.</p>
      </>}
      {(tool==='text'||tool==='math')&&<>
        <p className="popup-hint">Chọn vị trí trên giấy để mở trình nhập {tool==='math'?'công thức':'văn bản'}.</p>
        <label>Màu chữ</label>{colorPicker()}
        <label>Cỡ chữ <b>{settings.textSize}px</b></label><input type="range" min="12" max="72" value={settings.textSize} onChange={e=>update({textSize:+e.target.value})}/>
      </>}
      {tool==='select'&&<>
        <p className="popup-hint">Kéo từ vùng trống để khoanh nhiều nét. Kéo bên trong khung chọn để di chuyển cả nhóm; kéo 8 tay nắm để đổi kích thước hoặc lật khi kéo qua cạnh đối diện.</p>
        <div className="popup-choice-list"><button disabled={!selectedItem} onClick={onDuplicate}>Nhân đôi</button><button disabled={!selectedItem} onClick={onRotate}>Xoay 15°</button><button disabled={!selectedItem} onClick={onFlipHorizontal}>Lật ngang</button><button disabled={!selectedItem} onClick={onFlipVertical}>Lật dọc</button><button disabled={!selectedItem} onClick={onDelete}>Xóa</button></div>
        {selectedItem?.kind==='image'&&selectedItem.geometry&&<button type="button" className="popup-action-primary" onClick={onEditGeometry}>Chỉnh sửa hình 3D / Trải phẳng</button>}
        {selectedItem&&pages.filter(p=>p.id!==activePageId).length>0&&<><label>Chuyển {selectedCount>1?`${selectedCount} đối tượng`:'đối tượng'} sang trang</label><select className="popup-select" defaultValue="" onChange={e=>{const id=e.currentTarget.value;if(id)onMoveSelectedToPage(id);e.currentTarget.value=''}}><option value="">Chọn trang đích…</option>{pages.filter(p=>p.id!==activePageId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><p className="popup-hint">Đối tượng giữ nguyên vị trí tương đối trên khổ giấy khi chuyển trang.</p></>}
        {selectedItem&&'color'in selectedItem&&<><label>Màu đối tượng</label><div className="popup-colors">{colors.map(c=><button key={c} style={{background:c}} className={selectedItem.color===c?'picked':''} aria-label={`Màu ${c}`} onClick={()=>onEditSelected({color:c})}/>)}</div></>}
        {selectedItem&&'width'in selectedItem&&<><label>Độ dày <b>{selectedItem.width}px</b></label><input type="range" min="1" max="40" value={selectedItem.width} onChange={e=>onEditSelected({width:+e.target.value})}/><label>Kiểu đường</label><PatternPicker value={selectedItem.dash||'solid'} onChange={dash=>onEditSelected({dash})}/></>}
        {selectedItem?.kind==='stroke'&&<><label>Loại bút</label><select className="popup-select" value={selectedItem.style} onChange={e=>onEditSelected({style:e.target.value})}>{penStyles.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></>}
      </>}
      {tool==='pan'&&<p className="popup-hint">Kéo bảng để di chuyển. Giữ Ctrl và kéo chuột theo chiều dọc để phóng to hoặc thu nhỏ.</p>}
      {tool==='paper'&&<>
        <label>Mẫu giấy</label><div className="popup-paper-grid">{backgrounds.map(b=><button key={b.id} className={page.background===b.id?'picked':''} onClick={()=>onPage(p=>({...p,background:b.id,backgroundImage:undefined}))}>{b.label}</button>)}</div>
        <label>Màu giấy và đường kẻ</label><div className="popup-fill"><span>Giấy</span><input type="color" value={page.paperColor||(page.background==='black'?'#202936':'#ffffff')} onChange={e=>onPage(p=>({...p,paperColor:e.target.value}))}/><span>Đường kẻ</span><input type="color" value={page.lineColor||'#b6d6eb'} onChange={e=>onPage(p=>({...p,lineColor:e.target.value}))}/></div>
        <label>Khoảng cách dòng <b>{page.spacing||28}px</b></label><input type="range" min="14" max="60" value={page.spacing||28} onChange={e=>onPage(p=>({...p,spacing:+e.target.value}))}/>
        <div className="popup-toggles"><label><input type="checkbox" checked={page.border!==false} onChange={e=>onPage(p=>({...p,border:e.target.checked}))}/> Đường viền giấy</label><label><input type="checkbox" checked={page.margins!==false} onChange={e=>onPage(p=>({...p,margins:e.target.checked}))}/> Hai nét lề (trái xanh · phải đỏ)</label></div>
        <label className="popup-file">Dùng ảnh làm giấy<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)onPaperImage(file);e.currentTarget.value=''}}/></label>
      </>}
    </div>
  </div>;
}
