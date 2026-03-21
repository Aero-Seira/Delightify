/**
 * Lang 文件解析器
 * 策略一：从 assets/{modid}/lang/*.json 中提取物品信息
 * 
 * Lang 文件的 key 格式：
 * - item.{modid}.{item_name} → 物品
 * - block.{modid}.{block_name} → 方块
 * - entity.{modid}.{entity_name} → 实体
 * - itemGroup.{modid}.{group_name} → 创造模式物品栏
 */

import type { LangParseResult, ParsedItem, ProgressCallback } from './types';

/**
 * Lang 文件键名模式
 * 用于匹配各种 Minecraft 相关的键名
 */
const LANG_KEY_PATTERNS = {
  // 物品：item.{modid}.{name}
  item: /^item\.([a-z0-9_]+)\.([a-z0-9_]+)$/i,
  // 方块：block.{modid}.{name}
  block: /^block\.([a-z0-9_]+)\.([a-z0-9_]+)$/i,
  // 实体：entity.{modid}.{name}
  entity: /^entity\.([a-z0-9_]+)\.([a-z0-9_]+)$/i,
  // 刷怪蛋：item.{modid}.{name}_spawn_egg
  spawnEgg: /^item\.([a-z0-9_]+)\.([a-z0-9_]+)_spawn_egg$/i,
  // 创造模式物品栏
  itemGroup: /^itemGroup\.([a-z0-9_]+)\.([a-z0-9_]+)$/i,
};

/**
 * 解析单个 Lang 文件内容
 * @param content JSON 内容字符串
 * @param langCode 语言代码（如 "en_us"）
 * @param expectedModId 期望的模组 ID（用于过滤）
 * @returns 解析结果
 */
export function parseLangFile(
  content: string,
  langCode: string,
  expectedModId?: string
): LangParseResult {
  const translations = new Map<string, string>();
  const items: ParsedItem[] = [];

  try {
    const data = JSON.parse(content) as Record<string, string>;

    for (const [key, value] of Object.entries(data)) {
      translations.set(key, value);

      // 尝试匹配物品
      const itemMatch = key.match(LANG_KEY_PATTERNS.item);
      if (itemMatch) {
        const [, modId, itemName] = itemMatch;
        
        // 如果指定了期望的 modId，进行过滤
        if (expectedModId && modId !== expectedModId) {
          continue;
        }

        // 跳过刷怪蛋（单独处理）
        if (key.endsWith('_spawn_egg')) {
          continue;
        }

        items.push({
          itemId: `${modId}:${itemName}`,
          modId,
          name: value,
          isBlock: false,
          translationKey: key,
        });
        continue;
      }

      // 尝试匹配方块
      const blockMatch = key.match(LANG_KEY_PATTERNS.block);
      if (blockMatch) {
        const [, modId, blockName] = blockMatch;
        
        if (expectedModId && modId !== expectedModId) {
          continue;
        }

        items.push({
          itemId: `${modId}:${blockName}`,
          modId,
          name: value,
          isBlock: true,
          translationKey: key,
        });
        continue;
      }

      // 尝试匹配实体（生成刷怪蛋物品）
      const entityMatch = key.match(LANG_KEY_PATTERNS.entity);
      if (entityMatch) {
        const [, modId, entityName] = entityMatch;
        
        if (expectedModId && modId !== expectedModId) {
          continue;
        }

        // 实体本身不是物品，但通常有对应的刷怪蛋
        // 这里我们只记录，不创建物品条目
        continue;
      }
    }
  } catch (error) {
    console.warn(`[LangParser] Failed to parse lang file: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    langCode,
    translations,
    items,
  };
}

/**
 * 从 JAR 中解析所有 Lang 文件
 * @param entries JAR 条目列表
 * @param expectedModId 期望的模组 ID
 * @param onProgress 进度回调
 * @returns 合并后的解析结果
 */
export function parseLangFilesFromJar(
  entries: Array<{ path: string; data: Buffer }>,
  expectedModId?: string,
  onProgress?: ProgressCallback
): LangParseResult {
  // 收集所有 lang 文件
  const langFiles: Array<{ langCode: string; content: string }> = [];

  for (const entry of entries) {
    // 匹配 assets/{modid}/lang/{lang_code}.json
    const match = entry.path.match(/^assets\/([a-z0-9_]+)\/lang\/([a-z_]+)\.json$/i);
    if (!match) continue;

    const [, modId, langCode] = match;
    
    // 过滤非期望模组的 lang 文件
    if (expectedModId && modId !== expectedModId) {
      continue;
    }

    try {
      const content = entry.data.toString('utf-8');
      langFiles.push({ langCode, content });
    } catch (error) {
      console.warn(`[LangParser] Failed to read lang file ${entry.path}:`, error);
    }
  }

  // 优先使用 en_us，其次是 zh_cn，最后是任意语言
  const priorityOrder = ['en_us', 'zh_cn'];
  langFiles.sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a.langCode);
    const bIndex = priorityOrder.indexOf(b.langCode);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  // 合并所有语言的翻译，优先使用高优先级语言
  const mergedTranslations = new Map<string, string>();
  const allItems = new Map<string, ParsedItem>();

  for (let i = 0; i < langFiles.length; i++) {
    const { langCode, content } = langFiles[i];
    
    onProgress?.({
      stage: 'parsing_lang',
      stageLabel: `Parsing language: ${langCode}`,
      percent: 25 + Math.round((i / langFiles.length) * 15),
      currentFile: `${langCode}.json`,
      processedCount: i,
      totalCount: langFiles.length,
    });

    const result = parseLangFile(content, langCode, expectedModId);

    // 合并翻译（后覆盖前，所以优先级高的应该后处理）
    for (const [key, value] of result.translations) {
      if (!mergedTranslations.has(key)) {
        mergedTranslations.set(key, value);
      }
    }

    // 合并物品（以 itemId 为键去重）
    for (const item of result.items) {
      if (!allItems.has(item.itemId)) {
        allItems.set(item.itemId, item);
      }
    }
  }

  return {
    langCode: langFiles[0]?.langCode || 'en_us',
    translations: mergedTranslations,
    items: Array.from(allItems.values()),
  };
}

/**
 * 获取首选语言代码
 * 根据系统语言或配置选择最佳语言
 */
export function getPreferredLangCode(): string {
  // 可以扩展为读取用户配置
  // 默认返回 en_us
  return 'en_us';
}

/**
 * 格式化显示名称
 * 将 lang 值中的格式代码（如 §a）去除
 */
export function formatDisplayName(name: string): string {
  // 去除 Minecraft 颜色代码 §[0-9a-fk-or]
  return name.replace(/§[0-9a-fk-or]/gi, '').trim();
}

/**
 * 解析所有语言的翻译
 * @param entries JAR 条目列表
 * @param expectedModId 期望的模组 ID
 * @returns Map<key, Map<lang, value>>
 */
export function parseAllTranslations(
  entries: Array<{ path: string; data: Buffer }>,
  expectedModId?: string
): Map<string, Map<string, string>> {
  const translations = new Map<string, Map<string, string>>();

  for (const entry of entries) {
    // 匹配 assets/{modid}/lang/{lang_code}.json
    const match = entry.path.match(/^assets\/([a-z0-9_]+)\/lang\/([a-z_]+)\.json$/i);
    if (!match) continue;

    const [, modId, langCode] = match;
    
    // 过滤非期望模组的 lang 文件
    if (expectedModId && modId !== expectedModId) {
      continue;
    }

    try {
      const content = entry.data.toString('utf-8');
      const data = JSON.parse(content) as Record<string, string>;

      for (const [key, value] of Object.entries(data)) {
        if (!translations.has(key)) {
          translations.set(key, new Map());
        }
        translations.get(key)!.set(langCode, value);
      }
    } catch (error) {
      console.warn(`[LangParser] Failed to parse lang file ${entry.path}:`, error);
    }
  }

  return translations;
}
