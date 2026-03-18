/**
 * Project types for Delightify
 * 项目管理相关类型定义
 */

import type { ModLoader } from '../constants/minecraft';

export type { ModLoader };

/** 项目状态 */
export type ProjectStatus = 'loading' | 'ready' | 'error' | 'closed';

/**
 * 项目类型 - 代表一个 Minecraft 整合包项目
 */
export interface Project {
  /** 唯一标识符 */
  id: string;
  /** 项目名称 */
  name: string;
  /** 项目描述 */
  description?: string;
  /** 项目路径（整合包根目录） */
  path: string;
  /** Minecraft 版本 */
  mcVersion: string;
  /** 模组加载器 */
  modLoader: ModLoader;
  /** 模组加载器版本 */
  modLoaderVersion?: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
  /** 最后打开时间 */
  lastOpenedAt?: string;
  /** 是否收藏 */
  isFavorite?: boolean;
  /** 项目图标路径 */
  icon?: string;
  /** 模组数量 */
  totalMods: number;
  /** 配方数量 */
  totalRecipes: number;
  /** 物品数量 */
  totalItems: number;
}

/**
 * 创建项目请求数据
 */
export interface CreateProjectData {
  /** 项目名称 */
  name: string;
  /** 项目描述 */
  description?: string;
  /** 项目路径 */
  path: string;
  /** Minecraft 版本 */
  mcVersion: string;
  /** 模组加载器 */
  modLoader: ModLoader;
  /** 模组加载器版本 */
  modLoaderVersion?: string;
}

/**
 * 更新项目请求数据
 */
export interface UpdateProjectData {
  /** 项目名称 */
  name?: string;
  /** 项目描述 */
  description?: string;
  /** Minecraft 版本 */
  mcVersion?: string;
  /** 模组加载器 */
  modLoader?: ModLoader;
  /** 模组加载器版本 */
  modLoaderVersion?: string;
  /** 是否收藏 */
  isFavorite?: boolean;
  /** 项目图标路径 */
  icon?: string;
}

/**
 * 项目列表查询参数
 */
export interface ProjectListParams {
  /** 搜索关键词 */
  search?: string;
  /** 按 Minecraft 版本筛选 */
  mcVersion?: string;
  /** 按模组加载器筛选 */
  modLoader?: ModLoader;
  /** 只显示收藏 */
  favoriteOnly?: boolean;
  /** 排序字段 */
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastOpenedAt';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 项目列表结果
 */
export interface ProjectListResult {
  /** 是否成功 */
  success: boolean;
  /** 项目列表 */
  data?: Project[];
  /** 总数 */
  total?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 单个项目操作结果
 */
export interface ProjectResult {
  /** 是否成功 */
  success: boolean;
  /** 项目数据 */
  data?: Project | null;
  /** 错误信息 */
  error?: string;
}

/**
 * 项目删除结果
 */
export interface ProjectDeleteResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 项目统计信息
 */
export interface ProjectStats {
  /** 总项目数 */
  totalProjects: number;
  /** 收藏项目数 */
  favoriteProjects: number;
  /** 按 Minecraft 版本分布 */
  mcVersionDistribution: Record<string, number>;
  /** 按模组加载器分布 */
  modLoaderDistribution: Record<ModLoader, number>;
}
