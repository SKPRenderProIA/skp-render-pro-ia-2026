import fs from 'fs';
import path from 'path';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from './firebase';

export interface ClientLicenseRecord {
  id: string;
  clientName: string;
  clientContact?: string;
  notes?: string;
  pcId: string;
  validUntil: string;
  licenseKey: string;
  createdAt: string;
  status: 'active' | 'revoked';
  ownerId?: string;
}

const LICENSES_FILE_PATH = path.resolve(process.cwd(), 'data', 'licenses.json');
const DELETED_LICENSES_FILE_PATH = path.resolve(process.cwd(), 'data', 'deleted_licenses.json');

// Gerenciamento de IDs excluídos (Tombstones) para impedir ressurreição por cache antigo ou arquivo restaurado
function loadDeletedLicenseIds(): Set<string> {
  try {
    if (fs.existsSync(DELETED_LICENSES_FILE_PATH)) {
      const raw = fs.readFileSync(DELETED_LICENSES_FILE_PATH, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return new Set(parsed.map(id => String(id).trim()));
        }
      }
    }
  } catch (err: any) {
    console.warn('[STORAGE] Aviso ao ler deleted_licenses.json:', err?.message || err);
  }
  return new Set();
}

function persistDeletedLicenseIds(deletedSet: Set<string>): void {
  try {
    const dir = path.dirname(DELETED_LICENSES_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DELETED_LICENSES_FILE_PATH, JSON.stringify(Array.from(deletedSet), null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[STORAGE] Erro ao salvar deleted_licenses.json:', err?.message || err);
  }
}

let deletedIdsCache: Set<string> = loadDeletedLicenseIds();

export function addDeletedLicenseId(id: string): void {
  if (!id) return;
  deletedIdsCache.add(id);
  persistDeletedLicenseIds(deletedIdsCache);
}

export function removeDeletedLicenseId(id: string): void {
  if (!id) return;
  if (deletedIdsCache.has(id)) {
    deletedIdsCache.delete(id);
    persistDeletedLicenseIds(deletedIdsCache);
  }
}

// Sincroniza tombstones com o Firestore para que exclusões sejam permanentes mesmo em novos containers
async function syncDeletedIdsFromFirestore(): Promise<void> {
  try {
    const colRef = collection(db, 'deleted_licenses');
    const snap = await withTimeout(getDocs(colRef), 4000, null as any);
    if (snap && snap.docs) {
      let changed = false;
      snap.docs.forEach((d: any) => {
        const tid = String(d.id || '').trim();
        if (tid && !deletedIdsCache.has(tid)) {
          deletedIdsCache.add(tid);
          changed = true;
        }
      });
      if (changed) {
        persistDeletedLicenseIds(deletedIdsCache);
      }
    }
  } catch (err: any) {
    console.warn('[FIRESTORE] Sincronização de tombstones offline:', err?.message || err);
  }
}

// Carregamento do disco filtrando IDs excluídos
function loadLicensesFromDisk(): ClientLicenseRecord[] {
  try {
    if (fs.existsSync(LICENSES_FILE_PATH)) {
      const raw = fs.readFileSync(LICENSES_FILE_PATH, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((r: any) => r && r.id && !deletedIdsCache.has(r.id));
        }
      }
    }
  } catch (err: any) {
    console.warn('[STORAGE] Aviso ao ler licenses.json do disco:', err?.message || err);
  }
  return [];
}

// Persistência síncrona imediata no disco
function persistLicensesToDisk(records: ClientLicenseRecord[]): void {
  try {
    const dir = path.dirname(LICENSES_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const cleanRecords = records.filter(r => r && r.id && !deletedIdsCache.has(r.id));
    fs.writeFileSync(LICENSES_FILE_PATH, JSON.stringify(cleanRecords, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[STORAGE] Erro crítico ao salvar licenses.json no disco:', err?.message || err);
  }
}

// Helper para executar promessas com limite de tempo
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ]).catch(() => fallback);
}

// Cache local em memória
let licenseCache: ClientLicenseRecord[] = loadLicensesFromDisk();
let isSynced = false;

export async function initFirestoreSync(): Promise<void> {
  deletedIdsCache = loadDeletedLicenseIds();
  await syncDeletedIdsFromFirestore();
  licenseCache = loadLicensesFromDisk().filter(l => !deletedIdsCache.has(l.id));
  console.log(`[STORAGE] ${licenseCache.length} licenças carregadas do armazenamento local.`);

  try {
    const records = await withTimeout(getLicensesFromDb(), 6000, licenseCache);
    isSynced = true;
    console.log(`[FIRESTORE] Sincronização em nuvem concluída. Total ativo: ${records.length} licenças.`);
  } catch (err: any) {
    console.warn('[FIRESTORE] Sincronização inicial operando com cache local:', err?.message || err);
  }
}

export async function getLicensesFromDb(): Promise<ClientLicenseRecord[]> {
  // Sincroniza exclusões conhecidas antes de buscar lista
  await syncDeletedIdsFromFirestore();

  try {
    const colRef = collection(db, 'licenses');
    const fetchPromise = getDocs(colRef).then(async (snapshot) => {
      const records: ClientLicenseRecord[] = [];
      const cleanupPromises: Promise<void>[] = [];

      snapshot.forEach((d) => {
        const data = d.data() as ClientLicenseRecord;
        const id = data.id || d.id;
        
        // Se a licença foi excluída pelo usuário, exclui definitivamente do Firestore e ignora
        if (deletedIdsCache.has(id)) {
          cleanupPromises.push(deleteDoc(d.ref).catch(() => {}));
          return;
        }

        records.push({
          ...data,
          id,
        });
      });

      if (cleanupPromises.length > 0) {
        Promise.all(cleanupPromises).catch(() => {});
      }

      return records;
    });

    const remoteRecords = await withTimeout<ClientLicenseRecord[] | null>(fetchPromise, 5000, null);
    if (remoteRecords !== null) {
      licenseCache = remoteRecords.filter(r => !deletedIdsCache.has(r.id));
      persistLicensesToDisk(licenseCache);
      return licenseCache;
    }
  } catch (err: any) {
    console.warn('[FIRESTORE] Consulta ao Firestore indisponível, usando armazenamento local:', err?.message || err);
  }

  licenseCache = loadLicensesFromDisk().filter(r => !deletedIdsCache.has(r.id));
  return licenseCache;
}

export async function saveLicenseToDb(record: ClientLicenseRecord): Promise<void> {
  // Se estava na lista de excluídos, remove pois foi recriada/reativada intencionalmente
  removeDeletedLicenseId(record.id);

  // Remove tombstone no Firestore caso existisse
  try {
    const tombRef = doc(db, 'deleted_licenses', record.id);
    deleteDoc(tombRef).catch(() => {});
  } catch (_) {}

  // 1. Atualização imediata em memória
  const idx = licenseCache.findIndex((l) => l.id === record.id || (l.pcId && l.pcId === record.pcId));
  if (idx >= 0) {
    licenseCache[idx] = record;
  } else {
    licenseCache.push(record);
  }

  // 2. Persistência imediata no arquivo JSON local
  persistLicensesToDisk(licenseCache);
  console.log(`[STORAGE] Licença para "${record.clientName}" salva no disco com sucesso.`);

  // 3. Sincronização no Firestore com await
  try {
    const docRef = doc(db, 'licenses', record.id);
    await withTimeout(
      setDoc(docRef, record, { merge: true }),
      5000,
      undefined
    );
    console.log(`[FIRESTORE] Licença ${record.id} sincronizada na nuvem com sucesso.`);
  } catch (err: any) {
    console.warn(`[FIRESTORE] Não foi possível espelhar na nuvem no momento (${err?.message || err}). Licença garantida no disco local.`);
  }
}

export async function deleteLicenseFromDb(id: string): Promise<boolean> {
  if (!id) return false;

  // 1. Marca no tombstone persistente local e em memória
  addDeletedLicenseId(id);

  // 2. Remove da memória
  const targetRecord = licenseCache.find(l => l.id === id);
  licenseCache = licenseCache.filter((l) => l.id !== id);

  // 3. Persiste remoção no disco
  persistLicensesToDisk(licenseCache);
  console.log(`[STORAGE] Licença ${id} removida do cache e disco.`);

  // 4. Grava tombstone persistente no Firestore e exclui doc da coleção licenses
  try {
    const tombRef = doc(db, 'deleted_licenses', id);
    await withTimeout(setDoc(tombRef, { id, deletedAt: new Date().toISOString() }), 4000, undefined);
  } catch (_) {}

  try {
    const docRef = doc(db, 'licenses', id);
    await withTimeout(deleteDoc(docRef), 5000, undefined);
    console.log(`[FIRESTORE] Licença ${id} removida com sucesso da nuvem.`);

    // Se houver algum outro registro no Firestore com o mesmo pcId (duplicatas antigas), remove também
    if (targetRecord && targetRecord.pcId) {
      try {
        const colRef = collection(db, 'licenses');
        const q = query(colRef, where('pcId', '==', targetRecord.pcId.trim()));
        const snap = await withTimeout(getDocs(q), 3000, null as any);
        if (snap && snap.docs) {
          for (const d of snap.docs) {
            if (d.id !== id) {
              addDeletedLicenseId(d.id);
              const tombOther = doc(db, 'deleted_licenses', d.id);
              await setDoc(tombOther, { id: d.id, deletedAt: new Date().toISOString() }).catch(() => {});
              await deleteDoc(d.ref).catch(() => {});
            }
          }
        }
      } catch (_) {}
    }
  } catch (err: any) {
    console.warn(`[FIRESTORE] Aviso ao excluir da nuvem: ${err?.message || err}`);
  }

  return true;
}

export async function deleteAllLicensesFromDb(): Promise<boolean> {
  // Registra todos os IDs atuais no tombstone
  for (const l of licenseCache) {
    addDeletedLicenseId(l.id);
    try {
      const tombRef = doc(db, 'deleted_licenses', l.id);
      setDoc(tombRef, { id: l.id, deletedAt: new Date().toISOString() }).catch(() => {});
    } catch (_) {}
  }

  // Limpa memória e disco
  licenseCache = [];
  persistLicensesToDisk([]);

  // Limpa do Firestore
  try {
    const colRef = collection(db, 'licenses');
    const snap = await withTimeout(getDocs(colRef), 5000, null as any);
    if (snap && snap.docs) {
      for (const d of snap.docs) {
        addDeletedLicenseId(d.id);
        const tombRef = doc(db, 'deleted_licenses', d.id);
        setDoc(tombRef, { id: d.id, deletedAt: new Date().toISOString() }).catch(() => {});
        await deleteDoc(d.ref).catch(() => {});
      }
    }
  } catch (err: any) {
    console.warn('[FIRESTORE] Erro ao limpar todas as licenças do Firestore:', err?.message || err);
  }

  return true;
}

export async function getLicenseById(id: string): Promise<ClientLicenseRecord | null> {
  if (deletedIdsCache.has(id)) return null;

  // 1. Verifica cache de memória
  const cached = licenseCache.find((l) => l.id === id);
  if (cached && !deletedIdsCache.has(cached.id)) return cached;

  // 2. Verifica disco
  const disk = loadLicensesFromDisk();
  const diskMatch = disk.find((l) => l.id === id);
  if (diskMatch && !deletedIdsCache.has(diskMatch.id)) {
    licenseCache = disk;
    return diskMatch;
  }

  // 3. Tenta Firestore com timeout
  try {
    const docRef = doc(db, 'licenses', id);
    const snap = await withTimeout(getDoc(docRef), 2000, null as any);
    if (snap && snap.exists && snap.exists()) {
      const rec = snap.data() as ClientLicenseRecord;
      const fullId = rec.id || snap.id;
      if (deletedIdsCache.has(fullId)) return null;
      const full = { ...rec, id: fullId };
      licenseCache.push(full);
      persistLicensesToDisk(licenseCache);
      return full;
    }
  } catch (err: any) {
    console.warn('[FIRESTORE] Falha ao buscar licença por ID no Firestore:', err?.message || err);
  }

  return null;
}

export async function getLicenseByPcId(pcId: string): Promise<ClientLicenseRecord | null> {
  const cleanId = pcId.trim().toUpperCase();

  const sortBest = (arr: ClientLicenseRecord[]) => {
    return arr
      .filter(l => l && l.id && !deletedIdsCache.has(l.id))
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return (b.validUntil || '').localeCompare(a.validUntil || '');
      });
  };

  // 1. Verifica cache de memória
  const cachedMatches = licenseCache.filter((l) => l.pcId && l.pcId.trim().toUpperCase() === cleanId && !deletedIdsCache.has(l.id));
  const bestCached = sortBest(cachedMatches);
  if (bestCached.length > 0) return bestCached[0];

  // 2. Verifica disco
  const disk = loadLicensesFromDisk();
  const diskMatches = disk.filter((l) => l.pcId && l.pcId.trim().toUpperCase() === cleanId && !deletedIdsCache.has(l.id));
  const bestDisk = sortBest(diskMatches);
  if (bestDisk.length > 0) {
    licenseCache = disk;
    return bestDisk[0];
  }

  // 3. Tenta Firestore com timeout
  try {
    const colRef = collection(db, 'licenses');
    const q = query(colRef, where('pcId', '==', pcId.trim()));
    const snap = await withTimeout(getDocs(q), 2500, null as any);
    if (snap && snap.docs && !snap.empty) {
      const records = snap.docs
        .map(d => ({ ...(d.data() as ClientLicenseRecord), id: d.id }))
        .filter(r => !deletedIdsCache.has(r.id));
      const best = sortBest(records)[0];
      if (best) {
        licenseCache.push(best);
        persistLicensesToDisk(licenseCache);
        return best;
      }
    }
  } catch (err: any) {
    console.warn('[FIRESTORE] Falha ao buscar por pcId:', err?.message || err);
  }

  return null;
}

export async function getLicenseByKey(licenseKey: string): Promise<ClientLicenseRecord | null> {
  const cleanKey = licenseKey.trim();

  // 1. Verifica cache de memória
  const cached = licenseCache.find((l) => l.licenseKey === cleanKey && !deletedIdsCache.has(l.id));
  if (cached && !deletedIdsCache.has(cached.id)) return cached;

  // 2. Verifica disco
  const disk = loadLicensesFromDisk();
  const diskMatch = disk.find((l) => l.licenseKey === cleanKey && !deletedIdsCache.has(l.id));
  if (diskMatch && !deletedIdsCache.has(diskMatch.id)) {
    licenseCache = disk;
    return diskMatch;
  }

  // 3. Tenta Firestore com timeout
  try {
    const colRef = collection(db, 'licenses');
    const q = query(colRef, where('licenseKey', '==', cleanKey));
    const snap = await withTimeout(getDocs(q), 2500, null as any);
    if (snap && snap.docs && !snap.empty) {
      const rec = snap.docs[0].data() as ClientLicenseRecord;
      const fullId = rec.id || snap.docs[0].id;
      if (deletedIdsCache.has(fullId)) return null;
      const full = { ...rec, id: fullId };
      licenseCache.push(full);
      persistLicensesToDisk(licenseCache);
      return full;
    }
  } catch (err: any) {
    console.warn('[FIRESTORE] Falha ao buscar por licenseKey:', err?.message || err);
  }

  return null;
}
