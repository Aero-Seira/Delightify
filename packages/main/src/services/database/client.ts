/**
 * Database Client (M0 Stub)
 *
 * M0 阶段：使用内存 stub 实现，避免 native 依赖编译问题
 * M1 阶段：将替换为 better-sqlite3 真实实现
 */

import * as schema from './schema';

// 重新导出 schema，便于使用
export { schema };

/**
 * 内存数据库 stub 类型
 */
export interface MemoryDbClient {
  select: () => {
    from: () => Promise<unknown[]>;
    where: () => Promise<unknown[]>;
  };
  insert: () => {
    values: () => Promise<{ rowCount: number }>;
  };
  update: () => {
    set: () => {
      where: () => Promise<{ rowCount: number }>;
    };
  };
  delete: () => {
    where: () => Promise<{ rowCount: number }>;
  };
}

/**
 * Global Database 客户端类型
 * 对应 global.db - 跨项目共享的模组知识库
 */
export type GlobalDbClient = MemoryDbClient;

/**
 * Project Database 客户端类型
 * 对应 project.db - 项目私有数据
 */
export type ProjectDbClient = MemoryDbClient;

/**
 * 创建内存数据库 stub
 */
function createMemoryDbClient(): MemoryDbClient {
  return {
    select: () => ({
      from: () => Promise.resolve([]),
      where: () => Promise.resolve([]),
    }),
    insert: () => ({
      values: () => Promise.resolve({ rowCount: 0 }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve({ rowCount: 0 }),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve({ rowCount: 0 }),
    }),
  };
}

/**
 * 创建全局数据库客户端 (global.db)
 *
 * @param _dbPath - 数据库文件路径（M0 阶段忽略）
 * @returns 内存 stub 客户端
 *
 * @example
 * ```ts
 * const globalDb = createGlobalDbClient('/appData/Delightify/global.db');
 * const allMods = await globalDb.select().from(schema.mods);
 * ```
 */
export function createGlobalDbClient(_dbPath: string): GlobalDbClient {
  // M0 阶段返回内存 stub
  console.log('[M0 Stub] createGlobalDbClient called with:', _dbPath);
  return createMemoryDbClient();
}

/**
 * 创建项目数据库客户端 (project.db)
 *
 * @param _dbPath - 数据库文件路径（M0 阶段忽略）
 * @returns 内存 stub 客户端
 */
export function createProjectDbClient(_dbPath: string): ProjectDbClient {
  // M0 阶段返回内存 stub
  console.log('[M0 Stub] createProjectDbClient called with:', _dbPath);
  return createMemoryDbClient();
}

/**
 * 原始数据库连接类型（M0 阶段为 stub）
 */
export interface RawDatabase {
  exec: () => void;
}

/**
 * 获取原始数据库连接（M0 阶段为 stub）
 */
export function createRawConnection(_dbPath: string): RawDatabase {
  return {
    exec: () => {
      console.log('[M0 Stub] Raw SQL execution not implemented');
    },
  };
}

// 重新导出 drizzle 操作符（M0 阶段为 stub）
export const eq = () => ({});
export const and = () => ({});
export const or = () => ({});
export const like = () => ({});
