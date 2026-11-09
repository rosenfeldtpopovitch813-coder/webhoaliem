import {useCallback,useEffect,useState} from 'react';
import Studio from './Studio';
import Home from './pages/Home';
import ExamSuite from './pages/ExamSuite';
import {projectStore,ProjectRecord,ProjectSummary} from './services/projectStore';
import {BoardDocument} from './types/board';

function detectExamApp():boolean{
  const params=new URLSearchParams(window.location.search);
  if(params.get('app')==='exam')return true;
  if(params.get('app')==='board')return false;
  return window.location.hash.startsWith('#/exam');
}

export default function App(){
  const [isExamApp,setIsExamApp]=useState<boolean>(()=>detectExamApp());
  const [projects,setProjects]=useState<ProjectSummary[]>([]);
  const [active,setActive]=useState<ProjectRecord|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  useEffect(()=>{
    const checkMode=()=>{setIsExamApp(detectExamApp());};
    window.addEventListener('hashchange',checkMode);
    window.addEventListener('popstate',checkMode);
    return()=>{
      window.removeEventListener('hashchange',checkMode);
      window.removeEventListener('popstate',checkMode);
    };
  },[]);

  const refresh=useCallback(async()=>setProjects(await projectStore.list()),[]);
  const open=useCallback(async(id:string)=>{
    try{
      setError('');
      const project=await projectStore.load(id);
      setActive(project);
      window.location.hash=`/project/${id}`;
    }catch{
      setError('Không mở được bảng vẽ. Hãy thử lại.');
      setActive(null);
      window.location.hash='/';
    }
  },[]);
  const home=useCallback(async()=>{
    setActive(null);
    window.location.hash='/';
    try{await refresh();}catch{setError('Không tải được danh sách bảng vẽ.');}
  },[refresh]);
  const save=useCallback(async(id:string,document:BoardDocument)=>{
    await projectStore.save(id,document);
  },[]);

  const exportBackup=useCallback(async()=>{
    try{
      const backup=await projectStore.exportBackup();
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob);const link=document.createElement('a');
      link.href=url;link.download=`lop-hoc-muc-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice('Đã tạo bản sao lưu thư viện bảng vẽ.');setError('');
    }catch{setError('Không tạo được bản sao lưu. Hãy kiểm tra bộ nhớ thiết bị.');setNotice('');}
  },[]);

  const importBackup=useCallback(async(file:File)=>{
    try{
      const backup=JSON.parse(await file.text()) as unknown;
      const count=await projectStore.importBackup(backup);await refresh();
      setNotice(`Đã nhập ${count} bảng vẽ.`);setError('');
    }catch(e){setError(e instanceof Error?`Không nhập được bản sao lưu: ${e.message}`:'Không nhập được bản sao lưu.');setNotice('');}
  },[refresh]);

  useEffect(()=>{
    if(isExamApp)return;
    let live=true;
    const syncFromHash=async()=>{
      const id=window.location.hash.match(/^#\/project\/([^/]+)$/)?.[1];
      if(id){await open(id);return;}
      if(live)setActive(null);
    };
    (async()=>{
      try{
        const list=await projectStore.list();if(!live)return;setProjects(list);
        await syncFromHash();
      }catch{if(live)setError('Không tải được dữ liệu đã lưu trên thiết bị.')}finally{if(live)setLoading(false)}
    })();
    const onHash=()=>{void syncFromHash();};
    window.addEventListener('hashchange',onHash);
    return()=>{live=false;window.removeEventListener('hashchange',onHash)};
  },[open,isExamApp]);

  if(isExamApp){
    return <ExamSuite/>;
  }

  const create=async(title:string)=>{try{setError('');const record=await projectStore.create(title);await refresh();setActive(record);window.location.hash=`/project/${record.id}`}catch{setError('Không tạo được bảng mới. Hãy kiểm tra bộ nhớ trình duyệt.')}};
  const rename=async(id:string,title:string)=>{try{await projectStore.rename(id,title);await refresh()}catch{setError('Không đổi được tên bảng.')}};
  const duplicate=async(id:string)=>{try{await projectStore.duplicate(id);await refresh()}catch{setError('Không nhân đôi được bảng.')}};
  const remove=async(id:string)=>{try{await projectStore.remove(id);await refresh()}catch{setError('Không xóa được bảng.')}};

  if(loading)return <div className="home-loading">Đang mở thư viện bảng vẽ…</div>;
  return active
    ?<Studio key={active.id} projectId={active.id} initialDoc={active.document} onSave={save} onHome={home}/>
    :<Home projects={projects} error={error} notice={notice} onOpen={open} onCreate={create} onRename={rename} onDuplicate={duplicate} onDelete={remove} onExportBackup={exportBackup} onImportBackup={importBackup}/>;
}
