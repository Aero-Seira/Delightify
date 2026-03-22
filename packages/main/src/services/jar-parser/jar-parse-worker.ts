/**
 * JAR 解析 Worker
 * 
 * 在独立线程中执行 JAR 解析任务，避免阻塞主线程
 */

import { parentPort, workerData, isMainThread } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import { createZipReader, extractModInfo } from './zip-reader';
import { parseLangFilesFromJar, parseAllTranslations } from './lang-parser';
import { parseTagFilesFromJar } from './tag-parser';
import { parseRecipeFilesFromJar } from './recipe-parser';
import { extractTexturesFromJar } from './texture-extractor';
import { parseModelFilesFromJar } from './model-parser';
import { parseResourcesFromJar } from './resource-loader';
import type { JarParseResult, JarParseProgress, ParserOptions } from './types';

// Worker 接收的数据接口
interface WorkerData {
  filePath: string;
  cacheDir: string;
  options: ParserOptions;
}

// Worker 发送的消息接口
type WorkerMessage =
  | { type: 'progress'; progress: JarParseProgress }
  | { type: 'result'; result: JarParseResult }
  | { type: 'error'; error: string };

/**
 * 发送进度消息到主线程
 */
function sendProgress(progress: JarParseProgress): void {
  if (parentPort) {
    parentPort.postMessage({ type: 'progress', progress });
  }
}

/**
 * 发送结果消息到主线程
 */
function sendResult(result: JarParseResult): void {
  if (parentPort) {
    parentPort.postMessage({ type: 'result', result });
  }
}

/**
 * 发送错误消息到主线程
 */
function sendError(error: string): void {
  if (parentPort) {
    parentPort.postMessage({ type: 'error', error });
  }
}

/**
 * 在 Worker 中执行 JAR 解析
 */
async function parseJarInWorker(): Promise<void> {
  // 确保不是在主线程中运行
  if (isMainThread) {
    throw new Error('This file should not be run in the main thread');
  }

  const { filePath, cacheDir, options } = workerData as WorkerData;
  
  try {
    // 1. 打开 JAR 文件
    sendProgress({
      stage: 'reading',
      stageLabel: 'Reading JAR file...',
      percent: 0,
    });

    const zipReader = createZipReader(filePath);
    
    try {
      // 2. 提取模组元信息
      const modInfo = extractModInfo(filePath);
      if (!modInfo) {
        throw new Error('Failed to extract mod info from JAR');
      }

      const { modId, modName, version, description, mcVersion } = modInfo;

      sendProgress({
        stage: 'reading',
        stageLabel: `Reading JAR: ${modName}`,
        percent: 5,
      });

      // 3. 获取所有条目
      const entries = zipReader.getEntries().map(entry => ({
        path: entry.entryName,
        data: entry.getData(),
      }));

      sendProgress({
        stage: 'reading',
        stageLabel: `Found ${entries.length} entries`,
        percent: 10,
      });

      // 4. 并行解析各类资源
      // 使用 Promise.all 并行执行独立的解析任务
      const parseOptions = {
        parseLang: options.parseLang ?? true,
        parseTags: options.parseTags ?? true,
        parseRecipes: options.parseRecipes ?? true,
      };

      // 并行解析
      const [
        langResult,
        allTranslations,
        tags,
        recipes,
        models
      ] = await Promise.all([
        // 解析 Lang 文件
        (async () => {
          sendProgress({
            stage: 'parsing_lang',
            stageLabel: 'Parsing language files...',
            percent: 15,
          });
          return parseOptions.parseLang
            ? parseLangFilesFromJar(entries, modId)
            : { langCode: 'en_us', translations: new Map(), items: [] };
        })(),

        // 解析所有翻译
        (async () => {
          return parseOptions.parseLang
            ? parseAllTranslations(entries, modId)
            : new Map();
        })(),

        // 解析 Tags
        (async () => {
          sendProgress({
            stage: 'parsing_tags',
            stageLabel: 'Parsing tags...',
            percent: 30,
          });
          return parseOptions.parseTags
            ? parseTagFilesFromJar(entries, modId)
            : [];
        })(),

        // 解析 Recipes
        (async () => {
          sendProgress({
            stage: 'parsing_recipes',
            stageLabel: 'Parsing recipes...',
            percent: 50,
          });
          return parseOptions.parseRecipes
            ? parseRecipeFilesFromJar(entries, modId)
            : [];
        })(),

        // 解析 Models
        (async () => {
          sendProgress({
            stage: 'parsing_recipes',
            stageLabel: 'Parsing models...',
            percent: 60,
          });
          return parseModelFilesFromJar(entries, modId);
        })(),
      ]);

      // 5. 提取材质
      sendProgress({
        stage: 'extracting_textures',
        stageLabel: 'Extracting textures...',
        percent: 70,
      });

      const textures = await extractTexturesFromJar(
        entries,
        modId,
        {
          cacheDir,
          itemsOnly: false, // 提取所有纹理以便正确处理多面方块
          skipExisting: true,
        }
      );

      // 6. 解析资源关联
      sendProgress({
        stage: 'extracting_textures',
        stageLabel: 'Resolving resource mappings...',
        percent: 85,
      });

      const { items: resolvedItems, textures: textureMap } = parseResourcesFromJar(
        textures.map(t => ({ path: t.path, data: t.data })),
        modId,
        models
      );

      // 7. 合并物品列表
      const allItems = mergeItems(langResult.items, resolvedItems, tags, recipes, modId);

      // 8. 构建结果
      sendProgress({
        stage: 'saving',
        stageLabel: 'Finalizing...',
        percent: 95,
      });

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
        models,
        translations: allTranslations,
        stats: {
          itemCount: allItems.length,
          tagCount: tags.length,
          recipeCount: recipes.length,
          textureCount: textures.length,
        },
      };

      sendProgress({
        stage: 'saving',
        stageLabel: 'Complete',
        percent: 100,
      });

      sendResult(result);
    } finally {
      zipReader.close();
    }
  } catch (error) {
    sendError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * 合并来自不同来源的物品信息
 */
function mergeItems(
  langItems: Array<{ itemId: string; modId: string; name: string; isBlock: boolean; translationKey: string }>,
  resolvedItems: Array<{ itemId: string; modId: string; name: string; translationKey: string; isBlock: boolean; displayName: string }>,
  tags: Array<{ tagId: string; items: string[] }>,
  recipes: Array<{ recipeId: string; inputs: Array<{ id: string; isTag: boolean }>; outputs: Array<{ itemId: string }> }>,
  modId: string
): Array<{ itemId: string; modId: string; name: string; isBlock: boolean; translationKey: string }> {
  const itemMap = new Map<string, any>();

  // 1. 首先添加 Lang 解析出的物品（有完整名称）
  for (const item of langItems) {
    itemMap.set(item.itemId, item);
  }

  // 2. 添加解析后的物品（包含纹理信息）
  for (const item of resolvedItems) {
    if (!itemMap.has(item.itemId)) {
      itemMap.set(item.itemId, item);
    }
  }

  // 3. 从 Tags 提取补充物品
  for (const tag of tags) {
    for (const itemId of tag.items) {
      if (!itemMap.has(itemId)) {
        const parts = itemId.split(':');
        if (parts.length === 2) {
          itemMap.set(itemId, {
            itemId,
            modId: parts[0],
            name: parts[1],
            isBlock: false,
            translationKey: `item.${parts[0]}.${parts[1]}`,
          });
        }
      }
    }
  }

  // 4. 从 Recipes 提取补充物品
  for (const recipe of recipes) {
    // 处理输出
    for (const output of recipe.outputs) {
      if (!itemMap.has(output.itemId)) {
        const parts = output.itemId.split(':');
        if (parts.length === 2) {
          itemMap.set(output.itemId, {
            itemId: output.itemId,
            modId: parts[0],
            name: parts[1],
            isBlock: false,
            translationKey: `item.${parts[0]}.${parts[1]}`,
          });
        }
      }
    }
    
    // 处理输入
    for (const input of recipe.inputs) {
      if (!input.isTag && !itemMap.has(input.id)) {
        const parts = input.id.split(':');
        if (parts.length === 2) {
          itemMap.set(input.id, {
            itemId: input.id,
            modId: parts[0],
            name: parts[1],
            isBlock: false,
            translationKey: `item.${parts[0]}.${parts[1]}`,
          });
        }
      }
    }
  }

  // 过滤只保留当前模组的物品
  return Array.from(itemMap.values()).filter(item => item.modId === modId);
}

// 启动 Worker 解析
parseJarInWorker().catch(err => {
  sendError(`Worker error: ${err.message}`);
  process.exit(1);
});
