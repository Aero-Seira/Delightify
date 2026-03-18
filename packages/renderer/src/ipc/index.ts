// Type definition for the Electron API exposed via contextBridge in preload.ts

import type { Project, CreateProjectData } from '@delightify/shared';
import { mockElectronAPI } from './mock';

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
  jarImport: (filePath: string) => Promise<{ success: boolean; data?: { modId: string; modName: string; itemCount: number; recipeCount: number; tagCount: number; textureCount: number }; error?: string }>;
  jarList: () => Promise<{ success: boolean; data?: import('@delightify/shared').Mod[]; error?: string }>;
  jarSelect: () => Promise<{ success: boolean; data?: string | null; error?: string }>;
  jarDelete: (modId: string) => Promise<{ success: boolean; data?: boolean; error?: string }>;
  jarGetDetails: (modId: string) => Promise<{ success: boolean; data?: import('@delightify/shared').Mod | null; error?: string }>;
  onJarImportProgress: (callback: (progress: { step: string; percent: number; filePath: string; currentFile?: string; processedCount?: number; totalCount?: number; error?: string }) => void) => () => void;

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
    electronAPI?: ElectronAPI;
  }
}

/**
 * 检测是否在 Electron 环境中
 */
function isElectron(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  // 检查是否有 electronAPI
  if (window.electronAPI) {
    return true;
  }
  
  // 检查 userAgent
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('electron')) {
    return true;
  }
  
  return false;
}

/**
 * 获取 Electron API
 * 在 Electron 环境中返回真实的 API
 * 在浏览器环境中返回 Mock API
 */
export const electronAPI = (): ElectronAPI => {
  if (isElectron()) {
    if (!window.electronAPI) {
      throw new Error('electronAPI is not available. Are you running inside Electron?');
    }
    return window.electronAPI;
  }
  
  // 浏览器环境，使用 Mock
  console.log('[IPC] Running in browser mode, using Mock API');
  return mockElectronAPI as unknown as ElectronAPI;
};

/**
 * 检查是否在 Electron 环境
 */
export function checkElectronEnvironment(): boolean {
  return isElectron();
}
