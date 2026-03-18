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
});

console.log('[Preload] electronAPI exposed successfully');
