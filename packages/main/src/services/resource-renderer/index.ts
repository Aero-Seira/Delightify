/**
 * Resource Renderer Service
 * 
 * 提供物品/方块的渲染数据服务
 * 包括：纹理查找、3D面数据、缺失纹理处理
 */

import { getResourceLoader, type ItemRenderData } from '../jar-parser/resource-loader';
import { findBestTexture as findBestTextureInternal, generateMissingTexture as genMissingTex, generateLetterFallback as genLetterFallback } from './texture-resolver';

export interface RenderData {
  /** Base64纹理数据 */
  textureBase64: string | null;
  /** 各面纹理（用于3D渲染） */
  faces3d: {
    top?: string;
    bottom?: string;
    north?: string;
    south?: string;
    east?: string;
    west?: string;
  } | null;
  /** 渲染类型 */
  renderType: 'item' | 'block' | 'generated' | 'unknown';
  /** 是否为缺失纹理 */
  isMissing: boolean;
  /** 备用字母 */
  fallbackLetter: string;
  /** 来源 */
  source: 'database' | 'exact_match' | 'fuzzy_match' | 'generated' | 'fallback';
}

/** 缓存 */
const renderCache = new Map<string, RenderData>();
const textureIdCache = new Map<string, string | null>();

/**
 * 获取物品的渲染数据
 */
export async function getItemRenderData(itemId: string): Promise<RenderData> {
  // 检查缓存
  if (renderCache.has(itemId)) {
    return renderCache.get(itemId)!;
  }

  const loader = getResourceLoader();
  
  // 使用资源加载器解析渲染数据
  const renderData = await loader.resolveItemRenderData(itemId);

  // 转换为RenderData格式
  const data: RenderData = {
    textureBase64: renderData.texture2d || null,
    faces3d: renderData.faces3d || null,
    renderType: renderData.renderType === 'unknown' ? 'generated' : renderData.renderType,
    isMissing: !renderData.texture2d && !renderData.faces3d,
    fallbackLetter: getItemLetter(itemId),
    source: renderData.texture2d ? 'database' : 'fallback',
  };

  // 缓存结果
  renderCache.set(itemId, data);
  return data;
}

/**
 * 获取纹理ID（路径）用于延迟加载
 */
export async function getItemTextureId(itemId: string): Promise<string | null> {
  if (textureIdCache.has(itemId)) {
    return textureIdCache.get(itemId)!;
  }

  const loader = getResourceLoader();
  const renderData = await loader.resolveItemRenderData(itemId);

  // 返回2D纹理路径
  const textureId = renderData.texture2d || null;
  textureIdCache.set(itemId, textureId);
  return textureId;
}

/**
 * 生成缺失纹理（紫色/黑色棋盘格）
 */
export function generateMissingTexture(): string {
  // 返回简化的缺失纹理data URL
  // 这是一个1x1像素的洋红色PNG作为占位
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAQAAAAAYLlVAAAAPElEQVR42u3OMQ0AAAgDsPlX4wCdpeCjqaZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZm5r4B/pPBJV5Q740AAAAASUVORK5CYII=';
}

/**
 * 生成字母备用纹理
 */
export function generateLetterFallback(itemId: string): { char: string; color: string } {
  const letter = getItemLetter(itemId);
  const color = getConsistentColor(itemId);

  return { char: letter, color };
}

/**
 * 获取物品的代表字母
 */
function getItemLetter(itemId: string): string {
  const parts = itemId.split(':');
  const name = parts[parts.length - 1];
  return name.charAt(0).toUpperCase();
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
 * 查找最佳纹理（兼容旧接口）
 */
export async function findBestTexture(itemId: string): Promise<{
  textureBase64: string | null;
  source: string;
  textureType: 'item' | 'block' | 'generated';
}> {
  return findBestTextureInternal(itemId);
}

/**
 * 预加载多个物品的纹理
 */
export async function preloadTextures(itemIds: string[]): Promise<void> {
  const loader = getResourceLoader();
  
  // 并行加载
  await Promise.all(
    itemIds.map(async (id) => {
      try {
        await loader.resolveItemRenderData(id);
      } catch (e) {
        console.warn(`[ResourceRenderer] Failed to preload: ${id}`);
      }
    })
  );
}

/**
 * 清除缓存
 */
export function clearRenderCache(): void {
  renderCache.clear();
  textureIdCache.clear();
}

/**
 * 获取缓存统计
 */
export function getCacheStats(): {
  renderCache: number;
  textureIdCache: number;
} {
  return {
    renderCache: renderCache.size,
    textureIdCache: textureIdCache.size,
  };
}

// 重新导出 texture-resolver 的函数
export { getItemTextureData, resolveItemTexture, initTextureResolver } from './texture-resolver';
export type { ResolvedTexture } from './texture-resolver';
