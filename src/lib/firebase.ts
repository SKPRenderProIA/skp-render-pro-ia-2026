import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || undefined);

// Sem autenticação por Gmail / Google — sistema opera estritamente via licença e chave de máquina (PC ID)
export const auth = null;
export default app;

