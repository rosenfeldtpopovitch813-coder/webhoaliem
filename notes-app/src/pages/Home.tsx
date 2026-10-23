import {useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,MoreHorizontal,Plus,Search,Copy,PenLine,Trash2,X,Download,Upload,ImagePlus,Sparkles,ArrowUpRight,Clock3,PanelsTopLeft,Check,Camera,FileText} from 'lucide-react';
import {ProjectSummary} from '../services/projectStore';
import './home.css';

type Props={projects:ProjectSummary[];error:string;notice:string;onOpen:(id:string)=>void;onCreate:(title:string)=>void;onRename:(id:string,title:string)=>void;onDuplicate:(id:string)=>void;onDelete:(id:string)=>void;onExportBackup:()=>void;onImportBackup:(file:File)=>void};
type Dialog={kind:'create'|'rename'|'delete';id?:string;title?:string}|null;
type LocalProfile={name:string;avatar:string};
const PROFILE_KEY='lop-hoc-muc.profile.v1';
const DEFAULT_PROFILE:LocalProfile={name:'Bạn',avatar:''};
const date=(n:number)=>new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}).format(n);
function readProfile():LocalProfile{
  try{const parsed=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null') as Partial<LocalProfile>|null;
    if(parsed&&typeof parsed.name==='string'&&typeof parsed.avatar==='string')return {name:parsed.name||'Bạn',avatar:parsed.avatar};
  }catch{/* Use a clean local profile when storage is unavailable or invalid. */}
  return DEFAULT_PROFILE;
}
async function resizeAvatar(file:File):Promise<string>{
  if(!file.type.startsWith('image/'))throw new Error('Hãy chọn một file ảnh.');
  if(file.size>12*1024*1024)throw new Error('Ảnh quá lớn. Hãy chọn ảnh dưới 12 MB.');
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Không đọc được ảnh này.'));image.src=url;
    });
    const size=256,side=Math.min(img.naturalWidth,img.naturalHeight),sx=(img.naturalWidth-side)/2,sy=(img.naturalHeight-side)/2;
    const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Không thể xử lý ảnh trên thiết bị này.');
    ctx.drawImage(img,sx,sy,side,side,0,0,size,size);
    return canvas.toDataURL('image/jpeg',0.82);
  }finally{URL.revokeObjectURL(url)}
}
function greeting(){const hour=new Date().getHours();return hour<11?'buổi sáng':hour<14?'buổi trưa':hour<18?'buổi chiều':'buổi tối'}
function initials(name:string){return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part.charAt(0)).join('').toLocaleUpperCase('vi')||'M'}

export default function Home({projects,error,notice,onOpen,onCreate,onRename,onDuplicate,onDelete,onExportBackup,onImportBackup}:Props){
  const backupInput=useRef<HTMLInputElement>(null);const avatarInput=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState('');const [menu,setMenu]=useState<string|null>(null);
  const [dialog,setDialog]=useState<Dialog>(null);const [name,setName]=useState('');
  const [profile,setProfile]=useState<LocalProfile>(()=>readProfile());
  const [profileOpen,setProfileOpen]=useState(false);const [profileName,setProfileName]=useState(profile.name);const [avatarDraft,setAvatarDraft]=useState(profile.avatar);const [profileError,setProfileError]=useState('');
  const visible=useMemo(()=>projects.filter(p=>p.title.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))),[projects,query]);
  useEffect(()=>{
    if(!menu)return;
    const onPointerDown=(event:PointerEvent)=>{const target=event.target as HTMLElement|null;if(!target?.closest('.home-card-menu')&&!target?.closest('.home-card-more'))setMenu(null)};
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenu(null)};
    document.addEventListener('pointerdown',onPointerDown);window.addEventListener('keydown',onKeyDown);
    return()=>{document.removeEventListener('pointerdown',onPointerDown);window.removeEventListener('keydown',onKeyDown)};
  },[menu]);
  const createDialog=()=>{setName('');setDialog({kind:'create'})};
  const submit=(event:React.FormEvent)=>{event.preventDefault();if(!dialog)return;
    if(dialog.kind==='create')onCreate(name.trim()||'Ghi chú mới');
    if(dialog.kind==='rename'&&dialog.id&&name.trim())onRename(dialog.id,name.trim());
    if(dialog.kind==='delete'&&dialog.id)onDelete(dialog.id);
    setDialog(null);setMenu(null);
  };
  const openProfile=()=>{setProfileName(profile.name);setAvatarDraft(profile.avatar);setProfileError('');setProfileOpen(true)};
  const saveProfile=(event:React.FormEvent)=>{event.preventDefault();const next={name:profileName.trim()||'Bạn',avatar:avatarDraft};
    try{localStorage.setItem(PROFILE_KEY,JSON.stringify(next));setProfile(next);setProfileOpen(false);setProfileError('')}
    catch{setProfileError('Không lưu được ảnh đại diện. Hãy chọn ảnh khác nhỏ hơn.');}
  };
  const handleAvatar=(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(!file)return;
    void resizeAvatar(file).then(data=>{setAvatarDraft(data);setProfileError('')}).catch(e=>setProfileError(e instanceof Error?e.message:'Không đọc được ảnh.'));
  };
  const handleImport=(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.currentTarget.files?.[0];if(file)onImportBackup(file);event.currentTarget.value=''};
  return <div className="home-shell">
    <aside className="home-side">
      <div className="home-brand"><span className="home-mark" aria-hidden="true"><span>M</span><i/></span><div><strong>Lớp học <em>Mực</em></strong><small>Không gian viết của bạn</small></div></div>
      <div className="home-side-label">KHÔNG GIAN</div>
      <button className="home-inbox" onClick={()=>setQuery('')}><span className="home-nav-icon"><PanelsTopLeft size={17}/></span><span>Sảnh của tôi</span><b>{projects.length}</b></button>
      <button className="home-side-create" onClick={createDialog}><Plus size={17}/><span>Tạo bảng mới</span></button>
      <div className="home-side-label home-library-label">THƯ VIỆN</div>
      <button className="home-side-link" onClick={()=>setQuery('')}><BookOpen size={16}/><span>Tất cả bài viết</span></button>
      <div className="home-side-spacer"/>
      <div className="home-side-tools">
        <button className="home-backup" onClick={onExportBackup}><Download size={16}/> Sao lưu thư viện</button>
        <button className="home-backup" onClick={()=>backupInput.current?.click()}><Upload size={16}/> Nhập bản sao lưu</button>
        <input ref={backupInput} type="file" accept=".json,application/json" hidden onChange={handleImport}/>
      </div>
      <button className="home-side-profile" onClick={openProfile} title="Chỉnh sửa hồ sơ">
        <span className="home-avatar home-avatar-small">{profile.avatar?<img src={profile.avatar} alt=""/>:<span>{initials(profile.name)}</span>}</span>
        <span className="home-side-profile-copy"><strong>{profile.name}</strong><small>Hồ sơ trên thiết bị này</small></span>
        <PenLine size={15}/>
      </button>
    </aside>

    <main className="home-main">
      <header className="home-header">
        <div className="home-heading"><span className="home-overline"><span/> KHÔNG GIAN CÁ NHÂN</span><h1>Sảnh của bạn</h1></div>
        <div className="home-header-actions">
          <label className="home-search"><Search size={17}/><input aria-label="Tìm bài viết" placeholder="Tìm trong thư viện…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" title="Xóa tìm kiếm" onClick={()=>setQuery('')}><X size={15}/></button>}</label>
          <button className="home-profile-chip" onClick={openProfile} title="Chỉnh sửa hồ sơ"><span className="home-avatar">{profile.avatar?<img src={profile.avatar} alt="Ảnh đại diện"/>:<span>{initials(profile.name)}</span>}</span><span className="home-profile-name">{profile.name}</span><PenLine className="home-profile-edit" size={14}/></button>
        </div>
      </header>

      <div className="home-content">
        <section className="home-welcome">
          <div className="home-welcome-copy"><div className="home-kicker"><Sparkles size={14}/> GÓC LÀM VIỆC CỦA RIÊNG BẠN</div>
            <h2>Chào {greeting()},<br/><span>{profile.name}.</span></h2>
            <p>Mở một trang trắng, ghi lại ý tưởng và để bài học thành hình theo cách của bạn.</p>
            <div className="home-welcome-actions"><button className="home-primary-action" onClick={()=>onCreate('Ghi chú mới')}><Plus size={17}/> Bắt đầu viết</button><span className="home-shortcut-note"><PenLine size={14}/> Viết tự do, lưu trên thiết bị</span></div>
          </div>
          <div className="home-welcome-visual" aria-hidden="true">
            <div className="welcome-orbit orbit-one"/><div className="welcome-orbit orbit-two"/>
            <div className="welcome-sheet sheet-back"><span/><span/><span/></div>
            <div className="welcome-sheet sheet-front"><div className="welcome-sheet-dot"/><span/><span/><i/></div>
            <div className="welcome-pen"><PenLine size={27}/></div>
            <div className="welcome-sticker">mực <span>✳</span></div>
          </div>
        </section>

        {error&&<p className="home-error" role="alert">{error}</p>}
        {notice&&<p className="home-notice" role="status">{notice}</p>}

        <section className="home-library-section">
          <div className="home-section-heading"><div><span className="home-section-kicker">NƠI Ý TƯỞNG ĐƯỢC LƯU LẠI</span><h2>{query?'Kết quả tìm kiếm':'Bài viết gần đây'}</h2><p>{query?`Đang tìm “${query}”`:'Các bảng viết được lưu trên thiết bị của bạn.'}</p></div><div className="home-count-pill"><FileText size={15}/><span>{visible.length} bài viết</span></div></div>
          <div className="home-library">
            {visible.length?<div className="home-grid">{visible.map((project,index)=><article className="home-card" key={project.id}>
              <button className="home-card-open" onClick={()=>onOpen(project.id)} aria-label={`Mở ${project.title}`}>
                <div className="home-preview-wrap"><div className={'home-paper '+(project.background==='grid'?'grid':project.background==='dotted'?'dotted':project.background==='black'?'black':'lined')}><span className="paper-edge"/><span className="home-paper-index">{String(index+1).padStart(2,'0')}</span><span className="home-paper-mark"/></div><span className="home-open-arrow"><ArrowUpRight size={16}/></span></div>
                <div className="home-card-info"><strong title={project.title}>{project.title}</strong><div className="home-card-meta"><span><BookOpen size={13}/>{project.pageCount} trang</span><time><Clock3 size={13}/>{date(project.updatedAt)}</time></div></div>
              </button>
              <button className="home-card-more" aria-label={`Tùy chọn ${project.title}`} title="Tùy chọn" onClick={()=>setMenu(menu===project.id?null:project.id)}><MoreHorizontal size={19}/></button>
              {menu===project.id&&<div className="home-card-menu" role="menu"><div className="home-menu-heading">TÙY CHỌN BẢNG</div><button role="menuitem" onClick={()=>{setName(project.title);setDialog({kind:'rename',id:project.id,title:project.title});setMenu(null)}}><PenLine size={15}/> Đổi tên</button><button role="menuitem" onClick={()=>{onDuplicate(project.id);setMenu(null)}}><Copy size={15}/> Nhân đôi</button><button role="menuitem" className="danger" onClick={()=>{setDialog({kind:'delete',id:project.id,title:project.title});setMenu(null)}}><Trash2 size={15}/> Xóa bảng</button></div>}
            </article>)}</div>:<div className="home-empty"><div className="home-empty-icon"><PenLine size={26}/></div><strong>{query?'Chưa tìm thấy bảng phù hợp':'Sảnh đang còn trống'}</strong><p>{query?'Thử một từ khóa khác.':'Tạo bảng đầu tiên để bắt đầu lưu ghi chú, bài giảng và ý tưởng.'}</p>{query?<button onClick={()=>setQuery('')}>Xóa tìm kiếm</button>:<button onClick={createDialog}><Plus size={16}/> Tạo bảng đầu tiên</button>}</div>}
          </div>
        </section>
        <footer className="home-footer"><span className="home-footer-mark">M</span><span>Lớp học Mực</span><i/> <span>Không gian viết của bạn, theo cách của bạn.</span></footer>
      </div>
    </main>

    {dialog&&<div className="home-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDialog(null)}}><form className="home-dialog" onSubmit={submit}><div className="home-dialog-top"><h2>{dialog.kind==='create'?'Tạo bảng mới':dialog.kind==='rename'?'Đổi tên bảng':'Xóa bảng?'}</h2><button type="button" title="Đóng" onClick={()=>setDialog(null)}><X size={18}/></button></div>{dialog.kind==='delete'?<p>Xóa “{dialog.title}” và tất cả các trang trong bảng này? Không thể hoàn tác.</p>:<label>Tên bảng<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Ví dụ: Hóa học 12" maxLength={120}/></label>}<div className="home-dialog-actions"><button type="button" onClick={()=>setDialog(null)}>Hủy</button><button className={dialog.kind==='delete'?'danger':'primary'} type="submit">{dialog.kind==='delete'?'Xóa bảng':dialog.kind==='create'?'Tạo và mở':'Lưu tên'}</button></div></form></div>}

    {profileOpen&&<div className="home-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setProfileOpen(false)}}><form className="home-dialog home-profile-dialog" onSubmit={saveProfile}><div className="home-dialog-top"><div><span className="home-section-kicker">CÁ NHÂN HÓA</span><h2>Hồ sơ của bạn</h2></div><button type="button" title="Đóng" onClick={()=>setProfileOpen(false)}><X size={18}/></button></div>
      <div className="home-avatar-editor"><button className="home-avatar home-avatar-large" type="button" onClick={()=>avatarInput.current?.click()} title="Chọn ảnh đại diện">{avatarDraft?<img src={avatarDraft} alt="Ảnh đại diện xem trước"/>:<span>{initials(profileName)}</span>}<i><Camera size={14}/></i></button><div><strong>Ảnh đại diện</strong><p>Ảnh được cắt vuông và lưu nhỏ gọn trên máy.</p><button type="button" className="home-choose-avatar" onClick={()=>avatarInput.current?.click()}><ImagePlus size={15}/> Chọn ảnh</button>{avatarDraft&&<button type="button" className="home-remove-avatar" onClick={()=>setAvatarDraft('')}>Gỡ ảnh</button>}<input ref={avatarInput} type="file" accept="image/*" hidden onChange={handleAvatar}/></div></div>
      <label className="home-profile-name-field">Tên hiển thị<input autoFocus value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder="Tên của bạn" maxLength={36}/></label>
      <p className="home-profile-local-note">Hồ sơ này chỉ lưu trên thiết bị hiện tại, chưa đồng bộ sang máy khác.</p>{profileError&&<p className="home-profile-error" role="alert">{profileError}</p>}
      <div className="home-dialog-actions"><button type="button" onClick={()=>setProfileOpen(false)}>Hủy</button><button className="primary" type="submit"><Check size={15}/> Lưu hồ sơ</button></div>
    </form></div>}
  </div>;
}
