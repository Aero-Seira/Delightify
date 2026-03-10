import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';

export function registerRecipesHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.RECIPES_LIST, async (_event, filter: unknown) => {
    // TODO: List recipes from database with optional filtering
    console.log('recipes:list', filter);
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.RECIPES_CREATE, async (_event, recipe: unknown) => {
    // TODO: Create a new recipe in database
    console.log('recipes:create', recipe);
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.RECIPES_UPDATE, async (_event, recipe: unknown) => {
    // TODO: Update an existing recipe in database
    console.log('recipes:update', recipe);
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.RECIPES_DELETE, async (_event, recipeId: string) => {
    // TODO: Delete a recipe from database
    console.log('recipes:delete', recipeId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.RECIPES_EXPORT, async (_event, options: unknown) => {
    // TODO: Export recipes as KubeJS script or Datapack
    console.log('recipes:export', options);
    return null;
  });
}
