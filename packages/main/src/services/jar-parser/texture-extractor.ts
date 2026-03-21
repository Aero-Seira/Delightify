/**
 * 材质提取服务
 * 从 assets/{modid}/textures/ 中提取 PNG 材质
 * 存储到本地缓存目录
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { TextureInfo, ProgressCallback } from './types';

/**
 * 材质提取选项
 */
export interface TextureExtractionOptions {
  /** 缓存目录路径 */
  cacheDir: string;
  /** 最大尺寸限制（超过则缩放，0 表示不限制） */
  maxSize?: number;
  /** 只提取物品材质（跳过方块材质） */
  itemsOnly?: boolean;
  /** 是否跳过已存在的缓存 */
  skipExisting?: boolean;
}

/**
 * 从 JAR 条目中提取材质
 * @param entries JAR 条目列表
 * @param expectedModId 期望的模组 ID
 * @param options 提取选项
 * @param onProgress 进度回调
 * @returns 提取的材质信息列表
 */
export async function extractTexturesFromJar(
  entries: Array<{ path: string; data: Buffer }>,
  expectedModId: string,
  options: TextureExtractionOptions,
  onProgress?: ProgressCallback
): Promise<TextureInfo[]> {
  const textures: TextureInfo[] = [];
  
  // 确保缓存目录存在
  if (!fs.existsSync(options.cacheDir)) {
    fs.mkdirSync(options.cacheDir, { recursive: true });
  }

  // 收集所有材质文件
  const textureFiles: Array<{ path: string; data: Buffer }> = [];

  for (const entry of entries) {
    // 匹配 assets/{modid}/textures/{type}/{name}.png
    const match = entry.path.match(/^assets\/([a-z0-9_]+)\/textures\/([a-z0-9_]+)\/(.+)\.png$/i);
    if (!match) continue;

    const [, modId, textureType, textureName] = match;
    
    // 过滤非期望模组的材质
    if (modId !== expectedModId) {
      continue;
    }

    // 如果 itemsOnly 为 true，只提取物品和方块材质（用于物品栏显示）
    if (options.itemsOnly && textureType !== 'item' && textureType !== 'block') {
      continue;
    }

    textureFiles.push(entry);
  }

  // 提取每个材质
  for (let i = 0; i < textureFiles.length; i++) {
    const entry = textureFiles[i];
    const match = entry.path.match(/^assets\/([a-z0-9_]+)\/textures\/([a-z0-9_]+)\/(.+)\.png$/i);
    if (!match) continue;

    const [, modId, textureType, textureName] = match;

    onProgress?.({
      stage: 'extracting_textures',
      stageLabel: `Extracting texture: ${textureName}.png`,
      percent: 75 + Math.round((i / textureFiles.length) * 15),
      currentFile: entry.path,
      processedCount: i,
      totalCount: textureFiles.length,
    });

    try {
      // 计算文件哈希 (使用 sha256 与 jar.ts 保持一致)
      const fileHash = crypto.createHash('sha256').update(entry.data).digest('hex');
      
      // 生成缓存文件名
      const cacheName = `${modId}_${textureType}_${textureName.replace(/\//g, '_')}_${fileHash.slice(0, 8)}.png`;
      const cachePath = path.join(options.cacheDir, cacheName);

      // 检查是否已存在
      if (options.skipExisting && fs.existsSync(cachePath)) {
        textures.push({
          path: entry.path,
          modId,
          itemName: textureName,
          data: entry.data,
          cacheName,
        });
        continue;
      }

      // 写入缓存
      fs.writeFileSync(cachePath, entry.data);

      textures.push({
        path: entry.path,
        modId,
        itemName: textureName,
        data: entry.data,
        cacheName,
      });
    } catch (error) {
      console.warn(`[TextureExtractor] Failed to extract texture ${entry.path}:`, error);
    }
  }

  return textures;
}

/**
 * 获取材质的缓存路径
 * @param textureId 材质 ID
 * @param cacheDir 缓存目录
 * @returns 缓存文件路径（如果不存在则返回 null）
 */
export function getTextureCachePath(
  textureId: string,
  cacheDir: string
): string | null {
  const parts = textureId.split(':');
  if (parts.length !== 2) return null;

  const [modId, texturePath] = parts;
  const fileName = texturePath.replace(/\//g, '_');

  // 查找匹配的文件
  try {
    const files = fs.readdirSync(cacheDir);
    const pattern = new RegExp(`^${modId}_.*_${fileName}_[a-f0-9]{8}\\.png$`);
    
    for (const file of files) {
      if (pattern.test(file)) {
        return path.join(cacheDir, file);
      }
    }
  } catch {
    // 目录不存在或读取失败
  }

  return null;
}

/**
 * 清理过期的材质缓存
 * @param cacheDir 缓存目录
 * @param maxAge 最大缓存时间（毫秒，默认 30 天）
 * @returns 清理的文件数量
 */
export function cleanupTextureCache(cacheDir: string, maxAge: number = 30 * 24 * 60 * 60 * 1000): number {
  let deletedCount = 0;

  try {
    const files = fs.readdirSync(cacheDir);
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith('.png')) continue;

      const filePath = path.join(cacheDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
  } catch (error) {
    console.warn('[TextureExtractor] Failed to cleanup cache:', error);
  }

  return deletedCount;
}

/**
 * 获取材质缓存大小
 * @param cacheDir 缓存目录
 * @returns 缓存大小（字节）
 */
export function getTextureCacheSize(cacheDir: string): number {
  try {
    const files = fs.readdirSync(cacheDir);
    let totalSize = 0;

    for (const file of files) {
      if (!file.endsWith('.png')) continue;
      
      const stats = fs.statSync(path.join(cacheDir, file));
      totalSize += stats.size;
    }

    return totalSize;
  } catch {
    return 0;
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 从物品 ID 推断材质路径
 */
export function inferTexturePath(itemId: string, isBlock: boolean = false): string | null {
  const parts = itemId.split(':');
  if (parts.length !== 2) return null;

  const [modId, itemName] = parts;
  const textureType = isBlock ? 'block' : 'item';
  
  return `assets/${modId}/textures/${textureType}/${itemName}.png`;
}
