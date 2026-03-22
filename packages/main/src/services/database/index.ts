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
 * const result = await db.execute('SELECT * FROM mods');
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

// Export batch save utilities
export {
  batchInsertItems,
  batchInsertTags,
  batchInsertRecipes,
  batchInsertTranslations,
  batchInsertTextures,
  optimizeForBulkInsert,
  restoreSafetySettings,
  withTransaction,
} from './batch-save';
