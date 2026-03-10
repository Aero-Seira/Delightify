export interface Recipe {
  recipeId: string;
  modId: string;
  recipeTypeId: string;
  inputSlots: RecipeSlot[];
  outputSlots: RecipeSlot[];
  extraProps?: Record<string, unknown>;
  rawJson?: string;
}

export interface RecipeSlot {
  slotIndex: number;
  items: string[];
  count?: number;
}

export interface RecipeType {
  recipeTypeId: string;
  displayName: string;
  description?: string;
  icon?: string;
  inputSlotCount: number;
  outputSlotCount: number;
}
