import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  Recipe, 
  RecipeFilter,
  RecipeExportOptions 
} from '@delightify/shared';

// M0 placeholder: In-memory recipe storage
const mockRecipes: Recipe[] = [];

/**
 * Generate unique recipe ID
 */
function generateRecipeId(): string {
  return `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function registerRecipesHandlers(): void {
  // RECIPES_LIST: List recipes from database with optional filtering
  ipcMain.handle(IPC_CHANNELS.RECIPES_LIST, async (
    _event, 
    filter: RecipeFilter
  ): Promise<IpcResponse<Recipe[]>> => {
    try {
      const { modId, recipeTypeId, search } = filter || {};
      console.log('recipes:list', { modId, recipeTypeId, search });

      // M0 placeholder: Return mock data or empty array (M1 will implement database query)
      let filteredRecipes = [...mockRecipes];

      if (modId) {
        filteredRecipes = filteredRecipes.filter(r => r.modId === modId);
      }

      if (recipeTypeId) {
        filteredRecipes = filteredRecipes.filter(r => r.recipeTypeId === recipeTypeId);
      }

      if (search) {
        const searchLower = search.toLowerCase();
        filteredRecipes = filteredRecipes.filter(r => 
          r.recipeId.toLowerCase().includes(searchLower)
        );
      }

      return { success: true, data: filteredRecipes };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to list recipes';
      console.error('RECIPES_LIST error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // RECIPES_CREATE: Create a new recipe in database
  ipcMain.handle(IPC_CHANNELS.RECIPES_CREATE, async (
    _event, 
    recipe: Partial<Recipe>
  ): Promise<IpcResponse<Recipe>> => {
    try {
      console.log('recipes:create', recipe);

      if (!recipe.recipeTypeId) {
        return { success: false, error: 'Recipe type is required' };
      }

      // M0 placeholder: Create mock recipe (M1 will implement database insert)
      const newRecipe: Recipe = {
        recipeId: recipe.recipeId || generateRecipeId(),
        modId: recipe.modId || 'custom',
        recipeTypeId: recipe.recipeTypeId,
        inputSlots: recipe.inputSlots || [],
        outputSlots: recipe.outputSlots || [],
        extraProps: recipe.extraProps || {},
        rawJson: recipe.rawJson || JSON.stringify(recipe),
      };

      mockRecipes.push(newRecipe);

      return { success: true, data: newRecipe };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create recipe';
      console.error('RECIPES_CREATE error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // RECIPES_UPDATE: Update an existing recipe in database
  ipcMain.handle(IPC_CHANNELS.RECIPES_UPDATE, async (
    _event, 
    recipe: Partial<Recipe> & { recipeId: string }
  ): Promise<IpcResponse<Recipe>> => {
    try {
      console.log('recipes:update', recipe);

      if (!recipe.recipeId) {
        return { success: false, error: 'Recipe ID is required' };
      }

      // M0 placeholder: Update mock recipe (M1 will implement database update)
      const index = mockRecipes.findIndex(r => r.recipeId === recipe.recipeId);
      
      if (index === -1) {
        return { success: false, error: 'Recipe not found' };
      }

      const updatedRecipe: Recipe = {
        ...mockRecipes[index],
        ...recipe,
        inputSlots: recipe.inputSlots || mockRecipes[index].inputSlots,
        outputSlots: recipe.outputSlots || mockRecipes[index].outputSlots,
        extraProps: { ...mockRecipes[index].extraProps, ...recipe.extraProps },
      };

      mockRecipes[index] = updatedRecipe;

      return { success: true, data: updatedRecipe };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update recipe';
      console.error('RECIPES_UPDATE error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // RECIPES_DELETE: Delete a recipe from database
  ipcMain.handle(IPC_CHANNELS.RECIPES_DELETE, async (
    _event, 
    recipeId: string
  ): Promise<IpcResponse<{ deleted: boolean }>> => {
    try {
      console.log('recipes:delete', recipeId);

      if (!recipeId || typeof recipeId !== 'string') {
        return { success: false, error: 'Invalid recipe ID' };
      }

      // M0 placeholder: Delete from mock storage (M1 will implement database delete)
      const index = mockRecipes.findIndex(r => r.recipeId === recipeId);
      
      if (index === -1) {
        return { success: false, error: 'Recipe not found' };
      }

      mockRecipes.splice(index, 1);

      return { success: true, data: { deleted: true } };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete recipe';
      console.error('RECIPES_DELETE error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // RECIPES_EXPORT: Export recipes as KubeJS script or Datapack
  ipcMain.handle(IPC_CHANNELS.RECIPES_EXPORT, async (
    _event, 
    options: RecipeExportOptions
  ): Promise<IpcResponse<{ outputPath: string; exportedCount: number }>> => {
    try {
      const { format, outputPath, recipeIds } = options || {};
      console.log('recipes:export', { format, outputPath, recipeIds });

      if (!format || !['kubejs', 'datapack'].includes(format)) {
        return { success: false, error: 'Invalid export format. Must be "kubejs" or "datapack"' };
      }

      // M0 placeholder: Return mock export result (M1 will implement actual export)
      // Determine which recipes to export
      const recipesToExport = recipeIds 
        ? mockRecipes.filter(r => recipeIds.includes(r.recipeId))
        : mockRecipes;

      const mockOutputPath = outputPath || `/mock/export/path/recipes_export_${Date.now()}`;

      const result = {
        outputPath: mockOutputPath,
        exportedCount: recipesToExport.length,
      };

      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export recipes';
      console.error('RECIPES_EXPORT error:', error);
      return { success: false, error: errorMessage };
    }
  });
}
