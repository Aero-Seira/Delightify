import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  IpcResponse, 
  ItemQueryParams, 
  ItemQueryResult,
  Item 
} from '@delightify/shared';

// M0 placeholder: Empty item storage (M1 will use database)
const mockItems: Item[] = [];

export function registerItemsHandlers(): void {
  // ITEMS_QUERY: Query items from database with filtering and pagination
  ipcMain.handle(IPC_CHANNELS.ITEMS_QUERY, async (
    _event, 
    params: ItemQueryParams
  ): Promise<IpcResponse<ItemQueryResult>> => {
    try {
      const { 
        search, 
        modId, 
        category, 
        page = 1, 
        pageSize = 50 
      } = params || {};

      console.log('items:query', { search, modId, category, page, pageSize });

      // M0 placeholder: Return empty result (M1 will implement database query)
      // Filter mock items if any exist
      let filteredItems = [...mockItems];

      if (search) {
        const searchLower = search.toLowerCase();
        filteredItems = filteredItems.filter(item => 
          item.itemId.toLowerCase().includes(searchLower) ||
          item.displayName?.toLowerCase().includes(searchLower)
        );
      }

      if (modId) {
        filteredItems = filteredItems.filter(item => item.modId === modId);
      }

      if (category) {
        filteredItems = filteredItems.filter(item => item.category === category);
      }

      // Pagination
      const total = filteredItems.length;
      const startIndex = (page - 1) * pageSize;
      const paginatedItems = filteredItems.slice(startIndex, startIndex + pageSize);

      const result: ItemQueryResult = {
        items: paginatedItems,
        total,
        page,
        pageSize,
      };

      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to query items';
      console.error('ITEMS_QUERY error:', error);
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  });

  // ITEMS_GET_TEXTURE: Return texture data for given item
  ipcMain.handle(IPC_CHANNELS.ITEMS_GET_TEXTURE, async (
    _event, 
    itemId: string
  ): Promise<IpcResponse<string | null>> => {
    try {
      if (!itemId || typeof itemId !== 'string') {
        return { success: false, error: 'Invalid item ID' };
      }

      console.log('items:get-texture', itemId);

      // M0/M1 placeholder: Return null (M2 will implement texture loading)
      // Texture data will be base64 string or file path
      return { success: true, data: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get texture';
      console.error('ITEMS_GET_TEXTURE error:', error);
      return { success: false, error: errorMessage };
    }
  });
}
