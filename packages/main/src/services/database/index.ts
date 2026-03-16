/**
 * Database Service Layer
 * 
 * 统一导出数据库相关的所有模块
 * 
 * @example
 * ```ts
 * import { createGlobalDbClient, schema, eq } from '@delightify/main/services/database';
 * 
 * const db = createGlobalDbClient(globalDbPath);
 * const mods = await db.select().from(schema.mods).where(eq(schema.mods.modId, 'farmersdelight'));
 * ```
 */

// Schema definitions
export * from './schema';

// Client factories
export {
  createGlobalDbClient,
  createProjectDbClient,
  createRawConnection,
  schema,
  type GlobalDbClient,
  type ProjectDbClient,
  type RawDatabase,
} from './client';

// Re-export drizzle operators for convenience
export { eq, ne, gt, gte, lt, lte, like, inArray, and, or, not, desc, asc, sql } from 'drizzle-orm';
