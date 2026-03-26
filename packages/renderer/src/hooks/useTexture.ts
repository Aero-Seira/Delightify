/**
 * 纹理加载 Hook - v2.1
 * 
 * v2.1 架构中暂时禁用纹理加载，使用 fallback 图标
 * 后续版本可以重新实现基于新数据结构的纹理加载
 */

import { useState, useCallback } from 'react';

interface TextureState {
  /** 纹理数据 (Base64) */
  data: string | null;
  /** 是否加载中 */
  loading: boolean;
  /** 是否出错（纹理不存在） */
  error: boolean;
  /** 是否为 fallback 纹理 */
  isFallback: boolean;
}

interface UseTextureOptions {
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 加载超时时间（毫秒） */
  timeout?: number;
}

// 全局纹理缓存
const textureCache = new Map<string, string>();

/**
 * 使用纹理 Hook - v2.1 简化版
 * 
 * @param itemId 物品ID
 * @param options 选项
 * @returns 纹理状态和重新加载函数
 */
export function useTexture(
  itemId: string | null | undefined,
  options: UseTextureOptions = {}
): TextureState & { reload: () => void } {
  // v2.1 暂时返回空状态，表示没有纹理
  // 这样可以避免组件渲染时的错误
  return {
    data: null,
    loading: false,
    error: true,
    isFallback: true,
    reload: () => {},
  };
}

/**
 * 批量预加载纹理 - v2.1 空实现
 */
export async function preloadTextures(_itemIds: string[]): Promise<void> {
  // v2.1 暂时禁用
  return;
}

/**
 * 清除纹理缓存
 */
export function clearTextureCache(): void {
  textureCache.clear();
}

/**
 * 获取缓存统计
 */
export function getTextureCacheStats(): { size: number; keys: string[] } {
  return {
    size: textureCache.size,
    keys: Array.from(textureCache.keys()),
  };
}
