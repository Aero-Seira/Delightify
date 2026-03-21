/**
 * Electron API Mock
 * 用于在浏览器环境中开发和调试
 * 使用 localStorage 持久化数据
 */

import type { Project, Mod, Item, ItemQueryParams, ItemQueryResult } from '@delightify/shared';

// localStorage 键名
const STORAGE_KEYS = {
  projects: 'delightify:mock:projects',
  mods: 'delightify:mock:mods',
  items: 'delightify:mock:items',
  currentProject: 'delightify:mock:currentProject',
};

// 从 localStorage 加载数据
function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
}

// 保存到 localStorage
function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[Mock] Failed to save to localStorage:', e);
  }
}

// 模拟数据存储（带持久化）
const mockStorage = {
  get projects() {
    return loadFromStorage<Project[]>(STORAGE_KEYS.projects, []);
  },
  set projects(value: Project[]) {
    saveToStorage(STORAGE_KEYS.projects, value);
  },
  
  get mods() {
    return loadFromStorage<Mod[]>(STORAGE_KEYS.mods, []);
  },
  set mods(value: Mod[]) {
    saveToStorage(STORAGE_KEYS.mods, value);
  },
  
  get items() {
    return loadFromStorage<Item[]>(STORAGE_KEYS.items, []);
  },
  set items(value: Item[]) {
    saveToStorage(STORAGE_KEYS.items, value);
  },
  
  get currentProject() {
    return loadFromStorage<Project | null>(STORAGE_KEYS.currentProject, null);
  },
  set currentProject(value: Project | null) {
    saveToStorage(STORAGE_KEYS.currentProject, value);
  },
};

// 模拟延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 生成示例物品的纹理数据（使用 Canvas 生成简单的彩色方块）
function generateMockTexture(itemId: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  // 使用 itemId 生成一致的随机颜色
  const hash = itemId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const hue = Math.abs(hash % 360);
  const color = `hsl(${hue}, 70%, 60%)`;
  const darkColor = `hsl(${hue}, 70%, 40%)`;
  
  // 绘制简单的方块纹理
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 64, 64);
  
  // 添加一些细节
  ctx.fillStyle = darkColor;
  ctx.fillRect(0, 0, 64, 8);
  ctx.fillRect(0, 56, 64, 8);
  ctx.fillRect(0, 0, 8, 64);
  ctx.fillRect(56, 0, 8, 64);
  
  // 添加高光
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(8, 8, 48, 8);
  ctx.fillRect(8, 8, 8, 48);
  
  return canvas.toDataURL('image/png');
}

// 生成示例物品数据
function generateMockItems(modId: string, count: number = 50): Item[] {
  const categories = ['food', 'tool', 'weapon', 'armor', 'block', 'material', 'misc'] as const;
  const items: Item[] = [];
  
  const names = [
    '苹果', '面包', '胡萝卜', '土豆', '番茄', '洋葱', '小麦', '大米',
    '铁镐', '铁斧', '铁剑', '铁锹', '铁锄', '弓', '箭',
    '石头', '泥土', '木头', '沙子', '玻璃', '砖块',
    '金锭', '银锭', '铜锭', '钻石', '红宝石',
    '药水', '书', '地图', '指南针', '时钟',
  ];
  
  for (let i = 0; i < count; i++) {
    const name = names[i % names.length] + (i >= names.length ? `_${i}` : '');
    const category = categories[i % categories.length];
    const isBlock = category === 'block' || i % 3 === 0;
    
    items.push({
      itemId: `${modId}:${name.toLowerCase().replace(/\s+/g, '_')}`,
      modId,
      name: name.toLowerCase().replace(/\s+/g, '_'),
      displayName: name,
      displayNameKey: `${isBlock ? 'block' : 'item'}.${modId}.${name.toLowerCase().replace(/\s+/g, '_')}`,
      category,
      isBlock,
      textureType: isBlock ? 'block' : 'item',
      textureCacheName: `mock_${modId}_${name.toLowerCase().replace(/\s+/g, '_')}_12345678.png`,
      createdAt: new Date().toISOString(),
    });
  }
  
  return items;
}

/**
 * Mock Electron API
 * 在浏览器环境中模拟 IPC 调用
 */
export const mockElectronAPI = {
  // ========== Project Management ==========
  projectList: async () => {
    await delay(300);
    // 如果没有项目，初始化一个
    const projects = mockStorage.projects;
    if (projects.length === 0) {
      const defaultProject: Project = {
        id: 'proj_web_demo',
        name: 'Web 调试项目',
        description: '用于浏览器调试的示例项目',
        path: '/mock/path/to/web/demo',
        mcVersion: '1.20.1',
        modLoader: 'forge',
        modLoaderVersion: '47.2.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
        isFavorite: true,
        totalMods: 3,
        totalItems: 150,
        totalRecipes: 89,
      };
      mockStorage.projects = [defaultProject];
      mockStorage.currentProject = defaultProject;
    }
    return { success: true, data: mockStorage.projects, total: mockStorage.projects.length };
  },

  projectOpen: async (projectId?: string) => {
    await delay(200);
    if (projectId) {
      const project = mockStorage.projects.find(p => p.id === projectId);
      if (project) {
        mockStorage.currentProject = project;
        return { success: true, data: project };
      }
      return { success: false, error: 'Project not found' };
    }
    return { success: true, data: null, canceled: true };
  },

  projectCreate: async (data: any) => {
    await delay(500);
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name: data.name,
      description: data.description || '',
      path: data.path,
      mcVersion: data.mcVersion,
      modLoader: data.modLoader,
      modLoaderVersion: data.modLoaderVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      isFavorite: false,
      totalMods: 0,
      totalItems: 0,
      totalRecipes: 0,
    };
    mockStorage.projects = [...mockStorage.projects, newProject];
    return { success: true, data: newProject };
  },

  projectGetCurrent: async () => {
    await delay(100);
    return { success: true, data: mockStorage.currentProject };
  },

  projectUpdate: async (projectId: string, data: any) => {
    await delay(200);
    const projects = mockStorage.projects;
    const index = projects.findIndex(p => p.id === projectId);
    if (index >= 0) {
      const updated = { ...projects[index], ...data };
      projects[index] = updated;
      mockStorage.projects = projects;
      return { success: true, data: updated };
    }
    return { success: false, error: 'Project not found' };
  },

  projectDelete: async (projectId: string) => {
    await delay(300);
    const projects = mockStorage.projects;
    const index = projects.findIndex(p => p.id === projectId);
    if (index >= 0) {
      projects.splice(index, 1);
      mockStorage.projects = projects;
      return { success: true };
    }
    return { success: false, error: 'Project not found' };
  },

  selectDirectory: async () => {
    await delay(200);
    // 在浏览器中模拟目录选择
    return {
      canceled: false,
      filePaths: ['/mock/path/to/modpack'],
    };
  },

  // ========== JAR Import ==========
  jarList: async () => {
    await delay(300);
    return { success: true, data: mockStorage.mods };
  },

  jarSelect: async () => {
    await delay(200);
    return { success: true, data: '/mock/path/to/mod.jar' };
  },

  jarImport: async (filePath: string) => {
    await delay(1000);
    // 模拟导入进度
    const mockMod: Mod = {
      modId: 'demo_mod',
      modName: '演示模组',
      version: '1.20.1-1.0.0',
      mcVersion: '1.20.1',
      sourceType: 'jar',
      jarPath: filePath,
      parsedAt: new Date().toISOString(),
      itemCount: 50,
      recipeCount: 25,
    };
    
    // 添加到模组列表
    const mods = mockStorage.mods;
    mods.push(mockMod);
    mockStorage.mods = mods;
    
    // 生成并添加物品
    const newItems = generateMockItems(mockMod.modId, 50);
    mockStorage.items = [...mockStorage.items, ...newItems];
    
    return {
      success: true,
      data: {
        success: true,
        filePath,
        modId: mockMod.modId,
        modName: mockMod.modName,
        itemCount: mockMod.itemCount,
        recipeCount: mockMod.recipeCount,
        tagCount: 15,
        textureCount: 50,
      },
    };
  },

  jarDelete: async (modId: string) => {
    await delay(200);
    const mods = mockStorage.mods;
    const index = mods.findIndex(m => m.modId === modId);
    if (index >= 0) {
      mods.splice(index, 1);
      mockStorage.mods = mods;
      // 同时删除相关物品
      mockStorage.items = mockStorage.items.filter(i => i.modId !== modId);
      return { success: true, data: true };
    }
    return { success: false, error: 'Mod not found' };
  },

  jarGetDetails: async (modId: string) => {
    await delay(200);
    const mod = mockStorage.mods.find(m => m.modId === modId);
    return { success: true, data: mod || null };
  },

  onJarImportProgress: (callback: (progress: any) => void) => {
    // 模拟进度推送
    let percent = 0;
    const interval = setInterval(() => {
      percent += 10;
      callback({
        step: percent < 30 ? 'reading' : percent < 60 ? 'parsing' : percent < 90 ? 'extracting' : 'saving',
        percent,
        filePath: '/mock/path/to/mod.jar',
        currentFile: `file_${percent}.json`,
        processedCount: percent,
        totalCount: 100,
      });
      if (percent >= 100) {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  },

  // ========== Items ==========
  itemsQuery: async (params: ItemQueryParams) => {
    await delay(300);
    
    // 如果没有物品，生成一些示例数据
    if (mockStorage.items.length === 0) {
      mockStorage.items = [
        ...generateMockItems('farmersdelight', 30),
        ...generateMockItems('minecraft', 20),
      ];
    }
    
    const { search, modId, category, tag, textureType, page = 1, pageSize = 50 } = params;
    
    let items = mockStorage.items;
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(i => 
        i.itemId.toLowerCase().includes(searchLower) || 
        (i.displayName && i.displayName.toLowerCase().includes(searchLower))
      );
    }
    if (modId) {
      items = items.filter(i => i.modId === modId);
    }
    if (category) {
      items = items.filter(i => i.category === category);
    }
    if (textureType) {
      items = items.filter(i => i.textureType === textureType);
    }
    // 注意：mock 中不实现 tag 过滤

    const start = (page - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);

    return {
      success: true,
      data: {
        items: paginatedItems,
        total: items.length,
        page,
        pageSize,
      },
    };
  },

  itemsGetTexture: async (itemId: string) => {
    await delay(100);
    // 为每个物品生成一致的纹理
    const textureData = generateMockTexture(itemId);
    return { success: true, data: textureData || null };
  },

  itemsGetAllTags: async () => {
    await delay(200);
    return {
      success: true,
      data: [
        { tagId: 'forge:vegetables', count: 12 },
        { tagId: 'forge:fruits', count: 8 },
        { tagId: 'forge:grains', count: 6 },
        { tagId: 'forge:protein', count: 10 },
        { tagId: 'minecraft:logs', count: 15 },
      ],
    };
  },

  itemsGetCategories: async () => {
    await delay(200);
    return {
      success: true,
      data: [
        { category: 'food', count: 45 },
        { category: 'tool', count: 32 },
        { category: 'material', count: 28 },
        { category: 'block', count: 15 },
        { category: 'misc', count: 7 },
      ],
    };
  },

  itemsGetDetail: async (itemId: string) => {
    await delay(200);
    const item = mockStorage.items.find(i => i.itemId === itemId);
    if (!item) {
      return { success: true, data: null };
    }
    return {
      success: true,
      data: {
        ...item,
        tags: ['forge:vegetables', 'farmersdelight:ingredients'],
      },
    };
  },

  modsQuery: async () => {
    await delay(200);
    const mods = mockStorage.mods;
    return {
      success: true,
      data: mods.map(mod => ({
        modId: mod.modId,
        name: mod.modName,
        itemCount: mod.itemCount || 0,
      })),
    };
  },

  tagsQuery: async () => {
    await delay(200);
    return {
      success: true,
      data: [
        'forge:vegetables',
        'forge:fruits',
        'forge:grains',
        'forge:protein',
        'minecraft:logs',
        'minecraft:planks',
      ],
    };
  },

  // ========== Recipes ==========
  recipesList: async (filter: any) => {
    await delay(300);
    return { success: true, data: [] };
  },

  recipesCreate: async (recipe: any) => {
    await delay(200);
    return { success: true, data: recipe };
  },

  recipesUpdate: async (recipe: any) => {
    await delay(200);
    return { success: true, data: recipe };
  },
  
  recipesDelete: async (recipeId: string) => {
    await delay(200);
    return { success: true };
  },

  recipesExport: async (options: any) => {
    await delay(500);
    return { success: true, data: { path: '/mock/export/path' } };
  },

  // ========== LLM ==========
  llmConvert: async (data: any) => {
    await delay(2000);
    return {
      success: true,
      data: {
        results: [],
        status: 'complete',
      },
    };
  },

  llmCancel: async () => {
    return { success: true };
  },

  onLlmConvertProgress: (callback: (progress: any) => void) => {
    return () => {};
  },

  // ========== Shell operations ==========
  openExternal: async (url: string) => {
    window.open(url, '_blank');
  },

  // ========== Debug / Database Management ==========
  debugDbTables: async () => {
    await delay(200);
    return {
      success: true,
      data: [
        { name: 'mods', rowCount: mockStorage.mods.length },
        { name: 'items', rowCount: mockStorage.items.length },
        { name: 'recipes', rowCount: 10 },
        { name: 'textures', rowCount: 15 },
        { name: 'translations', rowCount: 50 },
        { name: 'item_tags', rowCount: 30 },
      ],
    };
  },

  debugDbQuery: async (sql: string) => {
    await delay(300);
    return {
      success: true,
      data: [
        { item_id: 'farmersdelight:tomato', display_name: '番茄', category: 'food' },
        { item_id: 'farmersdelight:onion', display_name: '洋葱', category: 'food' },
      ],
    };
  },

  debugDbDeleteMod: async (modId: string) => {
    await delay(300);
    return {
      success: true,
      data: {
        modId,
        deleted: { items: 20, recipes: 10, textures: 15 },
      },
    };
  },

  debugDbClearAll: async () => {
    await delay(500);
    // 清除 localStorage
    mockStorage.projects = [];
    mockStorage.mods = [];
    mockStorage.items = [];
    mockStorage.currentProject = null;
    return {
      success: true,
      data: {
        tables: { mods: 0, items: 0, recipes: 0 },
        deletedTextures: 0,
      },
    };
  },

  debugCacheInfo: async () => {
    await delay(200);
    return {
      success: true,
      data: {
        cacheDir: '/mock/cache/textures',
        fileCount: 15,
        totalSizeFormatted: '2.34 MB',
      },
    };
  },

  debugDbPath: async () => {
    await delay(100);
    return {
      success: true,
      data: {
        globalDb: '/mock/data/global.db',
        textureCache: '/mock/cache/textures',
        projectsJson: '/mock/data/projects.json',
      },
    };
  },

  debugGetItemDetail: async (itemId: string) => {
    await delay(200);
    return {
      success: true,
      data: {
        item: {
          item_id: itemId,
          mod_id: 'farmersdelight',
          display_name_key: `item.farmersdelight.${itemId.split(':')[1]}`,
          display_name: 'Mock Item',
          category: 'food',
        },
        translations: [
          { lang: 'en_us', value: 'Mock Item' },
          { lang: 'zh_cn', value: '模拟物品' },
        ],
        tags: ['forge:food', 'farmersdelight:ingredients'],
      },
    };
  },
};

// 初始化一些模拟数据
function initMockData() {
  // 只有在没有任何数据时才初始化
  if (mockStorage.projects.length === 0) {
    mockStorage.projects = [{
      id: 'proj_web_demo',
      name: 'Web 调试项目',
      description: '用于浏览器调试的示例项目',
      path: '/mock/path/to/web/demo',
      mcVersion: '1.20.1',
      modLoader: 'forge',
      modLoaderVersion: '47.2.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      isFavorite: true,
      totalMods: 3,
      totalItems: 150,
      totalRecipes: 89,
    }];
  }

  if (mockStorage.mods.length === 0) {
    mockStorage.mods = [{
      modId: 'farmersdelight',
      modName: "Farmer's Delight",
      version: '1.20.1-1.2.0',
      mcVersion: '1.20.1',
      sourceType: 'jar',
      jarPath: '/mock/mods/farmersdelight.jar',
      parsedAt: new Date().toISOString(),
      itemCount: 50,
      recipeCount: 25,
    }];
  }

  if (mockStorage.items.length === 0) {
    mockStorage.items = [
      ...generateMockItems('farmersdelight', 30),
      ...generateMockItems('minecraft', 20),
    ];
  }
}

// 延迟初始化，确保在浏览器环境中执行
if (typeof window !== 'undefined') {
  setTimeout(initMockData, 0);
}
