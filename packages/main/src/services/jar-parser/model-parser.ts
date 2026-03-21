/**
 * Minecraft 模型解析器
 * 解析 models/item/*.json 和 models/block/*.json 文件
 * 提取纹理引用和模型定义
 */

import type { ProgressCallback } from './types';

/**
 * 模型定义接口
 */
export interface ModelDefinition {
  /** 模型父类 */
  parent?: string;
  /** 纹理映射 */
  textures?: Record<string, string>;
  /** 显示设置 */
  display?: {
    gui?: {
      rotation?: [number, number, number];
      translation?: [number, number, number];
      scale?: [number, number, number];
    };
    ground?: {
      rotation?: [number, number, number];
      translation?: [number, number, number];
      scale?: [number, number, number];
    };
    fixed?: {
      rotation?: [number, number, number];
      translation?: [number, number, number];
      scale?: [number, number, number];
    };
  };
  /** 元素定义（用于自定义模型） */
  elements?: Array<{
    from: [number, number, number];
    to: [number, number, number];
    faces: Record<string, {
      texture: string;
      uv?: [number, number, number, number];
      cullface?: string;
    }>;
  }>;
}

/**
 * 解析后的物品模型信息
 */
export interface ParsedItemModel {
  /** 物品 ID */
  itemId: string;
  /** 模型路径 */
  modelPath: string;
  /** 父模型 */
  parent?: string;
  /** 解析后的纹理引用 */
  textures: {
    /** 粒子纹理 */
    particle?: string;
    /** 各面纹理 */
    up?: string;
    down?: string;
    north?: string;
    south?: string;
    east?: string;
    west?: string;
    /** 通用层纹理（用于物品） */
    layer0?: string;
    layer1?: string;
  };
  /** 是否使用 block 纹理 */
  usesBlockTexture: boolean;
  /** GUI 显示设置 */
  guiDisplay?: {
    rotation: [number, number, number];
    translation: [number, number, number];
    scale: [number, number, number];
  };
}

/**
 * 从 JAR 条目中解析所有模型文件
 */
export function parseModelFilesFromJar(
  entries: Array<{ path: string; data: Buffer }>,
  expectedModId?: string,
  onProgress?: ProgressCallback
): Map<string, ModelDefinition> {
  const models = new Map<string, ModelDefinition>();

  // 收集所有模型文件
  const modelFiles: Array<{ path: string; content: string }> = [];

  for (const entry of entries) {
    // 匹配 assets/{modid}/models/{type}/{name}.json
    const match = entry.path.match(/^assets\/([a-z0-9_]+)\/models\/(item|block)\/(.+)\.json$/i);
    if (!match) continue;

    const [, modId, type, modelName] = match;

    // 过滤非期望模组的模型文件
    if (expectedModId && modId !== expectedModId) {
      continue;
    }

    try {
      const content = entry.data.toString('utf-8');
      modelFiles.push({ path: entry.path, content });
    } catch (error) {
      console.warn(`[ModelParser] Failed to read model file ${entry.path}:`, error);
    }
  }

  // 解析每个模型文件
  for (let i = 0; i < modelFiles.length; i++) {
    const { path: filePath, content } = modelFiles[i];

    onProgress?.({
      stage: 'parsing_recipes',
      stageLabel: `Parsing model: ${filePath.split('/').pop()}`,
      percent: 60 + Math.round((i / modelFiles.length) * 10),
      currentFile: filePath,
      processedCount: i,
      totalCount: modelFiles.length,
    });

    try {
      const model: ModelDefinition = JSON.parse(content);
      models.set(filePath, model);
    } catch (error) {
      console.warn(`[ModelParser] Failed to parse model ${filePath}:`, error);
    }
  }

  return models;
}

/**
 * 解析特定物品的模型
 * 处理模型继承和纹理解析
 */
export function parseItemModel(
  itemId: string,
  models: Map<string, ModelDefinition>,
  modId: string
): ParsedItemModel | null {
  // 构建模型路径
  const itemName = itemId.split(':')[1];
  if (!itemName) return null;

  // 尝试找到物品的模型
  // 优先级: item/{name}.json > block/{name}.json
  const possiblePaths = [
    `assets/${modId}/models/item/${itemName}.json`,
    `assets/${modId}/models/block/${itemName}.json`,
  ];

  let modelPath: string | undefined;
  let modelDef: ModelDefinition | undefined;

  for (const path of possiblePaths) {
    if (models.has(path)) {
      modelPath = path;
      modelDef = models.get(path);
      break;
    }
  }

  // 如果没有找到专用模型，检查是否有继承自 block/item 的模型
  if (!modelDef) {
    // 尝试通过简单命名约定推断
    const itemModelPath = `assets/${modId}/models/item/${itemName}.json`;
    if (!models.has(itemModelPath)) {
      // 可能是纯方块，没有独立物品模型
      return null;
    }
  }

  if (!modelDef || !modelPath) return null;

  // 处理模型继承
  const resolvedModel = resolveModelInheritance(modelDef, models);

  // 解析纹理
  const textures: ParsedItemModel['textures'] = {};
  let usesBlockTexture = false;

  if (resolvedModel.textures) {
    for (const [key, value] of Object.entries(resolvedModel.textures)) {
      // 解析纹理引用
      // 格式: "#texture" 或 "namespace:path" 或 "path"
      let texturePath = value;

      // 如果是引用（以 # 开头），尝试解析
      if (texturePath.startsWith('#')) {
        const refKey = texturePath.substring(1);
        texturePath = resolvedModel.textures[refKey] || texturePath;
      }

      // 检查是否使用 block 纹理
      if (texturePath.includes('block/') || modelPath.includes('/block/')) {
        usesBlockTexture = true;
      }

      // 存储纹理路径
      if (key === 'particle') textures.particle = texturePath;
      else if (key === 'up' || key === 'top') textures.up = texturePath;
      else if (key === 'down' || key === 'bottom') textures.down = texturePath;
      else if (key === 'north' || key === 'side') textures.north = texturePath;
      else if (key === 'south') textures.south = texturePath;
      else if (key === 'east') textures.east = texturePath;
      else if (key === 'west') textures.west = texturePath;
      else if (key.startsWith('layer')) textures[key as 'layer0' | 'layer1'] = texturePath;
      // 如果没有具体面定义，使用 all 或 texture 作为通用纹理
      else if (key === 'all' || key === 'texture') {
        textures.north = texturePath;
        textures.south = texturePath;
        textures.east = texturePath;
        textures.west = texturePath;
        textures.up = texturePath;
        textures.down = texturePath;
      }
    }
  }

  // 提取 GUI 显示设置
  let guiDisplay: ParsedItemModel['guiDisplay'] | undefined;
  if (resolvedModel.display?.gui) {
    guiDisplay = {
      rotation: resolvedModel.display.gui.rotation || [30, 225, 0],
      translation: resolvedModel.display.gui.translation || [0, 0, 0],
      scale: resolvedModel.display.gui.scale || [0.625, 0.625, 0.625],
    };
  }

  return {
    itemId,
    modelPath,
    parent: resolvedModel.parent,
    textures,
    usesBlockTexture,
    guiDisplay,
  };
}

/**
 * 解析模型继承链
 * 合并父模型的属性
 */
function resolveModelInheritance(
  model: ModelDefinition,
  allModels: Map<string, ModelDefinition>,
  visited: Set<string> = new Set()
): ModelDefinition {
  if (!model.parent || model.parent === 'builtin/generated' || model.parent === 'builtin/entity') {
    return model;
  }

  // 防止循环继承
  if (visited.has(model.parent)) {
    return model;
  }
  visited.add(model.parent);

  // 查找父模型
  // parent 格式可能是 "modid:path" 或 "path"
  let parentPath = model.parent;
  if (!parentPath.includes(':')) {
    // 假设是 minecraft 命名空间
    parentPath = `minecraft:${parentPath}`;
  }

  // 转换为文件路径
  const [parentMod, parentModelPath] = parentPath.split(':');
  const possibleParentPaths = [
    `assets/${parentMod}/models/${parentModelPath}.json`,
  ];

  let parentModel: ModelDefinition | undefined;
  for (const path of possibleParentPaths) {
    if (allModels.has(path)) {
      parentModel = allModels.get(path);
      break;
    }
  }

  if (!parentModel) {
    return model;
  }

  // 递归解析父模型
  const resolvedParent = resolveModelInheritance(parentModel, allModels, visited);

  // 合并属性（子模型优先）
  return {
    parent: model.parent,
    textures: { ...resolvedParent.textures, ...model.textures },
    display: { ...resolvedParent.display, ...model.display },
    elements: model.elements || resolvedParent.elements,
  };
}

/**
 * 获取所有方块物品及其纹理映射
 */
export function getBlockItemTextureMapping(
  items: Array<{ itemId: string; modId: string }>,
  models: Map<string, ModelDefinition>,
  textures: Array<{ path: string; modId: string; itemName: string }>
): Map<string, { model?: ParsedItemModel; texturePath?: string; isBlock: boolean }> {
  const mapping = new Map<string, { model?: ParsedItemModel; texturePath?: string; isBlock: boolean }>();

  // 构建纹理路径到文件路径的映射
  const texturePathMap = new Map<string, string>();
  for (const tex of textures) {
    const textureId = `${tex.modId}:${tex.itemName}`;
    texturePathMap.set(textureId, tex.path);
  }

  for (const item of items) {
    const { itemId, modId } = item;
    const itemName = itemId.split(':')[1];

    // 尝试解析模型
    const model = parseItemModel(itemId, models, modId);

    if (model && model.usesBlockTexture) {
      // 找到 block 纹理路径
      const blockTextureId = `${modId}:block/${itemName}`;
      const texturePath = texturePathMap.get(blockTextureId);

      mapping.set(itemId, {
        model,
        texturePath,
        isBlock: true,
      });
    } else {
      // 检查是否有普通 item 纹理
      const itemTextureId = `${modId}:item/${itemName}`;
      const texturePath = texturePathMap.get(itemTextureId);

      if (texturePath) {
        mapping.set(itemId, {
          texturePath,
          isBlock: false,
        });
      }
    }
  }

  return mapping;
}

/**
 * 获取方块的三视图纹理
 * @param model 解析后的模型
 * @param textures 所有可用纹理的映射
 * @returns 三个面的纹理路径（用于 3D 渲染）
 */
export function getBlockFaceTextures(
  model: ParsedItemModel,
  textures: Map<string, string>
): {
  top?: string;
  front?: string;
  right?: string;
} {
  const result: { top?: string; front?: string; right?: string } = {};

  // 默认使用 north 作为正面，up 作为顶面，east 作为右面
  const frontTexture = model.textures.north || model.textures.layer0;
  const topTexture = model.textures.up || model.textures.layer0;
  const rightTexture = model.textures.east || model.textures.layer0;

  // 解析纹理引用为实际路径
  if (frontTexture) {
    const texturePath = resolveTexturePath(frontTexture, model.modelPath);
    if (texturePath) {
      result.front = textures.get(texturePath) || texturePath;
    }
  }

  if (topTexture) {
    const texturePath = resolveTexturePath(topTexture, model.modelPath);
    if (texturePath) {
      result.top = textures.get(texturePath) || texturePath;
    }
  }

  if (rightTexture) {
    const texturePath = resolveTexturePath(rightTexture, model.modelPath);
    if (texturePath) {
      result.right = textures.get(texturePath) || texturePath;
    }
  }

  return result;
}

/**
 * 解析纹理引用为完整路径
 */
function resolveTexturePath(textureRef: string, modelPath: string): string | null {
  // 如果已经是完整路径
  if (textureRef.includes(':')) {
    const [modId, path] = textureRef.split(':');
    return `assets/${modId}/textures/${path}.png`;
  }

  // 从模型路径推断命名空间
  const modIdMatch = modelPath.match(/^assets\/([a-z0-9_]+)\//);
  if (!modIdMatch) return null;

  const modId = modIdMatch[1];

  // 相对路径
  if (textureRef.startsWith('./')) {
    // 相对于当前模型目录
    const baseDir = modelPath.substring(0, modelPath.lastIndexOf('/'));
    return `${baseDir}/${textureRef.substring(2)}.png`;
  }

  // 默认使用 block 或 item 目录
  return `assets/${modId}/textures/${textureRef}.png`;
}
