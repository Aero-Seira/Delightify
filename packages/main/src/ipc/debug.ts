import { ipcMain } from 'electron';
import { createGlobalDbClient } from '../services/database';
import { appPaths } from '../services/paths';
import * as fs from 'fs';

/**
 * 注册调试/数据库管理相关的 IPC handlers
 */
export function registerDebugHandlers(): void {
  // DEBUG_DB_TABLES: 获取所有表的信息
  ipcMain.handle('debug:db-tables', async () => {
    try {
      const db = createGlobalDbClient(appPaths.globalDb);
      
      // 获取所有表名
      const tablesResult = await db.execute(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);
      
      const tables: Array<{ name: string; rowCount: number }> = [];
      
      for (const row of tablesResult.rows) {
        const tableName = (row as any).name;
        // 获取每表的行数
        const countResult = await db.execute(`SELECT COUNT(*) as count FROM "${tableName}"`);
        tables.push({
          name: tableName,
          rowCount: Number((countResult.rows[0] as any).count),
        });
      }
      
      return { success: true, data: tables };
    } catch (error) {
      console.error('[Debug] Failed to get tables:', error);
      return { success: false, error: String(error) };
    }
  });

  // DEBUG_DB_QUERY: 执行查询（只读）
  ipcMain.handle('debug:db-query', async (_event, sql: string, args?: (string | number | null)[]) => {
    try {
      // 安全检查：只允许 SELECT 查询
      const normalizedSql = sql.trim().toLowerCase();
      if (!normalizedSql.startsWith('select')) {
        return { success: false, error: 'Only SELECT queries are allowed' };
      }
      
      const db = createGlobalDbClient(appPaths.globalDb);
      const result = await db.execute({
        sql,
        args: args || [],
      });
      
      return { success: true, data: result.rows };
    } catch (error) {
      console.error('[Debug] Query failed:', error);
      return { success: false, error: String(error) };
    }
  });

  // DEBUG_DB_DELETE_MOD: 删除模组及其所有关联数据
  ipcMain.handle('debug:db-delete-mod', async (_event, modId: string) => {
    try {
      if (!modId || typeof modId !== 'string') {
        return { success: false, error: 'Invalid mod ID' };
      }
      
      const db = createGlobalDbClient(appPaths.globalDb);
      
      // 获取删除前的统计
      const statsResult = await db.execute({
        sql: `SELECT 
          (SELECT COUNT(*) FROM items WHERE mod_id = ?) as item_count,
          (SELECT COUNT(*) FROM recipes WHERE mod_id = ?) as recipe_count,
          (SELECT COUNT(*) FROM textures WHERE mod_id = ?) as texture_count`,
        args: [modId, modId, modId],
      });
      const stats = statsResult.rows[0] as any;
      
      // 删除关联数据
      await db.execute({ sql: 'DELETE FROM item_tags WHERE item_id IN (SELECT item_id FROM items WHERE mod_id = ?)', args: [modId] });
      await db.execute({ sql: 'DELETE FROM items WHERE mod_id = ?', args: [modId] });
      await db.execute({ sql: 'DELETE FROM recipes WHERE mod_id = ?', args: [modId] });
      await db.execute({ sql: 'DELETE FROM textures WHERE mod_id = ?', args: [modId] });
      await db.execute({ sql: 'DELETE FROM translations WHERE mod_id = ?', args: [modId] });
      await db.execute({ sql: 'DELETE FROM mods WHERE mod_id = ?', args: [modId] });
      
      return { 
        success: true, 
        data: {
          modId,
          deleted: {
            items: stats.item_count,
            recipes: stats.recipe_count,
            textures: stats.texture_count,
          },
        },
      };
    } catch (error) {
      console.error('[Debug] Failed to delete mod:', error);
      return { success: false, error: String(error) };
    }
  });

  // DEBUG_DB_CLEAR_ALL: 清空整个数据库（危险操作）
  ipcMain.handle('debug:db-clear-all', async () => {
    try {
      const db = createGlobalDbClient(appPaths.globalDb);
      
      // 获取统计
      const tablesResult = await db.execute(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      
      const stats: Record<string, number> = {};
      
      // 清空所有表
      for (const row of tablesResult.rows) {
        const tableName = (row as any).name;
        const countResult = await db.execute(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const count = Number((countResult.rows[0] as any).count);
        stats[tableName] = count;
        
        if (count > 0) {
          await db.execute(`DELETE FROM "${tableName}"`);
        }
      }
      
      // 也清理材质缓存目录
      let deletedTextures = 0;
      if (fs.existsSync(appPaths.textureCache)) {
        const files = fs.readdirSync(appPaths.textureCache);
        for (const file of files) {
          if (file.endsWith('.png')) {
            fs.unlinkSync(`${appPaths.textureCache}/${file}`);
            deletedTextures++;
          }
        }
      }
      
      return { 
        success: true, 
        data: {
          tables: stats,
          deletedTextures,
        },
      };
    } catch (error) {
      console.error('[Debug] Failed to clear database:', error);
      return { success: false, error: String(error) };
    }
  });

  // DEBUG_CACHE_INFO: 获取缓存信息
  ipcMain.handle('debug:cache-info', async () => {
    try {
      const cacheDir = appPaths.textureCache;
      let fileCount = 0;
      let totalSize = 0;
      
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        for (const file of files) {
          if (file.endsWith('.png')) {
            fileCount++;
            const stats = fs.statSync(`${cacheDir}/${file}`);
            totalSize += stats.size;
          }
        }
      }
      
      // 格式化大小
      const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
      };
      
      return {
        success: true,
        data: {
          cacheDir,
          fileCount,
          totalSize,
          totalSizeFormatted: formatSize(totalSize),
        },
      };
    } catch (error) {
      console.error('[Debug] Failed to get cache info:', error);
      return { success: false, error: String(error) };
    }
  });

  // DEBUG_DB_PATH: 获取数据库路径
  ipcMain.handle('debug:db-path', async () => {
    return {
      success: true,
      data: {
        globalDb: appPaths.globalDb,
        textureCache: appPaths.textureCache,
        projectsJson: appPaths.projectsJson,
      },
    };
  });

  // DEBUG_GET_ITEM_DETAIL: 获取物品完整信息（用于诊断）
  ipcMain.handle('debug:get-item-detail', async (_event, itemId: string) => {
    try {
      const db = createGlobalDbClient(appPaths.globalDb);
      
      // 获取物品基本信息
      const itemResult = await db.execute({
        sql: 'SELECT * FROM items WHERE item_id = ?',
        args: [itemId],
      });
      
      if (itemResult.rows.length === 0) {
        return { success: false, error: 'Item not found' };
      }
      
      const item = itemResult.rows[0];
      
      // 获取翻译
      const transResult = await db.execute({
        sql: 'SELECT lang, value FROM translations WHERE key = ?',
        args: [(item as any).display_name_key],
      });
      
      // 获取标签
      const tagsResult = await db.execute({
        sql: 'SELECT tag_id FROM item_tags WHERE item_id = ?',
        args: [itemId],
      });
      
      return {
        success: true,
        data: {
          item,
          translations: transResult.rows,
          tags: tagsResult.rows.map((r: any) => r.tag_id),
        },
      };
    } catch (error) {
      console.error('[Debug] Failed to get item detail:', error);
      return { success: false, error: String(error) };
    }
  });
}
