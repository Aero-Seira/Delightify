import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

console.log('[Preload] Script starting...');

// 内联 IPC 通道常量（preload 脚本不能依赖外部 npm 模块）
const IPC_CHANNELS = {
  // Project management
  PROJECT_LIST: 'project:list',
  PROJECT_OPEN: 'project:open',
  PROJECT_CREATE: 'project:create',
  PROJECT_GET_CURRENT: 'project:get-current',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_SELECT_DIRECTORY: 'project:select-directory',

  // JAR import
  JAR_IMPORT: 'jar:import',
  JAR_IMPORT_PROGRESS: 'jar:import:progress',
  JAR_LIST: 'jar:list',
  JAR_SELECT: 'jar:select',
  JAR_DELETE: 'jar:delete',
  JAR_GET_DETAILS: 'jar:get-details',

  // Item queries
  ITEMS_QUERY: 'items:query',
  ITEMS_GET_BY_MOD: 'items:get-by-mod',
  ITEMS_GET_TAGS: 'items:get-tags',
  ITEMS_GET_TEXTURE: 'items:get-texture',
  ITEMS_GET_TEXTURE_FALLBACK: 'items:get-texture-fallback',
  ITEMS_GET_ALL_TAGS: 'items:get-all-tags',
  ITEMS_GET_CATEGORIES: 'items:get-categories',
  ITEMS_GET_DETAIL: 'items:get-detail',

  // Mod queries
  MODS_QUERY: 'mods:query',

  // Tag queries
  TAGS_QUERY: 'tags:query',

  // Recipe CRUD
  RECIPES_LIST: 'recipes:list',
  RECIPES_CREATE: 'recipes:create',
  RECIPES_UPDATE: 'recipes:update',
  RECIPES_DELETE: 'recipes:delete',
  RECIPES_EXPORT: 'recipes:export',

  // LLM conversion
  LLM_CONVERT: 'llm:convert',
  LLM_CONVERT_PROGRESS: 'llm:convert:progress',
  LLM_CANCEL: 'llm:cancel',

  // Debug / Database management
  DEBUG_DB_TABLES: 'debug:db-tables',
  DEBUG_DB_QUERY: 'debug:db-query',
  DEBUG_DB_DELETE_MOD: 'debug:db-delete-mod',
  DEBUG_DB_CLEAR_ALL: 'debug:db-clear-all',
  DEBUG_CACHE_INFO: 'debug:cache-info',
  DEBUG_DB_PATH: 'debug:db-path',
  DEBUG_GET_ITEM_DETAIL: 'debug:get-item-detail',
} as const;

// Expose a safe IPC API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Project management
  projectList: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
  projectOpen: (projectId?: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN, projectId),
  projectCreate: (data: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, data),
  projectGetCurrent: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET_CURRENT),
  projectUpdate: (projectId: string, data: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE, projectId, data),
  projectDelete: (projectId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, projectId),
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SELECT_DIRECTORY),

  // JAR import
  jarImport: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.JAR_IMPORT, filePath),
  jarList: () => ipcRenderer.invoke(IPC_CHANNELS.JAR_LIST),
  jarSelect: () => ipcRenderer.invoke(IPC_CHANNELS.JAR_SELECT),
  jarDelete: (modId: string) => ipcRenderer.invoke(IPC_CHANNELS.JAR_DELETE, modId),
  jarGetDetails: (modId: string) => ipcRenderer.invoke(IPC_CHANNELS.JAR_GET_DETAILS, modId),
  onJarImportProgress: (callback: (progress: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, progress: unknown) =>
      callback(progress);
    ipcRenderer.on(IPC_CHANNELS.JAR_IMPORT_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.JAR_IMPORT_PROGRESS, listener);
  },

  // Item queries
  itemsQuery: (query: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.ITEMS_QUERY, query),
  itemsGetTexture: (itemId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ITEMS_GET_TEXTURE, itemId),
  itemsGetTextureFallback: (itemId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ITEMS_GET_TEXTURE_FALLBACK, itemId),
  itemsGetAllTags: () => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_GET_ALL_TAGS),
  itemsGetCategories: () => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_GET_CATEGORIES),
  itemsGetDetail: (itemId: string) => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_GET_DETAIL, itemId),

  // Mod queries
  modsQuery: () => ipcRenderer.invoke(IPC_CHANNELS.MODS_QUERY),

  // Tag queries
  tagsQuery: () => ipcRenderer.invoke(IPC_CHANNELS.TAGS_QUERY),

  // Recipe CRUD
  recipesList: (filter: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.RECIPES_LIST, filter),
  recipesCreate: (recipe: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.RECIPES_CREATE, recipe),
  recipesUpdate: (recipe: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.RECIPES_UPDATE, recipe),
  recipesDelete: (recipeId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RECIPES_DELETE, recipeId),
  recipesExport: (options: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.RECIPES_EXPORT, options),

  // LLM conversion
  llmConvert: (data: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.LLM_CONVERT, data),
  llmCancel: () => ipcRenderer.invoke(IPC_CHANNELS.LLM_CANCEL),
  onLlmConvertProgress: (callback: (progress: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, progress: unknown) =>
      callback(progress);
    ipcRenderer.on(IPC_CHANNELS.LLM_CONVERT_PROGRESS, listener);
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.LLM_CONVERT_PROGRESS, listener);
  },

  // Shell operations
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),

  // Debug / Database management
  debugDbTables: () => ipcRenderer.invoke('debug:db-tables'),
  debugDbQuery: (sql: string, args?: unknown[]) => ipcRenderer.invoke('debug:db-query', sql, args),
  debugDbDeleteMod: (modId: string) => ipcRenderer.invoke('debug:db-delete-mod', modId),
  debugDbClearAll: () => ipcRenderer.invoke('debug:db-clear-all'),
  debugCacheInfo: () => ipcRenderer.invoke('debug:cache-info'),
  debugDbPath: () => ipcRenderer.invoke('debug:db-path'),
  debugGetItemDetail: (itemId: string) => ipcRenderer.invoke('debug:get-item-detail', itemId),
});

console.log('[Preload] electronAPI exposed successfully');
