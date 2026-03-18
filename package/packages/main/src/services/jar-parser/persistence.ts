/**
 * JAR 解析结果持久化服务
 * 将解析结果保存到 global.db
 */

import type { GlobalDbClient } from '../database/client';
import * as schema from '../database/schema';
import { eq, sql } from 'drizzle-orm';
import type { JarParseResult, ParsedItem } from './types';
import { buildItemToTagsMap, inferCategoryFromTags } from './tag-parser';

/**
 * 将 JAR 解析结果保存到数据库
 * @param db 数据库客户端
 * @param result 解析结果
 * @param jarPath JAR 文件路径
 * @param jarHash JAR 文件哈希（可选）
 * @returns 保存的模组 ID
 */
export async function saveJarParseResult(
  db: GlobalDbClient,
  result: JarParseResult,
  jarPath: string,
  jarHash?: string
): Promise<string> {
  const { modInfo, items, tags, recipes, textures } = result;
  const now = new Date().toISOString();

  // 1. 保存模组信息
  await db.insert(schema.mods).values({
    modId: modInfo.modId,
    modName: modInfo.modName,
    version: modInfo.version,
    mcVersion: modInfo.mcVersion,
    sourceType: 'jar',
    jarPath,
    jarHash,
    parsedAt: now,
    itemCount: items.length,
    recipeCount: recipes.length,
  }).onConflictDoUpdate({
    target: schema.mods.modId,
    set: {
      modName: modInfo.modName,
      version: modInfo.version,
      mcVersion: modInfo.mcVersion,
      jarPath,
      jarHash,
      parsedAt: now,
      itemCount: items.length,
      recipeCount: recipes.length,
    },
  });

  // 2. 构建物品到 Tags 的映射（用于推断分类）
  const itemToTagsMap = buildItemToTagsMap(tags);

  // 3. 保存物品信息
  for (const item of items) {
    // 推断分类
    const category = inferCategoryFromTags(item.itemId, itemToTagsMap);
    
    // 查找材质缓存名
    const texture = textures.find(t => {
      const itemName = item.itemId.split(':')[1];
      return t.itemName === itemName || t.itemName === `${itemName}`;
    });

    await db.insert(schema.items).values({
      itemId: item.itemId,
      modId: modInfo.modId,
      displayNameKey: item.translationKey,
      displayName: item.name,
      category: category as any,
      texturePath: texture?.path,
      textureCacheName: texture ? `${texture.modId}_${texture.itemName}` : undefined,
      isBlock: item.isBlock,
      createdAt: now,
    }).onConflictDoUpdate({
      target: schema.items.itemId,
      set: {
        displayNameKey: item.translationKey,
        displayName: item.name,
        category: category as any,
        texturePath: texture?.path,
        textureCacheName: texture ? `${texture.modId}_${texture.itemName}` : undefined,
        isBlock: item.isBlock,
      },
    });
  }

  // 4. 保存 Tags
  for (const tag of tags) {
    for (const itemId of tag.items) {
      // 跳过 Tag 引用（以 # 开头）
      if (itemId.startsWith('#')) continue;

      await db.insert(schema.itemTags).values({
        tagId: tag.tagId,
        itemId,
        sourceModId: modInfo.modId,
      }).onConflictDoNothing();
    }
  }

  // 5. 保存配方类型（去重）
  const recipeTypesSet = new Set(recipes.map(r => r.recipeType));
  for (const recipeTypeId of recipeTypesSet) {
    await db.insert(schema.recipeTypes).values({
      recipeTypeId,
      displayName: getRecipeTypeDisplayName(recipeTypeId),
      sourceModId: modInfo.modId,
    }).onConflictDoNothing();
  }

  // 6. 保存配方
  for (const recipe of recipes) {
    await db.insert(schema.recipes).values({
      recipeId: recipe.recipeId,
      modId: modInfo.modId,
      recipeTypeId: recipe.recipeType,
      rawJson: recipe.rawJson,
      inputSlots: JSON.stringify(recipe.inputs),
      outputSlots: JSON.stringify(recipe.outputs),
      parsedAt: now,
    }).onConflictDoUpdate({
      target: schema.recipes.recipeId,
      set: {
        rawJson: recipe.rawJson,
        inputSlots: JSON.stringify(recipe.inputs),
        outputSlots: JSON.stringify(recipe.outputs),
        parsedAt: now,
      },
    });
  }

  // 7. 保存材质元数据
  for (const texture of textures) {
    const textureId = `${texture.modId}:${texture.path}`;
    await db.insert(schema.textures).values({
      textureId,
      modId: texture.modId,
      originalPath: texture.path,
      cacheName: `${texture.modId}_${texture.itemName}`,
      cachedAt: now,
    }).onConflictDoUpdate({
      target: schema.textures.textureId,
      set: {
        cacheName: `${texture.modId}_${texture.itemName}`,
        cachedAt: now,
      },
    });
  }

  return modInfo.modId;
}

/**
 * 获取配方类型的显示名称
 */
function getRecipeTypeDisplayName(recipeType: string): string {
  const displayNames: Record<string, string> = {
    'minecraft:crafting_shaped': '有序合成',
    'minecraft:crafting_shapeless': '无序合成',
    'minecraft:smelting': '熔炼',
    'minecraft:blasting': '高炉冶炼',
    'minecraft:smoking': '烟熏',
    'minecraft:campfire_cooking': '营火烹饪',
    'minecraft:stonecutting': '切石',
    'minecraft:smithing_transform': '锻造升级',
    'minecraft:smithing_trim': '锻造纹饰',
  };

  return displayNames[recipeType] || recipeType.split(':').pop() || recipeType;
}

/**
 * 检查模组是否已存在于数据库中
 * @param db 数据库客户端
 * @param modId 模组 ID
 * @returns 是否存在
 */
export async function isModExists(
  db: GlobalDbClient,
  modId: string
): Promise<boolean> {
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(schema.mods)
    .where(eq(schema.mods.modId, modId));
  
  return result[0]?.count > 0;
}

/**
 * 从数据库中删除模组及其相关数据
 * @param db 数据库客户端
 * @param modId 模组 ID
 */
export async function deleteModFromDatabase(
  db: GlobalDbClient,
  modId: string
): Promise<void> {
  // 删除顺序：先删关联表，再删主表
  
  // 1. 删除 item_tags
  await db.delete(schema.itemTags)
    .where(sql`${schema.itemTags.itemId} LIKE ${modId + ':%'}`);

  // 2. 删除 recipes
  await db.delete(schema.recipes)
    .where(eq(schema.recipes.modId, modId));

  // 3. 删除 items
  await db.delete(schema.items)
    .where(eq(schema.items.modId, modId));

  // 4. 删除 textures
  await db.delete(schema.textures)
    .where(eq(schema.textures.modId, modId));

  // 5. 删除模组本身
  await db.delete(schema.mods)
    .where(eq(schema.mods.modId, modId));
}

/**
 * 获取数据库中的模组列表
 * @param db 数据库客户端
 * @returns 模组列表
 */
export async function getModsList(
  db: GlobalDbClient
): Promise<Array<typeof schema.mods.$inferSelect>> {
  return db.select().from(schema.mods).orderBy(schema.mods.parsedAt);
}

/**
 * 获取模组详情
 * @param db 数据库客户端
 * @param modId 模组 ID
 * @returns 模组详情或 null
 */
export async function getModDetails(
  db: GlobalDbClient,
  modId: string
): Promise<typeof schema.mods.$inferSelect | null> {
  const result = await db.select()
    .from(schema.mods)
    .where(eq(schema.mods.modId, modId))
    .limit(1);
  
  return result[0] || null;
}
