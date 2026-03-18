import { ipcMain, shell } from 'electron';
import { registerProjectHandlers } from './project';
import { registerJarHandlers } from './jar';
import { registerItemsHandlers } from './items';
import { registerRecipesHandlers } from './recipes';
import { registerTexturesHandlers } from './textures';
import { registerLlmHandlers } from './llm';

export function registerAllHandlers(): void {
  registerProjectHandlers();
  registerJarHandlers();
  registerItemsHandlers();
  registerRecipesHandlers();
  registerTexturesHandlers();
  registerLlmHandlers();
  
  // 注册 shell.openExternal 处理程序
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    await shell.openExternal(url);
  });
}
