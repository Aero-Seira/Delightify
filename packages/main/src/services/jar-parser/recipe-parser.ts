/**
 * Recipes 文件解析器
 * 策略三：从 data/{modid}/recipes/*.json 中提取配方信息
 * 
 * 支持多种配方格式：
 * - minecraft:crafting_shaped
 * - minecraft:crafting_shapeless
 * - minecraft:smelting
 * - minecraft:blasting
 * - minecraft:smoking
 * - minecraft:campfire_cooking
 * - minecraft:stonecutting
 * - minecraft:smithing
 * - 以及各模组自定义配方类型
 */

import type { 
  RecipeParseResult, 
  RecipeIngredient, 
  RecipeOutput,
  ProgressCallback 
} from './types';

/**
 * 配方 JSON 的基础结构
 */
interface RecipeJson {
  type: string;
  [key: string]: unknown;
}

/**
 * 解析配方成分（输入）
 * 支持多种格式：
 * - "minecraft:iron_ingot"（简单字符串）
 * - { "item": "minecraft:iron_ingot" }
 * - { "tag": "forge:ingots/iron" }
 * - { "item": "...", "count": 2 }
 */
function parseIngredient(
  ingredient: unknown,
  slot: number
): RecipeIngredient | null {
  if (typeof ingredient === 'string') {
    return {
      slot,
      id: ingredient,
      isTag: false,
    };
  }

  if (typeof ingredient === 'object' && ingredient !== null) {
    const obj = ingredient as Record<string, unknown>;
    
    if (typeof obj.item === 'string') {
      return {
        slot,
        id: obj.item,
        isTag: false,
        count: typeof obj.count === 'number' ? obj.count : undefined,
      };
    }
    
    if (typeof obj.tag === 'string') {
      return {
        slot,
        id: obj.tag,
        isTag: true,
      };
    }
  }

  return null;
}

/**
 * 解析配方成分数组
 */
function parseIngredients(
  ingredients: unknown[],
  startSlot: number = 0
): RecipeIngredient[] {
  const results: RecipeIngredient[] = [];

  for (let i = 0; i < ingredients.length; i++) {
    const parsed = parseIngredient(ingredients[i], startSlot + i);
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}

/**
 * 解析配方输出
 */
function parseOutput(
  result: unknown,
  slot: number = 0
): RecipeOutput | null {
  if (typeof result === 'string') {
    return {
      slot,
      itemId: result,
      count: 1,
    };
  }

  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;
    
    if (typeof obj.item === 'string') {
      return {
        slot,
        itemId: obj.item,
        count: typeof obj.count === 'number' ? obj.count : 1,
        nbt: typeof obj.nbt === 'string' ? obj.nbt : undefined,
      };
    }
  }

  return null;
}

/**
 * 解析有序合成配方（crafting_shaped）
 */
function parseShapedRecipe(data: RecipeJson): { inputs: RecipeIngredient[]; outputs: RecipeOutput[] } {
  const inputs: RecipeIngredient[] = [];
  const outputs: RecipeOutput[] = [];

  // 解析 key 映射
  const key = data.key as Record<string, unknown> | undefined;
  const pattern = data.pattern as string[] | undefined;

  if (key && pattern) {
    for (let row = 0; row < pattern.length; row++) {
      const rowStr = pattern[row];
      for (let col = 0; col < rowStr.length; col++) {
        const char = rowStr[col];
        if (char === ' ') continue;

        const ingredient = key[char];
        if (ingredient !== undefined) {
          const slot = row * 3 + col;
          
          // 支持数组形式的 ingredient（多个可选物品）
          if (Array.isArray(ingredient)) {
            for (let i = 0; i < ingredient.length; i++) {
              const parsed = parseIngredient(ingredient[i], slot);
              if (parsed) {
                inputs.push(parsed);
              }
            }
          } else {
            const parsed = parseIngredient(ingredient, slot);
            if (parsed) {
              inputs.push(parsed);
            }
          }
        }
      }
    }
  }

  // 解析输出
  const result = parseOutput(data.result, 0);
  if (result) {
    outputs.push(result);
  }

  return { inputs, outputs };
}

/**
 * 解析无序合成配方（crafting_shapeless）
 */
function parseShapelessRecipe(data: RecipeJson): { inputs: RecipeIngredient[]; outputs: RecipeOutput[] } {
  const inputs: RecipeIngredient[] = [];
  const outputs: RecipeOutput[] = [];

  // 解析 ingredients
  const ingredients = data.ingredients as unknown[] | undefined;
  if (ingredients) {
    for (let i = 0; i < ingredients.length; i++) {
      const ingredient = ingredients[i];
      
      // 支持数组形式的 ingredient
      if (Array.isArray(ingredient)) {
        for (const subIngredient of ingredient) {
          const parsed = parseIngredient(subIngredient, i);
          if (parsed) {
            inputs.push(parsed);
          }
        }
      } else {
        const parsed = parseIngredient(ingredient, i);
        if (parsed) {
          inputs.push(parsed);
        }
      }
    }
  }

  // 解析输出
  const result = parseOutput(data.result, 0);
  if (result) {
    outputs.push(result);
  }

  return { inputs, outputs };
}

/**
 * 解析熔炼类配方（smelting/blasting/smoking/campfire_cooking）
 */
function parseCookingRecipe(data: RecipeJson): { inputs: RecipeIngredient[]; outputs: RecipeOutput[] } {
  const inputs: RecipeIngredient[] = [];
  const outputs: RecipeOutput[] = [];

  // 解析输入
  const ingredient = parseIngredient(data.ingredient, 0);
  if (ingredient) {
    inputs.push(ingredient);
  }

  // 解析输出
  const result = parseOutput(data.result, 0);
  if (result) {
    outputs.push(result);
  }

  return { inputs, outputs };
}

/**
 * 解析切石机配方（stonecutting）
 */
function parseStonecuttingRecipe(data: RecipeJson): { inputs: RecipeIngredient[]; outputs: RecipeOutput[] } {
  const inputs: RecipeIngredient[] = [];
  const outputs: RecipeOutput[] = [];

  // 解析输入
  const ingredient = parseIngredient(data.ingredient, 0);
  if (ingredient) {
    inputs.push(ingredient);
  }

  // 解析输出
  const result = parseOutput(data.result, 0);
  if (result) {
    outputs.push(result);
  }

  return { inputs, outputs };
}

/**
 * 解析锻造配方（smithing_transform/smithing_trim）
 */
function parseSmithingRecipe(data: RecipeJson): { inputs: RecipeIngredient[]; outputs: RecipeOutput[] } {
  const inputs: RecipeIngredient[] = [];
  const outputs: RecipeOutput[] = [];

  // 模板
  const template = parseIngredient(data.template, 0);
  if (template) inputs.push(template);

  // 基础物品
  const base = parseIngredient(data.base, 1);
  if (base) inputs.push(base);

  // 附加材料
  const addition = parseIngredient(data.addition, 2);
  if (addition) inputs.push(addition);

  // 解析输出
  const result = parseOutput(data.result, 0);
  if (result) {
    outputs.push(result);
  }

  return { inputs, outputs };
}

/**
 * 解析单个配方文件
 */
export function parseRecipeFile(
  content: string,
  recipeId: string
): RecipeParseResult | null {
  try {
    const data: RecipeJson = JSON.parse(content);
    
    if (!data.type) {
      return null;
    }

    let inputs: RecipeIngredient[] = [];
    let outputs: RecipeOutput[] = [];

    // 根据配方类型选择解析器
    const recipeType = data.type;
    
    if (recipeType === 'minecraft:crafting_shaped') {
      const result = parseShapedRecipe(data);
      inputs = result.inputs;
      outputs = result.outputs;
    } else if (recipeType === 'minecraft:crafting_shapeless') {
      const result = parseShapelessRecipe(data);
      inputs = result.inputs;
      outputs = result.outputs;
    } else if (
      recipeType === 'minecraft:smelting' ||
      recipeType === 'minecraft:blasting' ||
      recipeType === 'minecraft:smoking' ||
      recipeType === 'minecraft:campfire_cooking'
    ) {
      const result = parseCookingRecipe(data);
      inputs = result.inputs;
      outputs = result.outputs;
    } else if (recipeType === 'minecraft:stonecutting') {
      const result = parseStonecuttingRecipe(data);
      inputs = result.inputs;
      outputs = result.outputs;
    } else if (
      recipeType === 'minecraft:smithing_transform' ||
      recipeType === 'minecraft:smithing_trim'
    ) {
      const result = parseSmithingRecipe(data);
      inputs = result.inputs;
      outputs = result.outputs;
    } else {
      // 对于未知配方类型，尝试通用解析
      // 寻找常见的输入/输出字段
      inputs = extractGenericInputs(data);
      outputs = extractGenericOutputs(data);
    }

    // 如果没有解析到任何输入或输出，可能不是有效的配方
    if (inputs.length === 0 && outputs.length === 0) {
      return null;
    }

    return {
      recipeId,
      recipeType,
      rawJson: content,
      inputs,
      outputs,
    };
  } catch (error) {
    console.warn(`[RecipeParser] Failed to parse recipe ${recipeId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 通用输入提取（用于未知配方类型）
 */
function extractGenericInputs(data: RecipeJson): RecipeIngredient[] {
  const inputs: RecipeIngredient[] = [];
  const searchKeys = ['ingredient', 'ingredients', 'input', 'inputs', 'base', 'material'];

  for (const key of searchKeys) {
    const value = data[key];
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      const parsed = parseIngredients(value, inputs.length);
      inputs.push(...parsed);
    } else {
      const parsed = parseIngredient(value, inputs.length);
      if (parsed) {
        inputs.push(parsed);
      }
    }
  }

  return inputs;
}

/**
 * 通用输出提取（用于未知配方类型）
 */
function extractGenericOutputs(data: RecipeJson): RecipeOutput[] {
  const outputs: RecipeOutput[] = [];
  const searchKeys = ['result', 'output', 'results', 'outputs'];

  for (const key of searchKeys) {
    const value = data[key];
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const parsed = parseOutput(value[i], i);
        if (parsed) {
          outputs.push(parsed);
        }
      }
    } else {
      const parsed = parseOutput(value, 0);
      if (parsed) {
        outputs.push(parsed);
      }
    }
  }

  return outputs;
}

/**
 * 从 JAR 中解析所有配方文件
 */
export function parseRecipeFilesFromJar(
  entries: Array<{ path: string; data: Buffer }>,
  expectedModId?: string,
  onProgress?: ProgressCallback
): RecipeParseResult[] {
  const recipes: RecipeParseResult[] = [];
  
  // 收集所有配方文件
  const recipeFiles: Array<{ recipeId: string; content: string }> = [];

  for (const entry of entries) {
    // 匹配 data/{modid}/recipes/{recipe_name}.json
    const match = entry.path.match(/^data\/([a-z0-9_]+)\/recipes\/([a-z0-9_\/.-]+)\.json$/i);
    if (!match) continue;

    const [, modId, recipeName] = match;
    
    // 过滤非期望模组的配方文件
    if (expectedModId && modId !== expectedModId) {
      continue;
    }

    try {
      const content = entry.data.toString('utf-8');
      const recipeId = `${modId}:${recipeName.replace(/\//g, '_')}`;
      recipeFiles.push({ recipeId, content });
    } catch (error) {
      console.warn(`[RecipeParser] Failed to read recipe file ${entry.path}:`, error);
    }
  }

  // 解析每个配方文件
  for (let i = 0; i < recipeFiles.length; i++) {
    const { recipeId, content } = recipeFiles[i];

    onProgress?.({
      stage: 'parsing_recipes',
      stageLabel: `Parsing recipe: ${recipeId}`,
      percent: 55 + Math.round((i / recipeFiles.length) * 20),
      currentFile: recipeId,
      processedCount: i,
      totalCount: recipeFiles.length,
    });

    const result = parseRecipeFile(content, recipeId);
    if (result) {
      recipes.push(result);
    }
  }

  return recipes;
}

/**
 * 从配方中提取所有引用的物品 ID
 * 用于补充物品列表
 */
export function extractItemsFromRecipes(
  recipes: RecipeParseResult[],
  expectedModId?: string
): Set<string> {
  const itemIds = new Set<string>();

  for (const recipe of recipes) {
    // 提取输入物品
    for (const input of recipe.inputs) {
      if (!input.isTag) {
        itemIds.add(input.id);
      }
    }

    // 提取输出物品
    for (const output of recipe.outputs) {
      itemIds.add(output.itemId);
    }
  }

  // 如果指定了 modId，过滤结果
  if (expectedModId) {
    const filtered = new Set<string>();
    for (const itemId of itemIds) {
      const [modId] = itemId.split(':');
      if (modId === expectedModId) {
        filtered.add(itemId);
      }
    }
    return filtered;
  }

  return itemIds;
}

/**
 * 获取配方类型显示名称
 */
export function getRecipeTypeDisplayName(recipeType: string): string {
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
