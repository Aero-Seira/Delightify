/**
 * JAR 解析器主入口
 * 整合三策略解析：Lang / Tags / Recipes / Textures
 */

import { createZipReader, extractModInfo, extractModIdFromJar } from './zip-reader';
import { parseLangFilesFromJar } from './lang-parser';
import { parseTagFilesFromJar, extractItemsFromTags, inferCategoryFromTags, buildItemToTagsMap } from './tag-parser';
import { parseRecipeFilesFromJar, extractItemsFromRecipes, getRecipeTypeDisplayName } from './recipe-parser';
import { extractTexturesFromJar, type TextureExtractionOptions } from './texture-extractor';
import type { 
  JarParseResult, 
  ParserOptions,
  JarParseProgress,
  ParsedItem,
  JarParseError,
} from './types';

// 导出子模块
export * from './types';
export * from './zip-reader';
export * from './lang-parser';
export * from './tag-parser';
export * from './recipe-parser';
export * from './texture-extractor';

/**
 * 扩展 ParserOptions，添加缓存目录
 */
export interface ExtendedParserOptions extends ParserOptions {
  textureOptions?: {
    cacheDir: string;
    maxSize?: number;
    itemsOnly?: boolean;
  };
}

/**
 * 解析 JAR 文件
 * @param filePath JAR 文件路径
 * @param options 解析选项
 * @returns 解析结果
 */
export async function parseJarFile(
  filePath: string,
  options: ExtendedParserOptions = {}
): Promise<JarParseResult> {
  const {
    parseLang = true,
    parseTags = true,
    parseRecipes = true,
    extractTextures = true,
    textureOptions = { cacheDir: '' },
    onProgress,
  } = options;

  // 报告开始读取
  onProgress?.({
    stage: 'reading',
    stageLabel: 'Reading JAR file...',
    percent: 0,
  });

  // 1. 打开 JAR 文件
  const zipReader = createZipReader(filePath);
  
  try {
    // 2. 提取模组元信息
    const modInfo = extractModInfo(filePath);
    if (!modInfo) {
      throw new Error('Failed to extract mod info from JAR');
    }

    const { modId, modName, version, description, mcVersion } = modInfo;

    onProgress?.({
      stage: 'reading',
      stageLabel: `Reading JAR: ${modName}`,
      percent: 10,
    });

    // 3. 获取所有条目
    const entries = zipReader.getEntries().map(entry => ({
      path: entry.entryName,
      data: entry.getData(),
    }));

    onProgress?.({
      stage: 'reading',
      stageLabel: `Found ${entries.length} entries`,
      percent: 20,
    });

    // 4. 解析 Lang 文件（策略一）
    const langResult = parseLang 
      ? parseLangFilesFromJar(entries, modId, onProgress)
      : { langCode: 'en_us', translations: new Map(), items: [] };

    // 5. 解析 Tag 文件（策略二）
    const tags = parseTags
      ? parseTagFilesFromJar(entries, modId, onProgress)
      : [];

    // 6. 解析 Recipe 文件（策略三）
    const recipes = parseRecipes
      ? parseRecipeFilesFromJar(entries, modId, onProgress)
      : [];

    // 7. 提取材质
    let textures: Array<{ path: string; modId: string; itemName: string; data: Buffer }> = [];
    if (extractTextures && textureOptions.cacheDir) {
      textures = await extractTexturesFromJar(
        entries,
        modId,
        {
          cacheDir: textureOptions.cacheDir,
          itemsOnly: textureOptions.itemsOnly ?? true,
          skipExisting: true,
        },
        onProgress
      );
    }

    // 8. 合并物品列表
    const allItems = mergeItems(langResult.items, tags, recipes, modId);

    // 9. 构建结果
    const result: JarParseResult = {
      modInfo: {
        modId,
        modName,
        version,
        description,
        mcVersion,
      },
      items: allItems,
      tags,
      recipes,
      textures: textures.map(t => ({
        path: t.path,
        modId: t.modId,
        itemName: t.itemName,
        data: t.data,
      })),
      stats: {
        itemCount: allItems.length,
        tagCount: tags.length,
        recipeCount: recipes.length,
        textureCount: textures.length,
      },
    };

    // 报告完成
    onProgress?.({
      stage: 'saving',
      stageLabel: 'Saving to database...',
      percent: 100,
    });

    return result;
  } finally {
    // 确保关闭 ZIP 读取器
    zipReader.close();
  }
}

/**
 * 合并来自不同来源的物品信息
 * - Lang 解析提供基础名称
 * - Tags 提供分类信息
 * - Recipes 补充遗漏的物品
 */
function mergeItems(
  langItems: ParsedItem[],
  tags: Array<{ tagId: string; items: string[] }>,
  recipes: Array<{ recipeId: string; recipeType: string; rawJson: string; inputs: Array<{ id: string; isTag: boolean; slot: number }>; outputs: Array<{ itemId: string; slot: number; count: number }> }>,
  modId: string
): ParsedItem[] {
  const itemMap = new Map<string, ParsedItem>();

  // 1. 首先添加 Lang 解析出的物品（有完整名称）
  for (const item of langItems) {
    itemMap.set(item.itemId, item);
  }

  // 2. 从 Tags 提取补充物品
  const tagItems = extractItemsFromTags(tags.map(t => ({ ...t, replace: false })), modId);
  for (const item of tagItems) {
    if (!itemMap.has(item.itemId)) {
      // 如果 Lang 中已存在，更新分类
      itemMap.set(item.itemId, item);
    }
  }

  // 3. 从 Recipes 提取补充物品
  const recipeItemIds = extractItemsFromRecipes(recipes, modId);

  for (const itemId of recipeItemIds) {
    if (!itemMap.has(itemId)) {
      const parts = itemId.split(':');
      if (parts.length === 2) {
        const [, name] = parts;
        itemMap.set(itemId, {
          itemId,
          modId,
          name, // 暂时使用 ID 作为名称
          isBlock: false,
          translationKey: `item.${modId}.${name}`,
        });
      }
    }
  }

  // 4. 使用 Tags 推断分类
  const itemToTagsMap = buildItemToTagsMap(tags.map(t => ({ ...t, replace: false })));
  for (const item of itemMap.values()) {
    // 根据翻译键推断 isBlock
    if (item.translationKey.startsWith('block.')) {
      item.isBlock = true;
    }
  }

  return Array.from(itemMap.values());
}

/**
 * 快速验证 JAR 文件是否可解析
 */
export function validateJarFile(filePath: string): { valid: boolean; error?: string } {
  // 检查文件是否存在
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: 'File not found' };
  }

  // 检查文件扩展名
  if (!filePath.toLowerCase().endsWith('.jar')) {
    return { valid: false, error: 'Not a JAR file' };
  }

  // 检查是否为有效的 ZIP 文件
  const { isValidZipFile } = require('./zip-reader');
  if (!isValidZipFile(filePath)) {
    return { valid: false, error: 'Invalid or corrupted JAR file' };
  }

  // 尝试提取模组 ID
  const modId = extractModIdFromJar(filePath);
  if (!modId) {
    return { valid: false, error: 'Cannot extract mod ID from JAR' };
  }

  return { valid: true };
}

/**
 * 批量解析多个 JAR 文件
 */
export async function parseMultipleJars(
  filePaths: string[],
  options: ExtendedParserOptions = {}
): Promise<Array<{ filePath: string; result?: JarParseResult; error?: string }>> {
  const results: Array<{ filePath: string; result?: JarParseResult; error?: string }> = [];

  for (const filePath of filePaths) {
    try {
      const result = await parseJarFile(filePath, options);
      results.push({ filePath, result });
    } catch (error) {
      results.push({
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
