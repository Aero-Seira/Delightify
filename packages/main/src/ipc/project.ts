import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';

export function registerProjectHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    // TODO: Return list of registered projects from projects.json
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select modpack root directory',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    // TODO: Load or create project at the selected path
    return { path: result.filePaths[0] };
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, data: unknown) => {
    // TODO: Create new project at the specified directory
    return data;
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET_CURRENT, async () => {
    // TODO: Return the currently active project
    return null;
  });
}
