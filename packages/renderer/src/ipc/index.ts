// Type definition for the Electron API exposed via contextBridge in preload.ts
export interface ElectronAPI {
  projectList: () => Promise<unknown[]>;
  projectOpen: () => Promise<{ path: string } | null>;
  projectCreate: (data: unknown) => Promise<unknown>;
  projectGetCurrent: () => Promise<unknown>;

  jarImport: (filePath: string) => Promise<{ success: boolean; itemCount: number; recipeCount: number }>;
  jarList: () => Promise<unknown[]>;
  onJarImportProgress: (callback: (progress: unknown) => void) => () => void;

  itemsQuery: (query: unknown) => Promise<{ items: unknown[]; total: number }>;
  itemsGetTexture: (itemId: string) => Promise<string | null>;

  recipesList: (filter: unknown) => Promise<unknown[]>;
  recipesCreate: (recipe: unknown) => Promise<unknown>;
  recipesUpdate: (recipe: unknown) => Promise<unknown>;
  recipesDelete: (recipeId: string) => Promise<{ success: boolean }>;
  recipesExport: (options: unknown) => Promise<unknown>;

  llmConvert: (data: unknown) => Promise<{ results: unknown[]; status: string }>;
  llmCancel: () => Promise<{ success: boolean }>;
  onLlmConvertProgress: (callback: (progress: unknown) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export const electronAPI = (): ElectronAPI => {
  if (!window.electronAPI) {
    throw new Error('electronAPI is not available. Are you running inside Electron?');
  }
  return window.electronAPI;
};
