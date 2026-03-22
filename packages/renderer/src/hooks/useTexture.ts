/**
 * 纹理加载 Hook
 * 
 * 提供智能的纹理加载、缓存和 fallback 处理
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { electronAPI } from '../ipc';

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
 * 使用纹理 Hook
 * 
 * @param itemId 物品ID
 * @param options 选项
 * @returns 纹理状态和重新加载函数
 */
export function useTexture(
  itemId: string | null | undefined,
  options: UseTextureOptions = {}
): TextureState & { reload: () => void } {
  const { enableCache = true, timeout = 10000 } = options;
  
  const [state, setState] = useState<TextureState>({
    data: null,
    loading: false,
    error: false,
    isFallback: false,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const loadTexture = useCallback(async () => {
    if (!itemId) {
      setState({ data: null, loading: false, error: false, isFallback: false });
      return;
    }
    
    // 检查缓存
    if (enableCache && textureCache.has(itemId)) {
      setState({
        data: textureCache.get(itemId)!,
        loading: false,
        error: false,
        isFallback: false,
      });
      return;
    }
    
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    setState(prev => ({ ...prev, loading: true, error: false }));
    
    try {
      const api = electronAPI();
      const result = await api.itemsGetTexture(itemId);
      
      if (result.success && result.data) {
        // 存入缓存
        if (enableCache) {
          textureCache.set(itemId, result.data);
        }
        setState({
          data: result.data,
          loading: false,
          error: false,
          isFallback: false,
        });
      } else {
        // 纹理不存在
        setState({
          data: null,
          loading: false,
          error: true,
          isFallback: false,
        });
      }
    } catch (err) {
      console.warn(`[useTexture] Failed to load texture for ${itemId}:`, err);
      setState({
        data: null,
        loading: false,
        error: true,
        isFallback: false,
      });
    }
  }, [itemId, enableCache]);
  
  useEffect(() => {
    loadTexture();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadTexture]);
  
  return {
    ...state,
    reload: loadTexture,
  };
}

/**
 * 批量预加载纹理
 * 
 * @param itemIds 物品ID数组
 */
export async function preloadTextures(itemIds: string[]): Promise<void> {
  const api = electronAPI();
  const uncachedIds = itemIds.filter(id => !textureCache.has(id));
  
  if (uncachedIds.length === 0) return;
  
  // 并行加载（限制并发数）
  const batchSize = 10;
  for (let i = 0; i < uncachedIds.length; i += batchSize) {
    const batch = uncachedIds.slice(i, i + batchSize);
    const promises = batch.map(async (itemId) => {
      try {
        const result = await api.itemsGetTexture(itemId);
        if (result.success && result.data) {
          textureCache.set(itemId, result.data);
        }
      } catch (err) {
        console.warn(`[preloadTextures] Failed to preload ${itemId}:`, err);
      }
    });
    await Promise.all(promises);
  }
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
