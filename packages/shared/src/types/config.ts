/**
 * 配置类型定义 / Configuration Type Definitions
 */

/**
 * 模组信息 / Mod Information
 */
export interface ModInfo {
  mod_id: string;
  mod_name: string;
  version: string;
  description?: string;
}

/**
 * 字段规格 / Field Specification
 */
export interface FieldSpec {
  required: boolean;
  type: string;
  constant?: string;
  description?: string;
  default?: unknown;
  min_items?: number;
  max_items?: number;
  range?: [number, number];
  unit?: string;
  enum?: string[];
  item_format?: Record<string, string>;
}

/**
 * 适用条件 / Suitable For
 */
export interface SuitableFor {
  item_categories?: string[];
  keywords?: string[];
  input_count?: {
    min: number;
    max: number;
  };
  output_count?: {
    min: number;
    max: number;
  };
  typical_patterns?: string[];
}

/**
 * 不兼容条件 / Incompatible With
 */
export interface IncompatibleWith {
  output_categories?: string[];
  reasons?: string[];
}

/**
 * 提示词模板 / Prompt Template
 */
export interface PromptTemplate {
  description: string;
  template: string;
}

/**
 * 配方示例 / Recipe Example
 */
export interface RecipeExample {
  name: string;
  recipe: Record<string, unknown>;
}

/**
 * 配方类型定义 / Recipe Type Definition
 */
export interface RecipeTypeDefinition {
  recipe_type_id: string;
  display_name: string;
  description: string;
  icon: string;
  template: Record<string, unknown>;
  field_specs: Record<string, FieldSpec>;
  suitable_for?: SuitableFor;
  incompatible_with?: IncompatibleWith;
  prompt_template?: PromptTemplate;
  examples?: RecipeExample[];
}

/**
 * 配方类型文件结构 / Recipe Types File Structure
 */
export interface RecipeTypesFile {
  mod_info: ModInfo;
  recipe_types: RecipeTypeDefinition[];
}

/**
 * 物品分类定义 / Item Category Definition
 */
export interface ItemCategoryDefinition {
  display_name: string;
  description: string;
  parent?: string;
  subcategories?: string[];
  keywords?: string[];
}

/**
 * 物品分类配置 / Item Category Configuration
 */
export interface ItemCategoryConfig {
  categories: Record<string, ItemCategoryDefinition>;
  item_mapping: Record<string, string[]>;
}
