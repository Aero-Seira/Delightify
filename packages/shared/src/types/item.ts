export interface Item {
  itemId: string;
  modId: string;
  displayNameKey?: string;
  displayName?: string;
  category?: ItemCategory;
  texturePath?: string;
  isBlock: boolean;
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
