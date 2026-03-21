export interface Item {
  id?: string;  // 内部数据库 ID (可选，兼容性)
  itemId: string;
  modId: string;
  name?: string;  // 物品名称（itemId 的短名部分）
  displayNameKey?: string;
  displayName?: string;
  category?: ItemCategory;
  texturePath?: string;
  textureCacheName?: string;  // 缓存中的文件名
  textureType?: 'item' | 'block' | 'unknown';  // 材质类型
  isBlock: boolean;
  tagIds?: string[];  // 物品拥有的标签
  createdAt: string;
}

export type ItemCategory = 'food' | 'tool' | 'weapon' | 'armor' | 'block' | 'material' | 'misc';

export interface ItemStack {
  itemId: string;
  count?: number;
}

export interface ItemTag {
  tagId: string;
  items: string[];
  sourceModId: string;
}
