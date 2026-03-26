/**
 * Database Client - v2.1
 * 
 * 与附属Mod导出的数据结构保持一致
 */

import { createClient, Client } from '@libsql/client';
import * as path from 'path';
import * as fs from 'fs';
import * as schema from './schema';
import { initializeDatabaseWithExtensions } from './schema-manager';

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
  console.log('[DB] Creating project.db connection:', dbPath);
  
  ensureDbDirectory(dbPath);
  
  const client = createClient({
    url: `file:${dbPath}`,
  });
  
  // 使用新的扩展机制初始化数据库
  initializeDatabaseWithExtensions(client).catch(error => {
    console.error('[DB] Failed to initialize database:', error);
  });
  
  return client;
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
