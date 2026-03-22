/**
 * 纹理解析器
 * 
 * 提供更智能的物品到纹理的映射解析
 * 处理特殊情况：流体、分层纹理、动态纹理等
 */

import * as fs from 'fs';
import * as path from 'path';
import { appPaths } from '../paths';
import { createGlobalDbClient } from '../database';
import { getResourceLoader, initResourceLoader } from '../jar-parser/resource-loader';

export interface ResolvedTexture {
  /** 纹理缓存文件名或base64数据 */
  cacheName: string;
  /** 纹理类型 */
  type: 'item' | 'block' | 'fluid' | 'generated';
  /** 是否是替代纹理 */
  isFallback: boolean;
  /** 替代原因 */
  fallbackReason?: string;
}

/**
 * 流体特殊处理列表
 * 这些物品通常使用流体纹理，需要特殊处理
 */
const FLUID_ITEMS = [
  'water', 'lava', 'milk', 'honey', 'slime',
  'gasoline', 'diesel', 'kerosene', 'lubricant',
  'nuclear_waste', 'toxic_waste', 'raw_sludge',
  // 添加更多流体相关关键词
];

/**
 * 检查物品是否是流体类型
 */
function isFluidItem(itemId: string): boolean {
  const lowerId = itemId.toLowerCase();
  return FLUID_ITEMS.some(fluid => lowerId.includes(fluid));
}

/**
 * 尝试从文件系统缓存查找流体纹理
 */
function findFluidTextureInCache(itemId: string): ResolvedTexture | null {
  const parts = itemId.split(':');
  if (parts.length !== 2) return null;
  
  const [modId, itemName] = parts;
  const cacheDir = appPaths.textureCache;
  
  if (!fs.existsSync(cacheDir)) return null;
  
  const files = fs.readdirSync(cacheDir);
  
  // 1. 查找流体专用纹理
  const fluidPatterns = [
    new RegExp(`^${modId}_fluid_${itemName}_[a-f0-9]+\\.png$`, 'i'),
    new RegExp(`^${modId}_block_fluid_${itemName}_[a-f0-9]+\\.png$`, 'i'),
    new RegExp(`^${modId}_.*${itemName}.*_flowing_[a-f0-9]+\\.png$`, 'i'),
    new RegExp(`^${modId}_.*${itemName}.*_still_[a-f0-9]+\\.png$`, 'i'),
  ];
  
  for (const pattern of fluidPatterns) {
    const match = files.find(f => pattern.test(f));
    if (match) {
      return {
        cacheName: match,
        type: 'fluid',
        isFallback: false,
      };
    }
  }
  
  // 2. 流体通常有桶装版本
  const bucketName = itemName.replace(/_bucket$/, '').replace(/^bucket_/, '');
  const bucketPatterns = [
    new RegExp(`^${modId}_item_${bucketName}_bucket_[a-f0-9]+\\.png$`, 'i'),
    new RegExp(`^${modId}_item_bucket_${bucketName}_[a-f0-9]+\\.png$`, 'i'),
  ];
  
  for (const pattern of bucketPatterns) {
    const match = files.find(f => pattern.test(f));
    if (match) {
      return {
        cacheName: match,
        type: 'item',
        isFallback: false,
      };
    }
  }
  
  return null;
}

/**
 * 智能纹理解析
 * 
 * 尝试多种策略找到最佳纹理，优先级：
 * 1. 使用新的ResourceLoader（基于数据库的完整模型解析）
 * 2. 流体特殊处理
 * 3. 数据库记录
 * 4. 文件系统缓存匹配
 */
export async function resolveItemTexture(itemId: string): Promise<ResolvedTexture | null> {
  const parts = itemId.split(':');
  if (parts.length !== 2) return null;
  
  const [modId, itemName] = parts;
  const cacheDir = appPaths.textureCache;
  
  // 策略 1: 使用新的ResourceLoader进行完整的模型解析
  try {
    const loader = getResourceLoader();
    const renderData = await loader.resolveItemRenderData(itemId);
    
    if (renderData.texture2d) {
      // 找到了纹理，存储为base64数据
      return {
        cacheName: renderData.texture2d,  // 这里存储的是base64数据
        type: renderData.renderType === 'unknown' ? 'generated' : renderData.renderType,
        isFallback: false,
      };
    }
  } catch (error) {
    console.warn(`[TextureResolver] ResourceLoader failed for ${itemId}:`, error);
  }
  
  // 策略 2: 流体特殊处理（优先从缓存查找）
  if (isFluidItem(itemId)) {
    const fluidTexture = findFluidTextureInCache(itemId);
    if (fluidTexture) return fluidTexture;
  }
  
  // 策略 3: 从数据库获取
  const db = createGlobalDbClient(appPaths.globalDb);
  const dbResult = await db.execute({
    sql: 'SELECT texture_cache_name, texture_type FROM items WHERE item_id = ?',
    args: [itemId],
  });
  
  const dbRow = dbResult.rows[0] as any;
  if (dbRow?.texture_cache_name) {
    // 验证文件是否存在
    const cachePath = path.join(cacheDir, dbRow.texture_cache_name);
    if (fs.existsSync(cachePath)) {
      return {
        cacheName: dbRow.texture_cache_name,
        type: dbRow.texture_type || 'item',
        isFallback: false,
      };
    }
  }
  
  // 策略 4: 文件系统缓存精确匹配
  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir);
    
    // 精确匹配物品纹理
    const itemPattern = new RegExp(`^${modId}_item_${itemName}_[a-f0-9]{8,16}\\.png$`, 'i');
    const itemMatch = files.find(f => itemPattern.test(f));
    if (itemMatch) {
      return {
        cacheName: itemMatch,
        type: 'item',
        isFallback: false,
      };
    }
    
    // 精确匹配方块纹理
    const blockPattern = new RegExp(`^${modId}_block_${itemName}_[a-f0-9]{8,16}\\.png$`, 'i');
    const blockMatch = files.find(f => blockPattern.test(f));
    if (blockMatch) {
      return {
        cacheName: blockMatch,
        type: 'block',
        isFallback: false,
      };
    }
    
    // 模糊匹配
    const normalizedName = itemName.toLowerCase().replace(/_/g, '');
    const candidates: { file: string; score: number; type: 'item' | 'block' }[] = [];
    
    for (const file of files) {
      if (!file.startsWith(`${modId}_`)) continue;
      
      const fileLower = file.toLowerCase();
      const fileNormalized = fileLower.replace(/_/g, '').replace(/[a-f0-9]{8,16}\.png$/, '');
      
      const isItem = fileLower.includes('_item_');
      const isBlock = fileLower.includes('_block_');
      
      if (!isItem && !isBlock) continue;
      
      let score = 0;
      if (fileNormalized.includes(normalizedName)) {
        score += 100;
      } else if (normalizedName.includes(fileNormalized.replace(/item|block/g, ''))) {
        score += 50;
      } else {
        const itemWords = itemName.split('_');
        const fileWords = file.replace(/_[a-f0-9]{8,16}\.png$/, '').split('_');
        const matchingWords = itemWords.filter(w => fileWords.includes(w));
        score += matchingWords.length * 30;
      }
      
      if (score > 0) {
        candidates.push({
          file,
          score,
          type: isBlock ? 'block' : 'item',
        });
      }
    }
    
    candidates.sort((a, b) => b.score - a.score);
    
    if (candidates.length > 0) {
      const best = candidates[0];
      return {
        cacheName: best.file,
        type: best.type,
        isFallback: true,
        fallbackReason: `Fuzzy match (score: ${best.score})`,
      };
    }
  }
  
  return null;
}

/**
 * 查找最佳纹理（简化接口）
 * 
 * 返回最佳匹配的纹理数据
 */
export async function findBestTexture(itemId: string): Promise<{
  textureBase64: string | null;
  source: string;
  textureType: 'item' | 'block' | 'generated';
}> {
  const resolved = await resolveItemTexture(itemId);
  
  if (!resolved) {
    return { textureBase64: null, source: 'none', textureType: 'generated' };
  }
  
  try {
    let data: string | null = null;
    
    // 检查cacheName是否是base64数据
    if (resolved.cacheName.startsWith('data:image/png;base64,')) {
      data = resolved.cacheName;
    } else {
      // 从文件系统读取
      const cachePath = path.join(appPaths.textureCache, resolved.cacheName);
      const buffer = fs.readFileSync(cachePath);
      data = `data:image/png;base64,${buffer.toString('base64')}`;
    }
    
    return {
      textureBase64: data,
      source: resolved.isFallback ? 'fuzzy_match' : 'exact_match',
      textureType: resolved.type === 'fluid' ? 'item' : resolved.type,
    };
  } catch (error) {
    console.warn(`[TextureResolver] Failed to read texture for ${itemId}:`, error);
    return { textureBase64: null, source: 'error', textureType: 'generated' };
  }
}

/**
 * 获取纹理数据（Base64）
 */
export async function getItemTextureData(itemId: string): Promise<{
  data: string | null;
  resolved: ResolvedTexture | null;
}> {
  const resolved = await resolveItemTexture(itemId);
  
  if (!resolved) {
    return { data: null, resolved: null };
  }
  
  try {
    // 检查cacheName是否是base64数据（来自ResourceLoader）
    if (resolved.cacheName.startsWith('data:image/png;base64,')) {
      return { data: resolved.cacheName, resolved };
    }
    
    // 否则从文件系统读取
    const cachePath = path.join(appPaths.textureCache, resolved.cacheName);
    const data = fs.readFileSync(cachePath);
    const base64 = `data:image/png;base64,${data.toString('base64')}`;
    return { data: base64, resolved };
  } catch (error) {
    console.warn(`[TextureResolver] Failed to read texture for ${itemId}:`, error);
    return { data: null, resolved };
  }
}

/**
 * 生成缺失纹理（紫色/黑色棋盘格）
 */
export function generateMissingTexture(): string {
  // 创建一个64x64的棋盘格PNG数据
  // 使用简化的base64编码PNG
  // 这是一个1x1像素的洋红色PNG，实际应该生成棋盘格
  const canvas = createVirtualCanvas(64, 64);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  const tileSize = 16;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#f800f8' : '#000000';
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }
  
  // 在Node.js环境中，我们需要使用不同的方法
  // 这里返回一个固定的base64编码的棋盘格PNG
  return getMissingTextureBase64();
}

/**
 * 生成字母备用纹理信息
 */
export function generateLetterFallback(itemId: string): { char: string; color: string } {
  const parts = itemId.split(':');
  const name = parts[parts.length - 1];
  const char = name.charAt(0).toUpperCase();
  const color = getConsistentColor(itemId);
  
  return { char, color };
}

/**
 * 创建虚拟Canvas（在Node.js环境中）
 */
function createVirtualCanvas(width: number, height: number): HTMLCanvasElement {
  // 在Electron主进程中，我们需要使用不同的方法
  // 这里返回一个模拟的canvas对象
  const canvas = {
    width,
    height,
    getContext: (type: string) => {
      if (type === '2d') {
        return {
          fillStyle: '#000000',
          fillRect: () => {},
        };
      }
      return null;
    },
  } as any;
  return canvas;
}

/**
 * 获取缺失纹理的base64编码
 */
function getMissingTextureBase64(): string {
  // 这是一个64x64像素的洋红色和黑色棋盘格PNG
  // 简化的实现：使用固定颜色
  const colors = {
    magenta: { r: 0xf8, g: 0x00, b: 0xf8 },
    black: { r: 0x00, g: 0x00, b: 0x00 },
  };
  
  // 生成简单的PNG（这里简化处理，返回一个固定的data URL）
  // 实际应该生成真正的棋盘格纹理
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAQAAAAAYLlVAAAAPElEQVR42u3OMQ0AAAgDsPlX4wCdpeCjqaZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZm5r4B/pPBJV5Q740AAAAASUVORK5CYII=';
}

/**
 * 获取一致的颜色
 */
function getConsistentColor(itemId: string): string {
  const colors = [
    '#e53935', '#d81b60', '#8e24aa', '#5e35b1',
    '#3949ab', '#1e88e5', '#039be5', '#00acc1',
    '#00897b', '#43a047', '#7cb342', '#c0ca33',
    '#fdd835', '#ffb300', '#fb8c00', '#f4511e',
  ];

  let hash = 0;
  for (let i = 0; i < itemId.length; i++) {
    hash = itemId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * 初始化纹理系统
 */
export async function initTextureResolver(): Promise<void> {
  try {
    await initResourceLoader();
    console.log('[TextureResolver] Initialized with ResourceLoader');
  } catch (error) {
    console.warn('[TextureResolver] Failed to init ResourceLoader, using fallback:', error);
  }
}
