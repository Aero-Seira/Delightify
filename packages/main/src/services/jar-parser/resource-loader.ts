/**
 * 资源加载器
 * 
 * 负责从已导入的模组中加载资源文件
 * - 纹理图片
 * - 模型JSON
 * - 语言文件
 */

import { createGlobalDbClient } from '../database';
import { appPaths } from '../paths';
import * as path from 'path';
import * as fs from 'fs';
import { analyzeModel, getFaceTexturesFor3D } from './model-analyzer';
import type { ModelDefinition } from './types';

/** 资源类型 */
export type ResourceType = 'item' | 'texture' | 'model' | 'recipe' | 'tag' | 'translation';

/** 资源数据结构 */
export interface ResourceData {
  /** 资源ID */
  id: string;
  /** 资源类型 */
  type: ResourceType;
  /** 模组ID */
  modId: string;
  /** 资源路径 */
  path: string;
  /** 二进制数据 */
  data: Buffer;
  /** 元数据 */
  meta?: Record<string, any>;
  /** 创建时间 */
  createdAt?: string;
}

/** 纹理位置信息 */
export interface TextureLocation {
  namespace: string;
  path: string;
  toTexturePath: () => string;
}

/** 解析后的物品 */
export interface ResolvedItem {
  itemId: string;
  modId: string;
  name: string;
  translationKey: string;
  isBlock: boolean;
  displayName: string;
  textureLocations: TextureLocation[];
  resolvedTextures: Map<string, string>;
}

/** 解析进度 */
export interface ParseProgress {
  percent: number;
  stageLabel: string;
}

/** 缓存的资源数据库 */
interface ResourceDB {
  items: Map<string, ResourceData>;
  textures: Map<string, ResourceData>;
  models: Map<string, ResourceData>;
  byMod: Map<string, {
    items: ResourceData[];
    textures: ResourceData[];
    models: ResourceData[];
  }>;
}

/** 资源加载器实例 */
let resourceLoader: ResourceLoader | null = null;

export interface TextureLookupResult {
  /** 纹理数据 base64 */
  data: string;
  /** 纹理路径 */
  path: string;
  /** 来源mod */
  modId: string;
  /** 资源类型 */
  type: ResourceType;
}

export interface ModelLookupResult {
  /** 模型定义 */
  model: ModelDefinition;
  /** 模型路径 */
  path: string;
  /** 来源mod */
  modId: string;
}

export interface ItemRenderData {
  /** 物品ID */
  itemId: string;
  /** 2D纹理路径（用于物品栏显示） */
  texture2d?: string;
  /** 3D面纹理（用于方块渲染） */
  faces3d?: {
    top?: string;
    bottom?: string;
    north?: string;
    south?: string;
    east?: string;
    west?: string;
  };
  /** 渲染类型 */
  renderType: 'item' | 'block' | 'unknown';
  /** 是否透明 */
  hasTransparency?: boolean;
}

/**
 * 常见的状态/变体后缀模式
 * 这些后缀表示同一物品的不同状态，不应作为独立物品
 */
const STATE_SUFFIXES = [
  // 数字阶段（如 compost_0, compost_1）
  /_\d+$/,
  // 阶段（如 stage_0, stage1）
  /_stage_?\d+$/i,
  // 水平（如 level_1, level1）
  /_level_?\d+$/i,
  // 年龄/生长阶段
  /_age_?\d+$/i,
  // 朝向（如果作为后缀）
  /_(up|down|north|south|east|west|side|top|bottom)$/i,
  // 开/关状态
  /_(on|off|open|closed)$/i,
  //  Lit/unlit
  /_(lit|unlit)$/i,
  // 动力状态
  /_(powered|unpowered)$/i,
  // 附着状态
  /_(attached|detached)$/i,
  // 激活状态
  /_(active|inactive)$/i,
  // 流量/液态
  /_(flowing|still)$/i,
  // 其他常见变体
  /_(inventory|handheld|gui|entity|base|overlay)$/i,
];

/**
 * 检查名称是否是状态变体（应归并到基础物品）
 */
function isStateVariant(name: string): { isVariant: boolean; baseName?: string } {
  for (const pattern of STATE_SUFFIXES) {
    const match = name.match(pattern);
    if (match) {
      const baseName = name.substring(0, match.index);
      return { isVariant: true, baseName };
    }
  }
  return { isVariant: false };
}

/**
 * 资源加载器类
 * 
 * 提供从数据库加载和查询资源的能力
 */
export class ResourceLoader {
  private db: ResourceDB;
  private textureCache: Map<string, TextureLookupResult>;
  private modelCache: Map<string, ModelLookupResult>;

  constructor() {
    this.db = {
      items: new Map(),
      textures: new Map(),
      models: new Map(),
      byMod: new Map(),
    };
    this.textureCache = new Map();
    this.modelCache = new Map();
  }

  /**
   * 加载所有资源到内存
   */
  async loadAll(): Promise<void> {
    const db = createGlobalDbClient(appPaths.globalDb);
    
    // 加载所有资源
    // Note: 这里需要从数据库加载实际的资源数据
    // 目前是一个占位实现

    console.log(`[ResourceLoader] Loaded: ${this.db.items.size} items, ${this.db.textures.size} textures, ${this.db.models.size} models`);
  }

  /**
   * 查找纹理
   * 
   * @param texturePath 纹理路径（如 "minecraft:block/dirt"）
   * @returns 纹理数据或null
   */
  async findTexture(texturePath: string): Promise<TextureLookupResult | null> {
    // 检查缓存
    if (this.textureCache.has(texturePath)) {
      return this.textureCache.get(texturePath)!;
    }

    // 规范化路径
    const normalizedPath = this.normalizeTexturePath(texturePath);

    // 在数据库中查找
    let resource = this.db.textures.get(normalizedPath);
    
    // 如果没找到，尝试其他变体
    if (!resource) {
      // 尝试添加.png后缀
      if (!normalizedPath.endsWith('.png')) {
        resource = this.db.textures.get(normalizedPath + '.png');
      }
      // 尝试去掉.png后缀
      if (!resource && normalizedPath.endsWith('.png')) {
        resource = this.db.textures.get(normalizedPath.slice(0, -4));
      }
    }

    if (!resource || !resource.data) {
      return null;
    }

    // 转换为base64
    const base64 = this.bufferToBase64(resource.data);
    const result: TextureLookupResult = {
      data: `data:image/png;base64,${base64}`,
      path: resource.path,
      modId: resource.modId,
      type: resource.type,
    };

    // 缓存结果
    this.textureCache.set(texturePath, result);
    return result;
  }

  /**
   * 查找模型
   * 
   * @param modelPath 模型路径（如 "minecraft:block/dirt"）
   * @returns 模型定义或null
   */
  async findModel(modelPath: string): Promise<ModelLookupResult | null> {
    // 检查缓存
    if (this.modelCache.has(modelPath)) {
      return this.modelCache.get(modelPath)!;
    }

    // 规范化路径
    const normalizedPath = this.normalizeModelPath(modelPath);

    // 在数据库中查找
    let resource = this.db.models.get(normalizedPath);
    
    if (!resource && !normalizedPath.endsWith('.json')) {
      resource = this.db.models.get(normalizedPath + '.json');
    }

    if (!resource || !resource.data) {
      return null;
    }

    try {
      const jsonStr = resource.data.toString('utf-8');
      const model = JSON.parse(jsonStr) as ModelDefinition;
      
      const result: ModelLookupResult = {
        model,
        path: resource.path,
        modId: resource.modId,
      };

      // 缓存结果
      this.modelCache.set(modelPath, result);
      return result;
    } catch (e) {
      console.error(`[ResourceLoader] Failed to parse model: ${modelPath}`, e);
      return null;
    }
  }

  /**
   * 解析物品的渲染数据
   * 
   * 这是核心方法，处理物品到纹理的完整解析链
   * 
   * @param itemId 物品ID（如 "minecraft:dirt"）
   * @returns 渲染数据
   */
  async resolveItemRenderData(itemId: string): Promise<ItemRenderData> {
    const renderData: ItemRenderData = {
      itemId,
      renderType: 'unknown',
    };

    // 1. 查找物品定义
    const item = this.db.items.get(itemId);
    if (!item) {
      return renderData;
    }

    // 2. 查找物品模型
    const [modId, itemName] = itemId.split(':');
    
    // 尝试多种模型路径
    const modelPaths = [
      `${modId}:models/item/${itemName}.json`,
      `${modId}:item/${itemName}`,
      `${modId}:item/${itemName}.json`,
    ];

    let modelResult: ModelLookupResult | null = null;
    for (const path of modelPaths) {
      modelResult = await this.findModel(path);
      if (modelResult) break;
    }

    if (!modelResult) {
      return renderData;
    }

    // 3. 分析模型
    const analyzed = analyzeModel(modelResult.model, modelResult.path);

    // 4. 确定渲染类型
    if (analyzed.isBlockModel) {
      renderData.renderType = 'block';
    } else if (analyzed.isItemModel) {
      renderData.renderType = 'item';
    }

    renderData.hasTransparency = analyzed.textures.length > 0;

    // 5. 获取2D纹理
    // 优先使用layer0（物品）
    const layer0 = analyzed.textures.find(t => t.key === 'layer0');
    if (layer0?.resolved) {
      const texture = await this.findTexture(layer0.path);
      if (texture) {
        renderData.texture2d = texture.data;
      }
    }

    // 6. 获取3D面纹理（用于方块）
    if (analyzed.isBlockModel) {
      const facePaths = getFaceTexturesFor3D(analyzed);
      const faceTextures: typeof renderData.faces3d = {};

      // 并行加载所有面纹理
      const promises = Object.entries(facePaths).map(async ([face, path]) => {
        const texture = await this.findTexture(path);
        if (texture) {
          (faceTextures as any)[face] = texture.data;
        }
      });

      await Promise.all(promises);
      renderData.faces3d = faceTextures;

      // 如果没有2D纹理但有顶面纹理，使用顶面
      if (!renderData.texture2d && faceTextures.top) {
        renderData.texture2d = faceTextures.top;
      }
    }

    return renderData;
  }

  /**
   * 通过纹理路径查找纹理（用于直接访问纹理资源）
   * 
   * @param modId 模组ID
   * @param texturePath 纹理路径（如 "block/dirt"）
   * @returns 纹理数据或null
   */
  async findTextureByPath(modId: string, texturePath: string): Promise<TextureLookupResult | null> {
    const fullPath = `${modId}:textures/${texturePath}.png`;
    return this.findTexture(fullPath);
  }

  /**
   * 获取模组的所有纹理
   * 
   * @param modId 模组ID
   * @returns 纹理列表
   */
  getModTextures(modId: string): ResourceData[] {
    return this.db.byMod.get(modId)?.textures || [];
  }

  /**
   * 获取模组的所有模型
   * 
   * @param modId 模组ID
   * @returns 模型列表
   */
  getModModels(modId: string): ResourceData[] {
    return this.db.byMod.get(modId)?.models || [];
  }

  /**
   * 获取模组的所有物品
   * 
   * @param modId 模组ID
   * @returns 物品列表
   */
  getModItems(modId: string): ResourceData[] {
    return this.db.byMod.get(modId)?.items || [];
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.textureCache.clear();
    this.modelCache.clear();
    this.db.items.clear();
    this.db.textures.clear();
    this.db.models.clear();
    this.db.byMod.clear();
  }

  /**
   * 规范化纹理路径
   */
  private normalizeTexturePath(path: string): string {
    // 移除minecraft:前缀
    let normalized = path.replace(/^minecraft:/, '');
    
    // 确保路径以textures/开头
    if (!normalized.includes('/textures/')) {
      const parts = normalized.split(':');
      if (parts.length === 2) {
        normalized = `${parts[0]}:textures/${parts[1]}`;
      }
    }

    // 确保以.png结尾
    if (!normalized.endsWith('.png')) {
      normalized += '.png';
    }

    return normalized;
  }

  /**
   * 规范化模型路径
   */
  private normalizeModelPath(path: string): string {
    // 移除minecraft:前缀
    let normalized = path.replace(/^minecraft:/, '');
    
    // 确保路径以models/开头
    if (!normalized.includes('/models/')) {
      const parts = normalized.split(':');
      if (parts.length === 2) {
        normalized = `${parts[0]}:models/${parts[1]}`;
      }
    }

    // 确保以.json结尾
    if (!normalized.endsWith('.json')) {
      normalized += '.json';
    }

    return normalized;
  }

  /**
   * Buffer转换为Base64
   */
  private bufferToBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }
}

/**
 * 获取资源加载器单例
 */
export function getResourceLoader(): ResourceLoader {
  if (!resourceLoader) {
    resourceLoader = new ResourceLoader();
  }
  return resourceLoader;
}

/**
 * 重新加载资源
 */
export async function reloadResources(): Promise<void> {
  if (resourceLoader) {
    resourceLoader.clearCache();
  }
  resourceLoader = new ResourceLoader();
  await resourceLoader.loadAll();
}

/**
 * 初始化资源加载器
 */
export async function initResourceLoader(): Promise<void> {
  const loader = getResourceLoader();
  await loader.loadAll();
  console.log('[ResourceLoader] Initialized');
}

/**
 * 从JAR解析资源（兼容接口）
 * 
 * 用于JAR导入流程，解析纹理和模型关联
 * 
 * 关键修复：
 * - **优先从 models/item/ 识别物品**（物品的真正定义）
 * - **过滤 block 模型的状态变体**（如 _0, _1, _stage0 等后缀）
 * - **一个方块物品 = 一个 item 模型**，即使有多个 block 状态
 * 
 * @param textures 纹理列表
 * @param modId 模组ID
 * @param models 模型映射
 * @param onProgress 进度回调
 * @returns 解析后的物品和纹理映射
 */
export function parseResourcesFromJar(
  textures: Array<{ path: string; data: Buffer }>,
  modId: string,
  models?: Map<string, ModelDefinition>,
  onProgress?: (progress: ParseProgress) => void
): { items: ResolvedItem[]; textures: Map<string, string> } {
  const items: ResolvedItem[] = [];
  const textureMap = new Map<string, string>();
  const processedItems = new Set<string>();
  
  // Step 1: 首先处理所有纹理，生成缓存文件名映射
  for (let i = 0; i < textures.length; i++) {
    const texture = textures[i];
    const pathParts = texture.path.split('/');
    
    if (pathParts.length >= 5 && pathParts[0] === 'assets' && pathParts[2] === 'textures') {
      const textureModId = pathParts[1];
      const textureType = pathParts[3]; // 'block' or 'item'
      const fileName = pathParts[pathParts.length - 1];
      
      // 只处理当前模组的纹理
      if (textureModId !== modId) continue;
      
      // 生成缓存文件名
      const cacheName = `${modId}_${textureType}_${fileName.replace('.png', '')}_${generateHash(texture.data)}.png`;
      textureMap.set(texture.path, cacheName);
    }
  }
  
  // Step 2: **优先从 models/item/ 识别物品**（这是物品的真正定义！）
  if (models) {
    const modelPaths = Array.from(models.keys());
    
    // 首先处理 item 模型
    const itemModelPaths = modelPaths.filter(p => 
      p.includes('/models/item/') && p.endsWith('.json')
    );
    
    for (let i = 0; i < itemModelPaths.length; i++) {
      const modelPath = itemModelPaths[i];
      
      // 报告进度
      if (onProgress && i % 5 === 0) {
        onProgress({
          percent: Math.round((i / itemModelPaths.length) * 40),
          stageLabel: `Processing item models ${i + 1}/${itemModelPaths.length}`,
        });
      }
      
      // 解析路径: assets/{modid}/models/item/{name}.json
      const pathParts = modelPath.split('/');
      if (pathParts.length >= 5 && pathParts[0] === 'assets' && pathParts[2] === 'models') {
        const modelModId = pathParts[1];
        const fileName = pathParts[pathParts.length - 1];
        const itemName = fileName.replace('.json', '');
        const itemId = `${modelModId}:${itemName}`;
        
        // 只处理当前模组
        if (modelModId !== modId) continue;
        
        // 避免重复处理
        if (processedItems.has(itemId)) continue;
        processedItems.add(itemId);
        
        const model = models.get(modelPath)!;
        
        // Item 模型对应的通常是方块物品（继承自 block 模型）
        const isBlock = model.parent?.includes('block/') || model.parent?.includes('block');
        
        // 解析纹理引用
        let resolvedTextures = new Map<string, string>();
        let textureLocations: TextureLocation[] = [];
        
        if (model.textures) {
          for (const [key, textureRef] of Object.entries(model.textures)) {
            if (typeof textureRef === 'string' && !textureRef.startsWith('#')) {
              const resolvedPath = resolveTextureReference(textureRef, modId);
              if (resolvedPath) {
                const cacheName = textureMap.get(resolvedPath);
                resolvedTextures.set(key, cacheName || resolvedPath);
                textureLocations.push({
                  namespace: modId,
                  path: textureRef.replace(`${modId}:`, '').replace('textures/', ''),
                  toTexturePath: () => resolvedPath,
                });
              }
            }
          }
        }
        
        // 创建物品
        const resolvedItem: ResolvedItem = {
          itemId,
          modId,
          name: itemName,
          translationKey: isBlock ? `block.${modId}.${itemName}` : `item.${modId}.${itemName}`,
          isBlock: !!isBlock,
          displayName: itemName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          textureLocations,
          resolvedTextures,
        };
        
        items.push(resolvedItem);
      }
    }
    
    // Step 3: 处理 block 模型（只处理没有对应 item 模型的纯方块）
    const blockModelPaths = modelPaths.filter(p => 
      p.includes('/models/block/') && p.endsWith('.json')
    );
    
    for (let i = 0; i < blockModelPaths.length; i++) {
      const modelPath = blockModelPaths[i];
      
      // 报告进度
      if (onProgress && i % 10 === 0) {
        onProgress({
          percent: 40 + Math.round((i / blockModelPaths.length) * 30),
          stageLabel: `Processing block models ${i + 1}/${blockModelPaths.length}`,
        });
      }
      
      // 解析路径: assets/{modid}/models/block/{name}.json
      const pathParts = modelPath.split('/');
      if (pathParts.length < 5) continue;
      
      const modelModId = pathParts[1];
      const fileName = pathParts[pathParts.length - 1];
      const blockName = fileName.replace('.json', '');
      const blockId = `${modelModId}:${blockName}`;
      
      // 只处理当前模组
      if (modelModId !== modId) continue;
      
      // **关键：检查是否是状态变体（如 _0, _1, _stage0）**
      const variantCheck = isStateVariant(blockName);
      if (variantCheck.isVariant && variantCheck.baseName) {
        // 这是状态变体，检查基础物品是否已存在
        const baseItemId = `${modelModId}:${variantCheck.baseName}`;
        
        if (processedItems.has(baseItemId)) {
          // 基础物品已存在，将纹理归并到基础物品
          const baseItem = items.find(item => item.itemId === baseItemId);
          if (baseItem) {
            const model = models.get(modelPath)!;
            
            // 提取状态变体的纹理
            if (model.textures) {
              for (const [key, textureRef] of Object.entries(model.textures)) {
                if (typeof textureRef === 'string' && !textureRef.startsWith('#')) {
                  const resolvedPath = resolveTextureReference(textureRef, modId);
                  if (resolvedPath) {
                    const cacheName = textureMap.get(resolvedPath);
                    // 使用带后缀的键名存储（如 top_0, side_1）
                    const variantKey = `${key}_${variantCheck.baseName !== blockName ? blockName.replace(variantCheck.baseName + '_', '') : 'variant'}`;
                    baseItem.resolvedTextures.set(variantKey, cacheName || resolvedPath);
                  }
                }
              }
            }
          }
          continue; // 跳过创建新物品
        }
      }
      
      // 检查是否已有对应的 item 模型
      const itemModelPath = `assets/${modId}/models/item/${blockName}.json`;
      if (processedItems.has(blockId)) {
        // 已有 item 模型，跳过 block 模型
        continue;
      }
      
      // **关键：如果 block 名称看起来像状态变体，跳过它**
      if (variantCheck.isVariant) {
        continue;
      }
      
      // 这是一个纯方块（没有对应 item 模型），创建物品
      processedItems.add(blockId);
      
      const model = models.get(modelPath)!;
      
      let resolvedTextures = new Map<string, string>();
      let textureLocations: TextureLocation[] = [];
      
      if (model.textures) {
        for (const [key, textureRef] of Object.entries(model.textures)) {
          if (typeof textureRef === 'string' && !textureRef.startsWith('#')) {
            const resolvedPath = resolveTextureReference(textureRef, modId);
            if (resolvedPath) {
              const cacheName = textureMap.get(resolvedPath);
              resolvedTextures.set(key, cacheName || resolvedPath);
              textureLocations.push({
                namespace: modId,
                path: textureRef.replace(`${modId}:`, '').replace('textures/', ''),
                toTexturePath: () => resolvedPath,
              });
            }
          }
        }
      }
      
      const resolvedItem: ResolvedItem = {
        itemId: blockId,
        modId,
        name: blockName,
        translationKey: `block.${modId}.${blockName}`,
        isBlock: true,
        displayName: blockName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        textureLocations,
        resolvedTextures,
      };
      
      items.push(resolvedItem);
    }
  }
  
  // Step 4: 处理没有模型的物品（基于纹理文件，仅作为最后手段）
  // 只处理 item 纹理，block 纹理应该已经被上面的逻辑处理了
  for (let i = 0; i < textures.length; i++) {
    const texture = textures[i];
    const pathParts = texture.path.split('/');
    
    if (pathParts.length >= 5 && pathParts[0] === 'assets' && pathParts[2] === 'textures') {
      const textureModId = pathParts[1];
      const textureType = pathParts[3]; // 'block' or 'item'
      const fileName = pathParts[pathParts.length - 1];
      const itemName = fileName.replace('.png', '');
      const itemId = `${textureModId}:${itemName}`;
      
      // 只处理 item 纹理，且未处理的
      if (textureModId !== modId) continue;
      if (textureType !== 'item') continue; // 跳过 block 纹理
      if (processedItems.has(itemId)) continue;
      
      // 检查是否是状态变体
      const variantCheck = isStateVariant(itemName);
      if (variantCheck.isVariant) {
        // 检查基础物品是否存在
        const baseItemId = `${textureModId}:${variantCheck.baseName}`;
        if (processedItems.has(baseItemId)) {
          continue; // 跳过状态变体
        }
      }
      
      processedItems.add(itemId);
      
      const cacheName = textureMap.get(texture.path);
      
      const resolvedItem: ResolvedItem = {
        itemId,
        modId,
        name: itemName,
        translationKey: `item.${modId}.${itemName}`,
        isBlock: false,
        displayName: itemName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        textureLocations: [{
          namespace: modId,
          path: `item/${itemName}`,
          toTexturePath: () => `assets/${modId}/textures/item/${itemName}.png`,
        }],
        resolvedTextures: new Map([['layer0', cacheName || texture.path]]),
      };
      
      items.push(resolvedItem);
    }
  }
  
  // 最终进度报告
  if (onProgress) {
    onProgress({
      percent: 100,
      stageLabel: `Resolved ${items.length} items`,
    });
  }
  
  return { items, textures: textureMap };
}

/**
 * 解析纹理引用
 * 将模型中的纹理引用（如 "farmersdelight:block/cooking_pot"）解析为完整路径
 */
function resolveTextureReference(ref: string, defaultModId: string): string | null {
  if (!ref) return null;
  
  // 如果引用以#开头，是内部引用，无法直接解析
  if (ref.startsWith('#')) return null;
  
  // 如果引用已包含命名空间（如 "farmersdelight:block/cooking_pot"）
  if (ref.includes(':')) {
    const [modId, path] = ref.split(':');
    return `assets/${modId}/textures/${path}.png`;
  }
  
  // 否则使用默认命名空间
  return `assets/${defaultModId}/textures/${ref}.png`;
}

/**
 * 生成数据哈希（简化的哈希函数）
 */
function generateHash(data: Buffer): string {
  let hash = 0;
  const step = Math.max(1, Math.floor(data.length / 100)); // 采样
  for (let i = 0; i < data.length; i += step) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash; // 转为32位整数
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}
