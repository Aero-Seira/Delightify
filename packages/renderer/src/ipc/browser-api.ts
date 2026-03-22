/**
 * 浏览器完整功能 API
 * 在浏览器中模拟 Electron 的所有功能
 * - 文件系统访问（File System Access API）
 * - 数据库存储（IndexedDB）
 * - JAR 解析（JSZip）
 * - 纹理缓存（IndexedDB + Blob URLs）
 */

import { browserDB, initBrowserDB } from './browser-db';
import { 
  selectDirectory, 
  selectJarFile, 
  readJarFile,
  supportsFileSystemAccess 
} from './browser-fs';
import type { Project, Mod, Item } from '@delightify/shared';
import { mockElectronAPI } from './mock';

// 纹理缓存（内存中）
const textureCache = new Map<string, string>();

/**
 * 浏览器完整 API 实现
 */
export const browserElectronAPI = {
  // ========== 初始化 ==========
  async init() {
    await initBrowserDB();
    console.log('[BrowserAPI] Initialized');
  },

  // ========== Project Management ==========
  projectList: async () => {
    const result = await browserDB.execute<Project>('mods'); // 使用 mods 表存储项目信息
    // 如果没有项目，返回空数组
    return { success: true, data: [], total: 0 };
  },

  projectOpen: async (projectId?: string) => {
    return { success: true, data: null, canceled: true };
  },

  projectCreate: async (data: any) => {
    return { success: true, data: null };
  },

  projectGetCurrent: async () => {
    return { success: true, data: null };
  },

  projectUpdate: async () => ({ success: true }),
  projectDelete: async () => ({ success: true }),

  selectDirectory: async () => {
    return await selectDirectory();
  },

  // ========== JAR Import ==========
  jarList: async () => {
    const result = await browserDB.execute<Mod>('mods');
    return { success: true, data: result.rows };
  },

  jarSelect: async () => {
    const result = await selectJarFile();
    return { 
      success: !result.canceled, 
      data: result.canceled ? null : result.filePath 
    };
  },

  jarImport: async (filePath: string) => {
    try {
      // 1. 选择文件
      const fileResult = await selectJarFile();
      if (fileResult.canceled || !fileResult.file) {
        return { success: false, error: 'User canceled' };
      }

      const file = fileResult.file;
      
      // 2. 读取 JAR 内容
      const { entries } = await readJarFile(file);
      
      // 3. 解析 JAR 内容
      const modId = file.name.replace('.jar', '').toLowerCase();
      const now = new Date().toISOString();
      
      // 解析模组信息
      const modInfo = {
        mod_id: modId,
        mod_name: modId,
        version: 'unknown',
        mc_version: '1.20.1',
        item_count: 0,
        recipe_count: 0,
        parsed_at: now,
      };

      // 4. 解析物品、纹理等
      const items: Item[] = [];
      const textures: Array<{ path: string; cacheName: string; blob: Blob }> = [];
      
      for (const entry of entries) {
        // 解析物品（从 lang 文件）
        if (entry.path.endsWith('.json') && entry.path.includes('/lang/')) {
          try {
            const text = new TextDecoder().decode(entry.data);
            const lang = JSON.parse(text);
            
            for (const [key, value] of Object.entries(lang)) {
              if (key.startsWith('item.') || key.startsWith('block.')) {
                const parts = key.split('.');
                if (parts.length >= 3) {
                  const itemName = parts[2];
                  const isBlock = key.startsWith('block.');
                  
                  items.push({
                    itemId: `${modId}:${itemName}`,
                    modId,
                    name: itemName,
                    displayName: value as string,
                    displayNameKey: key,
                    category: isBlock ? 'block' : 'misc',
                    isBlock,
                    textureType: isBlock ? 'block' : 'item',
                    textureCacheName: `${modId}_${isBlock ? 'block' : 'item'}_${itemName}_00000000.png`,
                    createdAt: now,
                  });
                }
              }
            }
          } catch (e) {
            console.warn('Failed to parse lang file:', entry.path);
          }
        }
        
        // 解析纹理
        if (entry.path.endsWith('.png') && entry.path.includes('/textures/')) {
          const blob = new Blob([new Uint8Array(entry.data)], { type: 'image/png' });
          const pathParts = entry.path.split('/');
          const fileName = pathParts[pathParts.length - 1].replace('.png', '');
          const type = entry.path.includes('/block/') ? 'block' : 'item';
          
          textures.push({
            path: entry.path,
            cacheName: `${modId}_${type}_${fileName}_00000000.png`,
            blob,
          });
        }
      }

      // 5. 保存到数据库
      await browserDB.put('mods', {
        ...modInfo,
        item_count: items.length,
        recipe_count: 0,
      });

      for (const item of items) {
        await browserDB.put('items', {
          item_id: item.itemId,
          mod_id: item.modId,
          display_name_key: item.displayNameKey,
          display_name: item.displayName,
          category: item.category,
          texture_cache_name: item.textureCacheName,
          texture_type: item.textureType,
          is_block: item.isBlock ? 1 : 0,
          created_at: item.createdAt,
        });
      }

      for (const tex of textures) {
        await browserDB.saveTexture(tex.cacheName, tex.blob, {
          modId,
          itemName: tex.cacheName,
          path: tex.path,
        });
        
        // 创建 blob URL 用于显示
        const url = URL.createObjectURL(tex.blob);
        textureCache.set(tex.cacheName, url);
      }

      return {
        success: true,
        data: {
          success: true,
          filePath: file.name,
          modId,
          modName: modId,
          itemCount: items.length,
          recipeCount: 0,
          tagCount: 0,
          textureCount: textures.length,
        },
      };
    } catch (error) {
      console.error('JAR import error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Import failed' 
      };
    }
  },

  jarDelete: async (modId: string) => {
    await browserDB.delete('mods', modId);
    // 删除相关物品
    const items = await browserDB.query('items', 'mod_id', modId);
    for (const item of items.rows) {
      await browserDB.delete('items', item.item_id);
    }
    return { success: true, data: true };
  },

  jarGetDetails: async (modId: string) => {
    const result = await browserDB.execute<any>('mods');
    const mod = result.rows.find((m: any) => m.mod_id === modId);
    if (!mod) return { success: true, data: null };
    return { 
      success: true, 
      data: {
        modId: mod.mod_id,
        modName: mod.mod_name,
        version: mod.version,
        mcVersion: mod.mc_version,
        sourceType: 'jar',
        itemCount: mod.item_count,
        recipeCount: mod.recipe_count,
      } as Mod
    };
  },

  onJarImportProgress: (callback: (progress: any) => void) => {
    // 浏览器模式下进度通过 Promise 回调实现
    return () => {};
  },

  // ========== Items ==========
  itemsQuery: async (params: any) => {
    const { search, modId, category, textureType, page = 1, pageSize = 50 } = params;
    
    let items: Item[] = [];
    
    if (modId) {
      const result = await browserDB.query<any>('items', 'mod_id', modId);
      items = result.rows.map(row => ({
        itemId: row.item_id,
        modId: row.mod_id,
        name: row.item_id.split(':')[1],
        displayName: row.display_name,
        displayNameKey: row.display_name_key,
        category: row.category,
        texturePath: row.texture_path,
        textureCacheName: row.texture_cache_name,
        textureType: row.texture_type,
        isBlock: row.is_block === 1,
        createdAt: row.created_at,
      }));
    } else {
      const result = await browserDB.execute<any>('items');
      items = result.rows.map(row => ({
        itemId: row.item_id,
        modId: row.mod_id,
        name: row.item_id.split(':')[1],
        displayName: row.display_name,
        displayNameKey: row.display_name_key,
        category: row.category,
        texturePath: row.texture_path,
        textureCacheName: row.texture_cache_name,
        textureType: row.texture_type,
        isBlock: row.is_block === 1,
        createdAt: row.created_at,
      }));
    }
    
    // 过滤
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(i => 
        i.itemId.toLowerCase().includes(searchLower) ||
        (i.displayName && i.displayName.toLowerCase().includes(searchLower))
      );
    }
    
    if (category) {
      items = items.filter(i => i.category === category);
    }
    
    if (textureType) {
      items = items.filter(i => i.textureType === textureType);
    }
    
    const start = (page - 1) * pageSize;
    const paginated = items.slice(start, start + pageSize);
    
    return {
      success: true,
      data: {
        items: paginated,
        total: items.length,
        page,
        pageSize,
      },
    };
  },

  itemsGetTexture: async (itemId: string) => {
    try {
      // 获取物品的纹理信息
      const items = await browserDB.execute<any>('items');
      const item = items.rows.find((i: any) => i.item_id === itemId);
      
      if (!item || !item.texture_cache_name) {
        return { success: true, data: null };
      }
      
      // 检查内存缓存
      if (textureCache.has(item.texture_cache_name)) {
        return { success: true, data: textureCache.get(item.texture_cache_name) };
      }
      
      // 从数据库获取纹理 Blob
      const blob = await browserDB.getTexture(item.texture_cache_name);
      if (blob) {
        const url = URL.createObjectURL(blob);
        textureCache.set(item.texture_cache_name, url);
        return { success: true, data: url };
      }
      
      return { success: true, data: null };
    } catch (error) {
      return { success: false, error: 'Failed to load texture' };
    }
  },

  itemsGetTextureFallback: async (itemId: string) => {
    // 使用 mock 的实现
    return mockElectronAPI.itemsGetTextureFallback(itemId);
  },

  itemsGetAllTags: async () => {
    return mockElectronAPI.itemsGetAllTags();
  },

  itemsGetCategories: async () => {
    const items = await browserDB.execute<any>('items');
    const categories = new Map<string, number>();
    
    for (const item of items.rows) {
      const cat = item.category || 'misc';
      categories.set(cat, (categories.get(cat) || 0) + 1);
    }
    
    return {
      success: true,
      data: Array.from(categories.entries()).map(([category, count]) => ({
        category,
        count,
      })),
    };
  },

  itemsGetDetail: async (itemId: string) => {
    const items = await browserDB.execute<any>('items');
    const item = items.rows.find((i: any) => i.item_id === itemId);
    
    if (!item) return { success: true, data: null };
    
    return {
      success: true,
      data: {
        itemId: item.item_id,
        modId: item.mod_id,
        displayName: item.display_name,
        category: item.category,
        textureType: item.texture_type,
        isBlock: item.is_block === 1,
        tags: [],
      },
    };
  },

  modsQuery: async () => {
    const result = await browserDB.execute<any>('mods');
    return {
      success: true,
      data: result.rows.map((m: any) => ({
        modId: m.mod_id,
        name: m.mod_name,
        itemCount: m.item_count || 0,
      })),
    };
  },

  tagsQuery: async () => {
    return mockElectronAPI.tagsQuery();
  },

  // ========== Recipes ==========
  recipesList: async () => ({ success: true, data: [] }),
  recipesCreate: async () => ({ success: true }),
  recipesUpdate: async () => ({ success: true }),
  recipesDelete: async () => ({ success: true }),
  recipesExport: async () => ({ success: true }),

  // ========== LLM ==========
  llmConvert: async () => ({ success: true, data: { results: [], status: 'complete' } }),
  llmCancel: async () => ({ success: true }),
  onLlmConvertProgress: () => () => {},

  // ========== Shell ==========
  openExternal: async (url: string) => {
    window.open(url, '_blank');
  },

  // ========== Debug ==========
  debugDbTables: async () => {
    const stats = await browserDB.getStats();
    return {
      success: true,
      data: Object.entries(stats).map(([name, rowCount]) => ({
        name,
        rowCount,
      })),
    };
  },

  debugDbQuery: async () => ({ success: true, data: [] }),
  debugDbDeleteMod: async (modId: string) => {
    await browserDB.delete('mods', modId);
    return { success: true };
  },
  debugDbClearAll: async () => {
    const stores = ['mods', 'items', 'recipes', 'tags', 'translations', 'textures'];
    for (const store of stores) {
      await browserDB.clear(store as any);
    }
    return { success: true };
  },
  debugCacheInfo: async () => {
    const textures = await browserDB.execute('textures');
    return {
      success: true,
      data: {
        cacheDir: 'indexeddb://textures',
        fileCount: textures.rows.length,
        totalSizeFormatted: 'N/A',
      },
    };
  },
  debugDbPath: async () => ({
    success: true,
    data: {
      globalDb: 'indexeddb://DelightifyDB',
      textureCache: 'indexeddb://textures',
      projectsJson: 'indexeddb://projects',
    },
  }),
  debugGetItemDetail: async (itemId: string) => {
    const items = await browserDB.execute<any>('items');
    const item = items.rows.find((i: any) => i.item_id === itemId);
    return {
      success: true,
      data: {
        item,
        translations: [],
        tags: [],
      },
    };
  },
};

// 自动初始化
if (typeof window !== 'undefined') {
  browserElectronAPI.init().catch(console.error);
}
