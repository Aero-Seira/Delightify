// Type definition for the Electron API exposed via contextBridge in preload.ts

import type { Project, CreateProjectData } from '@delightify/shared';
import { mockElectronAPI } from './mock';
import { browserElectronAPI } from './browser-api';

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
  itemsQuery: (query: unknown) => Promise<{ success: boolean; data?: { items: unknown[]; total: number; page: number; pageSize: number }; error?: string }>;
  itemsGetTexture: (itemId: string) => Promise<{ success: boolean; data?: string | null; error?: string }>;
  itemsGetAllTags: () => Promise<{ success: boolean; data?: Array<{ tagId: string; count: number }>; error?: string }>;
  itemsGetCategories: () => Promise<{ success: boolean; data?: Array<{ category: string; count: number }>; error?: string }>;
  itemsGetDetail: (itemId: string) => Promise<{ success: boolean; data?: (import('@delightify/shared').Item & { tags: string[] }) | null; error?: string }>;

  // Mod queries
  modsQuery: () => Promise<{ success: boolean; data?: Array<{ modId: string; name: string; itemCount: number }>; error?: string }>;

  // Tag queries
  tagsQuery: () => Promise<{ success: boolean; data?: string[]; error?: string }>;

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

  // Shell operations
  openExternal: (url: string) => Promise<void>;

  // Debug / Database management
  debugDbTables: () => Promise<{ success: boolean; data?: Array<{ name: string; rowCount: number }>; error?: string }>;
  debugDbQuery: (sql: string, args?: unknown[]) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
  debugDbDeleteMod: (modId: string) => Promise<{ success: boolean; data?: { modId: string; deleted: Record<string, number> }; error?: string }>;
  debugDbClearAll: () => Promise<{ success: boolean; data?: { tables: Record<string, number>; deletedTextures: number }; error?: string }>;
  debugCacheInfo: () => Promise<{ success: boolean; data?: { cacheDir: string; fileCount: number; totalSizeFormatted: string }; error?: string }>;
  debugDbPath: () => Promise<{ success: boolean; data?: Record<string, string>; error?: string }>;
  debugGetItemDetail: (itemId: string) => Promise<{ success: boolean; data?: { item: any; translations: any[]; tags: string[] }; error?: string }>;
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
 * 检测浏览器功能支持
 */
function getBrowserMode(): 'electron' | 'browser-full' | 'browser-mock' {
  // 真正的 Electron 环境
  if (isElectron()) {
    return 'electron';
  }
  
  // 检查是否支持完整的文件系统 API
  if ('showOpenFilePicker' in window && 'showDirectoryPicker' in window) {
    return 'browser-full';
  }
  
  // 降级到 mock 模式
  return 'browser-mock';
}

/**
 * 获取 Electron API
 * 
 * 优先级：
 * 1. 真正的 Electron API（window.electronAPI）
 * 2. 浏览器完整 API（File System Access API + IndexedDB）
 * 3. Mock API（纯内存，无文件访问）
 */
export const electronAPI = (): ElectronAPI => {
  // 优先检查 window.electronAPI（真正的 Electron）
  if (window.electronAPI) {
    return window.electronAPI;
  }
  
  const mode = getBrowserMode();
  
  switch (mode) {
    case 'electron':
      console.warn('[IPC] Detected Electron environment but electronAPI is not available. ' +
        'Preload script may not have loaded. Using browser API.');
      return browserElectronAPI as unknown as ElectronAPI;
      
    case 'browser-full':
      console.log('[IPC] Running in browser mode with full File System Access API');
      return browserElectronAPI as unknown as ElectronAPI;
      
    case 'browser-mock':
    default:
      console.log('[IPC] Running in browser mock mode (limited file access)');
      return mockElectronAPI as unknown as ElectronAPI;
  }
};

/**
 * 检查是否在 Electron 环境
 */
export function checkElectronEnvironment(): boolean {
  return isElectron();
}

/**
 * 获取当前运行模式
 */
export function getRuntimeMode(): { 
  mode: 'electron' | 'browser-full' | 'browser-mock';
  description: string;
} {
  const mode = getBrowserMode();
  
  const descriptions = {
    'electron': 'Electron 桌面应用',
    'browser-full': '浏览器（完整功能，支持文件访问）',
    'browser-mock': '浏览器（模拟数据，无文件访问）',
  };
  
  return {
    mode,
    description: descriptions[mode],
  };
}

// 导出浏览器 API（供直接使用）
export { browserElectronAPI };
export { mockElectronAPI };
