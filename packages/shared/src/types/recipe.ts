/**
 * Recipe types - v2.1
 * 
 * 根据 reference_sql/export.sqlite 样例调整
 */

/** 配方信息（与附属Mod导出结构一致） */
export interface Recipe {
  /** 完整配方ID */
  recipeId: string;
  /** 配方类型ID (如 "minecraft:smoking") */
  typeId: string;
  /** 所属模组ID */
  modid: string;
  /** 配方哈希 */
  hash: string;
  /** 原始JSON */
  rawJson?: string;
  /** 是否未解析 */
  unparsed: boolean;
}

/** 配方查询参数 */
export interface RecipeQueryParams {
  /** 搜索关键词 */
  search?: string;
  /** 按模组筛选 */
  modid?: string;
  /** 按配方类型筛选 */
  typeId?: string;
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/** 配方类型信息 */
export interface RecipeTypeInfo {
  /** 配方类型ID */
  typeId: string;
  /** 显示名称（可自定义） */
  displayName: string;
  /** 配方数量 */
  recipeCount: number;
}

/** 配方编辑记录 */
export interface RecipeEdit {
  /** 编辑记录ID */
  editId: string;
  /** 修改的配方ID */
  recipeId: string;
  /** 编辑类型 */
  editType: 'create' | 'modify' | 'disable' | 'delete' | 'restore';
  /** 原始配方（修改前） */
  originalRecipe?: string;
  /** 修改后的配方 */
  editedRecipe: string;
  /** 编辑说明 */
  description?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 是否已导出 */
  isExported: boolean;
  /** 导出时间 */
  exportedAt?: string;
}

/** 创建配方编辑请求 */
export interface CreateRecipeEditRequest {
  /** 配方ID */
  recipeId: string;
  /** 编辑类型 */
  editType: RecipeEdit['editType'];
  /** 原始配方JSON */
  originalRecipe?: string;
  /** 修改后的配方JSON */
  editedRecipe: string;
  /** 编辑说明 */
  description?: string;
}
