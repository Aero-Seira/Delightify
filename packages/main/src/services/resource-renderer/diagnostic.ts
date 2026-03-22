/**
 * 资源渲染诊断工具
 * 
 * 用于诊断纹理加载问题
 */

import * as fs from 'fs';
import * as path from 'path';
import { appPaths } from '../paths';
import { createGlobalDbClient } from '../database';

export interface DiagnosticResult {
  /** 物品ID */
  itemId: string;
  /** 数据库中的纹理缓存名 */
  dbCacheName: string | null;
  /** 数据库中的纹理类型 */
  dbTextureType: string | null;
  /** 实际找到的纹理文件 */
  foundTextureFile: string | null;
  /** 可能的纹理文件名（基于物品名推测） */
  possibleTextureNames: string[];
  /** 缓存目录中匹配的文件 */
  cacheDirMatches: string[];
}

/**
 * 诊断单个物品的纹理问题
 */
export async function diagnoseItemTexture(itemId: string): Promise<DiagnosticResult> {
  const parts = itemId.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid item ID: ${itemId}`);
  }
  
  const [modId, itemName] = parts;
  const cacheDir = appPaths.textureCache;
  
  // 从数据库查询
  const db = createGlobalDbClient(appPaths.globalDb);
  const result = await db.execute({
    sql: 'SELECT texture_cache_name, texture_type, texture_path FROM items WHERE item_id = ?',
    args: [itemId],
  });
  
  const row = result.rows[0] as any;
  const dbCacheName = row?.texture_cache_name || null;
  const dbTextureType = row?.texture_type || null;
  
  // 检查缓存目录中的文件
  let foundTextureFile: string | null = null;
  let cacheDirMatches: string[] = [];
  
  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir);
    
    // 如果数据库有缓存名，检查文件是否存在
    if (dbCacheName) {
      const exactPath = path.join(cacheDir, dbCacheName);
      if (fs.existsSync(exactPath)) {
        foundTextureFile = dbCacheName;
      }
    }
    
    // 查找可能的匹配
    const patterns = [
      new RegExp(`^${modId}_item_${itemName}_[a-f0-9]+\\.png$`, 'i'),
      new RegExp(`^${modId}_block_${itemName}_[a-f0-9]+\\.png$`, 'i'),
      new RegExp(`^${modId}_.*_${itemName}_[a-f0-9]+\\.png$`, 'i'),
    ];
    
    for (const file of files) {
      for (const pattern of patterns) {
        if (pattern.test(file)) {
          cacheDirMatches.push(file);
          if (!foundTextureFile) {
            foundTextureFile = file;
          }
        }
      }
    }
  }
  
  // 推测可能的纹理名称
  const possibleTextureNames = [
    `${modId}_item_${itemName}_.png`,
    `${modId}_block_${itemName}_.png`,
    `${modId}_item_${itemName}_override_.png`,
  ];
  
  return {
    itemId,
    dbCacheName,
    dbTextureType,
    foundTextureFile,
    possibleTextureNames,
    cacheDirMatches: [...new Set(cacheDirMatches)], // 去重
  };
}

/**
 * 批量诊断纹理问题
 */
export async function diagnoseAllItems(modId?: string): Promise<{
  total: number;
  missing: number;
  withTexture: number;
  details: DiagnosticResult[];
}> {
  const db = createGlobalDbClient(appPaths.globalDb);
  
  let query = 'SELECT item_id FROM items';
  const args: string[] = [];
  
  if (modId) {
    query += ' WHERE mod_id = ?';
    args.push(modId);
  }
  
  const result = await db.execute({ sql: query, args });
  const itemIds = result.rows.map((row: any) => row.item_id as string);
  
  const details: DiagnosticResult[] = [];
  let missing = 0;
  let withTexture = 0;
  
  for (const itemId of itemIds.slice(0, 100)) { // 限制数量避免太慢
    const diag = await diagnoseItemTexture(itemId);
    details.push(diag);
    
    if (diag.foundTextureFile) {
      withTexture++;
    } else {
      missing++;
    }
  }
  
  return {
    total: itemIds.length,
    missing,
    withTexture,
    details,
  };
}

/**
 * 打印诊断报告
 */
export function printDiagnosticReport(result: {
  total: number;
  missing: number;
  withTexture: number;
  details: DiagnosticResult[];
}): void {
  console.log('=== 纹理诊断报告 ===');
  console.log(`总计物品: ${result.total}`);
  console.log(`有纹理: ${result.withTexture}`);
  console.log(`缺失纹理: ${result.missing}`);
  console.log('');
  
  // 显示缺失纹理的物品
  const missingItems = result.details.filter(d => !d.foundTextureFile);
  if (missingItems.length > 0) {
    console.log('--- 缺失纹理的物品 (前10个) ---');
    for (const item of missingItems.slice(0, 10)) {
      console.log(`\n物品: ${item.itemId}`);
      console.log(`  数据库缓存名: ${item.dbCacheName || 'N/A'}`);
      console.log(`  数据库类型: ${item.dbTextureType || 'N/A'}`);
      console.log(`  缓存目录匹配: ${item.cacheDirMatches.join(', ') || '无'}`);
    }
  }
  
  // 显示数据库记录和实际文件不匹配的情况
  const mismatched = result.details.filter(d => 
    d.dbCacheName && !d.cacheDirMatches.includes(d.dbCacheName) && d.cacheDirMatches.length > 0
  );
  if (mismatched.length > 0) {
    console.log('\n--- 数据库记录不匹配的物品 (前5个) ---');
    for (const item of mismatched.slice(0, 5)) {
      console.log(`\n物品: ${item.itemId}`);
      console.log(`  数据库记录: ${item.dbCacheName}`);
      console.log(`  实际找到: ${item.cacheDirMatches[0]}`);
    }
  }
}
