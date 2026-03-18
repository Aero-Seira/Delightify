import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  ItemQueryParams, 
  ItemQueryResult,
  Item 
} from '@delightify/shared';
import { appPaths } from '../services/paths';
import { createGlobalDbClient, schema, eq, like, and, or, desc, sql } from '../services/database';

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
      const conditions = [];

      if (search) {
        const searchPattern = `%${search}%`;
        conditions.push(
          or(
            like(schema.items.itemId, searchPattern),
            like(schema.items.displayName, searchPattern),
            like(schema.items.displayNameKey, searchPattern)
          )
        );
      }

      if (modId) {
        conditions.push(eq(schema.items.modId, modId));
      }

      if (category) {
        conditions.push(eq(schema.items.category, category as any));
      }

      // 构建基础查询
      let query = db.select().from(schema.items);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      // 获取总数
      const countQuery = db.select({ count: sql<number>`count(*)` }).from(schema.items);
      let finalCountQuery = countQuery;
      if (conditions.length > 0) {
        finalCountQuery = countQuery.where(and(...conditions)) as typeof countQuery;
      }
      const countResult = await finalCountQuery;
      const total = countResult[0]?.count || 0;

      // 分页查询
      const offset = (page - 1) * pageSize;
      const itemsFromDb = await query
        .orderBy(desc(schema.items.createdAt))
        .limit(pageSize)
        .offset(offset);

      // 转换为 Item 类型
      const items: Item[] = itemsFromDb.map(item => ({
        itemId: item.itemId,
        modId: item.modId,
        displayNameKey: item.displayNameKey || undefined,
        displayName: item.displayName || undefined,
        category: (item.category as Item['category']) || 'misc',
        texturePath: item.texturePath || undefined,
        isBlock: item.isBlock,
        createdAt: item.createdAt,
      }));

      const result: ItemQueryResult = {
        items,
        total,
        page,
        pageSize,
      };

      return { success: true, data: result };
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
      const item = await db.query.items.findFirst({
        where: eq(schema.items.itemId, itemId),
      });

      if (!item || !item.textureCacheName) {
        return { success: true, data: null };
      }

      // 构建材质文件路径
      const fs = require('fs');
      const path = require('path');

      // 查找实际的缓存文件
      try {
        const files = fs.readdirSync(appPaths.textureCache);
        const pattern = new RegExp(`^${item.textureCacheName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_[a-f0-9]{8}\\.png$`);
        
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
  ipcMain.handle('items:get-by-mod', async (
    _event,
    modId: string
  ): Promise<IpcResponse<Item[]>> => {
    try {
      if (!modId || typeof modId !== 'string') {
        return { success: false, error: 'Invalid mod ID' };
      }

      const db = createGlobalDbClient(appPaths.globalDb);

      const itemsFromDb = await db.select()
        .from(schema.items)
        .where(eq(schema.items.modId, modId))
        .orderBy(schema.items.displayName);

      const items: Item[] = itemsFromDb.map(item => ({
        itemId: item.itemId,
        modId: item.modId,
        displayNameKey: item.displayNameKey || undefined,
        displayName: item.displayName || undefined,
        category: (item.category as Item['category']) || 'misc',
        texturePath: item.texturePath || undefined,
        isBlock: item.isBlock,
        createdAt: item.createdAt,
      }));

      return { success: true, data: items };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get items';
      console.error('[Items] Get by mod error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // ITEMS_GET_TAGS: Get all tags for an item
  ipcMain.handle('items:get-tags', async (
    _event,
    itemId: string
  ): Promise<IpcResponse<string[]>> => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        return { success: false, error: 'Invalid item ID' };
      }

      const db = createGlobalDbClient(appPaths.globalDb);

      const tagsFromDb = await db.select({ tagId: schema.itemTags.tagId })
        .from(schema.itemTags)
        .where(eq(schema.itemTags.itemId, itemId));

      const tags = tagsFromDb.map(t => t.tagId);

      return { success: true, data: tags };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get tags';
      console.error('[Items] Get tags error:', error);
      return { success: false, error: errorMessage };
    }
  });
}
