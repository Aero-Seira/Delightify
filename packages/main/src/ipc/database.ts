/**
 * Database query handlers for mods, tags, and other metadata
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  Mod,
  Tag
} from '@delightify/shared';
import { appPaths } from '../services/paths';
import { createGlobalDbClient } from '../services/database';

/**
 * Register database-related IPC handlers
 */
export function registerDatabaseHandlers(): void {
  // MODS_QUERY: Query all imported mods
  ipcMain.handle(IPC_CHANNELS.MODS_QUERY, async (): Promise<IpcResponse<Mod[]>> => {
    try {
      const db = createGlobalDbClient(appPaths.globalDb);
      
      const result = await db.execute({
        sql: `SELECT 
          mod_id as modId,
          mod_name as modName,
          version,
          mc_version as mcVersion,
          source_type as sourceType,
          jar_path as jarPath,
          parsed_at as parsedAt,
          item_count as itemCount,
          recipe_count as recipeCount
        FROM mods 
        ORDER BY mod_name`,
      });

      const mods: Mod[] = result.rows.map((row: any) => ({
        modId: row.modId,
        modName: row.modName,
        version: row.version,
        mcVersion: row.mcVersion,
        sourceType: row.sourceType,
        jarPath: row.jarPath,
        parsedAt: row.parsedAt,
        itemCount: row.itemCount,
        recipeCount: row.recipeCount,
      }));

      return { success: true, data: mods };
    } catch (error) {
      console.error('MODS_QUERY error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to query mods' 
      };
    }
  });

  // TAGS_QUERY: Query all tags with optional mod filter
  ipcMain.handle(IPC_CHANNELS.TAGS_QUERY, async (
    _event,
    modId?: string
  ): Promise<IpcResponse<Tag[]>> => {
    try {
      const db = createGlobalDbClient(appPaths.globalDb);
      
      let sql = `SELECT 
        t.tag_id as tagId,
        t.mod_id as modId,
        t.tag_type as tagType,
        COUNT(it.item_id) as itemCount
      FROM tags t
      LEFT JOIN item_tags it ON t.tag_id = it.tag_id
      WHERE 1=1`;
      
      const args: any[] = [];
      
      if (modId) {
        sql += ` AND t.mod_id = ?`;
        args.push(modId);
      }
      
      sql += ` GROUP BY t.tag_id ORDER BY t.tag_id`;
      
      const result = await db.execute({ sql, args });

      const tags: Tag[] = result.rows.map((row: any) => ({
        tagId: row.tagId,
        modId: row.modId,
        tagType: row.tagType,
        itemCount: row.itemCount,
      }));

      return { success: true, data: tags };
    } catch (error) {
      console.error('TAGS_QUERY error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to query tags' 
      };
    }
  });
}
