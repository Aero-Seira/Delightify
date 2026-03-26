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
import type { Project, Mod, Item, ItemQueryResult } from '@delightify/shared';

// 浏览器模式下的本地物品类型（包含扩展字段）
interface BrowserItem {
  itemId: string;
  modId: string;
  name?: string;
  displayName?: string;
  displayNameKey?: string;
  category?: string;
  textureCacheName?: string;
  textureType?: string;
  isBlock?: boolean;
  createdAt?: string;
}
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
      const items: BrowserItem[] = [];
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
        modid: mod.mod_id,
        version: mod.version,
        name: mod.mod_name,
      } as Mod
    };
  },

  onJarImportProgress: (callback: (progress: any) => void) => {
    // 浏览器模式下进度通过 Promise 回调实现
    return () => {};
  },

  // ========== Items ==========
  itemsQuery: async (params: any) => {
    const { search, modid, page = 1, pageSize = 50 } = params;
    
    let items: Item[] = [];
    
    // 从 browser DB 获取物品（简化结构）
    let result;
    if (modid) {
      result = await browserDB.query<any>('items', 'mod_id', modid);
    } else {
      result = await browserDB.execute<any>('items');
    }
    
    items = result.rows.map(row => ({
      itemId: row.item_id || row.itemId,
      modid: row.mod_id || row.modid,
    }));
    
    // 过滤
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(i => 
        i.itemId.toLowerCase().includes(searchLower)
      );
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
      } as ItemQueryResult,
    };
  },

  itemsGetById: async (itemId: string) => {
    const items = await browserDB.execute<any>('items');
    const item = items.rows.find((i: any) => (i.item_id || i.itemId) === itemId);
    
    if (!item) return { success: true, data: null };
    
    return {
      success: true,
      data: {
        itemId: item.item_id || item.itemId,
        modid: item.mod_id || item.modid,
      } as Item,
    };
  },

  // 浏览器模式下纹理相关功能使用 mock
  itemsGetTexture: async (itemId: string) => {
    return { success: true, data: null };
  },

  modsQuery: async () => {
    const result = await browserDB.execute<any>('mods');
    return {
      success: true,
      data: result.rows.map((m: any) => ({
        modid: m.mod_id || m.modid,
        version: m.version || 'unknown',
        name: m.mod_name || m.name || m.mod_id || m.modid,
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

  debugDbQuery: async (_projectPath: string, sql: string, _args?: unknown[]) => {
    // 浏览器模式下只支持简单的 SELECT 查询
    if (sql.toLowerCase().includes('select')) {
      const table = sql.toLowerCase().includes('from items') ? 'items' :
                    sql.toLowerCase().includes('from mods') ? 'mods' :
                    sql.toLowerCase().includes('from recipes') ? 'recipes' : null;
      if (table) {
        const result = await browserDB.execute(table);
        return { success: true, data: result.rows };
      }
    }
    return { success: true, data: [] };
  },

  debugClearData: async () => {
    const stores = ['mods', 'items', 'recipes', 'tags', 'translations', 'textures'];
    for (const store of stores) {
      await browserDB.clear(store as any);
    }
    return { success: true, data: { cleared: true } };
  },

  // ========== Mod Data Import ==========
  modDataDetect: async () => ({ success: true, data: { found: false } }),
  modDataValidate: async () => ({ success: true, data: { valid: false } }),
  modDataImport: async () => ({ success: true, data: { modCount: 0, itemCount: 0, recipeCount: 0, tagCount: 0 } }),
  onModDataImportProgress: () => () => {},

  // Import Engine Test
  importEngineTest: async (filePath: string) => {
    // 浏览器模式下不支持实际测试，返回 mock 数据
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      success: true,
      data: {
        oldEngine: {
          engine: 'old',
          duration: 1200,
          items: 156,
          blocks: 89,
          recipes: 234,
          tags: 45,
          errors: [],
          warnings: ['Some items may be missing'],
          details: {},
        },
        newEngine: {
          engine: 'new',
          duration: 850,
          items: 142,
          blocks: 78,
          recipes: 234,
          tags: 52,
          errors: [],
          warnings: [],
          details: {
            resolvedTagCount: 52,
            totalResolvedItems: 340,
          },
        },
        differences: [
          { type: 'removed', item: 'lemon_tree_upper', oldValue: 'block', newValue: undefined },
          { type: 'removed', item: 'lemon_tree_mid', oldValue: 'block', newValue: undefined },
          { type: 'added', item: 'lemon_tree', oldValue: undefined, newValue: 'multiblock' },
          { type: 'improved', item: 'Tag Resolution', description: 'New engine expands tag references', oldValue: '45 tags', newValue: '52 tags with 340 items' },
        ],
      },
    };
  },
  
  onImportEngineTestProgress: () => {
    return () => {};
  },
  
  // JAR Bytecode Import
  jarImportBytecode: async (filePath: string) => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      success: true,
      data: {
        items: 142,
        blocks: 78,
      },
    };
  },
  
  onJarImportBytecodeProgress: (callback: (progress: { phase: string; percent: number }) => void) => {
    let percent = 0;
    const interval = setInterval(() => {
      percent = (percent + 5) % 100;
      callback({ phase: 'analyzing', percent });
    }, 100);
    return () => clearInterval(interval);
  },
};

// 自动初始化
if (typeof window !== 'undefined') {
  browserElectronAPI.init().catch(console.error);
}
