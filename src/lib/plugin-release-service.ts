import fs from 'fs';
import path from 'path';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface PluginReleaseInfo {
  releaseVersion: number;
  versionName: string;
  releaseDate: string;
  releaseNotes: string;
  activeAlert: boolean;
}

const RELEASE_FILE_PATH = path.resolve(process.cwd(), 'data', 'plugin_release.json');

const DEFAULT_RELEASE: PluginReleaseInfo = {
  releaseVersion: 1730100000000,
  versionName: '2.1.0',
  releaseDate: new Date('2026-10-28T12:00:00Z').toISOString(),
  releaseNotes: 'Versão Estável 2.1.0 com correções e melhorias de performance.',
  activeAlert: false,
};

let cachedRelease: PluginReleaseInfo | null = null;

function loadLocalReleaseFile(): PluginReleaseInfo {
  try {
    if (fs.existsSync(RELEASE_FILE_PATH)) {
      const raw = fs.readFileSync(RELEASE_FILE_PATH, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.releaseVersion === 'number') {
          return {
            releaseVersion: parsed.releaseVersion,
            versionName: parsed.versionName || '2.1.0',
            releaseDate: parsed.releaseDate || new Date().toISOString(),
            releaseNotes: parsed.releaseNotes || '',
            activeAlert: Boolean(parsed.activeAlert),
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[RELEASE SERVICE] Aviso ao ler plugin_release.json local:', err?.message || err);
  }
  return DEFAULT_RELEASE;
}

function persistLocalReleaseFile(info: PluginReleaseInfo): void {
  try {
    const dir = path.dirname(RELEASE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(RELEASE_FILE_PATH, JSON.stringify(info, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[RELEASE SERVICE] Erro ao salvar plugin_release.json local:', err?.message || err);
  }
}

export async function getPluginReleaseInfo(): Promise<PluginReleaseInfo> {
  if (cachedRelease) {
    return cachedRelease;
  }

  // 1. Tenta carregar do Firestore
  try {
    const docRef = doc(db, 'system_config', 'plugin_release');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      cachedRelease = {
        releaseVersion: Number(data.releaseVersion) || DEFAULT_RELEASE.releaseVersion,
        versionName: data.versionName || DEFAULT_RELEASE.versionName,
        releaseDate: data.releaseDate || DEFAULT_RELEASE.releaseDate,
        releaseNotes: data.releaseNotes || DEFAULT_RELEASE.releaseNotes,
        activeAlert: Boolean(data.activeAlert),
      };
      persistLocalReleaseFile(cachedRelease);
      return cachedRelease;
    }
  } catch (err: any) {
    console.warn('[RELEASE SERVICE] Firestore indisponível para plugin_release, usando arquivo local:', err?.message || err);
  }

  // 2. Fallback para arquivo local
  cachedRelease = loadLocalReleaseFile();
  return cachedRelease;
}

export async function publishPluginRelease(
  versionName: string = '2.1.0',
  releaseNotes: string = 'Atualização do Plugin SKP Render Pro IA'
): Promise<PluginReleaseInfo> {
  const newRelease: PluginReleaseInfo = {
    releaseVersion: Date.now(),
    versionName: versionName.trim() || '2.1.0',
    releaseDate: new Date().toISOString(),
    releaseNotes: releaseNotes.trim(),
    activeAlert: true,
  };

  cachedRelease = newRelease;
  persistLocalReleaseFile(newRelease);

  try {
    const docRef = doc(db, 'system_config', 'plugin_release');
    await setDoc(docRef, newRelease, { merge: true });
    console.log('[RELEASE SERVICE] Nova atualização do plugin publicada com sucesso no Firestore:', newRelease);
  } catch (err: any) {
    console.warn('[RELEASE SERVICE] Erro ao persistir no Firestore, salvo localmente:', err?.message || err);
  }

  return newRelease;
}

export async function clearPluginReleaseAlert(): Promise<PluginReleaseInfo> {
  const current = await getPluginReleaseInfo();
  const updated: PluginReleaseInfo = {
    ...current,
    activeAlert: false,
  };

  cachedRelease = updated;
  persistLocalReleaseFile(updated);

  try {
    const docRef = doc(db, 'system_config', 'plugin_release');
    await setDoc(docRef, updated, { merge: true });
    console.log('[RELEASE SERVICE] Alerta de atualização do plugin desativado:', updated);
  } catch (err: any) {
    console.warn('[RELEASE SERVICE] Erro ao atualizar no Firestore:', err?.message || err);
  }

  return updated;
}
