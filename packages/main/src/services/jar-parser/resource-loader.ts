/**
 * Minecraft 资源加载器
 * 模拟游戏内资源加载流程，正确关联物品、模型和纹理
 */

import * as crypto from 'crypto';
import type { ProgressCallback, ModelDefinition } from './types';

/**
 * 资源位置 (ResourceLocation)
 * 格式: namespace:path 或 path (默认为minecraft)
 */
export class ResourceLocation {
  constructor(
    public readonly namespace: string,
    public readonly path: string
  ) {}

  static parse(location: string, defaultNamespace: string = 'minecraft'): ResourceLocation {
    if (location.includes(':')) {
      const [ns, path] = location.split(':', 2);
      return new ResourceLocation(ns, path);
    }
    return new ResourceLocation(defaultNamespace, location);
  }

  toString(): string {
    return `${this.namespace}:${this.path}`;
  }

  /**
   * 获取完整文件路径
   */
  toFilePath(type: 'models' | 'textures' | 'blockstates'): string {
    return `assets/${this.namespace}/${type}/${this.path}.json`;
  }

  toTexturePath(): string {
    return `assets/${this.namespace}/textures/${this.path}.png`;
  }
}

/**
 * 显示设置（用于模型定义）
 */
interface DisplaySettings {
  rotation?: [number, number, number];
  translation?: [number, number, number];
  scale?: [number, number, number];
}

/**
 * 解析后的物品信息
 */
export interface ParsedItemInfo {
  itemId: string;
  modId: string;
  name: string;
  isBlock: boolean;
  displayName?: string;
  translationKey?: string;
  model?: ModelDefinition;
  modelPath?: string;
  textureLocations: ResourceLocation[];
  resolvedTextures: Map<string, string>; // face -> texture_cache_name
}

/**
 * 资源加载器
 */
export class ResourceLoader {
  private models = new Map<string, ModelDefinition>();
  private textures = new Map<string, { path: string; data: Buffer; cacheName: string }>();
  private langData = new Map<string, Map<string, string>>();
  private modId: string;

  constructor(modId: string) {
    this.modId = modId;
  }

  /**
   * 加载所有资源
   */
  loadResources(
    entries: Array<{ path: string; data: Buffer }>,
    onProgress?: ProgressCallback
  ): void {
    const total = entries.length;
    let processed = 0;

    for (const entry of entries) {
      processed++;
      
      // 加载模型
      if (entry.path.startsWith(`assets/${this.modId}/models/`)) {
        this.loadModel(entry.path, entry.data);
      }
      
      // 加载纹理
      if (entry.path.startsWith(`assets/${this.modId}/textures/`)) {
        this.loadTexture(entry.path, entry.data);
      }
      
      // 加载语言文件
      if (entry.path.startsWith(`assets/${this.modId}/lang/`)) {
        this.loadLang(entry.path, entry.data);
      }

      if (processed % 100 === 0) {
        onProgress?.({
          stage: 'extracting_textures',
          percent: Math.round((processed / total) * 50),
          stageLabel: `Loading resources: ${entry.path}`,
          processedCount: processed,
          totalCount: total,
        });
      }
    }
  }

  /**
   * 加载模型文件
   */
  private loadModel(path: string, data: Buffer): void {
    try {
      const json: ModelDefinition = JSON.parse(data.toString('utf-8'));
      this.models.set(path, json);
    } catch (e) {
      console.warn(`[ResourceLoader] Failed to parse model ${path}:`, e);
    }
  }

  /**
   * 加载纹理文件
   */
  private loadTexture(path: string, data: Buffer): void {
    // 生成缓存名（使用 SHA256 与 texture-extractor.ts 保持一致）
    const fileName = path.split('/').pop()?.replace('.png', '') || 'unknown';
    const type = path.includes('/block/') ? 'block' : 'item';
    const hash = crypto.createHash('sha256').update(data).digest('hex').slice(0, 8);
    const cacheName = `${this.modId}_${type}_${fileName}_${hash}.png`;
    
    this.textures.set(path, { path, data, cacheName });
  }

  /**
   * 加载语言文件
   */
  private loadLang(path: string, data: Buffer): void {
    try {
      const langCode = path.split('/').pop()?.replace('.json', '') || 'en_us';
      const json = JSON.parse(data.toString('utf-8'));
      
      const translations = new Map<string, string>();
      for (const [key, value] of Object.entries(json)) {
        if (typeof value === 'string') {
          translations.set(key, value);
        }
      }
      
      this.langData.set(langCode, translations);
    } catch (e) {
      console.warn(`[ResourceLoader] Failed to parse lang ${path}:`, e);
    }
  }

  /**
   * 解析所有物品
   */
  parseAllItems(): ParsedItemInfo[] {
    const items: ParsedItemInfo[] = [];
    
    // 从模型文件推断物品
    for (const [path, model] of this.models) {
      const match = path.match(/assets\/([^/]+)\/models\/(item|block)\/(.+)\.json$/);
      if (!match) continue;
      
      const [, modId, type, name] = match;
      const isBlock = type === 'block';
      const itemId = `${modId}:${name}`;
      
      // 解析模型并获取纹理
      const resolvedModel = this.resolveModel(model);
      const textureLocations = this.extractTextureLocations(resolvedModel);
      const resolvedTextures = this.resolveTextures(textureLocations);
      
      // 获取显示名称
      const translationKey = isBlock 
        ? `block.${modId}.${name}` 
        : `item.${modId}.${name}`;
      const displayName = this.getTranslation(translationKey);
      
      items.push({
        itemId,
        modId,
        name,
        isBlock,
        displayName,
        translationKey,
        model: resolvedModel,
        modelPath: path,
        textureLocations,
        resolvedTextures,
      });
    }
    
    return items;
  }

  /**
   * 解析单个物品（优先从 item 模型，然后是 block 模型）
   */
  parseItem(itemName: string): ParsedItemInfo | null {
    // 1. 尝试 item 模型
    const itemModelPath = `assets/${this.modId}/models/item/${itemName}.json`;
    const itemModel = this.models.get(itemModelPath);
    
    if (itemModel) {
      return this.createItemInfo(itemName, itemModel, itemModelPath, false);
    }
    
    // 2. 尝试 block 模型
    const blockModelPath = `assets/${this.modId}/models/block/${itemName}.json`;
    const blockModel = this.models.get(blockModelPath);
    
    if (blockModel) {
      return this.createItemInfo(itemName, blockModel, blockModelPath, true);
    }
    
    // 3. 直接匹配纹理
    return this.createItemFromTexture(itemName);
  }

  /**
   * 从模型创建物品信息
   */
  private createItemInfo(
    name: string,
    model: ModelDefinition,
    modelPath: string,
    isBlock: boolean
  ): ParsedItemInfo {
    const resolvedModel = this.resolveModel(model);
    const textureLocations = this.extractTextureLocations(resolvedModel);
    const resolvedTextures = this.resolveTextures(textureLocations);
    
    const translationKey = isBlock 
      ? `block.${this.modId}.${name}` 
      : `item.${this.modId}.${name}`;
    
    return {
      itemId: `${this.modId}:${name}`,
      modId: this.modId,
      name,
      isBlock,
      displayName: this.getTranslation(translationKey),
      translationKey,
      model: resolvedModel,
      modelPath,
      textureLocations,
      resolvedTextures,
    };
  }

  /**
   * 从纹理直接创建物品信息（当没有模型时）
   */
  private createItemFromTexture(itemName: string): ParsedItemInfo | null {
    // 尝试 item 纹理
    const itemTexturePath = `assets/${this.modId}/textures/item/${itemName}.png`;
    const itemTexture = this.textures.get(itemTexturePath);
    
    if (itemTexture) {
      const resolvedTextures = new Map([['layer0', itemTexture.cacheName]]);
      return {
        itemId: `${this.modId}:${itemName}`,
        modId: this.modId,
        name: itemName,
        isBlock: false,
        displayName: this.getTranslation(`item.${this.modId}.${itemName}`),
        translationKey: `item.${this.modId}.${itemName}`,
        textureLocations: [new ResourceLocation(this.modId, `item/${itemName}`)],
        resolvedTextures,
      };
    }
    
    // 尝试 block 纹理
    const blockTexturePath = `assets/${this.modId}/textures/block/${itemName}.png`;
    const blockTexture = this.textures.get(blockTexturePath);
    
    if (blockTexture) {
      const resolvedTextures = new Map([['all', blockTexture.cacheName]]);
      return {
        itemId: `${this.modId}:${itemName}`,
        modId: this.modId,
        name: itemName,
        isBlock: true,
        displayName: this.getTranslation(`block.${this.modId}.${itemName}`),
        translationKey: `block.${this.modId}.${itemName}`,
        textureLocations: [new ResourceLocation(this.modId, `block/${itemName}`)],
        resolvedTextures,
      };
    }
    
    return null;
  }

  /**
   * 解析模型继承链
   */
  private resolveModel(model: ModelDefinition, visited: Set<string> = new Set()): ModelDefinition {
    if (!model.parent) {
      return model;
    }
    
    // 防止循环继承
    if (visited.has(model.parent)) {
      return model;
    }
    visited.add(model.parent);
    
    // 解析父模型路径
    const parentLoc = ResourceLocation.parse(model.parent);
    let parentPath: string;
    
    // 处理特殊情况
    if (model.parent.startsWith('builtin/') || model.parent.startsWith('item/')) {
      // 这些是 Minecraft 内置的，无法解析
      return model;
    }
    
    // 尝试不同的路径
    const possiblePaths = [
      `assets/${parentLoc.namespace}/models/${parentLoc.path}.json`,
      `assets/${parentLoc.namespace}/models/block/${parentLoc.path.split('/').pop()}.json`,
      `assets/${parentLoc.namespace}/models/item/${parentLoc.path.split('/').pop()}.json`,
    ];
    
    let parentModel: ModelDefinition | undefined;
    for (const path of possiblePaths) {
      parentModel = this.models.get(path);
      if (parentModel) break;
    }
    
    if (!parentModel) {
      return model;
    }
    
    // 递归解析父模型
    const resolvedParent = this.resolveModel(parentModel, visited);
    
    // 合并属性（子模型优先）
    return {
      parent: model.parent,
      textures: { ...resolvedParent.textures, ...model.textures },
      elements: model.elements || resolvedParent.elements,
      display: { ...resolvedParent.display, ...model.display },
    };
  }

  /**
   * 从模型中提取纹理位置
   */
  private extractTextureLocations(model: ModelDefinition): ResourceLocation[] {
    const locations: ResourceLocation[] = [];
    
    if (!model.textures) {
      return locations;
    }
    
    for (const [key, value] of Object.entries(model.textures)) {
      if (key.startsWith('#')) continue; // 跳过引用
      
      // 解析纹理引用
      const resolved = this.resolveTextureReference(value, model.textures);
      if (resolved && !resolved.startsWith('#')) {
        // 使用当前模组ID作为默认命名空间（而不是minecraft）
        const loc = ResourceLocation.parse(resolved, this.modId);
        locations.push(loc);
      }
    }
    
    return locations;
  }

  /**
   * 解析纹理引用（处理 # 引用）
   */
  private resolveTextureReference(ref: string, textures: Record<string, string>): string {
    if (!ref.startsWith('#')) {
      return ref;
    }
    
    const key = ref.substring(1);
    const resolved = textures[key];
    
    if (!resolved) {
      return ref;
    }
    
    // 递归解析
    return this.resolveTextureReference(resolved, textures);
  }

  /**
   * 将纹理位置解析为实际的缓存名
   */
  private resolveTextures(locations: ResourceLocation[]): Map<string, string> {
    const resolved = new Map<string, string>();
    
    for (const loc of locations) {
      const texturePath = loc.toTexturePath();
      const texture = this.textures.get(texturePath);
      
      if (texture) {
        // 确定面名
        const faceName = this.getFaceName(loc.path);
        resolved.set(faceName, texture.cacheName);
      }
    }
    
    return resolved;
  }

  /**
   * 从纹理路径推断面名
   */
  private getFaceName(texturePath: string): string {
    // 路径格式: block/stone 或 item/apple
    const parts = texturePath.split('/');
    if (parts.length >= 2) {
      const type = parts[0]; // 'block' or 'item'
      const name = parts[1];
      
      if (type === 'item') {
        return 'layer0';
      }
      
      // 对于方块，检查常见的面名后缀
      const faceSuffixes = ['_top', '_bottom', '_side', '_front', '_back', '_north', '_south', '_east', '_west', '_all'];
      for (const suffix of faceSuffixes) {
        if (name.endsWith(suffix)) {
          return suffix.replace('_', '');
        }
      }
      
      return 'all';
    }
    
    return 'texture';
  }

  /**
   * 获取翻译文本
   */
  private getTranslation(key: string): string | undefined {
    // 优先使用 en_us
    const enUs = this.langData.get('en_us');
    if (enUs?.has(key)) {
      return enUs.get(key);
    }
    
    // 然后尝试 zh_cn
    const zhCn = this.langData.get('zh_cn');
    if (zhCn?.has(key)) {
      return zhCn.get(key);
    }
    
    // 返回第一个找到的
    for (const translations of this.langData.values()) {
      if (translations.has(key)) {
        return translations.get(key);
      }
    }
    
    return undefined;
  }

  /**
   * 获取所有加载的纹理
   */
  getTextures(): Map<string, { path: string; data: Buffer; cacheName: string }> {
    return this.textures;
  }
}

/**
 * 从 JAR 条目中解析所有资源
 */
export function parseResourcesFromJar(
  entries: Array<{ path: string; data: Buffer }>,
  modId: string,
  existingModels?: Map<string, ModelDefinition>,
  onProgress?: ProgressCallback
): {
  items: ParsedItemInfo[];
  textures: Map<string, { path: string; data: Buffer; cacheName: string }>;
} {
  const loader = new ResourceLoader(modId);
  
  // 加载已解析的模型（如果有）
  if (existingModels) {
    for (const [path, model] of existingModels) {
      loader['models'].set(path, model);
    }
  }
  
  loader.loadResources(entries, onProgress);
  
  const items = loader.parseAllItems();
  const textures = loader.getTextures();
  
  return { items, textures };
}
