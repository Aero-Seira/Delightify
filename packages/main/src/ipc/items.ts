import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  ItemQueryParams, 
  ItemQueryResult,
  Item 
} from '@delightify/shared';
import { appPaths } from '../services/paths';
import { createGlobalDbClient } from '../services/database';
import { getItemTextureData, generateMissingTexture, generateLetterFallback } from '../services/resource-renderer/texture-resolver';
import * as fs from 'fs';
import * as path from 'path';

// 当前语言设置（可以从配置读取，默认为 zh_cn）
const CURRENT_LANG = 'zh_cn';
const FALLBACK_LANG = 'en_us';

/**
 * 获取物品的翻译名称
 */
async function getItemTranslations(
  db: ReturnType<typeof createGlobalDbClient>,
  displayNameKeys: string[]
): Promise<Map<string, string>> {
  const translationMap = new Map<string, string>();
  
  if (displayNameKeys.length === 0) {
    return translationMap;
  }
  
  // 查询当前语言的翻译
  const transResult = await db.execute({
    sql: `SELECT key, value FROM translations 
          WHERE key IN (${displayNameKeys.map(() => '?').join(',')}) 
          AND lang = ?`,
    args: [...displayNameKeys, CURRENT_LANG],
  });
  
  for (const row of transResult.rows) {
    translationMap.set((row as any).key, (row as any).value);
  }
  
  // 查询 fallback 语言的翻译
  const missingKeys = displayNameKeys.filter(key => !translationMap.has(key));
  if (missingKeys.length > 0) {
    const fallbackResult = await db.execute({
      sql: `SELECT key, value FROM translations 
            WHERE key IN (${missingKeys.map(() => '?').join(',')}) 
            AND lang = ?`,
      args: [...missingKeys, FALLBACK_LANG],
    });
    
    for (const row of fallbackResult.rows) {
      if (!translationMap.has((row as any).key)) {
        translationMap.set((row as any).key, (row as any).value);
      }
    }
  }
  
  return translationMap;
}

export function registerItemsHandlers(): void {
  // ITEMS_QUERY: Query items from database with filtering and pagination
  ipcMain.handle(IPC_CHANNELS.ITEMS_QUERY, async (
    _event, 
    params: ItemQueryParams
  ): Promise<IpcResponse<ItemQueryResult>> => {
    try {
      const { 
        search, 
        modId, 
        category, 
        tag,
        textureType,
        page = 1, 
        pageSize = 50 
      } = params || {};

      console.log('[Items] Query:', { search, modId, category, tag, page, pageSize });

      const db = createGlobalDbClient(appPaths.globalDb);

      // 构建查询条件
      const conditions: string[] = [];
      const args: (string | number)[] = [];
      
      if (search) {
        conditions.push(`(item_id LIKE ? OR display_name LIKE ? OR display_name_key LIKE ?)`);
        const searchPattern = `%${search}%`;
        args.push(searchPattern, searchPattern, searchPattern);
      }

      if (modId) {
        conditions.push(`mod_id = ?`);
        args.push(modId);
      }

      if (category) {
        conditions.push(`category = ?`);
        args.push(category);
      }

      if (textureType) {
        conditions.push(`texture_type = ?`);
        args.push(textureType);
      }

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as count FROM items';
      if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.join(' AND ');
      }
      
      const countResult = await db.execute({
        sql: countQuery,
        args: args,
      });
      const total = Number(countResult.rows[0]?.count || 0);

      // 如果有 tag 筛选，需要关联 item_tags 表
      let query = 'SELECT * FROM items';
      let queryArgs = [...args];
      
      if (tag) {
        query = `SELECT i.* FROM items i 
                 INNER JOIN item_tags it ON i.item_id = it.item_id 
                 WHERE it.tag_id = ?`;
        queryArgs = [tag];
        
        // 添加其他条件
        if (conditions.length > 0) {
          query += ' AND ' + conditions.join(' AND ');
          queryArgs.push(...args);
        }
      } else if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY display_name ASC, item_id ASC';
      query += ` LIMIT ? OFFSET ?`;
      queryArgs.push(pageSize, (page - 1) * pageSize);

      const result = await db.execute({
        sql: query,
        args: queryArgs,
      });

      // 获取所有物品的翻译（优化：批量查询）
      const itemIds = result.rows.map((row: any) => row.item_id);
      const displayNameKeys = result.rows.map((row: any) => row.display_name_key).filter(Boolean);
      
      // 构建翻译映射
      const translationMap = new Map<string, string>();
      
      if (displayNameKeys.length > 0) {
        // 查询当前语言的翻译
        const transResult = await db.execute({
          sql: `SELECT key, value FROM translations 
                WHERE key IN (${displayNameKeys.map(() => '?').join(',')}) 
                AND lang = ?`,
          args: [...displayNameKeys, CURRENT_LANG],
        });
        
        for (const row of transResult.rows) {
          translationMap.set((row as any).key, (row as any).value);
        }
        
        // 查询 fallback 语言的翻译（对于没有当前语言翻译的）
        const missingKeys = displayNameKeys.filter(key => !translationMap.has(key));
        if (missingKeys.length > 0) {
          const fallbackResult = await db.execute({
            sql: `SELECT key, value FROM translations 
                  WHERE key IN (${missingKeys.map(() => '?').join(',')}) 
                  AND lang = ?`,
            args: [...missingKeys, FALLBACK_LANG],
          });
          
          for (const row of fallbackResult.rows) {
            if (!translationMap.has((row as any).key)) {
              translationMap.set((row as any).key, (row as any).value);
            }
          }
        }
      }
      
      // 转换为 Item 类型
      const items: Item[] = result.rows.map((row: any) => {
        const displayNameKey = row.display_name_key;
        // 优先使用 translations 表的翻译，其次是 items 表存储的 display_name
        const translatedName = displayNameKey ? translationMap.get(displayNameKey) : undefined;
        const displayName = translatedName || row.display_name || undefined;
        
        return {
          id: row.id,
          itemId: row.item_id,
          modId: row.mod_id,
          name: row.name,
          displayNameKey: displayNameKey || undefined,
          displayName: displayName,
          category: (row.category as Item['category']) || 'misc',
          texturePath: row.texture_path || undefined,
          textureCacheName: row.texture_cache_name || undefined,
          textureType: (row.texture_type as Item['textureType']) || 'unknown',
          isBlock: Boolean(row.is_block),
          createdAt: row.created_at,
        };
      });

      const queryResult: ItemQueryResult = {
        items,
        total,
        page,
        pageSize,
      };

      return { success: true, data: queryResult };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to query items';
      console.error('[Items] Query error:', error);
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  });

  // ITEMS_GET_TEXTURE: Return texture data for given item
  ipcMain.handle(IPC_CHANNELS.ITEMS_GET_TEXTURE, async (
    _event, 
    itemId: string
  ): Promise<IpcResponse<string | null>> => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        return { success: false, error: 'Invalid item ID' };
      }

      console.log('[Items] Get texture:', itemId);

      // 使用新的智能纹理解析器
      const { data, resolved } = await getItemTextureData(itemId);
      
      if (data && resolved) {
        console.log(`[Items] Found texture for ${itemId}: ${resolved.cacheName} (${resolved.isFallback ? 'fallback' : 'exact'})`);
        return { success: true, data };
      }

      // 如果没有找到纹理，返回 null（让前端使用 fallback）
      console.warn(`[Items] No texture found for ${itemId}`);
      return { success: true, data: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get texture';
      console.error('[Items] Get texture error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // ITEMS_GET_TEXTURE_FALLBACK: Get fallback info for missing textures
  ipcMain.handle('items:get-texture-fallback', async (
    _event,
    itemId: string
  ): Promise<IpcResponse<{ type: 'missing' | 'letter'; data: string; char?: string; color?: string }>> => {
    try {
      // 首先尝试生成 missing texture
      const missingTexture = generateMissingTexture();
      const { char, color } = generateLetterFallback(itemId);
      
      return {
        success: true,
        data: {
          type: 'missing',
          data: missingTexture,
          char,
          color,
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate fallback';
      return { success: false, error: errorMessage };
    }
  });

  // ITEMS_GET_BY_MOD: Get all items from a specific mod
  ipcMain.handle(IPC_CHANNELS.ITEMS_GET_BY_MOD, async (
    _event,
    modId: string
  ): Promise<IpcResponse<Item[]>> => {
    try {
      if (!modId || typeof modId !== 'string') {
        return { success: false, error: 'Invalid mod ID' };
      }

      const db = createGlobalDbClient(appPaths.globalDb);

      const result = await db.execute({
        sql: 'SELECT * FROM items WHERE mod_id = ? ORDER BY display_name, item_id',
        args: [modId],
      });
      
      // 获取翻译
      const displayNameKeys = result.rows.map((row: any) => row.display_name_key).filter(Boolean);
      const translationMap = await getItemTranslations(db, displayNameKeys);

      const items: Item[] = result.rows.map((row: any) => {
        const displayNameKey = row.display_name_key;
        const translatedName = displayNameKey ? translationMap.get(displayNameKey) : undefined;
        
        return {
          id: row.id,
          itemId: row.item_id,
          modId: row.mod_id,
          name: row.name,
          displayNameKey: displayNameKey || undefined,
          displayName: translatedName || row.display_name || undefined,
          category: (row.category as Item['category']) || 'misc',
          texturePath: row.texture_path || undefined,
          textureCacheName: row.texture_cache_name || undefined,
          textureType: (row.texture_type as Item['textureType']) || 'unknown',
          isBlock: Boolean(row.is_block),
          createdAt: row.created_at,
        };
      });

      return { success: true, data: items };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get items';
      console.error('[Items] Get by mod error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // ITEMS_GET_TAGS: Get all tags for an item
  ipcMain.handle(IPC_CHANNELS.ITEMS_GET_TAGS, async (
    _event,
    itemId: string
  ): Promise<IpcResponse<string[]>> => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        return { success: false, error: 'Invalid item ID' };
      }

      const db = createGlobalDbClient(appPaths.globalDb);

      const result = await db.execute({
        sql: 'SELECT tag_id FROM item_tags WHERE item_id = ?',
        args: [itemId],
      });

      const tags = result.rows.map((row: any) => row.tag_id as string);

      return { success: true, data: tags };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get tags';
      console.error('[Items] Get tags error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // ITEMS_GET_ALL_TAGS: Get all unique tags with counts
  ipcMain.handle('items:get-all-tags', async (): Promise<IpcResponse<Array<{ tagId: string; count: number }>>> => {
    try {
      const db = createGlobalDbClient(appPaths.globalDb);

      const result = await db.execute(`
        SELECT tag_id, COUNT(*) as count 
        FROM item_tags 
        GROUP BY tag_id 
        ORDER BY count DESC
      `);

      const tags = result.rows.map((row: any) => ({
        tagId: row.tag_id as string,
        count: Number(row.count),
      }));

      return { success: true, data: tags };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get tags';
      console.error('[Items] Get all tags error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // ITEMS_GET_CATEGORIES: Get all categories with counts
  ipcMain.handle('items:get-categories', async (): Promise<IpcResponse<Array<{ category: string; count: number }>>> => {
    try {
      const db = createGlobalDbClient(appPaths.globalDb);

      const result = await db.execute(`
        SELECT category, COUNT(*) as count 
        FROM items 
        GROUP BY category 
        ORDER BY count DESC
      `);

      const categories = result.rows.map((row: any) => ({
        category: (row.category as string) || 'misc',
        count: Number(row.count),
      }));

      return { success: true, data: categories };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get categories';
      console.error('[Items] Get categories error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // ITEMS_GET_DETAIL: Get detailed info for an item (including tags)
  ipcMain.handle('items:get-detail', async (
    _event,
    itemId: string
  ): Promise<IpcResponse<Item & { tags: string[] } | null>> => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        return { success: false, error: 'Invalid item ID' };
      }

      const db = createGlobalDbClient(appPaths.globalDb);

      // 获取物品信息
      const itemResult = await db.execute({
        sql: 'SELECT * FROM items WHERE item_id = ?',
        args: [itemId],
      });

      const row = itemResult.rows[0] as any;
      if (!row) {
        return { success: true, data: null };
      }

      // 获取翻译
      const displayNameKey = row.display_name_key;
      let displayName = row.display_name;
      
      if (displayNameKey) {
        const translationMap = await getItemTranslations(db, [displayNameKey]);
        const translatedName = translationMap.get(displayNameKey);
        if (translatedName) {
          displayName = translatedName;
        }
      }

      // 获取标签
      const tagsResult = await db.execute({
        sql: 'SELECT tag_id FROM item_tags WHERE item_id = ?',
        args: [itemId],
      });

      const tags = tagsResult.rows.map((r: any) => r.tag_id as string);

      const item: Item & { tags: string[] } = {
        id: row.id,
        itemId: row.item_id,
        modId: row.mod_id,
        name: row.name,
        displayNameKey: displayNameKey || undefined,
        displayName: displayName || undefined,
        category: (row.category as Item['category']) || 'misc',
        texturePath: row.texture_path || undefined,
        textureCacheName: row.texture_cache_name || undefined,
        textureType: (row.texture_type as Item['textureType']) || 'unknown',
        isBlock: Boolean(row.is_block),
        createdAt: row.created_at,
        tags,
      };

      return { success: true, data: item };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get item detail';
      console.error('[Items] Get detail error:', error);
      return { success: false, error: errorMessage };
    }
  });
}
