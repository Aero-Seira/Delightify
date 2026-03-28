/**
 * Database Client - v2.2
 * 
 * 与附属Mod导出的数据结构保持一致
 * 添加简单的连接缓存，避免频繁创建/关闭连接
 */

import { createClient, Client } from '@libsql/client';
import * as path from 'path';
import * as fs from 'fs';
import * as schema from './schema';
import { initializeDatabaseWithExtensions } from './schema-manager';

export { schema };

export type ProjectDbClient = Client;

// 连接缓存
const connectionCache = new Map<string, Client>();
const connectionTimestamps = new Map<string, number>();
const CACHE_MAX_AGE = 30000; // 30秒后重新创建连接

function ensureDbDirectory(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function createProjectDbClient(dbPath: string): ProjectDbClient {
  const now = Date.now();
  const cached = connectionCache.get(dbPath);
  const timestamp = connectionTimestamps.get(dbPath);
  
  // 如果缓存有效且未过期，直接返回
  if (cached && timestamp && (now - timestamp) < CACHE_MAX_AGE) {
    console.log('[DB] Using cached connection:', dbPath);
    connectionTimestamps.set(dbPath, now);
    return cached;
  }
  
  // 关闭旧连接（如果有）
  if (cached) {
    console.log('[DB] Closing expired connection:', dbPath);
    try { cached.close(); } catch {}
    connectionCache.delete(dbPath);
  }
  
  console.log('[DB] Creating new connection:', dbPath);
  
  ensureDbDirectory(dbPath);
  
  const client = createClient({
    url: `file:${dbPath}`,
  });
  
  // 使用新的扩展机制初始化数据库
  initializeDatabaseWithExtensions(client).catch(error => {
    console.error('[DB] Failed to initialize database:', error);
  });
  
  connectionCache.set(dbPath, client);
  connectionTimestamps.set(dbPath, now);
  
  return client;
}

// 延迟关闭连接（给并发请求复用的机会）
const pendingCloses = new Map<string, NodeJS.Timeout>();

export async function closeProjectDbClient(dbPath: string, immediate = false): Promise<void> {
  // 取消之前的延迟关闭
  const existing = pendingCloses.get(dbPath);
  if (existing) {
    clearTimeout(existing);
    pendingCloses.delete(dbPath);
  }
  
  if (immediate) {
    // 立即关闭
    const cached = connectionCache.get(dbPath);
    if (cached) {
      console.log('[DB] Closing connection immediately:', dbPath);
      try { await cached.close(); } catch {}
      connectionCache.delete(dbPath);
      connectionTimestamps.delete(dbPath);
    }
  } else {
    // 延迟关闭，给并发请求复用的机会
    const timeout = setTimeout(() => {
      console.log('[DB] Closing connection after delay:', dbPath);
      const cached = connectionCache.get(dbPath);
      if (cached) {
        try { cached.close(); } catch {}
        connectionCache.delete(dbPath);
        connectionTimestamps.delete(dbPath);
      }
      pendingCloses.delete(dbPath);
    }, 100); // 100ms后关闭
    
    pendingCloses.set(dbPath, timeout);
  }
}

export async function closeAllConnections(): Promise<void> {
  console.log('[DB] Closing all database connections');
  
  // 取消所有待处理的延迟关闭
  for (const timeout of pendingCloses.values()) {
    clearTimeout(timeout);
  }
  pendingCloses.clear();
  
  for (const [dbPath, client] of connectionCache.entries()) {
    try {
      await client.close();
      console.log('[DB] Connection closed:', dbPath);
    } catch (error) {
      console.error('[DB] Error closing connection:', dbPath, error);
    }
  }
  
  connectionCache.clear();
  connectionTimestamps.clear();
}

export function clearDbCache(dbPath?: string): void {
  if (dbPath) {
    const cached = connectionCache.get(dbPath);
    if (cached) {
      try { cached.close(); } catch {}
      connectionCache.delete(dbPath);
      connectionTimestamps.delete(dbPath);
    }
    const timeout = pendingCloses.get(dbPath);
    if (timeout) {
      clearTimeout(timeout);
      pendingCloses.delete(dbPath);
    }
  } else {
    for (const client of connectionCache.values()) {
      try { client.close(); } catch {}
    }
    connectionCache.clear();
    connectionTimestamps.clear();
    for (const timeout of pendingCloses.values()) {
      clearTimeout(timeout);
    }
    pendingCloses.clear();
  }
}

export { eq, and, or, like, desc, asc, sql, count } from 'drizzle-orm';
