/**
 * Mod Data Importer - Core Implementation
 * 
 * 根据 reference_sql/export.sqlite 样例实现
 */

import { createClient, Client } from '@libsql/client';
import * as path from 'path';
import * as crypto from 'crypto';
import type { 
  ModDataImportOptions, 
  ImportResult, 
  ImportProgress,
  ModEntry,
  ItemEntry,
  ItemTagEntry,
  RecipeEntry,
  ManifestEntry,
} from './types';
import { validateModDataFile, DATA_FILE_PATHS } from './validator';

function generateId(): string {
  return `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * 导入 Mod 数据到项目数据库
 */
export async function importModData(options: ModDataImportOptions): Promise<ImportResult> {
  const { projectPath, dataFilePath: providedDataFilePath, onProgress } = options;
  
  const importId = generateId();
  const now = new Date().toISOString();
  
  try {
    // Step 1: 检测数据文件
    onProgress?.({
      phase: 'detecting',
      percent: 5,
      message: '检测数据文件...',
    });

    const dataFilePath = providedDataFilePath || await detectModDataFile(projectPath);
    
    if (!dataFilePath) {
      return {
        success: false,
        importId,
        error: `未找到数据文件。请确保已安装附属Mod并启动游戏。\n预期路径: ${DATA_FILE_PATHS.join(', ')}`,
      };
    }

    // Step 2: 验证数据文件
    onProgress?.({
      phase: 'validating',
      percent: 10,
      message: '验证数据文件...',
    });

    const validation = await validateModDataFile(dataFilePath);
    if (!validation.valid) {
      return {
        success: false,
        importId,
        error: validation.error || '数据文件验证失败',
      };
    }

    // Step 3: 读取源数据库
    onProgress?.({
      phase: 'reading',
      percent: 15,
      message: '读取数据...',
    });

    const sourceClient = createClient({ url: `file:${dataFilePath}` });
    
    // 读取所有数据
    const manifestData = await readManifest(sourceClient);
    const modsData = await readMods(sourceClient);
    const itemsData = await readItems(sourceClient);
    const tagsData = await readItemTags(sourceClient);
    const recipesData = await readRecipes(sourceClient);

    await sourceClient.close();

    const stats = {
      modCount: modsData.length,
      itemCount: itemsData.length,
      tagCount: tagsData.length,
      recipeCount: recipesData.length,
    };

    onProgress?.({
      phase: 'reading',
      percent: 25,
      message: `读取完成：${stats.modCount}个模组，${stats.itemCount}个物品，${stats.recipeCount}个配方`,
    });

    // Step 4: 导入到项目数据库
    onProgress?.({
      phase: 'importing',
      percent: 30,
      message: '准备导入...',
    });

    const projectDbPath = path.join(projectPath, '.delightify', 'project.db');
    const targetClient = createClient({ url: `file:${projectDbPath}` });

    try {
      // 清空现有数据
      await clearExistingData(targetClient);

      // 导入 manifest
      onProgress?.({
        phase: 'importing',
        percent: 30,
        message: '导入清单...',
      });
      await importManifest(targetClient, manifestData);

      // 导入模组
      onProgress?.({
        phase: 'importing',
        percent: 35,
        message: `导入模组... (${modsData.length})`,
      });
      await importMods(targetClient, modsData);

      // 导入物品
      onProgress?.({
        phase: 'importing',
        percent: 45,
        message: `导入物品... (${itemsData.length})`,
      });
      await importItems(targetClient, itemsData);

      // 导入标签
      onProgress?.({
        phase: 'importing',
        percent: 60,
        message: `导入标签... (${tagsData.length})`,
      });
      await importItemTags(targetClient, tagsData);

      // 导入配方
      onProgress?.({
        phase: 'importing',
        percent: 75,
        message: `导入配方... (${recipesData.length})`,
      });
      await importRecipes(targetClient, recipesData);

      // 记录导入历史
      await recordImportHistory(targetClient, {
        importId,
        sourceFilePath: dataFilePath,
        dataVersion: '1.0',
        exportedAt: manifestData.find(m => m.key === 'exported_at_utc')?.value,
        ...stats,
        importedAt: now,
      });

      await targetClient.close();

      onProgress?.({
        phase: 'completed',
        percent: 100,
        message: '导入完成！',
      });

      return {
        success: true,
        importId,
        stats,
      };
    } catch (error) {
      await targetClient.close();
      throw error;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '导入数据失败';
    onProgress?.({
      phase: 'error',
      percent: 0,
      message: `导入失败: ${errorMessage}`,
    });
    return {
      success: false,
      importId,
      error: errorMessage,
    };
  }
}

/**
 * 检测整合包中的数据文件
 */
export async function detectModDataFile(projectPath: string): Promise<string | null> {
  const fs = await import('fs/promises');
  
  for (const relativePath of DATA_FILE_PATHS) {
    const filePath = path.join(projectPath, relativePath);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      // 文件不存在，继续检查下一个
    }
  }

  return null;
}

/**
 * 清空现有数据
 */
async function clearExistingData(client: Client): Promise<void> {
  const tables = ['recipes', 'item_tags', 'items', 'mods', 'manifest'];
  for (const table of tables) {
    await client.execute(`DELETE FROM ${table}`);
  }
}

// ============================================================================
// 读取数据函数
// ============================================================================

async function readManifest(client: Client): Promise<ManifestEntry[]> {
  const result = await client.execute('SELECT * FROM manifest');
  return result.rows.map(row => ({
    key: row.key as string,
    value: row.value as string,
  }));
}

async function readMods(client: Client): Promise<ModEntry[]> {
  const result = await client.execute('SELECT * FROM mods');
  return result.rows.map(row => ({
    modid: row.modid as string,
    version: row.version as string | undefined,
    name: row.name as string | undefined,
  }));
}

async function readItems(client: Client): Promise<ItemEntry[]> {
  const result = await client.execute('SELECT * FROM items');
  return result.rows.map(row => ({
    item_id: row.item_id as string,
    modid: row.modid as string,
  }));
}

async function readItemTags(client: Client): Promise<ItemTagEntry[]> {
  const result = await client.execute('SELECT * FROM item_tags');
  return result.rows.map(row => ({
    tag_id: row.tag_id as string,
    item_id: row.item_id as string,
  }));
}

async function readRecipes(client: Client): Promise<RecipeEntry[]> {
  const result = await client.execute('SELECT * FROM recipes');
  return result.rows.map(row => ({
    recipe_id: row.recipe_id as string,
    type_id: row.type_id as string,
    modid: row.modid as string,
    hash: row.hash as string,
    raw_json: row.raw_json as string | undefined,
    unparsed: Boolean(row.unparsed),
  }));
}

// ============================================================================
// 导入数据函数
// ============================================================================

async function importManifest(client: Client, entries: ManifestEntry[]): Promise<void> {
  for (const entry of entries) {
    await client.execute({
      sql: 'INSERT INTO manifest (key, value) VALUES (?, ?)',
      args: [entry.key, entry.value],
    });
  }
}

async function importMods(client: Client, mods: ModEntry[]): Promise<void> {
  for (const mod of mods) {
    await client.execute({
      sql: 'INSERT INTO mods (modid, version, name) VALUES (?, ?, ?)',
      args: [mod.modid, mod.version || null, mod.name || null],
    });
  }
}

async function importItems(client: Client, items: ItemEntry[]): Promise<void> {
  // 使用批量插入提高效率
  const batchSize = 500;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const values = batch.map(() => '(?, ?)').join(',');
    const args = batch.flatMap(item => [item.item_id, item.modid]);
    
    await client.execute({
      sql: `INSERT INTO items (item_id, modid) VALUES ${values}`,
      args,
    });
  }
}

async function importItemTags(client: Client, tags: ItemTagEntry[]): Promise<void> {
  // 使用批量插入
  const batchSize = 500;
  for (let i = 0; i < tags.length; i += batchSize) {
    const batch = tags.slice(i, i + batchSize);
    const values = batch.map(() => '(?, ?)').join(',');
    const args = batch.flatMap(tag => [tag.tag_id, tag.item_id]);
    
    await client.execute({
      sql: `INSERT INTO item_tags (tag_id, item_id) VALUES ${values}`,
      args,
    });
  }
}

async function importRecipes(client: Client, recipes: RecipeEntry[]): Promise<void> {
  // 使用批量插入
  const batchSize = 200;
  for (let i = 0; i < recipes.length; i += batchSize) {
    const batch = recipes.slice(i, i + batchSize);
    const values = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
    const args = batch.flatMap(recipe => [
      recipe.recipe_id,
      recipe.type_id,
      recipe.modid,
      recipe.hash,
      recipe.raw_json || null,
      recipe.unparsed ? 1 : 0,
    ]);
    
    await client.execute({
      sql: `INSERT INTO recipes (recipe_id, type_id, modid, hash, raw_json, unparsed) VALUES ${values}`,
      args,
    });
  }
}

async function recordImportHistory(
  client: Client,
  data: {
    importId: string;
    sourceFilePath: string;
    dataVersion: string;
    exportedAt?: string;
    modCount: number;
    itemCount: number;
    recipeCount: number;
    tagCount: number;
    importedAt: string;
  }
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO data_imports 
          (import_id, source_file_path, data_version, exported_at, mod_count, item_count, recipe_count, tag_count, imported_at, is_success)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.importId,
      data.sourceFilePath,
      data.dataVersion,
      data.exportedAt || null,
      data.modCount,
      data.itemCount,
      data.recipeCount,
      data.tagCount,
      data.importedAt,
      1,
    ],
  });
}
