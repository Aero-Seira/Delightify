/**
 * Tags 文件解析器
 * 策略二：从 data/{modid}/tags/items/*.json 中提取物品信息
 * 
 * Tag 文件格式：
 * {
 *   "replace": false,
 *   "values": [
 *     "modid:item_name",
 *     "#modid:tag_name"  // 引用其他 tag
 *   ]
 * }
 */

import type { TagParseResult, ProgressCallback, ParsedItem } from './types';

/**
 * Tag JSON 文件结构
 */
interface TagJson {
  replace?: boolean;
  values?: Array<string | { id: string; required: boolean }>;
}

/**
 * 解析单个 Tag 文件
 * @param content JSON 内容字符串
 * @returns 解析结果
 */
export function parseTagFile(content: string): TagParseResult | null {
  try {
    const data: TagJson = JSON.parse(content);

    const items: string[] = [];
    
    if (data.values) {
      for (const value of data.values) {
        if (typeof value === 'string') {
          items.push(value);
        } else if (typeof value === 'object' && value.id) {
          // 处理带 required 字段的格式
          items.push(value.id);
        }
      }
    }

    return {
      tagId: '', // 由调用方填充
      items,
      replace: data.replace || false,
    };
  } catch (error) {
    console.warn(`[TagParser] Failed to parse tag file: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 从 JAR 中解析所有 Tag 文件
 * @param entries JAR 条目列表
 * @param expectedModId 期望的模组 ID
 * @param onProgress 进度回调
 * @returns 解析结果数组
 */
export function parseTagFilesFromJar(
  entries: Array<{ path: string; data: Buffer }>,
  expectedModId?: string,
  onProgress?: ProgressCallback
): TagParseResult[] {
  const tags: TagParseResult[] = [];
  
  // 收集所有 tag 文件
  const tagFiles: Array<{ tagId: string; content: string }> = [];

  for (const entry of entries) {
    // 匹配 data/{modid}/tags/{type}/{tag_name}.json
    // type 可以是 items, blocks, fluids, entity_types, functions 等
    const match = entry.path.match(/^data\/([a-z0-9_]+)\/tags\/([a-z0-9_]+)\/([a-z0-9_\/.]+)\.json$/i);
    if (!match) continue;

    const [, modId, tagType, tagName] = match;
    
    // 过滤非期望模组的 tag 文件
    if (expectedModId && modId !== expectedModId) {
      continue;
    }

    // 目前只关注物品标签
    if (tagType !== 'items') {
      continue;
    }

    try {
      const content = entry.data.toString('utf-8');
      const tagId = `${modId}:${tagName.replace(/\//g, '_')}`;
      tagFiles.push({ tagId, content });
    } catch (error) {
      console.warn(`[TagParser] Failed to read tag file ${entry.path}:`, error);
    }
  }

  // 解析每个 tag 文件
  for (let i = 0; i < tagFiles.length; i++) {
    const { tagId, content } = tagFiles[i];

    onProgress?.({
      stage: 'parsing_tags',
      stageLabel: `Parsing tags: ${tagId}`,
      percent: 40 + Math.round((i / tagFiles.length) * 15),
      currentFile: tagId,
      processedCount: i,
      totalCount: tagFiles.length,
    });

    const result = parseTagFile(content);
    if (result) {
      tags.push({
        ...result,
        tagId,
      });
    }
  }

  return tags;
}

/**
 * 从 Tags 中提取物品 ID
 * 用于补充 Lang 解析可能遗漏的物品
 */
export function extractItemsFromTags(
  tags: TagParseResult[],
  expectedModId?: string
): ParsedItem[] {
  const itemMap = new Map<string, ParsedItem>();

  for (const tag of tags) {
    for (const itemId of tag.items) {
      // 跳过 Tag 引用（以 # 开头）
      if (itemId.startsWith('#')) {
        continue;
      }

      // 解析物品 ID
      const parts = itemId.split(':');
      if (parts.length !== 2) {
        continue;
      }

      const [modId, name] = parts;
      
      // 过滤非期望模组的物品
      if (expectedModId && modId !== expectedModId) {
        continue;
      }

      // 避免重复
      if (itemMap.has(itemId)) {
        continue;
      }

      itemMap.set(itemId, {
        itemId,
        modId,
        name, // 暂时使用 ID 作为名称，后续可以用翻译覆盖
        isBlock: false, // 无法从 tag 推断是否为方块
        translationKey: `item.${modId}.${name}`,
      });
    }
  }

  return Array.from(itemMap.values());
}

/**
 * 构建物品到 Tags 的映射
 * 用于快速查询某个物品属于哪些 Tags
 */
export function buildItemToTagsMap(tags: TagParseResult[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const tag of tags) {
    for (const itemId of tag.items) {
      if (itemId.startsWith('#')) {
        continue; // 跳过 tag 引用
      }

      if (!map.has(itemId)) {
        map.set(itemId, []);
      }
      map.get(itemId)!.push(tag.tagId);
    }
  }

  return map;
}

/**
 * 获取常用的 Forge/Fabric 标签
 * 用于物品分类
 */
export function getCommonTagCategories(): Map<string, string> {
  const categories = new Map<string, string>();
  
  // Forge 常用标签
  categories.set('forge:ingots', 'material');
  categories.set('forge:nuggets', 'material');
  categories.set('forge:gems', 'material');
  categories.set('forge:dusts', 'material');
  categories.set('forge:ores', 'material');
  categories.set('forge:raw_materials', 'material');
  categories.set('forge:storage_blocks', 'block');
  categories.set('forge:tools', 'tool');
  categories.set('forge:armor', 'armor');
  categories.set('forge:food', 'food');
  categories.set('forge:vegetables', 'food');
  categories.set('forge:fruits', 'food');
  categories.set('forge:grain', 'food');
  categories.set('forge:bread', 'food');
  categories.set('forge:cooked_meat', 'food');
  categories.set('forge:raw_meat', 'food');
  categories.set('forge:seeds', 'material');
  categories.set('forge:crops', 'material');
  
  // Fabric 常用标签
  categories.set('c:ingots', 'material');
  categories.set('c:nuggets', 'material');
  categories.set('c:gems', 'material');
  categories.set('c:dusts', 'material');
  categories.set('c:ores', 'material');
  categories.set('c:raw_ores', 'material');
  categories.set('c:storage_blocks', 'block');
  categories.set('c:tools', 'tool');
  categories.set('c:armor', 'armor');
  categories.set('c:food', 'food');
  categories.set('c:vegetables', 'food');
  categories.set('c:seeds', 'material');

  return categories;
}

/**
 * 根据物品所属的标签推断物品分类
 */
export function inferCategoryFromTags(itemId: string, itemToTagsMap: Map<string, string[]>): string {
  const tagCategories = getCommonTagCategories();
  const tags = itemToTagsMap.get(itemId);

  if (!tags) {
    return 'misc';
  }

  for (const tag of tags) {
    const category = tagCategories.get(tag);
    if (category) {
      return category;
    }
  }

  // 根据 tag 名称推断
  for (const tag of tags) {
    const lowerTag = tag.toLowerCase();
    if (lowerTag.includes('food')) return 'food';
    if (lowerTag.includes('tool')) return 'tool';
    if (lowerTag.includes('weapon')) return 'weapon';
    if (lowerTag.includes('armor')) return 'armor';
    if (lowerTag.includes('block')) return 'block';
    if (lowerTag.includes('material') || lowerTag.includes('ingot') || lowerTag.includes('gem')) {
      return 'material';
    }
  }

  return 'misc';
}
