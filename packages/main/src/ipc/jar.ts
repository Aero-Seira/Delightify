import { ipcMain, BrowserWindow, dialog } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  JarImportResult, 
  JarImportProgress, 
  Mod 
} from '@delightify/shared';
import { appPaths } from '../services/paths';
import { createGlobalDbClient } from '../services/database';
import { 
  parseJarFile, 
  validateJarFile,
  saveJarParseResult,
  getModsList,
} from '../services/jar-parser';
import type { JarParseProgress } from '../services/jar-parser/types';

/**
 * 活跃的导入任务 Map
 * 用于支持取消操作
 */
const activeImports = new Map<string, { cancel: boolean }>();

export function registerJarHandlers(): void {
  // JAR_IMPORT: Import a JAR file with real parsing
  ipcMain.handle(IPC_CHANNELS.JAR_IMPORT, async (
    event, 
    filePath: string
  ): Promise<IpcResponse<JarImportResult>> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const importId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: 'Invalid file path provided' };
      }

      // 1. 验证 JAR 文件
      const validation = validateJarFile(filePath);
      if (!validation.valid) {
        return { success: false, error: validation.error || 'Invalid JAR file' };
      }

      // 2. 创建取消标记
      const importTask = { cancel: false };
      activeImports.set(importId, importTask);

      // 3. 发送初始进度
      sendProgress(win, {
        step: 'reading',
        percent: 0,
        filePath,
      });

      // 4. 解析 JAR 文件
      const result = await parseJarFile(filePath, {
        parseLang: true,
        parseTags: true,
        parseRecipes: true,
        extractTextures: true,
        textureOptions: {
          cacheDir: appPaths.textureCache,
          itemsOnly: true,
        },
        onProgress: (progress: JarParseProgress) => {
          // 检查是否被取消
          if (importTask.cancel) {
            throw new Error('Import cancelled by user');
          }

          // 转换进度格式并发送
          sendProgress(win, {
            step: progress.stage,
            percent: progress.percent,
            filePath,
            currentFile: progress.currentFile,
            processedCount: progress.processedCount,
            totalCount: progress.totalCount,
          });
        },
      });

      // 5. 保存到数据库
      sendProgress(win, {
        step: 'saving',
        percent: 95,
        filePath,
      });

      const db = createGlobalDbClient(appPaths.globalDb);
      await saveJarParseResult(db, result, filePath);

      // 6. 完成
      sendProgress(win, {
        step: 'completed',
        percent: 100,
        filePath,
      });

      // 清理任务
      activeImports.delete(importId);

      const importResult: JarImportResult = {
        success: true,
        filePath,
        modId: result.modInfo.modId,
        modName: result.modInfo.modName,
        itemCount: result.stats.itemCount,
        recipeCount: result.stats.recipeCount,
        tagCount: result.stats.tagCount,
        textureCount: result.stats.textureCount,
      };

      return { success: true, data: importResult };
    } catch (error) {
      // 清理任务
      activeImports.delete(importId);

      const errorMessage = error instanceof Error ? error.message : 'Failed to import JAR';
      console.error('JAR_IMPORT error:', error);
      
      // 发送错误进度
      sendProgress(win, {
        step: 'error',
        percent: 0,
        filePath,
        error: errorMessage,
      });
      
      return { success: false, error: errorMessage };
    }
  });

  // JAR_LIST: Return list of imported JARs from database
  ipcMain.handle(IPC_CHANNELS.JAR_LIST, async (): Promise<IpcResponse<Mod[]>> => {
    try {
      const db = createGlobalDbClient(appPaths.globalDb);
      
      // 从数据库查询所有模组
      const modsFromDb = await getModsList(db);
      
      // 转换为 Mod 类型
      const mods: Mod[] = modsFromDb.map((mod: typeof modsFromDb[0]) => ({
        modId: mod.modId,
        modName: mod.modName,
        version: mod.version || undefined,
        mcVersion: mod.mcVersion || undefined,
        sourceType: mod.sourceType as 'jar' | 'builtin' | 'manual',
        jarPath: mod.jarPath || undefined,
        parsedAt: mod.parsedAt || undefined,
        itemCount: mod.itemCount,
        recipeCount: mod.recipeCount,
      }));

      return { success: true, data: mods };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to list JARs';
      console.error('JAR_LIST error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // JAR_SELECT: Open file dialog to select JAR file
  ipcMain.handle('jar:select', async (): Promise<IpcResponse<string | null>> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        title: '选择 Minecraft 模组 JAR 文件',
        filters: [
          { name: 'JAR Files', extensions: ['jar'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select file';
      console.error('JAR_SELECT error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // JAR_DELETE: Delete a mod from database
  ipcMain.handle('jar:delete', async (_event, modId: string): Promise<IpcResponse<boolean>> => {
    try {
      if (!modId || typeof modId !== 'string') {
        return { success: false, error: 'Invalid mod ID' };
      }

      const db = createGlobalDbClient(appPaths.globalDb);
      
      // 删除模组及其相关数据
      const { deleteModFromDatabase } = await import('../services/jar-parser/persistence');
      await deleteModFromDatabase(db, modId);

      return { success: true, data: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete mod';
      console.error('JAR_DELETE error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // JAR_GET_DETAILS: Get detailed info about a mod
  ipcMain.handle('jar:get-details', async (_event, modId: string): Promise<IpcResponse<Mod | null>> => {
    try {
      if (!modId || typeof modId !== 'string') {
        return { success: false, error: 'Invalid mod ID' };
      }

      const db = createGlobalDbClient(appPaths.globalDb);
      const { getModDetails } = await import('../services/jar-parser/persistence');
      
      const modDetails = await getModDetails(db, modId);
      
      if (!modDetails) {
        return { success: true, data: null };
      }

      const mod: Mod = {
        modId: modDetails.modId,
        modName: modDetails.modName,
        version: modDetails.version || undefined,
        mcVersion: modDetails.mcVersion || undefined,
        sourceType: modDetails.sourceType as 'jar' | 'builtin' | 'manual',
        jarPath: modDetails.jarPath || undefined,
        parsedAt: modDetails.parsedAt || undefined,
        itemCount: modDetails.itemCount,
        recipeCount: modDetails.recipeCount,
      };

      return { success: true, data: mod };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get mod details';
      console.error('JAR_GET_DETAILS error:', error);
      return { success: false, error: errorMessage };
    }
  });
}

/**
 * 发送进度更新到渲染进程
 */
function sendProgress(
  win: BrowserWindow | null,
  progress: JarImportProgress
): void {
  if (!win) return;
  
  win.webContents.send(IPC_CHANNELS.JAR_IMPORT_PROGRESS, progress);
}
