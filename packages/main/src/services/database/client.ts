/**
 * Database Client (libsql Implementation)
 *
 * 使用 libsql 实现，纯 JavaScript，无需 native 编译
 * 支持 local file 模式，与 better-sqlite3 API 兼容
 */

import { createClient, Client } from '@libsql/client';
import * as path from 'path';
import * as fs from 'fs';
import * as schema from './schema';

// 重新导出 schema
export { schema };

/**
 * Global Database 客户端类型
 */
export type GlobalDbClient = Client;

/**
 * Project Database 客户端类型
 */
export type ProjectDbClient = Client;

/**
 * 存储已创建的数据库客户端实例（用于复用连接）
 */
const dbInstances = new Map<string, Client>();

/**
 * 确保数据库文件所在目录存在
 */
function ensureDbDirectory(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 创建全局数据库客户端 (global.db)
 *
 * @param dbPath - 数据库文件路径
 * @returns libsql 客户端实例
 *
 * @example
 * ```ts
 * const globalDb = createGlobalDbClient('/appData/Delightify/global.db');
 * const result = await globalDb.execute('SELECT * FROM mods');
 * ```
 */
export function createGlobalDbClient(dbPath: string): GlobalDbClient {
  // 检查是否已有实例
  if (dbInstances.has(dbPath)) {
    return dbInstances.get(dbPath)!;
  }

  console.log('[DB] Creating global.db connection:', dbPath);
  
  // 确保目录存在
  ensureDbDirectory(dbPath);
  
  // 创建 libsql 客户端
  const client = createClient({
    url: `file:${dbPath}`,
  });
  
  // 执行初始化和迁移
  initializeDatabase(client, dbPath);
  
  // 缓存实例
  dbInstances.set(dbPath, client);
  
  return client;
}

/**
 * 创建项目数据库客户端 (project.db)
 *
 * @param dbPath - 数据库文件路径
 * @returns libsql 客户端实例
 */
export function createProjectDbClient(dbPath: string): ProjectDbClient {
  // 检查是否已有实例
  if (dbInstances.has(dbPath)) {
    return dbInstances.get(dbPath)!;
  }

  console.log('[DB] Creating project.db connection:', dbPath);
  
  // 确保目录存在
  ensureDbDirectory(dbPath);
  
  // 创建 libsql 客户端
  const client = createClient({
    url: `file:${dbPath}`,
  });
  
  // 执行初始化和迁移
  initializeDatabase(client, dbPath);
  
  // 缓存实例
  dbInstances.set(dbPath, client);
  
  return client;
}

/**
 * 初始化数据库（创建表结构）
 */
async function initializeDatabase(client: Client, dbPath: string): Promise<void> {
  try {
    // 创建表的 SQL 语句
    const createTablesSQL = `
      -- mods: 模组元信息表
      CREATE TABLE IF NOT EXISTS mods (
        mod_id TEXT PRIMARY KEY,
        mod_name TEXT NOT NULL,
        version TEXT,
        mc_version TEXT,
        source_type TEXT NOT NULL,
        jar_path TEXT,
        jar_hash TEXT,
        parsed_at TEXT,
        item_count INTEGER NOT NULL DEFAULT 0,
        recipe_count INTEGER NOT NULL DEFAULT 0
      );

      -- items: 物品条目表
      CREATE TABLE IF NOT EXISTS items (
        item_id TEXT PRIMARY KEY,
        mod_id TEXT NOT NULL REFERENCES mods(mod_id),
        display_name_key TEXT,
        display_name TEXT,
        category TEXT,
        texture_path TEXT,
        texture_cache_name TEXT,
        is_block INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      -- item_tags: 物品标签关联表
      CREATE TABLE IF NOT EXISTS item_tags (
        tag_id TEXT NOT NULL,
        item_id TEXT NOT NULL REFERENCES items(item_id),
        source_mod_id TEXT NOT NULL,
        PRIMARY KEY (tag_id, item_id)
      );

      -- recipe_types: 配方类型表
      CREATE TABLE IF NOT EXISTS recipe_types (
        recipe_type_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        input_slot_count INTEGER NOT NULL DEFAULT 1,
        output_slot_count INTEGER NOT NULL DEFAULT 1,
        is_builtin INTEGER NOT NULL DEFAULT 0,
        source_mod_id TEXT,
        field_spec TEXT
      );

      -- recipes: 配方表
      CREATE TABLE IF NOT EXISTS recipes (
        recipe_id TEXT PRIMARY KEY,
        mod_id TEXT NOT NULL REFERENCES mods(mod_id),
        recipe_type_id TEXT NOT NULL REFERENCES recipe_types(recipe_type_id),
        raw_json TEXT NOT NULL,
        input_slots TEXT,
        output_slots TEXT,
        parsed_at TEXT NOT NULL
      );

      -- translations: 翻译表
      CREATE TABLE IF NOT EXISTS translations (
        key TEXT NOT NULL,
        lang TEXT NOT NULL,
        value TEXT NOT NULL,
        mod_id TEXT NOT NULL,
        PRIMARY KEY (key, lang)
      );

      -- textures: 材质缓存表
      CREATE TABLE IF NOT EXISTS textures (
        texture_id TEXT PRIMARY KEY,
        mod_id TEXT NOT NULL,
        original_path TEXT NOT NULL,
        cache_name TEXT NOT NULL,
        file_hash TEXT,
        width INTEGER,
        height INTEGER,
        cached_at TEXT NOT NULL
      );

      -- entities: 统一实体表
      CREATE TABLE IF NOT EXISTS entities (
        entity_id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        original_id TEXT NOT NULL,
        mod_id TEXT NOT NULL,
        display_name TEXT,
        created_at TEXT NOT NULL
      );

      -- relations: 关系边表
      CREATE TABLE IF NOT EXISTS relations (
        relation_id TEXT PRIMARY KEY,
        from_entity_id TEXT NOT NULL REFERENCES entities(entity_id),
        to_entity_id TEXT NOT NULL REFERENCES entities(entity_id),
        relation_type TEXT NOT NULL,
        layer TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        confidence REAL DEFAULT 1.0,
        payload TEXT,
        created_at TEXT NOT NULL
      );

      -- imports: 导入批次记录表
      CREATE TABLE IF NOT EXISTS imports (
        import_id TEXT PRIMARY KEY,
        import_type TEXT NOT NULL,
        source_path TEXT,
        file_hash TEXT,
        parser_version TEXT NOT NULL,
        item_count INTEGER DEFAULT 0,
        recipe_count INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT
      );

      -- relation_evidence: 关系证据溯源表
      CREATE TABLE IF NOT EXISTS relation_evidence (
        evidence_id TEXT PRIMARY KEY,
        relation_id TEXT NOT NULL REFERENCES relations(relation_id),
        import_id TEXT REFERENCES imports(import_id),
        evidence_type TEXT NOT NULL,
        content TEXT NOT NULL,
        file_path TEXT,
        json_path TEXT,
        created_at TEXT NOT NULL
      );

      -- conversion_history: 配方转换历史表
      CREATE TABLE IF NOT EXISTS conversion_history (
        conversion_id TEXT PRIMARY KEY,
        source_recipe_id TEXT NOT NULL,
        source_recipe_type TEXT NOT NULL,
        target_recipe_type TEXT NOT NULL,
        converted_json TEXT,
        conversion_method TEXT NOT NULL,
        llm_confidence REAL,
        user_confirmed INTEGER DEFAULT 0,
        user_note TEXT,
        created_at TEXT NOT NULL,
        confirmed_at TEXT
      );

      -- project_relations: 项目级语义关系覆盖表
      CREATE TABLE IF NOT EXISTS project_relations (
        relation_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        status TEXT NOT NULL,
        override_data TEXT,
        user_note TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (relation_id, project_id)
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_items_mod_id ON items(mod_id);
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_items_display_name ON items(display_name);
      CREATE INDEX IF NOT EXISTS idx_item_tags_tag_id ON item_tags(tag_id);
      CREATE INDEX IF NOT EXISTS idx_item_tags_item_id ON item_tags(item_id);
      CREATE INDEX IF NOT EXISTS idx_recipes_mod_id ON recipes(mod_id);
      CREATE INDEX IF NOT EXISTS idx_recipes_recipe_type_id ON recipes(recipe_type_id);
      CREATE INDEX IF NOT EXISTS idx_translations_lang ON translations(lang);
      CREATE INDEX IF NOT EXISTS idx_translations_mod_id ON translations(mod_id);
      CREATE INDEX IF NOT EXISTS idx_textures_mod_id ON textures(mod_id);
      CREATE INDEX IF NOT EXISTS idx_textures_cache_name ON textures(cache_name);
      CREATE INDEX IF NOT EXISTS idx_relations_from_entity ON relations(from_entity_id);
      CREATE INDEX IF NOT EXISTS idx_relations_to_entity ON relations(to_entity_id);
      CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(relation_type);
      CREATE INDEX IF NOT EXISTS idx_relations_layer ON relations(layer);
      CREATE INDEX IF NOT EXISTS idx_imports_status ON imports(status);
      CREATE INDEX IF NOT EXISTS idx_imports_started_at ON imports(started_at);
    `;

    // 执行建表语句
    await client.executeMultiple(createTablesSQL);
    console.log('[DB] Database initialized successfully');
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
}

/**
 * 原始数据库连接类型（libsql 不需要，但为了兼容性保留）
 */
export interface RawDatabase {
  exec: (sql: string) => Promise<void>;
}

/**
 * 获取原始数据库连接（libsql 实现）
 */
export async function createRawConnection(dbPath: string): Promise<RawDatabase> {
  ensureDbDirectory(dbPath);
  const client = createClient({
    url: `file:${dbPath}`,
  });

  return {
    exec: async (sql: string) => {
      await client.executeMultiple(sql);
    },
  };
}

/**
 * 关闭所有数据库连接
 * 应用退出时调用
 */
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

/**
 * 删除数据库实例缓存（用于测试或重新连接）
 */
export function clearDbCache(dbPath?: string): void {
  if (dbPath) {
    dbInstances.delete(dbPath);
  } else {
    dbInstances.clear();
  }
}

// 重新导出 drizzle 操作符（libsql 兼容）
export { eq, and, or, like, desc, asc, sql, count } from 'drizzle-orm';
