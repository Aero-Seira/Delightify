/**
 * Drizzle ORM Schema Definitions
 * 
 * 定义 global.db 和 project.db 的完整表结构
 * M1 阶段：实现所有核心表（mods, items, item_tags, recipes, recipe_types, translations, textures）
 */

import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

// ============================================================================
// Global Database Tables (global.db)
// ============================================================================

/**
 * 模组元信息表
 * 存储已导入的模组基本信息，每个 JAR 文件对应一条记录
 */
export const mods = sqliteTable('mods', {
  // 主键：modId (如 "farmersdelight")
  modId: text('mod_id').primaryKey(),
  
  // 模组显示名称
  modName: text('mod_name').notNull(),
  
  // 模组版本号
  version: text('version'),
  
  // 适配的 Minecraft 版本
  mcVersion: text('mc_version'),
  
  // 来源类型：builtin (内置) / jar (JAR文件) / manual (手动添加)
  sourceType: text('source_type', { enum: ['builtin', 'jar', 'manual'] }).notNull(),
  
  // JAR 文件路径（sourceType 为 'jar' 时必填）
  jarPath: text('jar_path'),
  
  // JAR 文件哈希（用于增量更新检测）
  jarHash: text('jar_hash'),
  
  // 解析完成时间戳 (ISO 8601)
  parsedAt: text('parsed_at'),
  
  // 物品数量统计
  itemCount: integer('item_count').notNull().default(0),
  
  // 配方数量统计
  recipeCount: integer('recipe_count').notNull().default(0),
});

/**
 * 物品条目表
 * 存储所有从模组中解析出的物品/方块
 */
export const items = sqliteTable('items', {
  // 主键：itemId (如 "farmersdelight:tomato")
  itemId: text('item_id').primaryKey(),
  
  // 外键：所属模组 ID
  modId: text('mod_id').notNull().references(() => mods.modId),
  
  // 显示名称的翻译键 (如 "item.farmersdelight.tomato")
  displayNameKey: text('display_name_key'),
  
  // 解析后的显示名称（英文或已翻译文本）
  displayName: text('display_name'),
  
  // 物品分类：food/tool/weapon/armor/block/material/misc
  category: text('category', {
    enum: ['food', 'tool', 'weapon', 'armor', 'block', 'material', 'misc']
  }),
  
  // 材质文件相对路径（相对于 JAR 内 assets/）
  texturePath: text('texture_path'),
  
  // 材质缓存文件名（存储在 textureCache 目录下的文件名）
  textureCacheName: text('texture_cache_name'),
  
  // 是否为方块（影响渲染方式）
  isBlock: integer('is_block', { mode: 'boolean' }).notNull().default(false),
  
  // 记录创建时间戳 (ISO 8601)
  createdAt: text('created_at').notNull(),
});

/**
 * 物品标签关联表
 * 多对多关系：物品 <-> 标签
 */
export const itemTags = sqliteTable('item_tags', {
  // 标签 ID (如 "forge:vegetables")
  tagId: text('tag_id').notNull(),
  
  // 物品 ID
  itemId: text('item_id').notNull().references(() => items.itemId),
  
  // 来源模组（记录哪个模组定义了这个标签关联）
  sourceModId: text('source_mod_id').notNull(),
}, (table) => ({
  // 复合主键：一个物品可以属于多个标签，一个标签包含多个物品
  pk: primaryKey({ columns: [table.tagId, table.itemId] }),
}));

/**
 * 配方类型表
 * 存储支持的配方类型元数据
 */
export const recipeTypes = sqliteTable('recipe_types', {
  // 配方类型 ID (如 "minecraft:crafting_shaped", "farmersdelight:cooking")
  recipeTypeId: text('recipe_type_id').primaryKey(),
  
  // 显示名称
  displayName: text('display_name').notNull(),
  
  // 描述
  description: text('description'),
  
  // 图标路径（可选）
  icon: text('icon'),
  
  // 输入槽位数量
  inputSlotCount: integer('input_slot_count').notNull().default(1),
  
  // 输出槽位数量
  outputSlotCount: integer('output_slot_count').notNull().default(1),
  
  // 是否为内置类型（Minecraft 原版）
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  
  // 来源模组 ID
  sourceModId: text('source_mod_id'),
  
  // 原始 JSON 字段规格（用于 UI 渲染）
  fieldSpec: text('field_spec'),
});

/**
 * 配方表
 * 存储所有解析的配方数据
 */
export const recipes = sqliteTable('recipes', {
  // 配方 ID (如 "farmersdelight:tomato_soup")
  recipeId: text('recipe_id').primaryKey(),
  
  // 外键：所属模组
  modId: text('mod_id').notNull().references(() => mods.modId),
  
  // 外键：配方类型
  recipeTypeId: text('recipe_type_id').notNull().references(() => recipeTypes.recipeTypeId),
  
  // 配方原始 JSON 数据
  rawJson: text('raw_json').notNull(),
  
  // 输入槽位信息（JSON 数组，包含物品/tag引用）
  inputSlots: text('input_slots'),
  
  // 输出槽位信息（JSON 数组）
  outputSlots: text('output_slots'),
  
  // 解析时间
  parsedAt: text('parsed_at').notNull(),
});

/**
 * 翻译表
 * 存储 lang 文件的键值对
 */
export const translations = sqliteTable('translations', {
  // 翻译键 (如 "item.farmersdelight.tomato")
  key: text('key').notNull(),
  
  // 语言代码 (如 "en_us", "zh_cn")
  lang: text('lang').notNull(),
  
  // 翻译文本
  value: text('value').notNull(),
  
  // 来源模组
  modId: text('mod_id').notNull(),
}, (table) => ({
  // 复合主键：同一个 key 在不同 lang 下有不同的 value
  pk: primaryKey({ columns: [table.key, table.lang] }),
}));

/**
 * 材质缓存表
 * 存储材质元数据（实际 PNG 文件存储在磁盘缓存目录）
 */
export const textures = sqliteTable('textures', {
  // 材质 ID (格式: "{modId}:{texturePath}")
  textureId: text('texture_id').primaryKey(),
  
  // 来源模组
  modId: text('mod_id').notNull(),
  
  // 原始路径（在 JAR 内的路径）
  originalPath: text('original_path').notNull(),
  
  // 缓存文件名（存储在 textureCache 目录下）
  cacheName: text('cache_name').notNull(),
  
  // 文件哈希（用于缓存失效检测）
  fileHash: text('file_hash'),
  
  // 图片宽度
  width: integer('width'),
  
  // 图片高度
  height: integer('height'),
  
  // 缓存时间
  cachedAt: text('cached_at').notNull(),
});

// ============================================================================
// 图谱层扩展表 (M2+ 阶段实现)
// ============================================================================

/**
 * 统一实体表（图谱层）
 * 所有可关联对象（item/recipe/tag/block）都映射为 entity
 */
export const entities = sqliteTable('entities', {
  // 实体全局唯一 ID (格式: "item:farmersdelight:tomato", "recipe:farmersdelight:cooking/tomato_soup")
  entityId: text('entity_id').primaryKey(),
  
  // 实体类型：item / recipe / tag / block / recipe_type
  entityType: text('entity_type', { 
    enum: ['item', 'recipe', 'tag', 'block', 'recipe_type'] 
  }).notNull(),
  
  // 原始 ID（在各自表中的主键）
  originalId: text('original_id').notNull(),
  
  // 所属模组
  modId: text('mod_id').notNull(),
  
  // 显示名称
  displayName: text('display_name'),
  
  // 创建时间
  createdAt: text('created_at').notNull(),
});

/**
 * 关系边表（图谱层）
 * 存储数据关系（来自 JAR 解析）和语义关系（来自 LLM 推断）
 */
export const relations = sqliteTable('relations', {
  // 关系 ID（可复现 hash: sha1(from+type+to+slot)）
  relationId: text('relation_id').primaryKey(),
  
  // 起点实体 ID
  fromEntityId: text('from_entity_id').notNull().references(() => entities.entityId),
  
  // 终点实体 ID
  toEntityId: text('to_entity_id').notNull().references(() => entities.entityId),
  
  // 关系类型 (如 "data:consumes_item", "sem:equivalent_to")
  relationType: text('relation_type').notNull(),
  
  // 关系层次：data (数据层) / semantic (语义层)
  layer: text('layer', { enum: ['data', 'semantic'] }).notNull(),
  
  // 来源类型：jar / builtin / manual / llm / inferred
  sourceKind: text('source_kind', { 
    enum: ['jar', 'builtin', 'manual', 'llm', 'inferred'] 
  }).notNull(),
  
  // 关系状态：active / deprecated / deleted
  status: text('status', { enum: ['active', 'deprecated', 'deleted'] })
    .notNull()
    .default('active'),
  
  // 置信度（0-1，语义层必填，数据层可为 1.0）
  confidence: real('confidence').default(1.0),
  
  // 扩展信息（JSON）
  payload: text('payload'),
  
  // 创建时间
  createdAt: text('created_at').notNull(),
});

/**
 * 导入批次记录表
 * 每次解析 JAR 为一个批次，用于溯源
 */
export const imports = sqliteTable('imports', {
  // 导入批次 ID
  importId: text('import_id').primaryKey(),
  
  // 导入类型：jar / manual / builtin
  importType: text('import_type', { enum: ['jar', 'manual', 'builtin'] }).notNull(),
  
  // 来源路径（JAR 路径或标识）
  sourcePath: text('source_path'),
  
  // 文件哈希
  fileHash: text('file_hash'),
  
  // 解析器版本号
  parserVersion: text('parser_version').notNull(),
  
  // 导入的物品数量
  itemCount: integer('item_count').default(0),
  
  // 导入的配方数量
  recipeCount: integer('recipe_count').default(0),
  
  // 导入状态：pending / processing / completed / failed
  status: text('status', { 
    enum: ['pending', 'processing', 'completed', 'failed'] 
  }).notNull().default('pending'),
  
  // 错误信息（失败时）
  errorMessage: text('error_message'),
  
  // 开始时间
  startedAt: text('started_at').notNull(),
  
  // 完成时间
  completedAt: text('completed_at'),
});

/**
 * 关系证据溯源表
 * 每条关系可关联多条证据
 */
export const relationEvidence = sqliteTable('relation_evidence', {
  // 证据 ID
  evidenceId: text('evidence_id').primaryKey(),
  
  // 关联的关系 ID
  relationId: text('relation_id').notNull().references(() => relations.relationId),
  
  // 关联的导入批次
  importId: text('import_id').references(() => imports.importId),
  
  // 证据类型：file / json_path / llm_response / manual_note
  evidenceType: text('evidence_type', { 
    enum: ['file', 'json_path', 'llm_response', 'manual_note'] 
  }).notNull(),
  
  // 证据内容
  content: text('content').notNull(),
  
  // 文件路径（如果是文件证据）
  filePath: text('file_path'),
  
  // JSON Path（如果是 JSON 内特定位置）
  jsonPath: text('json_path'),
  
  // 创建时间
  createdAt: text('created_at').notNull(),
});

// ============================================================================
// Project Database Tables (project.db)
// ============================================================================

/**
 * 配方转换历史表
 * 存储项目内的配方转换记录
 */
export const conversionHistory = sqliteTable('conversion_history', {
  // 转换记录 ID
  conversionId: text('conversion_id').primaryKey(),
  
  // 原始配方 ID
  sourceRecipeId: text('source_recipe_id').notNull(),
  
  // 原始配方类型
  sourceRecipeType: text('source_recipe_type').notNull(),
  
  // 目标配方类型
  targetRecipeType: text('target_recipe_type').notNull(),
  
  // 转换后的配方 JSON
  convertedJson: text('converted_json'),
  
  // 转换方式：manual / llm / rule
  conversionMethod: text('conversion_method', { 
    enum: ['manual', 'llm', 'rule'] 
  }).notNull(),
  
  // LLM 建议的置信度（如果是 LLM 转换）
  llmConfidence: real('llm_confidence'),
  
  // 用户是否确认
  userConfirmed: integer('user_confirmed', { mode: 'boolean' }).default(false),
  
  // 用户备注
  userNote: text('user_note'),
  
  // 创建时间
  createdAt: text('created_at').notNull(),
  
  // 确认时间
  confirmedAt: text('confirmed_at'),
});

/**
 * 项目级语义关系覆盖表
 * 用于覆盖或屏蔽全局语义关系
 */
export const projectRelations = sqliteTable('project_relations', {
  // 关系 ID（与 global.db relations 对应）
  relationId: text('relation_id').notNull(),
  
  // 项目 ID（支持多项目）
  projectId: text('project_id').notNull(),
  
  // 覆盖状态：override / blocked / inherited
  status: text('status', { 
    enum: ['override', 'blocked', 'inherited'] 
  }).notNull(),
  
  // 覆盖后的关系数据（如果是 override）
  overrideData: text('override_data'),
  
  // 用户备注
  userNote: text('user_note'),
  
  // 创建时间
  createdAt: text('created_at').notNull(),
}, (table) => ({
  // 复合主键
  pk: primaryKey({ columns: [table.relationId, table.projectId] }),
}));

// ============================================================================
// Type Exports (推断的 TypeScript 类型)
// ============================================================================

export type Mod = typeof mods.$inferSelect;
export type NewMod = typeof mods.$inferInsert;

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;

export type ItemTag = typeof itemTags.$inferSelect;
export type NewItemTag = typeof itemTags.$inferInsert;

export type RecipeType = typeof recipeTypes.$inferSelect;
export type NewRecipeType = typeof recipeTypes.$inferInsert;

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

export type Translation = typeof translations.$inferSelect;
export type NewTranslation = typeof translations.$inferInsert;

export type Texture = typeof textures.$inferSelect;
export type NewTexture = typeof textures.$inferInsert;

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

export type Relation = typeof relations.$inferSelect;
export type NewRelation = typeof relations.$inferInsert;

export type Import = typeof imports.$inferSelect;
export type NewImport = typeof imports.$inferInsert;

export type RelationEvidence = typeof relationEvidence.$inferSelect;
export type NewRelationEvidence = typeof relationEvidence.$inferInsert;

export type ConversionHistory = typeof conversionHistory.$inferSelect;
export type NewConversionHistory = typeof conversionHistory.$inferInsert;

export type ProjectRelation = typeof projectRelations.$inferSelect;
export type NewProjectRelation = typeof projectRelations.$inferInsert;
