/**
 * 模型分析器
 * 
 * 深入分析 Minecraft 模型文件，提取渲染所需的所有信息
 * 包括：纹理引用、元素几何、UV映射等
 */

import type { ModelDefinition, ModelFace } from './types';

export interface AnalyzedTexture {
  /** 纹理键名 */
  key: string;
  /** 纹理路径 */
  path: string;
  /** 是否已解析（非#引用） */
  resolved: boolean;
  /** 用途类型 */
  usage: 'particle' | 'layer' | 'face' | 'other';
}

export interface AnalyzedFace {
  /** 面方向 */
  direction: 'north' | 'south' | 'east' | 'west' | 'up' | 'down';
  /** 纹理引用 */
  textureRef: string;
  /** UV坐标 */
  uv?: [number, number, number, number];
  /** 是否剔除 */
  cullface?: string;
  /** 旋转 */
  rotation?: number;
}

export interface AnalyzedElement {
  /** 元素名称 */
  name?: string;
  /** 起始坐标 */
  from: [number, number, number];
  /** 结束坐标 */
  to: [number, number, number];
  /** 旋转 */
  rotation?: {
    angle: number;
    axis: 'x' | 'y' | 'z';
    origin: [number, number, number];
  };
  /** 面映射 */
  faces: Partial<Record<string, AnalyzedFace>>;
}

export interface AnalyzedModel {
  /** 模型路径 */
  modelPath: string;
  /** 父模型路径 */
  parent?: string;
  /** 是否继承自block/block */
  isBlockModel: boolean;
  /** 是否继承自item/generated */
  isItemModel: boolean;
  /** 纹理引用列表 */
  textures: AnalyzedTexture[];
  /** 元素列表（用于3D渲染） */
  elements: AnalyzedElement[];
  /** 显示设置 */
  display?: {
    gui?: {
      rotation?: [number, number, number];
      translation?: [number, number, number];
      scale?: [number, number, number];
    };
  };
  /** 渲染类型 */
  renderType?: string;
}

/**
 * 分析模型定义
 */
export function analyzeModel(model: ModelDefinition, modelPath: string): AnalyzedModel {
  const analysis: AnalyzedModel = {
    modelPath,
    parent: model.parent,
    isBlockModel: model.parent === 'block/block' || !!model.parent?.includes('block/'),
    isItemModel: model.parent === 'item/generated' || model.parent === 'builtin/generated',
    textures: [],
    elements: [],
    display: model.display,
    renderType: (model as any).render_type,
  };

  // 分析纹理
  if (model.textures) {
    for (const [key, value] of Object.entries(model.textures)) {
      const isReference = value.startsWith('#');
      const usage = classifyTextureUsage(key);
      
      analysis.textures.push({
        key,
        path: value,
        resolved: !isReference,
        usage,
      });
    }
  }

  // 分析元素
  if (model.elements) {
    for (const elem of model.elements) {
      const element: AnalyzedElement = {
        name: (elem as any).name,
        from: elem.from,
        to: elem.to,
        faces: {},
      };

      // 处理旋转
      if ((elem as any).rotation) {
        const rot = (elem as any).rotation;
        element.rotation = {
          angle: rot.angle,
          axis: rot.axis,
          origin: rot.origin,
        };
      }

      // 处理面
      for (const [dir, face] of Object.entries(elem.faces)) {
        const modelFace = face as ModelFace;
        element.faces[dir] = {
          direction: dir as any,
          textureRef: modelFace.texture,
          uv: modelFace.uv,
          cullface: modelFace.cullface,
          rotation: modelFace.rotation,
        };
      }

      analysis.elements.push(element);
    }
  }

  return analysis;
}

/**
 * 分类纹理用途
 */
function classifyTextureUsage(key: string): AnalyzedTexture['usage'] {
  if (key === 'particle') return 'particle';
  if (key.startsWith('layer')) return 'layer';
  if (['up', 'down', 'north', 'south', 'east', 'west', 'side', 'top', 'bottom', 'front', 'back'].includes(key)) {
    return 'face';
  }
  return 'other';
}

/**
 * 获取模型用于物品栏显示的纹理
 * 
 * 策略：
 * 1. 对于简单物品（继承item/generated），使用layer0
 * 2. 对于方块物品，尝试找到代表性纹理
 * 3. 对于复杂模型，找到最常用的纹理
 */
export function getInventoryTexture(model: AnalyzedModel): string | null {
  // 如果是物品模型，优先使用layer0
  if (model.isItemModel) {
    const layer0 = model.textures.find(t => t.key === 'layer0');
    if (layer0?.resolved) return layer0.path;
  }

  // 如果是方块模型
  if (model.isBlockModel) {
    // 优先找顶面纹理（通常最能代表方块）
    const top = model.textures.find(t => t.key === 'top' || t.key === 'up');
    if (top?.resolved) return top.path;

    // 然后找side纹理
    const side = model.textures.find(t => t.key === 'side' || t.key === 'north');
    if (side?.resolved) return side.path;

    // 找all或texture
    const all = model.textures.find(t => t.key === 'all' || t.key === 'texture');
    if (all?.resolved) return all.path;
  }

  // 使用第一个已解析的纹理
  const firstResolved = model.textures.find(t => t.resolved);
  if (firstResolved) return firstResolved.path;

  // 使用particle纹理作为最后的回退
  const particle = model.textures.find(t => t.key === 'particle');
  if (particle) {
    // 如果particle是引用，尝试解析
    if (!particle.resolved && particle.path.startsWith('#')) {
      const refKey = particle.path.substring(1);
      const ref = model.textures.find(t => t.key === refKey && t.resolved);
      if (ref) return ref.path;
    }
    return particle.path;
  }

  return null;
}

/**
 * 获取3D渲染所需的各面纹理
 */
export function getFaceTexturesFor3D(model: AnalyzedModel): {
  top?: string;
  bottom?: string;
  north?: string;
  south?: string;
  east?: string;
  west?: string;
} {
  const result: ReturnType<typeof getFaceTexturesFor3D> = {};

  // 映射键名到标准方向
  const mapping: Record<string, keyof typeof result> = {
    'up': 'top',
    'down': 'bottom',
    'north': 'north',
    'south': 'south',
    'east': 'east',
    'west': 'west',
    'top': 'top',
    'bottom': 'bottom',
    'side': 'north', // side通常用于所有侧面，但先标记为north
  };

  for (const texture of model.textures) {
    if (!texture.resolved) continue;

    const direction = mapping[texture.key];
    if (direction) {
      result[direction] = texture.path;
    }
  }

  // 如果有side纹理但没有其他侧面纹理，应用到所有侧面
  const sideTexture = model.textures.find(t => t.key === 'side' && t.resolved);
  if (sideTexture) {
    if (!result.north) result.north = sideTexture.path;
    if (!result.south) result.south = sideTexture.path;
    if (!result.east) result.east = sideTexture.path;
    if (!result.west) result.west = sideTexture.path;
  }

  // 如果有all纹理，应用到所有面
  const allTexture = model.textures.find(t => t.key === 'all' && t.resolved);
  if (allTexture) {
    if (!result.top) result.top = allTexture.path;
    if (!result.bottom) result.bottom = allTexture.path;
    if (!result.north) result.north = allTexture.path;
    if (!result.south) result.south = allTexture.path;
    if (!result.east) result.east = allTexture.path;
    if (!result.west) result.west = allTexture.path;
  }

  return result;
}

/**
 * 检查模型是否包含透明/剪切渲染
 */
export function hasTransparency(model: AnalyzedModel): boolean {
  return model.renderType === 'minecraft:cutout' || 
         model.renderType === 'minecraft:translucent' ||
         model.renderType === 'cutout' ||
         model.renderType === 'translucent';
}

/**
 * 检查模型是否是简单平面（如作物）
 */
export function isSimpleFlatModel(model: AnalyzedModel): boolean {
  // 如果没有元素定义，可能是继承的简单模型
  if (model.elements.length === 0) return true;

  // 检查是否所有元素都很薄（如交叉平面作物）
  for (const elem of model.elements) {
    const width = elem.to[0] - elem.from[0];
    const height = elem.to[1] - elem.from[1];
    const depth = elem.to[2] - elem.from[2];

    // 如果任何维度小于1，可能是平面
    if (width < 1 || depth < 1) return true;
  }

  return false;
}
