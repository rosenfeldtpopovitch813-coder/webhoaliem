import { ExamPaperDocument } from '../types/board';
import { createDefaultExamPaper } from '../components/ExamPaper/examTemplates';
import { projectStore } from './projectStore';

const DB_NAME = 'htvvm-exams-db';
const STORE_NAME = 'exams';
const INDEX_KEY = 'htvvm-exam-index-v1';
const MIGRATED_KEY = 'htvvm-exam-migrated-from-boards-v1';
const itemKey = (id: string) => `htvvm-exam:${id}`;

export type ExamSummary = {
  id: string;
  title: string;
  examCode: string;
  questionCount: number;
  createdAt: number;
  updatedAt: number;
};

export type ExamRecord = {
  id: string;
  title: string;
  paper: ExamPaperDocument;
  createdAt: number;
  updatedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  try {
    const db = await openDb();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      let out: T | undefined;
      req.onsuccess = () => { out = req.result as T | undefined; };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => { db.close(); resolve(out); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    return undefined;
  }
}

async function idbWrite(entries: Array<{ key: string; value?: unknown; remove?: boolean }>): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const e of entries) {
        if (e.remove) store.delete(e.key);
        else store.put(e.value, e.key);
      }
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
    for (const e of entries) {
      try { localStorage.removeItem(e.key); } catch { /* ignore */ }
    }
  } catch {
    for (const e of entries) {
      if (e.remove) localStorage.removeItem(e.key);
      else localStorage.setItem(e.key, JSON.stringify(e.value));
    }
  }
}

function toSummary(rec: ExamRecord): ExamSummary {
  const questionCount = (rec.paper.blocks || []).filter(b => b.type === 'question').length;
  return {
    id: rec.id,
    title: rec.title || rec.paper.header?.examTitle || 'Đề kiểm tra',
    examCode: rec.paper.header?.examCode || '101',
    questionCount,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt
  };
}

let migratedPromise: Promise<void> | null = null;
async function ensurePrepared(): Promise<void> {
  if (!migratedPromise) {
    migratedPromise = (async () => {
      const existing = await idbGet<ExamSummary[]>(INDEX_KEY);
      let list = Array.isArray(existing) ? existing : [];

      let alreadyMigrated = false;
      try { alreadyMigrated = localStorage.getItem(MIGRATED_KEY) === '1'; } catch { /* ignore */ }

      if (!alreadyMigrated) {
        try {
          const boards = await projectStore.list();
          const writes: Array<{ key: string; value: unknown }> = [];
          for (const b of boards) {
            if (!b.hasExamPaper) continue;
            const full = await projectStore.load(b.id).catch(() => null);
            if (!full?.document.examPaper) continue;
            if (list.some(item => item.id === full.id)) continue;
            const rec: ExamRecord = {
              id: full.id,
              title: full.document.title || full.document.examPaper.header.examTitle || 'Đề kiểm tra',
              paper: structuredClone(full.document.examPaper),
              createdAt: full.createdAt,
              updatedAt: full.updatedAt
            };
            writes.push({ key: itemKey(rec.id), value: rec });
            list = [toSummary(rec), ...list];
          }
          if (writes.length) {
            await idbWrite([...writes, { key: INDEX_KEY, value: list }]);
          }
          localStorage.setItem(MIGRATED_KEY, '1');
        } catch { /* ignore migration errors */ }
      }

      if (!existing && list.length === 0) {
        await idbWrite([{ key: INDEX_KEY, value: [] }]);
      }
    })();
  }
  return migratedPromise;
}

export const examStore = {
  async list(): Promise<ExamSummary[]> {
    await ensurePrepared();
    const list = (await idbGet<ExamSummary[]>(INDEX_KEY)) || [];
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async load(id: string): Promise<ExamRecord> {
    await ensurePrepared();
    const rec = await idbGet<ExamRecord>(itemKey(id));
    if (!rec) throw new Error('Không tìm thấy đề thi trên thiết bị.');
    return rec;
  },

  async create(title: string): Promise<ExamRecord> {
    await ensurePrepared();
    const clean = title.trim() || 'Đề kiểm tra định kỳ';
    const now = Date.now();
    const paper = createDefaultExamPaper(clean);
    const rec: ExamRecord = {
      id: crypto.randomUUID(),
      title: clean,
      paper,
      createdAt: now,
      updatedAt: now
    };
    const list = await this.list();
    await idbWrite([
      { key: itemKey(rec.id), value: rec },
      { key: INDEX_KEY, value: [toSummary(rec), ...list] }
    ]);
    return rec;
  },

  async save(id: string, paper: ExamPaperDocument): Promise<void> {
    await ensurePrepared();
    const now = Date.now();
    const old = await idbGet<ExamRecord>(itemKey(id));
    const title = paper.header?.examTitle?.trim() || old?.title || 'Đề kiểm tra';
    const updated: ExamRecord = {
      id,
      title,
      paper: { ...paper, updatedAt: now },
      createdAt: old?.createdAt || now,
      updatedAt: now
    };
    const list = await this.list();
    const nextList = list.some(x => x.id === id)
      ? list.map(x => (x.id === id ? toSummary(updated) : x))
      : [toSummary(updated), ...list];
    await idbWrite([
      { key: itemKey(id), value: updated },
      { key: INDEX_KEY, value: nextList }
    ]);
  },

  async rename(id: string, title: string): Promise<void> {
    const rec = await this.load(id);
    const clean = title.trim() || rec.title;
    rec.paper.header.examTitle = clean.toUpperCase();
    await this.save(id, rec.paper);
  },

  async duplicate(id: string): Promise<ExamRecord> {
    const orig = await this.load(id);
    const now = Date.now();
    const paper = structuredClone(orig.paper);
    const copyTitle = `${orig.title} — Bản sao`;
    paper.header.examTitle = copyTitle.toUpperCase();
    const rec: ExamRecord = {
      id: crypto.randomUUID(),
      title: copyTitle,
      paper,
      createdAt: now,
      updatedAt: now
    };
    const list = await this.list();
    await idbWrite([
      { key: itemKey(rec.id), value: rec },
      { key: INDEX_KEY, value: [toSummary(rec), ...list] }
    ]);
    return rec;
  },

  async remove(id: string): Promise<void> {
    await ensurePrepared();
    const list = await this.list();
    await idbWrite([
      { key: itemKey(id), remove: true },
      { key: INDEX_KEY, value: list.filter(x => x.id !== id) }
    ]);
  },

  async exportBackup() {
    const summaries = await this.list();
    const exams: ExamRecord[] = [];
    for (const s of summaries) {
      const r = await idbGet<ExamRecord>(itemKey(s.id));
      if (r) exams.push(r);
    }
    return { format: 'htvvm-exams-backup', version: 1 as const, exportedAt: Date.now(), exams };
  },

  async importBackup(input: unknown): Promise<number> {
    await ensurePrepared();
    if (!input || typeof input !== 'object') throw new Error('Tệp sao lưu không hợp lệ.');
    const obj = input as { format?: unknown; exams?: unknown };
    if (obj.format !== 'htvvm-exams-backup' || !Array.isArray(obj.exams)) {
      throw new Error('Không đúng định dạng tệp sao lưu Đề thi A4.');
    }
    let count = 0;
    for (const raw of obj.exams) {
      const r = raw as Partial<ExamRecord>;
      if (!r?.paper || !Array.isArray(r.paper.blocks)) continue;
      const created = await this.create(r.title || r.paper.header?.examTitle || 'Đề đã nhập');
      await this.save(created.id, structuredClone(r.paper));
      count++;
    }
    return count;
  }
};
