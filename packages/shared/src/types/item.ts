/**
 * Item types - v2.1
 * 
 * 根据 reference_sql/export.sqlite 样例调整
 */

/** 物品/方块信息（与附属Mod导出结构一致） */
export interface Item {
  /** 完整ID (如 "minecraft:stone") */
  itemId: string;
  /** 所属模组ID */
  modid: string;
}

/** 标签信息（与附属Mod导出结构一致） */
export interface ItemTag {
  /** 标签ID (如 "forge:storage_blocks") */
  tagId: string;
  /** 物品ID */
  itemId: string;
}

/** 物品查询参数 */
export interface ItemQueryParams {
  /** 搜索关键词（匹配ID） */
  search?: string;
  /** 按模组筛选 */
  modid?: string;
  /** 按标签筛选 */
  tagId?: string;
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/** 物品查询结果 */
export interface ItemQueryResult {
  /** 物品列表 */
  items: Item[];
  /** 总数 */
  total: number;
  /** 页码 */
  page: number;
  /** 每页数量 */
  pageSize: number;
}

/** 标签信息（聚合后） */
export interface TagInfo {
  /** 标签ID */
  tagId: string;
  /** 包含的物品数量 */
  itemCount: number;
}
