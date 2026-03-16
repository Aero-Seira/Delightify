/**
 * Drizzle ORM Schema Definitions
 * 
 * 定义 global.db 和 project.db 的表结构
 * M0 阶段：实现 mods 和 items 核心表，其他表留作 TODO
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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
  
  // 材质文件相对路径
  texturePath: text('texture_path'),
  
  // 是否为方块（影响渲染方式）
  isBlock: integer('is_block', { mode: 'boolean' }).notNull().default(false),
  
  // 记录创建时间戳 (ISO 8601)
  createdAt: text('created_at').notNull(),
});

// TODO: M1+ 阶段实现以下表
// export const itemTags = sqliteTable('item_tags', { ... });
// export const recipes = sqliteTable('recipes', { ... });
// export const recipeTypes = sqliteTable('recipe_types', { ... });
// export const translations = sqliteTable('translations', { ... });
// export const textures = sqliteTable('textures', { ... });

// TODO: 图谱层表 (M2+ 阶段)
// export const entities = sqliteTable('entities', { ... });
// export const relations = sqliteTable('relations', { ... });
// export const imports = sqliteTable('imports', { ... });
// export const relationEvidence = sqliteTable('relation_evidence', { ... });

// ============================================================================
// Project Database Tables (project.db)
// ============================================================================

// TODO: M2+ 阶段实现项目私有库表
// export const conversionHistory = sqliteTable('conversion_history', { ... });
// export const projectRelations = sqliteTable('project_relations', { ... });

// ============================================================================
// Type Exports (推断的 TypeScript 类型)
// ============================================================================

export type Mod = typeof mods.$inferSelect;
export type NewMod = typeof mods.$inferInsert;

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
