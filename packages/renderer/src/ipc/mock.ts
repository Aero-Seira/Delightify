/**
 * Electron API Mock
 * 用于在浏览器环境中开发和调试
 */

import type { Project, Mod, Item, ItemQueryParams, ItemQueryResult } from '@delightify/shared';

// 模拟数据存储
const mockStorage = {
  projects: [] as Project[],
  mods: [] as Mod[],
  items: [] as Item[],
  currentProject: null as Project | null,
};

// 模拟延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock Electron API
 * 在浏览器环境中模拟 IPC 调用
 */
export const mockElectronAPI = {
  // ========== Project Management ==========
  projectList: async () => {
    await delay(300);
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
    mockStorage.projects.push(newProject);
    return { success: true, data: newProject };
  },

  projectGetCurrent: async () => {
    await delay(100);
    return { success: true, data: mockStorage.currentProject };
  },

  projectUpdate: async (projectId: string, data: any) => {
    await delay(200);
    const index = mockStorage.projects.findIndex(p => p.id === projectId);
    if (index >= 0) {
      mockStorage.projects[index] = { ...mockStorage.projects[index], ...data };
      return { success: true, data: mockStorage.projects[index] };
    }
    return { success: false, error: 'Project not found' };
  },

  projectDelete: async (projectId: string) => {
    await delay(300);
    const index = mockStorage.projects.findIndex(p => p.id === projectId);
    if (index >= 0) {
      mockStorage.projects.splice(index, 1);
      return { success: true };
    }
    return { success: false, error: 'Project not found' };
  },

  selectDirectory: async () => {
    await delay(200);
    // 模拟用户选择目录
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
      modId: 'farmersdelight',
      modName: "Farmer's Delight",
      version: '1.20.1-1.2.0',
      mcVersion: '1.20.1',
      sourceType: 'jar',
      jarPath: filePath,
      parsedAt: new Date().toISOString(),
      itemCount: 127,
      recipeCount: 89,
    };
    mockStorage.mods.push(mockMod);
    return {
      success: true,
      data: {
        success: true,
        filePath,
        modId: mockMod.modId,
        modName: mockMod.modName,
        itemCount: mockMod.itemCount,
        recipeCount: mockMod.recipeCount,
        tagCount: 45,
        textureCount: 200,
      },
    };
  },

  jarDelete: async (modId: string) => {
    await delay(200);
    const index = mockStorage.mods.findIndex(m => m.modId === modId);
    if (index >= 0) {
      mockStorage.mods.splice(index, 1);
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
    const { search, modId, category, page = 1, pageSize = 50 } = params;
    
    let items = mockStorage.items;
    if (search) {
      items = items.filter(i => 
        i.itemId.includes(search) || 
        i.displayName?.includes(search)
      );
    }
    if (modId) {
      items = items.filter(i => i.modId === modId);
    }
    if (category) {
      items = items.filter(i => i.category === category);
    }

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
    // 返回一个 1x1 像素的透明 PNG
    return { success: true, data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' };
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
};

// 初始化一些模拟数据
function initMockData() {
  // 添加示例项目
  mockStorage.projects.push({
    id: 'proj_1',
    name: '示例整合包',
    description: '这是一个示例项目',
    path: '/mock/path/to/modpack',
    mcVersion: '1.20.1',
    modLoader: 'forge',
    modLoaderVersion: '47.2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
    isFavorite: true,
    totalMods: 5,
    totalItems: 127,
    totalRecipes: 89,
  });

  // 添加示例模组
  mockStorage.mods.push({
    modId: 'farmersdelight',
    modName: "Farmer's Delight",
    version: '1.20.1-1.2.0',
    mcVersion: '1.20.1',
    sourceType: 'jar',
    jarPath: '/mock/mods/farmersdelight.jar',
    parsedAt: new Date().toISOString(),
    itemCount: 127,
    recipeCount: 89,
  });

  // 添加示例物品
  for (let i = 0; i < 20; i++) {
    mockStorage.items.push({
      itemId: `farmersdelight:item_${i}`,
      modId: 'farmersdelight',
      displayName: `物品 ${i}`,
      displayNameKey: `item.farmersdelight.item_${i}`,
      category: i % 3 === 0 ? 'food' : i % 3 === 1 ? 'tool' : 'material',
      isBlock: i % 2 === 0,
      createdAt: new Date().toISOString(),
    } as Item);
  }
}

initMockData();
