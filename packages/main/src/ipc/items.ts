import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';

export function registerItemsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ITEMS_QUERY, async (_event, query: unknown) => {
    // TODO: Query items from database with filtering and pagination
    console.log('items:query', query);
    return { items: [], total: 0 };
  });

  ipcMain.handle(IPC_CHANNELS.ITEMS_GET_TEXTURE, async (_event, itemId: string) => {
    // TODO: Return texture data (base64 or file path) for given item
    console.log('items:get-texture', itemId);
    return null;
  });
}
