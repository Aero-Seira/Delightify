import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';

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
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) =>
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
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) =>
      callback(progress);
    ipcRenderer.on(IPC_CHANNELS.LLM_CONVERT_PROGRESS, listener);
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.LLM_CONVERT_PROGRESS, listener);
  },
});
