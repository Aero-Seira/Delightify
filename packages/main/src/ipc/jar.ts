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
  type JarParseProgress,
} from '../services/jar-parser';

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
      
      // 保存模组信息
      const now = new Date().toISOString();
      await db.execute({
        sql: `INSERT INTO mods (mod_id, mod_name, version, mc_version, source_type, jar_path, parsed_at, item_count, recipe_count)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(mod_id) DO UPDATE SET
                mod_name = excluded.mod_name,
                version = excluded.version,
                mc_version = excluded.mc_version,
                jar_path = excluded.jar_path,
                parsed_at = excluded.parsed_at,
                item_count = excluded.item_count,
                recipe_count = excluded.recipe_count`,
        args: [
          result.modInfo.modId,
          result.modInfo.modName,
          result.modInfo.version || null,
          result.modInfo.mcVersion || null,
          'jar',
          filePath,
          now,
          result.stats.itemCount,
          result.stats.recipeCount,
        ],
      });

      // 批量保存物品
      for (const item of result.items) {
        await db.execute({
          sql: `INSERT INTO items (item_id, mod_id, display_name_key, display_name, category, is_block, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(item_id) DO UPDATE SET
                  display_name_key = excluded.display_name_key,
                  display_name = excluded.display_name,
                  category = excluded.category,
                  is_block = excluded.is_block`,
          args: [
            item.itemId,
            item.modId,
            item.translationKey,
            item.name,
            'misc', // TODO: 从 tags 推断
            item.isBlock ? 1 : 0,
            now,
          ],
        });
      }

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
      const result = await db.execute('SELECT * FROM mods ORDER BY parsed_at DESC');
      
      // 转换为 Mod 类型
      const mods: Mod[] = result.rows.map((row: any) => ({
        modId: row.mod_id,
        modName: row.mod_name,
        version: row.version || undefined,
        mcVersion: row.mc_version || undefined,
        sourceType: row.source_type as 'jar' | 'builtin' | 'manual',
        jarPath: row.jar_path || undefined,
        parsedAt: row.parsed_at || undefined,
        itemCount: row.item_count,
        recipeCount: row.recipe_count,
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
      
      // 删除模组及其相关数据（使用事务）
      await db.execute({
        sql: 'DELETE FROM item_tags WHERE item_id IN (SELECT item_id FROM items WHERE mod_id = ?)',
        args: [modId],
      });
      
      await db.execute({
        sql: 'DELETE FROM items WHERE mod_id = ?',
        args: [modId],
      });
      
      await db.execute({
        sql: 'DELETE FROM recipes WHERE mod_id = ?',
        args: [modId],
      });
      
      await db.execute({
        sql: 'DELETE FROM textures WHERE mod_id = ?',
        args: [modId],
      });
      
      await db.execute({
        sql: 'DELETE FROM mods WHERE mod_id = ?',
        args: [modId],
      });

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
      
      const result = await db.execute({
        sql: 'SELECT * FROM mods WHERE mod_id = ?',
        args: [modId],
      });
      
      const row = result.rows[0] as any;
      
      if (!row) {
        return { success: true, data: null };
      }

      const mod: Mod = {
        modId: row.mod_id,
        modName: row.mod_name,
        version: row.version || undefined,
        mcVersion: row.mc_version || undefined,
        sourceType: row.source_type as 'jar' | 'builtin' | 'manual',
        jarPath: row.jar_path || undefined,
        parsedAt: row.parsed_at || undefined,
        itemCount: row.item_count,
        recipeCount: row.recipe_count,
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
