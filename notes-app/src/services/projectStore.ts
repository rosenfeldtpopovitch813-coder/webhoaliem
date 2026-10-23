import {BoardDocument,initialDocument} from '../types/board';
import {localDocumentStore} from './documentStore';
import {docImageWeight as docImageWeightLocal} from '../utils/docWeight';

const DATABASE='muc-classroom';
const STORE='documents';
const INDEX_KEY='muc-project-index-v2';
const projectKey=(id:string)=>`muc-project:${id}`;
const emergencyKey=(id:string)=>`muc-emergency-project:${id}`;
const tombstoneKey=(key:string)=>`muc-deleted:${key}`;
function isTombstoned(key:string):boolean{try{return localStorage.getItem(tombstoneKey(key))==='1'}catch{return false}}
const EMERGENCY_LIMIT=2.5*1024*1024;

export type ProjectSummary={id:string;title:string;pageCount:number;updatedAt:number;createdAt:number;background:string};
export type ProjectRecord={id:string;document:BoardDocument;createdAt:number;updatedAt:number};
type ProjectIndex={version:2;projects:ProjectSummary[]};

function openDatabase():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db)};request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('IndexedDB bị chặn bởi tab khác'));
  });
}

// Khóa đã phải ghi tạm vào localStorage vì IndexedDB lỗi: đọc lại phải ưu tiên bản này, nếu không sẽ đọc nhầm bản cũ.
const fallbackKeys=new Set<string>();
function readFallback<T>(key:string):T|undefined{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:undefined}catch{return undefined}}

// Trình duyệt (nhất là Safari/iPad) có thể đóng kết nối IndexedDB giữa chừng; thử lại bằng kết nối mới trước khi chịu thua.
async function withRetry<T>(work:()=>Promise<T>):Promise<T>{
  let last:unknown;
  for(let attempt=0;attempt<3;attempt++){
    try{return await work()}catch(e){last=e;await new Promise(r=>setTimeout(r,60*(attempt+1)))}
  }
  throw last;
}

async function read<T>(key:string):Promise<T|undefined>{
  if(isTombstoned(key))return undefined;
  // localStorage is only used here as the last-resort copy of a failed IndexedDB write.
  // Its presence must take precedence even after F5, when the in-memory fallbackKeys set resets.
  const fallback=readFallback<T>(key);
  if(fallback!==undefined)return fallback;
  try{
    const value=await withRetry(async()=>{
      const db=await openDatabase();
      return await new Promise<T|undefined>((resolve,reject)=>{
        const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(key);
        let result:T|undefined;
        request.onsuccess=()=>{result=request.result as T|undefined};
        request.onerror=()=>reject(request.error);
        tx.oncomplete=()=>{db.close();resolve(result)};
        tx.onerror=()=>{db.close();reject(tx.error)};
        tx.onabort=()=>{db.close();reject(tx.error||new Error('IndexedDB read aborted'))};
      });
    });
    return value!==undefined?value:fallback;
  }catch{
    return fallback;
  }
}

async function writeMany(entries:{key:string;value?:unknown;remove?:boolean}[]):Promise<void>{
  try{
    await withRetry(async()=>{
      const db=await openDatabase();
      await new Promise<void>((resolve,reject)=>{
        let tx:IDBTransaction;
        try{tx=db.transaction(STORE,'readwrite');const store=tx.objectStore(STORE);for(const entry of entries)entry.remove?store.delete(entry.key):store.put(entry.value,entry.key)}
        catch(e){db.close();reject(e);return}
        tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)};tx.onabort=()=>{db.close();reject(tx.error||new Error('IndexedDB transaction aborted'))};
      });
    });
    // IndexedDB đã nhận dữ liệu. Xóa bản localStorage cùng khóa vô điều kiện:
    // fallbackKeys chỉ sống trong bộ nhớ và bị reset sau F5, nên không thể dùng nó
    // làm bằng chứng duy nhất rằng bản dự phòng đã tồn tại từ lần chạy trước.
    for(const entry of entries){fallbackKeys.delete(entry.key);try{localStorage.removeItem(entry.key);localStorage.removeItem(tombstoneKey(entry.key))}catch{/* ignore */}}
  }catch{
    try{for(const entry of entries){
      if(entry.remove){localStorage.removeItem(entry.key);localStorage.setItem(tombstoneKey(entry.key),'1')}
      else {localStorage.removeItem(tombstoneKey(entry.key));localStorage.setItem(entry.key,JSON.stringify(entry.value))}
      fallbackKeys.add(entry.key)
    }}
    catch{throw new Error('Hết dung lượng lưu trên thiết bị (quota full)')}
  }
}

function summary(record:ProjectRecord):ProjectSummary{
  const page=record.document.pages[0];
  return {id:record.id,title:record.document.title||'Không có tên',pageCount:record.document.pages.length,
    updatedAt:record.updatedAt,createdAt:record.createdAt,background:page?.background||'lined'};
}

function isProjectRecord(value:unknown):value is ProjectRecord{
  if(!value||typeof value!=='object')return false;
  const record=value as Partial<ProjectRecord>;
  return typeof record.id==='string'&&!!record.document&&typeof record.document==='object'&&
    Array.isArray(record.document.pages)&&typeof record.createdAt==='number'&&typeof record.updatedAt==='number';
}
function readEmergency(id:string):{savedAt:number;document:BoardDocument}|undefined{
  try{
    const raw=localStorage.getItem(emergencyKey(id));if(!raw)return undefined;
    const parsed=JSON.parse(raw) as {savedAt?:unknown;document?:unknown};
    if(typeof parsed.savedAt==='number'&&parsed.document&&typeof parsed.document==='object'&&
      Array.isArray((parsed.document as BoardDocument).pages))
      return {savedAt:parsed.savedAt,document:parsed.document as BoardDocument};
  }catch{/* Storage can be unavailable or the journal can be malformed. */}
  return undefined;
}

// Rebuild missing library metadata from the durable project records and recovery journals.
// Without this, a missing/partially-written index could make saved boards appear to be gone.
async function scanProjectRecords():Promise<ProjectRecord[]>{
  const found=new Map<string,ProjectRecord>();
  try{
    const db=await openDatabase();
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const request=tx.objectStore(STORE).openCursor();
      request.onsuccess=()=>{
        const cursor=request.result;
        if(!cursor)return;
        const key=String(cursor.key);
        if(key.startsWith('muc-project:')&&!isTombstoned(key)&&isProjectRecord(cursor.value))found.set(cursor.value.id,cursor.value);
        cursor.continue();
      };
      request.onerror=()=>reject(request.error);
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Index scan aborted'));
    }).finally(()=>db.close());
  }catch{/* Continue with localStorage records below. */}
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);if(!key)continue;
      if(key.startsWith('muc-project:')){
        if(isTombstoned(key))continue;
        try{const parsed=JSON.parse(localStorage.getItem(key)||'null');if(isProjectRecord(parsed)){
          const old=found.get(parsed.id);if(!old||parsed.updatedAt>=old.updatedAt)found.set(parsed.id,parsed);
        }}catch{/* Skip corrupt individual records. */}
      }else if(key.startsWith('muc-emergency-project:')){
        const id=key.slice('muc-emergency-project:'.length);if(isTombstoned(projectKey(id)))continue;
        const emergency=readEmergency(id);if(!emergency)continue;
        const old=found.get(id);
        if(!old||emergency.savedAt>=old.updatedAt){
          found.set(id,{id,document:emergency.document,createdAt:old?.createdAt||emergency.savedAt,updatedAt:emergency.savedAt});
        }
      }
    }
  }catch{/* localStorage may be disabled. */}
  return [...found.values()].sort((a,b)=>b.updatedAt-a.updatedAt);
}

async function findUnindexedProjectIds(knownIds:Set<string>):Promise<string[]>{
  const ids=new Set<string>();
  try{
    const db=await openDatabase();
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).openKeyCursor();
      request.onsuccess=()=>{
        const cursor=request.result;if(!cursor)return;
        const key=String(cursor.key);if(key.startsWith('muc-project:')&&!isTombstoned(key))ids.add(key.slice('muc-project:'.length));
        cursor.continue();
      };
      request.onerror=()=>reject(request.error);
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Project key scan aborted'));
    }).finally(()=>db.close());
  }catch{/* Continue with localStorage fallback keys. */}
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);if(!key)continue;
      if(key.startsWith('muc-project:')&&!isTombstoned(key))ids.add(key.slice('muc-project:'.length));
      if(key.startsWith('muc-emergency-project:')){const id=key.slice('muc-emergency-project:'.length);if(!isTombstoned(projectKey(id)))ids.add(id)}
    }
  }catch{/* localStorage may be disabled. */}
  return [...ids].filter(id=>id&&!knownIds.has(id));
}

let queue:Promise<unknown>=Promise.resolve();
function exclusive<T>(work:()=>Promise<T>):Promise<T>{
  const next=queue.then(work,work);queue=next.then(()=>undefined,()=>undefined);return next;
}

let prepared:Promise<void>|null=null;
function prepare(){
  if(!prepared){
    const work=exclusive(async()=>{
      const existing=await read<ProjectIndex>(INDEX_KEY);
      if(existing?.version===2&&Array.isArray(existing.projects)&&existing.projects.length>0){
        // Even a syntactically valid index can be older than a fallback project record
        // created when the index write failed. Find only orphan keys to avoid loading every board.
        const knownIds=new Set(existing.projects.map(p=>p.id));
        const missingIds=await findUnindexedProjectIds(knownIds);
        if(!missingIds.length)return;
        const recovered:ProjectRecord[]=[];
        for(const id of missingIds){
          const record=await read<ProjectRecord>(projectKey(id));
          if(isProjectRecord(record)){recovered.push(record);continue}
          const emergency=readEmergency(id);
          if(emergency)recovered.push({id,document:emergency.document,createdAt:emergency.savedAt,updatedAt:emergency.savedAt});
        }
        if(recovered.length){
          const merged=[...existing.projects,...recovered.map(summary)].sort((a,b)=>b.updatedAt-a.updatedAt);
          await writeMany([
            ...recovered.map(record=>({key:projectKey(record.id),value:record})),
            {key:INDEX_KEY,value:{version:2,projects:merged} satisfies ProjectIndex},
          ]);
        }
        return;
      }

      // If the index is missing/empty after an interrupted write, recover project records
      // before creating a blank board. The records may still be safely present in IndexedDB.
      const recovered=await scanProjectRecords();
      if(recovered.length){
        const projects=recovered.map(summary);
        await writeMany([
          ...recovered.map(record=>({key:projectKey(record.id),value:record})),
          {key:INDEX_KEY,value:{version:2,projects} satisfies ProjectIndex},
        ]);
        return;
      }
      // Never replace a non-empty index merely because a scan was unavailable.
      if(existing?.version===2&&Array.isArray(existing.projects)&&existing.projects.length>0)return;
      const old=await localDocumentStore.load(),now=Date.now();
      const record:ProjectRecord={id:crypto.randomUUID(),document:old,createdAt:now,updatedAt:now};
      await writeMany([{key:projectKey(record.id),value:record},{key:INDEX_KEY,value:{version:2,projects:[summary(record)]} satisfies ProjectIndex}]);
    });
    prepared=work.catch(error=>{prepared=null;throw error});
  }
  return prepared;
}

async function index(){const value=await read<ProjectIndex>(INDEX_KEY);if(!value)throw Error('Không đọc được danh sách project');return value}
export const projectStore={
  async list():Promise<ProjectSummary[]>{await prepare();return [...(await index()).projects].filter(p=>!isTombstoned(projectKey(p.id))).sort((a,b)=>b.updatedAt-a.updatedAt)},
  async exportBackup(){
    const summaries=await this.list();
    const projects:ProjectRecord[]=[];
    for(const item of summaries)projects.push(await this.load(item.id));
    return {format:'lop-hoc-muc-backup',version:1 as const,exportedAt:Date.now(),projects};
  },
  async importBackup(input:unknown):Promise<number>{
    await prepare();
    if(!input||typeof input!=='object')throw new Error('File không phải bản sao lưu của Lớp học Mực.');
    const backup=input as {format?:unknown;version?:unknown;projects?:unknown};
    if(backup.format!=='lop-hoc-muc-backup'||backup.version!==1||!Array.isArray(backup.projects))
      throw new Error('Sai định dạng hoặc phiên bản bản sao lưu.');
    if(backup.projects.length>2000)throw new Error('Bản sao lưu có quá nhiều bài viết.');
    // Validate the whole file first so malformed JSON is rejected before importing any item.
    const records=backup.projects as unknown[];
    for(let i=0;i<records.length;i++){
      const record=records[i] as {document?:unknown}|null;
      const doc=record?.document as {title?:unknown;pages?:unknown}|undefined;
      if(!doc||typeof doc!=='object'||typeof doc.title!=='string'||!Array.isArray(doc.pages)||
        !doc.pages.every((page)=>!!page&&typeof page==='object'&&Array.isArray((page as {items?:unknown}).items)))
        throw new Error(`Dữ liệu bài viết thứ ${i+1} không hợp lệ.`);
    }
    let imported=0;
    for(const source of records){
      const sourceRecord=source as ProjectRecord;
      const document=structuredClone(sourceRecord.document);
      const created=await this.create(document.title||'Bài viết đã nhập');
      await this.save(created.id,document);
      imported++;
    }
    return imported;
  },
  async load(id:string):Promise<ProjectRecord>{
    await prepare();
    if(isTombstoned(projectKey(id)))throw Error('Project đã bị xóa trên thiết bị');
    const record=await read<ProjectRecord>(projectKey(id));
    const emergency=readEmergency(id);
    if(emergency&&(!record||emergency.savedAt>=(record.updatedAt||0))){
      const recovered:ProjectRecord={...(record||{id,createdAt:emergency.savedAt,updatedAt:emergency.savedAt}),document:emergency.document,updatedAt:emergency.savedAt};
      // Restore newer emergency content even if an older main record still exists.
      // Otherwise each reload would depend on the journal and never repair the primary copy.
      try{
        const current=await index();
        const projects=current.projects.some(p=>p.id===id)?current.projects.map(p=>p.id===id?summary(recovered):p):[summary(recovered),...current.projects];
        await writeMany([{key:projectKey(id),value:recovered},{key:INDEX_KEY,value:{...current,projects}}]);
      }catch{/* The recovered copy is still returned to the editor. */}
      return recovered;
    }
    if(!record)throw Error('Project không còn trên thiết bị');
    return record;
  },
  async create(title:string):Promise<ProjectRecord>{
    await prepare();return exclusive(async()=>{
      const now=Date.now(),document=initialDocument();document.title=title.trim()||'Ghi chú mới';
      const record:ProjectRecord={id:crypto.randomUUID(),document,createdAt:now,updatedAt:now};
      const current=await index();await writeMany([{key:projectKey(record.id),value:record},{key:INDEX_KEY,value:{...current,projects:[summary(record),...current.projects]}}]);
      return record;
    });
  },
  async save(id:string,document:BoardDocument):Promise<void>{
    await prepare();return exclusive(async()=>{
      // Tự phục hồi: nếu danh sách bị thiếu/hỏng hoặc không có project này thì dựng lại thay vì báo lỗi.
      let current:ProjectIndex;try{current=await index()}catch{current={version:2,projects:[]}}
      const savedAt=Date.now();
      const meta=current.projects.find(p=>p.id===id)||{id,title:'',pageCount:0,updatedAt:savedAt,createdAt:savedAt,background:'lined'};
      const record:ProjectRecord={id,document,createdAt:meta.createdAt,updatedAt:meta.updatedAt};
      // Emergency journal is intentionally small so it does not crowd out the main local store.
      // Write it before IndexedDB: if the tab closes mid-transaction, load() can recover it.
      try{
        if(docImageWeightLocal(document)>1.5*1024*1024){localStorage.removeItem(emergencyKey(id));}
        else {
          const snapshot=JSON.stringify({savedAt,document});
          const bytes=typeof Blob!=='undefined'?new Blob([snapshot]).size:snapshot.length*2;
          if(bytes<=EMERGENCY_LIMIT)localStorage.setItem(emergencyKey(id),snapshot);
          else localStorage.removeItem(emergencyKey(id));
        }
      }catch{/* Storage may be disabled/full; IndexedDB remains the primary store. */}
      const updated:ProjectRecord={...record,document,updatedAt:savedAt};
      const projects=current.projects.some(p=>p.id===id)?current.projects.map(p=>p.id===id?summary(updated):p):[summary(updated),...current.projects];
      await writeMany([{key:projectKey(id),value:updated},{key:INDEX_KEY,value:{...current,projects}}]);
      // Đọc lại để xác nhận dữ liệu thật sự đã vào kho (nút Lưu chỉ báo "đã lưu" khi bước này qua).
      const check=await read<ProjectIndex>(INDEX_KEY);
      if(check?.projects.find(p=>p.id===id)?.updatedAt!==savedAt)throw new Error('Không xác nhận được bản lưu trên thiết bị');
    });
  },
  async rename(id:string,title:string):Promise<void>{
    const record=await this.load(id);await this.save(id,{...record.document,title:title.trim()||record.document.title});
  },
  async duplicate(id:string):Promise<ProjectRecord>{
    await prepare();return exclusive(async()=>{
      const original=await this.load(id);
      const now=Date.now(),document=structuredClone(original.document);document.title=`${document.title} — bản sao`;
      const record:ProjectRecord={id:crypto.randomUUID(),document,createdAt:now,updatedAt:now};
      const current=await index();await writeMany([{key:projectKey(record.id),value:record},{key:INDEX_KEY,value:{...current,projects:[summary(record),...current.projects]}}]);
      return record;
    });
  },
  async remove(id:string):Promise<void>{
    await prepare();return exclusive(async()=>{
      const current=await index();await writeMany([{key:projectKey(id),remove:true},{key:INDEX_KEY,value:{...current,projects:current.projects.filter(p=>p.id!==id)}}]);try{localStorage.removeItem(emergencyKey(id))}catch{/* ignore unavailable storage */}
    });
  },
};
