import { ipcMain, BrowserWindow, dialog } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  JarImportResult, 
  JarImportProgress, 
  Mod 
} from '@delightify/shared';
import { appPaths } from '../services/paths';
import { createGlobalDbClient, batchInsertItems, batchInsertTags, batchInsertRecipes, batchInsertTranslations, optimizeForBulkInsert, restoreSafetySettings } from '../services/database';
import { 
  parseJarFile, 
  validateJarFile,
  parseJarWithWorker,
  isWorkerSupported,
  type JarParseProgress,
  type RecipeParseResult,
  type TagParseResult,
  type TextureInfo,
} from '../services/jar-parser';
import { parseResourcesFromJar, type ParseProgress, type ResolvedItem } from '../services/jar-parser/resource-loader';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 活跃的导入任务 Map
 * 用于支持取消操作
 */
const activeImports = new Map<string, { cancel: boolean }>();

/**
 * 确保目录存在
 */
function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 计算 Buffer 的哈希值
 */
function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
}

/**
 * 初始化内置配方类型
 */
async function initializeBuiltinRecipeTypes(db: ReturnType<typeof createGlobalDbClient>): Promise<void> {
  const builtinTypes = [
    { id: 'minecraft:crafting_shaped', name: '有序合成', inputSlots: 9, outputSlots: 1 },
    { id: 'minecraft:crafting_shapeless', name: '无序合成', inputSlots: 9, outputSlots: 1 },
    { id: 'minecraft:smelting', name: '熔炼', inputSlots: 1, outputSlots: 1 },
    { id: 'minecraft:blasting', name: '高炉冶炼', inputSlots: 1, outputSlots: 1 },
    { id: 'minecraft:smoking', name: '烟熏', inputSlots: 1, outputSlots: 1 },
    { id: 'minecraft:campfire_cooking', name: '营火烹饪', inputSlots: 1, outputSlots: 1 },
    { id: 'minecraft:stonecutting', name: '切石', inputSlots: 1, outputSlots: 1 },
    { id: 'minecraft:smithing_transform', name: '锻造升级', inputSlots: 3, outputSlots: 1 },
    { id: 'minecraft:smithing_trim', name: '锻造纹饰', inputSlots: 3, outputSlots: 1 },
  ];

  for (const type of builtinTypes) {
    await db.execute({
      sql: `INSERT INTO recipe_types (recipe_type_id, display_name, input_slot_count, output_slot_count, is_builtin, source_mod_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(recipe_type_id) DO UPDATE SET
              display_name = excluded.display_name,
              input_slot_count = excluded.input_slot_count,
              output_slot_count = excluded.output_slot_count`,
      args: [type.id, type.name, type.inputSlots, type.outputSlots, 1, 'minecraft'],
    });
  }
}

/**
 * 保存配方到数据库（已迁移到 batchInsertRecipes）
 * 保留此函数用于兼容性
 */
async function saveRecipes(
  db: ReturnType<typeof createGlobalDbClient>,
  recipes: RecipeParseResult[],
  modId: string,
  now: string
): Promise<void> {
  await batchInsertRecipes(db, recipes, modId, now, { batchSize: 200 });
}

/**
 * 保存标签到数据库（已迁移到 batchInsertTags）
 * 保留此函数用于兼容性
 */
async function saveTags(
  db: ReturnType<typeof createGlobalDbClient>,
  tags: TagParseResult[],
  modId: string,
  validItemIds?: Set<string>
): Promise<void> {
  await batchInsertTags(db, tags, modId, validItemIds, { batchSize: 500 });
}

/**
 * 保存翻译到数据库（已迁移到 batchInsertTranslations）
 * 保留此函数用于兼容性
 */
async function saveTranslations(
  db: ReturnType<typeof createGlobalDbClient>,
  translationsMap: Map<string, Map<string, string>>,
  modId: string
): Promise<void> {
  await batchInsertTranslations(db, translationsMap, modId, { batchSize: 500 });
}

/**
 * 保存材质到缓存和数据库（优化版）
 * 
 * 1. 先批量写入文件（异步并行）
 * 2. 再批量插入数据库
 */
async function saveTexturesOptimized(
  db: ReturnType<typeof createGlobalDbClient>,
  textures: TextureInfo[],
  modId: string,
  cacheDir: string,
  now: string
): Promise<void> {
  // 确保缓存目录存在
  ensureDirectory(cacheDir);

  // 准备批量插入数据
  const textureRecords: Array<{
    textureId: string;
    modId: string;
    originalPath: string;
    cacheName: string;
    fileHash: string;
    width?: number;
    height?: number;
    cachedAt: string;
  }> = [];

  // 并发写入文件（限制并发数避免 EMFILE）
  const CONCURRENT_WRITES = 50;
  for (let i = 0; i < textures.length; i += CONCURRENT_WRITES) {
    const batch = textures.slice(i, i + CONCURRENT_WRITES);
    
    await Promise.all(batch.map(async (texture) => {
      // 生成缓存文件名（使用哈希避免冲突）
      const fileHash = hashBuffer(texture.data);
      const cacheName = `${modId}_${texture.itemName}_${fileHash}.png`;
      const cachePath = path.join(cacheDir, cacheName);

      // 异步写入缓存文件
      try {
        await fs.promises.writeFile(cachePath, texture.data);
        
        textureRecords.push({
          textureId: `${modId}:${texture.path}`,
          modId,
          originalPath: texture.path,
          cacheName,
          fileHash,
          width: texture.width,
          height: texture.height,
          cachedAt: now,
        });
      } catch (err) {
        console.warn(`[JAR_IMPORT] Failed to save texture to cache: ${cachePath}`, err);
      }
    }));
  }

  // 批量插入数据库
  if (textureRecords.length > 0) {
    const { batchInsertTextures } = await import('../services/database');
    await batchInsertTextures(db, textureRecords, { batchSize: 200 });
  }
}

/**
 * 保存材质到缓存和数据库（兼容旧版）
 */
async function saveTextures(
  db: ReturnType<typeof createGlobalDbClient>,
  textures: TextureInfo[],
  modId: string,
  cacheDir: string,
  now: string
): Promise<void> {
  await saveTexturesOptimized(db, textures, modId, cacheDir, now);
}

export function registerJarHandlers(): void {
  // JAR_IMPORT: Import a JAR file with real parsing
  ipcMain.handle(IPC_CHANNELS.JAR_IMPORT, async (
    event, 
    filePath: string
  ): Promise<IpcResponse<JarImportResult>> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const importId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: 'Invalid file path provided' };
      }

      // 1. 验证 JAR 文件
      const validation = validateJarFile(filePath);
      if (!validation.valid) {
        return { success: false, error: validation.error || 'Invalid JAR file' };
      }

      // 2. 创建取消标记
      const importTask = { cancel: false };
      activeImports.set(importId, importTask);

      // 3. 发送初始进度
      sendProgress(win, {
        step: 'reading',
        percent: 0,
        filePath,
      });

      // 4. 解析 JAR 文件（使用 Worker 线程避免阻塞主线程）
      let result: import('../services/jar-parser').JarParseResult;
      
      try {
        // 尝试使用 Worker 解析
        console.log(`[JAR Import] Using Worker for parsing: ${isWorkerSupported()}`);
        
        result = await parseJarWithWorker(
          filePath,
          appPaths.textureCache,
          {
            parseLang: true,
            parseTags: true,
            parseRecipes: true,
            extractTextures: true,
            textureOptions: {
              itemsOnly: false, // 提取所有纹理以便正确处理多面方块
            },
          },
          (progress: JarParseProgress) => {
            // 检查是否被取消
            if (importTask.cancel) {
              throw new Error('Import cancelled by user');
            }

            // 转换进度格式并发送
            sendProgress(win, {
              step: progress.stage,
              percent: progress.percent,
              filePath,
              currentFile: progress.currentFile,
              processedCount: progress.processedCount,
              totalCount: progress.totalCount,
            });
          }
        );
      } catch (workerError) {
        // Worker 失败，回退到主线程解析
        console.warn('[JAR Import] Worker failed, falling back to main thread:', workerError);
        
        sendProgress(win, {
          step: 'parsing',
          percent: 20,
          filePath,
          stageLabel: 'Worker failed, using fallback...',
        });
        
        result = await parseJarFile(filePath, {
          parseLang: true,
          parseTags: true,
          parseRecipes: true,
          extractTextures: true,
          textureOptions: {
            cacheDir: appPaths.textureCache,
            itemsOnly: false,
          },
          onProgress: (progress: JarParseProgress) => {
            if (importTask.cancel) {
              throw new Error('Import cancelled by user');
            }
            sendProgress(win, {
              step: progress.stage,
              percent: progress.percent,
              filePath,
              currentFile: progress.currentFile,
              processedCount: progress.processedCount,
              totalCount: progress.totalCount,
            });
          },
        });
      }

      // 4.5 使用资源加载器深度解析物品和纹理关联
      sendProgress(win, {
        step: 'parsing',
        percent: 85,
        filePath,
        stageLabel: 'Resolving textures...',
      });

      const { items: resolvedItems, textures: resolvedTextureMap } = parseResourcesFromJar(
        result.textures.map(t => ({ path: t.path, data: t.data })),
        result.modInfo.modId,
        result.models, // 传递已解析的模型
        (progress: ParseProgress) => {
          sendProgress(win, {
            step: 'parsing',
            percent: 85 + Math.round(progress.percent * 0.05),
            filePath,
            stageLabel: progress.stageLabel,
          });
        }
      );

      // 5. 保存到数据库（使用批量优化）
      sendProgress(win, {
        step: 'saving',
        percent: 90,
        filePath,
        stageLabel: 'Preparing data...',
      });

      const db = createGlobalDbClient(appPaths.globalDb);
      const now = new Date().toISOString();
      
      // 优化数据库写入性能（临时禁用安全特性）
      await optimizeForBulkInsert(db);
      
      try {
        // 初始化内置配方类型
        await initializeBuiltinRecipeTypes(db);
        
        // 保存模组信息
        await db.execute({
          sql: `INSERT INTO mods (mod_id, mod_name, version, mc_version, source_type, jar_path, parsed_at, item_count, recipe_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(mod_id) DO UPDATE SET
                  mod_name = excluded.mod_name,
                  version = excluded.version,
                  mc_version = excluded.mc_version,
                  jar_path = excluded.jar_path,
                  parsed_at = excluded.parsed_at,
                  item_count = excluded.item_count,
                  recipe_count = excluded.recipe_count`,
          args: [
            result.modInfo.modId,
            result.modInfo.modName,
            result.modInfo.version || null,
            result.modInfo.mcVersion || null,
            'jar',
            filePath,
            now,
            result.stats.itemCount,
            result.stats.recipeCount,
          ],
        });

        // 构建物品到标签的映射（用于分类推断）
        const itemToTagsMap = new Map<string, string[]>();
        for (const tag of result.tags) {
          for (const itemId of tag.items) {
            if (!itemToTagsMap.has(itemId)) {
              itemToTagsMap.set(itemId, []);
            }
            itemToTagsMap.get(itemId)!.push(tag.tagId);
          }
        }

        // 合并解析结果：新资源加载器的结果优先
        const currentModId = result.modInfo.modId;
        
        // 合并物品列表：resolvedItems优先，然后添加result.items中独有的
        const mergedItems = new Map<string, typeof resolvedItems[0]>();
        for (const item of resolvedItems) {
          mergedItems.set(item.itemId, item);
        }
        for (const item of result.items) {
          if (!mergedItems.has(item.itemId) && item.modId === currentModId) {
            const itemName = item.itemId.split(':')[1];
            const texturePath = item.isBlock 
              ? `assets/${item.modId}/textures/block/${itemName}.png`
              : `assets/${item.modId}/textures/item/${itemName}.png`;
            
            const fallbackItem: typeof resolvedItems[0] = {
              itemId: item.itemId,
              modId: item.modId,
              name: item.name,
              translationKey: item.translationKey,
              isBlock: item.isBlock,
              displayName: item.name,
              textureLocations: [{ 
                namespace: item.modId, 
                path: item.isBlock ? `block/${itemName}` : `item/${itemName}`,
                toTexturePath: () => texturePath
              } as any],
              resolvedTextures: new Map(),
            };
            mergedItems.set(item.itemId, fallbackItem);
          }
        }
        
        const currentModItems = Array.from(mergedItems.values()).filter(item => item.modId === currentModId);
        console.log(`[JAR Import] Saving ${currentModItems.length} items for mod ${currentModId}`);
        
        // 准备物品数据
        const itemsToInsert = currentModItems.map(item => {
          const tags = itemToTagsMap.get(item.itemId) || [];
          const category = inferCategoryFromTagsLocal(tags, item.itemId, item.isBlock);
          const resolvedTextureEntries = Array.from(item.resolvedTextures?.entries() || []);
          const primaryTextureCacheName = resolvedTextureEntries.length > 0 ? resolvedTextureEntries[0][1] as string : null;
          const primaryTextureLoc = item.textureLocations?.[0];
          const inferredTextureType = primaryTextureLoc?.path.includes('/block/') || primaryTextureLoc?.path.startsWith('block/') ? 'block' : 
                                     primaryTextureLoc?.path.includes('/item/') || primaryTextureLoc?.path.startsWith('item/') ? 'item' : 
                                     item.isBlock ? 'block' : 'item';
          
          return {
            itemId: item.itemId,
            modId: item.modId,
            translationKey: item.translationKey,
            name: item.name,
            category,
            texturePath: primaryTextureLoc?.toTexturePath(),
            textureCacheName: primaryTextureCacheName,
            textureType: inferredTextureType,
            isBlock: item.isBlock,
            createdAt: now,
          };
        });
        
        // 批量保存物品（每批500条）
        sendProgress(win, {
          step: 'saving',
          percent: 91,
          filePath,
          stageLabel: `Saving ${itemsToInsert.length} items...`,
        });
        
        await batchInsertItems(db, itemsToInsert, {
          batchSize: 500,
          onProgress: (inserted, total) => {
            const percent = 91 + Math.round((inserted / total) * 2);
            sendProgress(win, {
              step: 'saving',
              percent: Math.min(93, percent),
              filePath,
              stageLabel: `Saving items... ${inserted}/${total}`,
            });
          },
        });
        
        // 批量保存标签
        sendProgress(win, {
          step: 'saving',
          percent: 93,
          filePath,
          stageLabel: 'Saving tags...',
        });
        
        const validItemIds = new Set(currentModItems.map(item => item.itemId));
        await batchInsertTags(db, result.tags, result.modInfo.modId, validItemIds, {
          batchSize: 500,
        });
        
        // 批量保存配方
        sendProgress(win, {
          step: 'saving',
          percent: 95,
          filePath,
          stageLabel: 'Saving recipes...',
        });
        
        // 先保存配方类型
        const recipeTypes = new Map<string, string>();
        for (const recipe of result.recipes) {
          if (!recipeTypes.has(recipe.recipeType)) {
            recipeTypes.set(recipe.recipeType, recipe.recipeType.split(':').pop() || recipe.recipeType);
          }
        }
        for (const [typeId, displayName] of recipeTypes) {
          if (!typeId.startsWith('minecraft:')) {
            await db.execute({
              sql: `INSERT INTO recipe_types (recipe_type_id, display_name, input_slot_count, output_slot_count, is_builtin, source_mod_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(recipe_type_id) DO NOTHING`,
              args: [typeId, displayName, 1, 1, 0, result.modInfo.modId],
            });
          }
        }
        
        // 批量保存配方
        await batchInsertRecipes(db, result.recipes, result.modInfo.modId, now, {
          batchSize: 200,
          onProgress: (inserted, total) => {
            const percent = 95 + Math.round((inserted / total) * 2);
            sendProgress(win, {
              step: 'saving',
              percent: Math.min(97, percent),
              filePath,
              stageLabel: `Saving recipes... ${inserted}/${total}`,
            });
          },
        });
        
        // 批量保存翻译
        if (result.translations && result.translations.size > 0) {
          sendProgress(win, {
            step: 'saving',
            percent: 97,
            filePath,
            stageLabel: 'Saving translations...',
          });
          
          await batchInsertTranslations(db, result.translations, result.modInfo.modId, {
            batchSize: 500,
          });
        }
        
        // 保存材质（文件 I/O 保持原有逻辑）
        sendProgress(win, {
          step: 'saving',
          percent: 98,
          filePath,
          stageLabel: 'Saving textures...',
        });
        
        await saveTexturesOptimized(db, result.textures, result.modInfo.modId, appPaths.textureCache, now);
        
      } finally {
        // 恢复数据库安全设置
        await restoreSafetySettings(db);
      }

      // 6. 完成
      sendProgress(win, {
        step: 'completed',
        percent: 100,
        filePath,
      });

      // 清理任务
      activeImports.delete(importId);

      const importResult: JarImportResult = {
        success: true,
        filePath,
        modId: result.modInfo.modId,
        modName: result.modInfo.modName,
        itemCount: result.stats.itemCount,
        recipeCount: result.stats.recipeCount,
        tagCount: result.stats.tagCount,
        textureCount: result.stats.textureCount,
      };

      return { success: true, data: importResult };
    } catch (error) {
      // 清理任务
      activeImports.delete(importId);

      const errorMessage = error instanceof Error ? error.message : 'Failed to import JAR';
      console.error('JAR_IMPORT error:', error);
      
      // 发送错误进度
      sendProgress(win, {
        step: 'error',
        percent: 0,
        filePath,
        error: errorMessage,
      });
      
      return { success: false, error: errorMessage };
    }
  });

  // JAR_LIST: Return list of imported JARs from database
  ipcMain.handle(IPC_CHANNELS.JAR_LIST, async (): Promise<IpcResponse<Mod[]>> => {
    try {
      const db = createGlobalDbClient(appPaths.globalDb);
      
      // 从数据库查询所有模组
      const result = await db.execute('SELECT * FROM mods ORDER BY parsed_at DESC');
      
      // 转换为 Mod 类型
      const mods: Mod[] = result.rows.map((row: any) => ({
        modId: row.mod_id,
        modName: row.mod_name,
        version: row.version || undefined,
        mcVersion: row.mc_version || undefined,
        sourceType: row.source_type as 'jar' | 'builtin' | 'manual',
        jarPath: row.jar_path || undefined,
        parsedAt: row.parsed_at || undefined,
        itemCount: row.item_count,
        recipeCount: row.recipe_count,
      }));

      return { success: true, data: mods };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to list JARs';
      console.error('JAR_LIST error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // JAR_SELECT: Open file dialog to select JAR file
  ipcMain.handle(IPC_CHANNELS.JAR_SELECT, async (): Promise<IpcResponse<string | null>> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        title: '选择 Minecraft 模组 JAR 文件',
        filters: [
          { name: 'JAR Files', extensions: ['jar'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select file';
      console.error('JAR_SELECT error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // JAR_DELETE: Delete a mod from database
  ipcMain.handle(IPC_CHANNELS.JAR_DELETE, async (_event, modId: string): Promise<IpcResponse<boolean>> => {
    try {
      if (!modId || typeof modId !== 'string') {
        return { success: false, error: 'Invalid mod ID' };
      }

      const db = createGlobalDbClient(appPaths.globalDb);
      
      // 删除模组及其相关数据（使用事务）
      await db.execute({
        sql: 'DELETE FROM item_tags WHERE item_id IN (SELECT item_id FROM items WHERE mod_id = ?)',
        args: [modId],
      });
      
      await db.execute({
        sql: 'DELETE FROM items WHERE mod_id = ?',
        args: [modId],
      });
      
      await db.execute({
        sql: 'DELETE FROM recipes WHERE mod_id = ?',
        args: [modId],
      });
      
      await db.execute({
        sql: 'DELETE FROM textures WHERE mod_id = ?',
        args: [modId],
      });
      
      await db.execute({
        sql: 'DELETE FROM mods WHERE mod_id = ?',
        args: [modId],
      });

      return { success: true, data: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete mod';
      console.error('JAR_DELETE error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // JAR_GET_DETAILS: Get detailed info about a mod
  ipcMain.handle(IPC_CHANNELS.JAR_GET_DETAILS, async (_event, modId: string): Promise<IpcResponse<Mod | null>> => {
    try {
      if (!modId || typeof modId !== 'string') {
        return { success: false, error: 'Invalid mod ID' };
      }

      const db = createGlobalDbClient(appPaths.globalDb);
      
      const result = await db.execute({
        sql: 'SELECT * FROM mods WHERE mod_id = ?',
        args: [modId],
      });
      
      const row = result.rows[0] as any;
      
      if (!row) {
        return { success: true, data: null };
      }

      const mod: Mod = {
        modId: row.mod_id,
        modName: row.mod_name,
        version: row.version || undefined,
        mcVersion: row.mc_version || undefined,
        sourceType: row.source_type as 'jar' | 'builtin' | 'manual',
        jarPath: row.jar_path || undefined,
        parsedAt: row.parsed_at || undefined,
        itemCount: row.item_count,
        recipeCount: row.recipe_count,
      };

      return { success: true, data: mod };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get mod details';
      console.error('JAR_GET_DETAILS error:', error);
      return { success: false, error: errorMessage };
    }
  });
}

/**
 * 发送进度更新到渲染进程
 */
function sendProgress(
  win: BrowserWindow | null,
  progress: JarImportProgress
): void {
  if (!win) return;
  
  win.webContents.send(IPC_CHANNELS.JAR_IMPORT_PROGRESS, progress);
}

/**
 * 根据标签智能推断物品分类
 * 基于 Minecraft 和常见模组的标签命名约定
 */
function inferCategoryFromTagsLocal(tags: string[], itemId: string, isBlock: boolean): string {
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  const itemName = itemId.split(':')[1] || '';
  
  // 1. 检查食物相关标签
  const foodTags = [
    'forge:food', 'forge:foods', 'forge:fruits', 'forge:vegetables', 
    'forge:grains', 'forge:protein', 'forge:crops', 'c:food', 'c:foods'
  ];
  for (const tag of foodTags) {
    if (tagSet.has(tag)) return 'food';
  }
  
  // 2. 检查工具相关标签
  const toolTags = [
    'forge:tools', 'forge:tool', 'minecraft:tools', 
    'c:tools', 'c:pickaxes', 'c:axes', 'c:shovels', 'c:hoes'
  ];
  for (const tag of toolTags) {
    if (tagSet.has(tag)) return 'tool';
  }
  
  // 3. 检查武器相关标签
  const weaponTags = [
    'forge:weapons', 'forge:weapon', 'minecraft:weapons',
    'c:swords', 'c:axes', 'c:weapons'
  ];
  for (const tag of weaponTags) {
    if (tagSet.has(tag)) return 'weapon';
  }
  
  // 4. 检查护甲相关标签
  const armorTags = [
    'forge:armor', 'forge:armors', 'minecraft:armors',
    'c:helmets', 'c:chestplates', 'c:leggings', 'c:boots'
  ];
  for (const tag of armorTags) {
    if (tagSet.has(tag)) return 'armor';
  }
  
  // 5. 检查材料相关标签
  const materialTags = [
    'forge:ingots', 'forge:gems', 'forge:dusts', 'forge:nuggets',
    'forge:raw_materials', 'c:ingots', 'c:gems', 'c:raw_materials'
  ];
  for (const tag of materialTags) {
    if (tagSet.has(tag)) return 'material';
  }
  
  // 6. 基于物品名称模式推断
  const namePatterns: Record<string, RegExp[]> = {
    food: [/bread|apple|meat|soup|stew|pie|cake|cookie|stew|juice|wine|beer/i],
    tool: [/pickaxe|axe|shovel|hoe|shears|fishing_rod|brush$/i],
    weapon: [/sword|bow|crossbow|trident|mace$/i],
    armor: [/_helmet$|_chestplate$|_leggings$|_boots$|armor_/i],
    block: [/_block$|_planks$|_stairs$|_slab$|_door$|_fence$|_wall$/i],
  };
  
  for (const [cat, patterns] of Object.entries(namePatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(itemName)) return cat;
    }
  }
  
  // 7. 如果是方块且没有其他分类，返回 block
  if (isBlock) return 'block';
  
  // 8. 默认返回 misc
  return 'misc';
}

/**
 * 从模型定义中查找纹理引用
 * 返回第一个找到的纹理路径（优先 layer0，然后是 all/texture，然后是各面）
 */
function findTextureInModel(model: any, modId: string): string | null {
  if (!model?.textures) return null;
  
  const textures = model.textures;
  
  // 1. 优先检查 layer0（物品层）
  if (textures.layer0) {
    return resolveTextureReference(textures.layer0, textures);
  }
  
  // 2. 检查 all 或 texture（通用纹理）
  if (textures.all) {
    return resolveTextureReference(textures.all, textures);
  }
  if (textures.texture) {
    return resolveTextureReference(textures.texture, textures);
  }
  
  // 3. 检查粒子纹理（通常与主纹理相同）
  if (textures.particle) {
    return resolveTextureReference(textures.particle, textures);
  }
  
  // 4. 检查各面纹理（方块）
  const facePriority = ['north', 'side', 'east', 'west', 'up', 'down'];
  for (const face of facePriority) {
    if (textures[face]) {
      return resolveTextureReference(textures[face], textures);
    }
  }
  
  // 5. 返回第一个可用的纹理
  const firstKey = Object.keys(textures)[0];
  if (firstKey) {
    return resolveTextureReference(textures[firstKey], textures);
  }
  
  return null;
}

/**
 * 解析纹理引用（处理 # 引用）
 */
function resolveTextureReference(ref: string, allTextures: Record<string, string>): string {
  // 如果是引用（以 # 开头），递归解析
  if (ref.startsWith('#')) {
    const refKey = ref.substring(1);
    const resolved = allTextures[refKey];
    if (resolved && resolved !== ref) {
      return resolveTextureReference(resolved, allTextures);
    }
    return ref;
  }
  return ref;
}

/**
 * 将纹理引用转换为完整路径
 */
function resolveTexturePath(textureRef: string, modId: string): string {
  if (!textureRef) return '';
  
  // 如果已经是完整路径
  if (textureRef.includes(':')) {
    const [ns, path] = textureRef.split(':');
    return `assets/${ns}/textures/${path}.png`;
  }
  
  // 默认使用当前模组命名空间
  return `assets/${modId}/textures/${textureRef}.png`;
}
