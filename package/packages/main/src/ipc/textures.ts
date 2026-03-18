import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { IpcResponse } from '@delightify/shared';
import { appPaths } from '../services/paths';

// M2 placeholder: Texture metadata storage
interface TextureMetadata {
  itemId: string;
  texturePath: string;
  cachedAt: string;
}

const textureCache = new Map<string, TextureMetadata>();

export function registerTexturesHandlers(): void {
  // Texture-related handlers will be implemented in Phase 2
  // Currently textures are served via items:get-texture in the items handler
  
  console.log('Texture handlers registered (M2 placeholder)');

  // Future handlers for M2:
  
  // TEXTURE_CACHE_CLEAR: Clear texture cache
  ipcMain.handle('texture:cache-clear', async (): Promise<IpcResponse<{ cleared: boolean }>> => {
    try {
      console.log('texture:cache-clear');
      
      // M2 placeholder: Clear in-memory cache
      textureCache.clear();
      
      return { success: true, data: { cleared: true } };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear texture cache';
      console.error('TEXTURE_CACHE_CLEAR error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // TEXTURE_GET_CACHE_INFO: Get texture cache statistics
  ipcMain.handle('texture:cache-info', async (): Promise<IpcResponse<{
    cacheSize: number;
    cachePath: string;
  }>> => {
    try {
      console.log('texture:cache-info');
      
      // M2 placeholder: Return cache info
      const result = {
        cacheSize: textureCache.size,
        cachePath: appPaths.textureCache,
      };
      
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get cache info';
      console.error('TEXTURE_CACHE_INFO error:', error);
      return { success: false, error: errorMessage };
    }
  });
}
