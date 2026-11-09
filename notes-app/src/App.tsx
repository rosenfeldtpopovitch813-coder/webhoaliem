import {useCallback,useEffect,useState} from 'react';
import Studio from './Studio';
import Home from './pages/Home';
import {projectStore,ProjectRecord,ProjectSummary} from './services/projectStore';
import {BoardDocument} from './types/board';
import {createDefaultExamPaper} from './components/ExamPaper/examTemplates';

export default function App(){
  const [projects,setProjects]=useState<ProjectSummary[]>([]);
  const [active,setActive]=useState<ProjectRecord|null>(null);
  const [openInExamMode,setOpenInExamMode]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const refresh=useCallback(async()=>setProjects(await projectStore.list()),[]);
  const open=useCallback(async(id:string,examMode=false)=>{
    try{
      setError('');
      const project=await projectStore.load(id);
      if(examMode&&!project.document.examPaper){
        project.document={
          ...project.document,
          examPaper:createDefaultExamPaper(project.document.title||'Đề kiểm tra')
        };
        await projectStore.save(project.id,project.document);
      }
      setOpenInExamMode(examMode);
      setActive(project);
      window.location.hash=examMode?`/project/${id}/exam`:`/project/${id}`;
    }
    catch{setError('Không mở được bài viết. Hãy thử lại.');setActive(null);setOpenInExamMode(false);window.location.hash='/'}
  },[]);
  const home=useCallback(async()=>{setActive(null);setOpenInExamMode(false);window.location.hash='/';try{await refresh()}catch{setError('Không tải được danh sách bài viết.')}},[refresh]);
  const save=useCallback(async(id:string,document:BoardDocument)=>{
    await projectStore.save(id,document);
  },[]);
  const createExam=useCallback(async(title:string)=>{
    try{
      setError('');
      const cleanTitle=title.trim()||'Đề kiểm tra định kỳ';
      const record=await projectStore.create(cleanTitle);
      record.document={
        ...record.document,
        title:cleanTitle,
        examPaper:createDefaultExamPaper(cleanTitle)
      };
      await projectStore.save(record.id,record.document);
      await refresh();
      setOpenInExamMode(true);
      setActive(record);
      window.location.hash=`/project/${record.id}/exam`;
    }catch{
      setError('Không tạo được đề thi mới. Hãy kiểm tra bộ nhớ trình duyệt.');
    }
  },[refresh]);
  const exportBackup=useCallback(async()=>{
    try{
      const backup=await projectStore.exportBackup();
      const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob);const link=document.createElement('a');
      link.href=url;link.download=`lop-hoc-muc-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice('Đã tạo bản sao lưu thư viện. Hãy giữ file JSON ở nơi an toàn.');setError('');
    }catch{setError('Không tạo được bản sao lưu. Hãy kiểm tra bộ nhớ thiết bị.');setNotice('');}
  },[]);
  const importBackup=useCallback(async(file:File)=>{
    try{
      const backup=JSON.parse(await file.text()) as unknown;
      const count=await projectStore.importBackup(backup);await refresh();
      setNotice(`Đã nhập ${count} bài viết. Các bài viết đang có được giữ nguyên.`);setError('');
    }catch(e){setError(e instanceof Error?`Không nhập được bản sao lưu: ${e.message}`:'Không nhập được bản sao lưu.');setNotice('');}
  },[refresh]);
  useEffect(()=>{
    let live=true;
    const syncFromHash=async()=>{
      const hash=window.location.hash;
      if(hash==='#/exam-paper'||hash.startsWith('#/exam-paper?')){
        const list=await projectStore.list();
        const existingExam=list.find(item=>item.hasExamPaper);
        if(existingExam){
          const project=await projectStore.load(existingExam.id);
          if(live){setOpenInExamMode(true);setActive(project);}
          return;
        }
        const created=await projectStore.create('Đề kiểm tra Hóa học 12');
        created.document={
          ...created.document,
          examPaper:createDefaultExamPaper('Đề kiểm tra Hóa học 12')
        };
        await projectStore.save(created.id,created.document);
        const nextList=await projectStore.list();
        if(live){setProjects(nextList);setOpenInExamMode(true);setActive(created);}
        return;
      }
      const examMatch=hash.match(/^#\/project\/([^/]+)\/exam$/);
      if(examMatch?.[1]){
        await open(examMatch[1],true);
        return;
      }
      const id=hash.match(/^#\/project\/([^/]+)$/)?.[1];
      if(id){
        await open(id,false);
        return;
      }
      if(live){setActive(null);setOpenInExamMode(false);}
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
  },[open]);
  const create=async(title:string)=>{try{setError('');const record=await projectStore.create(title);await refresh();setOpenInExamMode(false);setActive(record);window.location.hash=`/project/${record.id}`}catch{setError('Không tạo được bài viết mới. Hãy kiểm tra bộ nhớ trình duyệt.')}};
  const rename=async(id:string,title:string)=>{try{await projectStore.rename(id,title);await refresh()}catch{setError('Không đổi được tên bài viết.')}};
  const duplicate=async(id:string)=>{try{await projectStore.duplicate(id);await refresh()}catch{setError('Không nhân đôi được bài viết.')}};
  const remove=async(id:string)=>{try{await projectStore.remove(id);await refresh()}catch{setError('Không xóa được bài viết.')}};
  if(loading)return <div className="home-loading">Đang mở thư viện bài viết…</div>;
  return active?<Studio key={active.id} projectId={active.id} initialDoc={active.document} initialExamOpen={openInExamMode} onSave={save} onHome={home}/>:
    <Home projects={projects} error={error} notice={notice} onOpen={id=>open(id,false)} onOpenExam={id=>open(id,true)} onCreate={create} onCreateExam={createExam} onRename={rename} onDuplicate={duplicate} onDelete={remove} onExportBackup={exportBackup} onImportBackup={importBackup}/>;
}
