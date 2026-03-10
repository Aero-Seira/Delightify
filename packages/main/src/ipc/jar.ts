import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';

export function registerJarHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.JAR_IMPORT, async (event, filePath: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    // TODO: Implement JAR parsing with progress push
    // Steps: read file → parse items → parse recipes → extract textures
    const steps = ['reading file', 'parsing items', 'parsing recipes', 'extracting textures'];
    for (let i = 0; i < steps.length; i++) {
      win?.webContents.send(IPC_CHANNELS.JAR_IMPORT_PROGRESS, {
        step: steps[i],
        percent: Math.round(((i + 1) / steps.length) * 100),
        filePath,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return { success: true, filePath, itemCount: 0, recipeCount: 0 };
  });

  ipcMain.handle(IPC_CHANNELS.JAR_LIST, async () => {
    // TODO: Return list of imported JARs for current project
    return [];
  });
}
