/**
 * Items IPC Handlers - v2.1
 * 
 * 根据 reference_sql/export.sqlite 样例调整
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  ItemQueryParams, 
  ItemQueryResult,
  Item,
  ItemTag,
  TagInfo,
} from '@delightify/shared';
import { createProjectDbClient } from '../services/database';

export function registerItemsHandlers(): void {
  // ITEMS_QUERY: 查询物品
  ipcMain.handle(IPC_CHANNELS.ITEMS_QUERY, async (
    _event,
    projectPath: string,
    params: ItemQueryParams
  ): Promise<IpcResponse<ItemQueryResult>> => {
    try {
      const { search, modid, tagId, page = 1, pageSize = 50 } = params;
      
      const db = createProjectDbClient(projectPath);
      
      // 构建查询
      let whereClause = '';
      const args: (string | number)[] = [];
      
      if (search) {
        whereClause = 'WHERE item_id LIKE ?';
        args.push(`%${search}%`);
      } else if (modid) {
        whereClause = 'WHERE modid = ?';
        args.push(modid);
      }
      
      // 获取总数
      const countResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM items ${whereClause}`,
        args,
      });
      const total = Number(countResult.rows[0]?.count || 0);
      
      // 获取数据
      let query = `SELECT * FROM items ${whereClause} ORDER BY item_id LIMIT ? OFFSET ?`;
      args.push(pageSize, (page - 1) * pageSize);
      
      const result = await db.execute({ sql: query, args });
      
      const items: Item[] = result.rows.map((row: any) => ({
        itemId: row.item_id,
        modid: row.modid,
      }));
      
      await db.close();
      
      return {
        success: true,
        data: { items, total, page, pageSize },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '查询失败';
      return { success: false, error: errorMessage };
    }
  });

  // ITEMS_GET_BY_MOD: 获取模组的所有物品
  ipcMain.handle(IPC_CHANNELS.ITEMS_GET_BY_MOD, async (
    _event,
    projectPath: string,
    modid: string
  ): Promise<IpcResponse<Item[]>> => {
    try {
      const db = createProjectDbClient(projectPath);
      
      const result = await db.execute({
        sql: 'SELECT * FROM items WHERE modid = ? ORDER BY item_id',
        args: [modid],
      });
      
      await db.close();
      
      const items: Item[] = result.rows.map((row: any) => ({
        itemId: row.item_id,
        modid: row.modid,
      }));
      
      return { success: true, data: items };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取失败';
      return { success: false, error: errorMessage };
    }
  });

  // ITEMS_GET_DETAIL: 获取物品详情（包含标签）
  ipcMain.handle(IPC_CHANNELS.ITEMS_GET_DETAIL, async (
    _event,
    projectPath: string,
    itemId: string
  ): Promise<IpcResponse<Item & { tags: string[] } | null>> => {
    try {
      const db = createProjectDbClient(projectPath);
      
      const [itemResult, tagsResult] = await Promise.all([
        db.execute({
          sql: 'SELECT * FROM items WHERE item_id = ?',
          args: [itemId],
        }),
        db.execute({
          sql: 'SELECT tag_id FROM item_tags WHERE item_id = ?',
          args: [itemId],
        }),
      ]);
      
      await db.close();
      
      const row = itemResult.rows[0] as any;
      if (!row) {
        return { success: true, data: null };
      }
      
      const tags = tagsResult.rows.map((r: any) => r.tag_id as string);
      
      return {
        success: true,
        data: {
          itemId: row.item_id,
          modid: row.modid,
          tags,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取详情失败';
      return { success: false, error: errorMessage };
    }
  });

  // TAGS_QUERY: 获取所有标签
  ipcMain.handle(IPC_CHANNELS.TAGS_QUERY, async (
    _event,
    projectPath: string
  ): Promise<IpcResponse<TagInfo[]>> => {
    try {
      const db = createProjectDbClient(projectPath);
      
      const result = await db.execute(`
        SELECT tag_id, COUNT(*) as count 
        FROM item_tags 
        GROUP BY tag_id 
        ORDER BY count DESC
      `);
      
      await db.close();
      
      const tags: TagInfo[] = result.rows.map((row: any) => ({
        tagId: row.tag_id,
        itemCount: Number(row.count),
      }));
      
      return { success: true, data: tags };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取标签失败';
      return { success: false, error: errorMessage };
    }
  });

  // MODS_QUERY: 获取所有模组
  ipcMain.handle(IPC_CHANNELS.MODS_QUERY, async (
    _event,
    projectPath: string
  ): Promise<IpcResponse<{ modid: string; version?: string; name?: string }[]>> => {
    try {
      const db = createProjectDbClient(projectPath);
      
      const result = await db.execute('SELECT * FROM mods ORDER BY modid');
      
      await db.close();
      
      const mods = result.rows.map((row: any) => ({
        modid: row.modid,
        version: row.version,
        name: row.name,
      }));
      
      return { success: true, data: mods };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取模组失败';
      return { success: false, error: errorMessage };
    }
  });
}
