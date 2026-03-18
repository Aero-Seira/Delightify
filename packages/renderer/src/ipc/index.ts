// Type definition for the Electron API exposed via contextBridge in preload.ts

import type { Project, CreateProjectData } from '@delightify/shared';

export interface ElectronAPI {
  // Project management
  projectList: () => Promise<{ success: boolean; data?: Project[]; error?: string }>;
  projectOpen: (projectId?: string) => Promise<{ success: boolean; data?: Project | null; error?: string; canceled?: boolean }>;
  projectCreate: (data: CreateProjectData) => Promise<{ success: boolean; data?: Project; error?: string }>;
  projectGetCurrent: () => Promise<{ success: boolean; data?: Project | null; error?: string }>;
  projectUpdate: (projectId: string, data: unknown) => Promise<{ success: boolean; data?: Project; error?: string }>;
  projectDelete: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  selectDirectory: () => Promise<{ canceled: boolean; filePaths?: string[] }>;

  // JAR import
  jarImport: (filePath: string) => Promise<{ success: boolean; itemCount: number; recipeCount: number }>;
  jarList: () => Promise<unknown[]>;
  onJarImportProgress: (callback: (progress: unknown) => void) => () => void;

  // Item queries
  itemsQuery: (query: unknown) => Promise<{ items: unknown[]; total: number }>;
  itemsGetTexture: (itemId: string) => Promise<string | null>;

  // Recipe CRUD
  recipesList: (filter: unknown) => Promise<unknown[]>;
  recipesCreate: (recipe: unknown) => Promise<unknown>;
  recipesUpdate: (recipe: unknown) => Promise<unknown>;
  recipesDelete: (recipeId: string) => Promise<{ success: boolean }>;
  recipesExport: (options: unknown) => Promise<unknown>;

  // LLM conversion
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
