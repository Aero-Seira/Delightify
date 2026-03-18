/**
 * Database Client (M1 Implementation)
 *
 * 使用 better-sqlite3 实现真实的 SQLite 数据库连接
 * 支持 global.db 和 project.db 两个数据库
 */

import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as path from 'path';
import * as fs from 'fs';
import * as schema from './schema';

// 重新导出 schema
export { schema };

/**
 * Global Database 客户端类型
 */
export type GlobalDbClient = BetterSQLite3Database<typeof schema>;

/**
 * Project Database 客户端类型
 */
export type ProjectDbClient = BetterSQLite3Database<typeof schema>;

/**
 * 存储已创建的数据库客户端实例（用于复用连接）
 */
const dbInstances = new Map<string, BetterSQLite3Database<typeof schema>>();

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
 * 获取迁移文件夹路径
 */
function getMigrationsFolder(): string {
  // 在开发模式下， migrations 位于 drizzle/migrations
  // 在生产模式下，需要根据实际打包路径调整
  const possiblePaths = [
    path.join(__dirname, '../../../drizzle/migrations'),
    path.join(process.resourcesPath || '', 'drizzle/migrations'),
    path.join(__dirname, '../drizzle/migrations'),
  ];
  
  for (const migrationsPath of possiblePaths) {
    if (fs.existsSync(migrationsPath)) {
      return migrationsPath;
    }
  }
  
  // 默认返回第一个路径（如果不存在，后续会报错）
  return possiblePaths[0];
}

/**
 * 创建全局数据库客户端 (global.db)
 *
 * @param dbPath - 数据库文件路径
 * @returns Drizzle ORM 客户端实例
 *
 * @example
 * ```ts
 * const globalDb = createGlobalDbClient('/appData/Delightify/global.db');
 * const allMods = await globalDb.select().from(schema.mods);
 * ```
 */
export function createGlobalDbClient(dbPath: string): GlobalDbClient {
  // 检查是否已有实例
  if (dbInstances.has(dbPath)) {
    return dbInstances.get(dbPath) as GlobalDbClient;
  }

  console.log('[DB] Creating global.db connection:', dbPath);
  
  // 确保目录存在
  ensureDbDirectory(dbPath);
  
  // 创建 better-sqlite3 连接
  const sqlite = new Database(dbPath);
  
  // 启用 WAL 模式以获得更好的并发性能
  sqlite.pragma('journal_mode = WAL');
  
  // 启用外键约束
  sqlite.pragma('foreign_keys = ON');
  
  // 创建 Drizzle ORM 客户端
  const db = drizzle(sqlite, { schema });
  
  // 执行迁移
  try {
    const migrationsFolder = getMigrationsFolder();
    console.log('[DB] Running migrations from:', migrationsFolder);
    migrate(db, { migrationsFolder });
    console.log('[DB] Migrations completed successfully');
  } catch (error) {
    console.error('[DB] Migration failed:', error);
    // 如果迁移失败，尝试直接创建表（开发环境回退方案）
    createTablesDirectly(sqlite);
  }
  
  // 缓存实例
  dbInstances.set(dbPath, db);
  
  return db;
}

/**
 * 创建项目数据库客户端 (project.db)
 *
 * @param dbPath - 数据库文件路径
 * @returns Drizzle ORM 客户端实例
 */
export function createProjectDbClient(dbPath: string): ProjectDbClient {
  // 检查是否已有实例
  if (dbInstances.has(dbPath)) {
    return dbInstances.get(dbPath) as ProjectDbClient;
  }

  console.log('[DB] Creating project.db connection:', dbPath);
  
  // 确保目录存在
  ensureDbDirectory(dbPath);
  
  // 创建 better-sqlite3 连接
  const sqlite = new Database(dbPath);
  
  // 启用 WAL 模式
  sqlite.pragma('journal_mode = WAL');
  
  // 启用外键约束
  sqlite.pragma('foreign_keys = ON');
  
  // 创建 Drizzle ORM 客户端
  const db = drizzle(sqlite, { schema });
  
  // 执行迁移
  try {
    const migrationsFolder = getMigrationsFolder();
    console.log('[DB] Running migrations from:', migrationsFolder);
    migrate(db, { migrationsFolder });
    console.log('[DB] Migrations completed successfully');
  } catch (error) {
    console.error('[DB] Migration failed:', error);
    // 如果迁移失败，尝试直接创建表
    createTablesDirectly(sqlite);
  }
  
  // 缓存实例
  dbInstances.set(dbPath, db);
  
  return db;
}

/**
 * 直接创建表结构（当迁移失败时的回退方案）
 * 在生产环境中，应该使用迁移文件而不是这个函数
 */
function createTablesDirectly(sqlite: Database.Database): void {
  console.log('[DB] Creating tables directly (fallback mode)');
  
  // 创建 mods 表
  sqlite.exec(`
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
    )
  `);
  
  // 创建 items 表
  sqlite.exec(`
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
    )
  `);
  
  // 创建 item_tags 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS item_tags (
      tag_id TEXT NOT NULL,
      item_id TEXT NOT NULL REFERENCES items(item_id),
      source_mod_id TEXT NOT NULL,
      PRIMARY KEY (tag_id, item_id)
    )
  `);
  
  // 创建 recipe_types 表
  sqlite.exec(`
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
    )
  `);
  
  // 创建 recipes 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      recipe_id TEXT PRIMARY KEY,
      mod_id TEXT NOT NULL REFERENCES mods(mod_id),
      recipe_type_id TEXT NOT NULL REFERENCES recipe_types(recipe_type_id),
      raw_json TEXT NOT NULL,
      input_slots TEXT,
      output_slots TEXT,
      parsed_at TEXT NOT NULL
    )
  `);
  
  // 创建 translations 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS translations (
      key TEXT NOT NULL,
      lang TEXT NOT NULL,
      value TEXT NOT NULL,
      mod_id TEXT NOT NULL,
      PRIMARY KEY (key, lang)
    )
  `);
  
  // 创建 textures 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS textures (
      texture_id TEXT PRIMARY KEY,
      mod_id TEXT NOT NULL,
      original_path TEXT NOT NULL,
      cache_name TEXT NOT NULL,
      file_hash TEXT,
      width INTEGER,
      height INTEGER,
      cached_at TEXT NOT NULL
    )
  `);
  
  // 创建 entities 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      entity_id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      original_id TEXT NOT NULL,
      mod_id TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT NOT NULL
    )
  `);
  
  // 创建 relations 表
  sqlite.exec(`
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
    )
  `);
  
  // 创建 imports 表
  sqlite.exec(`
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
    )
  `);
  
  // 创建 relation_evidence 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS relation_evidence (
      evidence_id TEXT PRIMARY KEY,
      relation_id TEXT NOT NULL REFERENCES relations(relation_id),
      import_id TEXT REFERENCES imports(import_id),
      evidence_type TEXT NOT NULL,
      content TEXT NOT NULL,
      file_path TEXT,
      json_path TEXT,
      created_at TEXT NOT NULL
    )
  `);
  
  // 创建 conversion_history 表
  sqlite.exec(`
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
    )
  `);
  
  // 创建 project_relations 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS project_relations (
      relation_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      status TEXT NOT NULL,
      override_data TEXT,
      user_note TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (relation_id, project_id)
    )
  `);
  
  console.log('[DB] Tables created successfully');
}

/**
 * 原始数据库连接类型
 */
export interface RawDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => Database.Statement;
}

/**
 * 获取原始数据库连接（用于执行原生 SQL）
 */
export function createRawConnection(dbPath: string): RawDatabase {
  ensureDbDirectory(dbPath);
  const sqlite = new Database(dbPath);
  
  return {
    exec: (sql: string) => sqlite.exec(sql),
    prepare: (sql: string) => sqlite.prepare(sql),
  };
}

/**
 * 关闭所有数据库连接
 * 应用退出时调用
 */
export function closeAllConnections(): void {
  console.log('[DB] Closing all database connections');
  
  for (const [path, db] of dbInstances.entries()) {
    try {
      // better-sqlite3 的连接在数据库对象被垃圾回收时自动关闭
      // 这里我们只是从缓存中移除引用
      dbInstances.delete(path);
      console.log('[DB] Connection removed:', path);
    } catch (error) {
      console.error('[DB] Error closing connection:', path, error);
    }
  }
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

// 重新导出 drizzle 操作符
export { eq, and, or, like, desc, asc, sql, count } from 'drizzle-orm';
