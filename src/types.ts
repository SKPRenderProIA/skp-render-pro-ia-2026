export interface DetectedMaterial {
  id: string;
  element: string;
  category?: string;
  description: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'ia';
  text: string;
  image?: string;
  images?: string[];
  masterPrompt?: string;
  promptPt?: string;
  promptEn?: string;
  timestamp?: string;
  imageWidth?: number;
  imageHeight?: number;
  isImported?: boolean;
}

export interface RenderConfig {
  ratio: number;
  width: number;
  height: number;
  isImported?: boolean;
}

export interface CommandSlot {
  id: string;
  label: string;
  prompt: string;
  category?: string;
}

export type SurfaceReflectType = 'espelho' | 'piso' | 'tv' | 'vidro' | 'bronze' | 'fume';

export interface SurfaceReflectConfig {
  type: SurfaceReflectType;
  darkening: number; // 0 a 100 (%)
  opacity: number;   // 0 a 100 (%)
}

export interface BatchSceneItem {
  id: string;
  image: string; // dataUrl base64
  name?: string;
  sceneCode: string; // A1, B2, C3, etc.
  width?: number;
  height?: number;
  ratio?: number;
  customNote?: string;
  generatedPrompt?: string;
}

