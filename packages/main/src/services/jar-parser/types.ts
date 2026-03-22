/**
 * JAR 解析器类型定义
 */

/**
 * 解析进度回调
 */
export type ProgressCallback = (progress: JarParseProgress) => void;

/**
 * JAR 解析进度信息
 */
export interface JarParseProgress {
  /** 当前阶段 */
  stage: 'reading' | 'parsing_lang' | 'parsing_tags' | 'parsing_recipes' | 'extracting_textures' | 'saving';
  /** 阶段描述 */
  stageLabel: string;
  /** 总进度百分比 (0-100) */
  percent: number;
  /** 当前处理的文件路径 */
  currentFile?: string;
  /** 已处理项目数 */
  processedCount?: number;
  /** 总数 */
  totalCount?: number;
}

/**
 * Lang 文件解析结果
 */
export interface LangParseResult {
  /** 语言代码 (如 "en_us") */
  langCode: string;
  /** 翻译项映射 */
  translations: Map<string, string>;
  /** 解析出的物品列表 */
  items: ParsedItem[];
}

/**
 * 解析出的物品信息
 */
export interface ParsedItem {
  /** 物品 ID (如 "farmersdelight:tomato") */
  itemId: string;
  /** 模组 ID */
  modId: string;
  /** 物品名称（来自 lang） */
  name: string;
  /** 是否为方块 */
  isBlock: boolean;
  /** 翻译键 */
  translationKey: string;
}

/**
 * Tag 解析结果
 */
export interface TagParseResult {
  /** Tag ID (如 "forge:vegetables") */
  tagId: string;
  /** 属于该 Tag 的物品 ID 列表 */
  items: string[];
  /** 是否替换模式 */
  replace: boolean;
}

/**
 * 配方解析结果
 */
export interface RecipeParseResult {
  /** 配方 ID */
  recipeId: string;
  /** 配方类型 */
  recipeType: string;
  /** 原始 JSON */
  rawJson: string;
  /** 输入物品/Tag */
  inputs: RecipeIngredient[];
  /** 输出物品 */
  outputs: RecipeOutput[];
}

/**
 * 配方输入成分
 */
export interface RecipeIngredient {
  /** 槽位索引 */
  slot: number;
  /** 物品 ID 或 Tag ID */
  id: string;
  /** 是否为 Tag */
  isTag: boolean;
  /** 数量 */
  count?: number;
}

/**
 * 配方输出
 */
export interface RecipeOutput {
  /** 槽位索引 */
  slot: number;
  /** 物品 ID */
  itemId: string;
  /** 数量 */
  count: number;
  /** NBT 数据（如果有） */
  nbt?: string;
}

/**
 * 材质信息
 */
export interface TextureInfo {
  /** 材质在 JAR 内的路径 */
  path: string;
  /** 模组 ID */
  modId: string;
  /** 物品名称（从路径推断） */
  itemName: string;
  /** 图片数据 Buffer */
  data: Buffer;
  /** 缓存文件名 */
  cacheName?: string;
  /** 图片宽度 */
  width?: number;
  /** 图片高度 */
  height?: number;
}

/**
 * 模型面定义
 */
export interface ModelFace {
  texture: string;
  uv?: [number, number, number, number];
  cullface?: string;
  rotation?: number;
  tintindex?: number;
}

/**
 * 模型元素定义
 */
export interface ModelElement {
  from: [number, number, number];
  to: [number, number, number];
  rotation?: {
    angle: number;
    axis: 'x' | 'y' | 'z';
    origin: [number, number, number];
  };
  faces: Record<string, ModelFace>;
  shade?: boolean;
  name?: string;
}

/**
 * 模型定义（简化版）
 */
export interface ModelDefinition {
  parent?: string;
  textures?: Record<string, string>;
  elements?: ModelElement[];
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
    thirdperson_righthand?: {
      rotation?: [number, number, number];
      translation?: [number, number, number];
      scale?: [number, number, number];
    };
    firstperson_righthand?: {
      rotation?: [number, number, number];
      translation?: [number, number, number];
      scale?: [number, number, number];
    };
  };
}

/**
 * 完整的 JAR 解析结果
 */
export interface JarParseResult {
  /** 模组元信息 */
  modInfo: {
    modId: string;
    modName: string;
    version?: string;
    mcVersion?: string;
    description?: string;
  };
  /** 解析出的物品 */
  items: ParsedItem[];
  /** 解析出的 Tags */
  tags: TagParseResult[];
  /** 解析出的配方 */
  recipes: RecipeParseResult[];
  /** 提取的材质 */
  textures: TextureInfo[];
  /** 解析的模型: 路径 -> 模型定义 */
  models?: Map<string, ModelDefinition>;
  /** 所有语言的翻译: key -> lang -> value */
  translations: Map<string, Map<string, string>>;
  /** 统计信息 */
  stats: {
    itemCount: number;
    tagCount: number;
    recipeCount: number;
    textureCount: number;
  };
}

/**
 * 解析器选项
 */
export interface ParserOptions {
  /** 是否解析 Lang 文件 */
  parseLang?: boolean;
  /** 是否解析 Tags */
  parseTags?: boolean;
  /** 是否解析 Recipes */
  parseRecipes?: boolean;
  /** 是否提取材质 */
  extractTextures?: boolean;
  /** 材质提取选项 */
  textureOptions?: {
    /** 最大尺寸限制（超过则缩放） */
    maxSize?: number;
    /** 只提取物品材质（跳过方块材质） */
    itemsOnly?: boolean;
  };
  /** 进度回调 */
  onProgress?: ProgressCallback;
}

/**
 * JAR 文件中的条目信息
 */
export interface JarEntry {
  /** 条目路径 */
  entryName: string;
  /** 是否为目录 */
  isDirectory: boolean;
  /** 文件大小 */
  size: number;
  /** 修改时间 */
  modTime: Date;
  /** 获取文件内容 */
  getData(): Buffer;
}

/**
 * ZIP 读取器接口
 */
export interface ZipReader {
  /** 获取所有条目 */
  getEntries(): JarEntry[];
  /** 读取特定文件 */
  readFile(path: string): Buffer | null;
  /** 关闭读取器 */
  close(): void;
}

/**
 * 解析错误类型
 */
export class JarParseError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'JarParseError';
  }
}
