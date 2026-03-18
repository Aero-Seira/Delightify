import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  ItemQueryParams, 
  ItemQueryResult,
  Item 
} from '@delightify/shared';
import { appPaths } from '../services/paths';
import { createGlobalDbClient, schema } from '../services/database';

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
        page = 1, 
        pageSize = 50 
      } = params || {};

      console.log('[Items] Query:', { search, modId, category, page, pageSize });

      const db = createGlobalDbClient(appPaths.globalDb);

      // 构建查询条件
      const conditions: string[] = [];
      
      if (search) {
        conditions.push(`(item_id LIKE '%${search}%' OR display_name LIKE '%${search}%' OR display_name_key LIKE '%${search}%')`);
      }

      if (modId) {
        conditions.push(`mod_id = '${modId}'`);
      }

      if (category) {
        conditions.push(`category = '${category}'`);
      }

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as count FROM items';
      if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.join(' AND ');
      }
      
      const countResult = await db.execute(countQuery);
      const total = Number(countResult.rows[0]?.count || 0);

      // 分页查询
      let query = 'SELECT * FROM items';
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY created_at DESC';
      query += ` LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

      const result = await db.execute(query);

      // 转换为 Item 类型
      const items: Item[] = result.rows.map((row: any) => ({
        itemId: row.item_id,
        modId: row.mod_id,
        displayNameKey: row.display_name_key || undefined,
        displayName: row.display_name || undefined,
        category: (row.category as Item['category']) || 'misc',
        texturePath: row.texture_path || undefined,
        isBlock: Boolean(row.is_block),
        createdAt: row.created_at,
      }));

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

      const db = createGlobalDbClient(appPaths.globalDb);

      // 查询物品的材质信息
      const result = await db.execute({
        sql: 'SELECT texture_cache_name FROM items WHERE item_id = ?',
        args: [itemId],
      });

      const row = result.rows[0] as any;
      if (!row || !row.texture_cache_name) {
        return { success: true, data: null };
      }

      // 构建材质文件路径
      const fs = require('fs');
      const path = require('path');

      // 查找实际的缓存文件
      try {
        const files = fs.readdirSync(appPaths.textureCache);
        const pattern = new RegExp(`^${row.texture_cache_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_[a-f0-9]{8}\\.png$`);
        
        for (const file of files) {
          if (pattern.test(file)) {
            const fullPath = path.join(appPaths.textureCache, file);
            // 读取文件并转为 base64
            const data = fs.readFileSync(fullPath);
            const base64 = `data:image/png;base64,${data.toString('base64')}`;
            return { success: true, data: base64 };
          }
        }
      } catch (error) {
        console.warn('[Items] Failed to read texture:', error);
      }

      return { success: true, data: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get texture';
      console.error('[Items] Get texture error:', error);
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
        sql: 'SELECT * FROM items WHERE mod_id = ? ORDER BY display_name',
        args: [modId],
      });

      const items: Item[] = result.rows.map((row: any) => ({
        itemId: row.item_id,
        modId: row.mod_id,
        displayNameKey: row.display_name_key || undefined,
        displayName: row.display_name || undefined,
        category: (row.category as Item['category']) || 'misc',
        texturePath: row.texture_path || undefined,
        isBlock: Boolean(row.is_block),
        createdAt: row.created_at,
      }));

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
}
