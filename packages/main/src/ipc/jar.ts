import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  JarImportResult, 
  JarImportProgress, 
  Mod 
} from '@delightify/shared';

// In-memory storage for imported JARs (M0 placeholder)
const importedJars: Mod[] = [];

export function registerJarHandlers(): void {
  // JAR_IMPORT: Import a JAR file with progress simulation
  ipcMain.handle(IPC_CHANNELS.JAR_IMPORT, async (
    event, 
    filePath: string
  ): Promise<IpcResponse<JarImportResult>> => {
    const win = BrowserWindow.fromWebContents(event.sender);

    try {
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: 'Invalid file path provided' };
      }

      // Simulate JAR parsing with progress push
      // Steps: read file → parse items → parse recipes → extract textures
      const steps = [
        { step: 'reading file', percent: 25 },
        { step: 'parsing items', percent: 50 },
        { step: 'parsing recipes', percent: 75 },
        { step: 'extracting textures', percent: 100 },
      ];

      for (const { step, percent } of steps) {
        const progress: JarImportProgress = {
          step,
          percent,
          filePath,
        };
        win?.webContents.send(IPC_CHANNELS.JAR_IMPORT_PROGRESS, progress);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // M0 placeholder: Create mock mod entry
      const jarName = filePath.split(/[/\\]/).pop() || 'unknown.jar';
      const modId = jarName.replace('.jar', '').toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      const mockMod: Mod = {
        modId,
        modName: jarName.replace('.jar', ''),
        sourceType: 'jar',
        jarPath: filePath,
        parsedAt: new Date().toISOString(),
        itemCount: 0,
        recipeCount: 0,
      };

      // Avoid duplicates
      const existingIndex = importedJars.findIndex(m => m.jarPath === filePath);
      if (existingIndex >= 0) {
        importedJars[existingIndex] = mockMod;
      } else {
        importedJars.push(mockMod);
      }

      const result: JarImportResult = {
        success: true,
        filePath,
        itemCount: 0,
        recipeCount: 0,
      };

      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import JAR';
      console.error('JAR_IMPORT error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // JAR_LIST: Return list of imported JARs for current project
  ipcMain.handle(IPC_CHANNELS.JAR_LIST, async (): Promise<IpcResponse<Mod[]>> => {
    try {
      // M0 placeholder: Return empty array (M1 will implement database query)
      return { success: true, data: [...importedJars] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to list JARs';
      console.error('JAR_LIST error:', error);
      return { success: false, error: errorMessage };
    }
  });
}
