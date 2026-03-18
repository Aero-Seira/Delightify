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
  closeAllConnections,
  clearDbCache,
  schema,
  eq, and, or, like, desc, asc, sql, count,
  type GlobalDbClient,
  type ProjectDbClient,
  type RawDatabase,
} from './client';

// Re-export drizzle operators for convenience
export { 
  eq as eqOp, 
  ne, 
  gt, 
  gte, 
  lt, 
  lte, 
  like as likeOp, 
  inArray, 
  and as andOp, 
  or as orOp, 
  not, 
  desc as descOp, 
  asc as ascOp, 
  sql as sqlOp,
  count as countOp,
} from 'drizzle-orm';
