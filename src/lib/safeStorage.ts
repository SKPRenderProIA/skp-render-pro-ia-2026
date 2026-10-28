// Safe storage helper with memory fallback to prevent DOMException / SecurityError
// in sandboxed iframes, SketchUp CEF webviews, or browsers blocking third-party storage.

const memoryStorage = new Map<string, string>();

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`[SafeStorage] Could not read ${key} from localStorage, using memory fallback:`, e);
    }
    return memoryStorage.get(key) ?? null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`[SafeStorage] Could not write ${key} to localStorage, using memory fallback:`, e);
    }
    memoryStorage.set(key, value);
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`[SafeStorage] Could not remove ${key} from localStorage:`, e);
    }
    memoryStorage.delete(key);
  },

  clear: (): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
        return;
      }
    } catch (_) {}
    memoryStorage.clear();
  }
};
