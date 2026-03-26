/**
 * Database Client - v2.1
 * 
 * 与附属Mod导出的数据结构保持一致
 */

import { createClient, Client } from '@libsql/client';
import * as path from 'path';
import * as fs from 'fs';
import * as schema from './schema';

export { schema };

export type ProjectDbClient = Client;

const dbInstances = new Map<string, Client>();

function ensureDbDirectory(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function createProjectDbClient(dbPath: string): ProjectDbClient {
  if (dbInstances.has(dbPath)) {
    return dbInstances.get(dbPath)!;
  }

  console.log('[DB] Creating project.db connection:', dbPath);
  
  ensureDbDirectory(dbPath);
  
  const client = createClient({
    url: `file:${dbPath}`,
  });
  
  initializeDatabase(client, dbPath);
  dbInstances.set(dbPath, client);
  
  return client;
}

async function initializeDatabase(client: Client, dbPath: string): Promise<void> {
  try {
    const createTablesSQL = `
      -- 元数据表
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
      
      INSERT OR IGNORE INTO schema_version (version) VALUES (1);

      CREATE TABLE IF NOT EXISTS manifest (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- 核心数据表（与附属Mod结构一致）
      CREATE TABLE IF NOT EXISTS mods (
        modid TEXT PRIMARY KEY,
        version TEXT,
        name TEXT
      );

      CREATE TABLE IF NOT EXISTS items (
        item_id TEXT PRIMARY KEY,
        modid TEXT NOT NULL REFERENCES mods(modid)
      );

      CREATE TABLE IF NOT EXISTS item_tags (
        tag_id TEXT NOT NULL,
        item_id TEXT NOT NULL REFERENCES items(item_id),
        PRIMARY KEY (tag_id, item_id)
      );

      CREATE INDEX IF NOT EXISTS idx_item_tags_item_id ON item_tags(item_id);

      CREATE TABLE IF NOT EXISTS recipes (
        recipe_id TEXT PRIMARY KEY,
        type_id TEXT NOT NULL,
        modid TEXT NOT NULL REFERENCES mods(modid),
        hash TEXT NOT NULL,
        raw_json TEXT,
        unparsed INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_recipes_type_id ON recipes(type_id);
      CREATE INDEX IF NOT EXISTS idx_recipes_modid ON recipes(modid);

      -- 项目工作区数据
      CREATE TABLE IF NOT EXISTS recipe_type_display_names (
        type_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        icon TEXT,
        input_slot_count INTEGER DEFAULT 1,
        output_slot_count INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS recipe_edits (
        edit_id TEXT PRIMARY KEY,
        recipe_id TEXT NOT NULL,
        edit_type TEXT NOT NULL,
        original_recipe TEXT,
        edited_recipe TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_exported INTEGER NOT NULL DEFAULT 0,
        exported_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_recipe_edits_recipe_id ON recipe_edits(recipe_id);

      CREATE TABLE IF NOT EXISTS export_history (
        export_id TEXT PRIMARY KEY,
        export_type TEXT NOT NULL,
        target_path TEXT NOT NULL,
        exported_edit_ids TEXT,
        exported_files TEXT,
        exported_at TEXT NOT NULL,
        is_success INTEGER NOT NULL DEFAULT 1,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS data_imports (
        import_id TEXT PRIMARY KEY,
        source_file_path TEXT NOT NULL,
        data_version TEXT NOT NULL,
        exported_at TEXT,
        mod_count INTEGER NOT NULL DEFAULT 0,
        item_count INTEGER NOT NULL DEFAULT 0,
        recipe_count INTEGER NOT NULL DEFAULT 0,
        tag_count INTEGER NOT NULL DEFAULT 0,
        imported_at TEXT NOT NULL,
        is_success INTEGER NOT NULL DEFAULT 1,
        error_message TEXT
      );
    `;

    await client.executeMultiple(createTablesSQL);
    console.log('[DB] Database initialized successfully');
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
}

export async function closeAllConnections(): Promise<void> {
  console.log('[DB] Closing all database connections');
  
  for (const [path, client] of dbInstances.entries()) {
    try {
      await client.close();
      console.log('[DB] Connection closed:', path);
    } catch (error) {
      console.error('[DB] Error closing connection:', path, error);
    }
  }
  
  dbInstances.clear();
}

export function clearDbCache(dbPath?: string): void {
  if (dbPath) {
    dbInstances.delete(dbPath);
  } else {
    dbInstances.clear();
  }
}

export { eq, and, or, like, desc, asc, sql, count } from 'drizzle-orm';
