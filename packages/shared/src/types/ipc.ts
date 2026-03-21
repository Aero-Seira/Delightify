/**
 * IPC response types for Delightify
 */

export interface IpcSuccessResponse<T> {
  success: true;
  data: T;
}

export interface IpcErrorResponse {
  success: false;
  error: string;
}

export type IpcResponse<T> = IpcSuccessResponse<T> | IpcErrorResponse;

// Item query types
export interface ItemQueryParams {
  search?: string;
  modId?: string;
  category?: string;
  tag?: string;
  textureType?: 'item' | 'block' | 'unknown';
  page?: number;
  pageSize?: number;
}

export interface ItemQueryResult {
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
}

// Recipe filter types
export interface RecipeFilter {
  modId?: string;
  recipeTypeId?: string;
  search?: string;
}

// JAR import types
export interface JarImportResult {
  success: boolean;
  filePath: string;
  modId: string;
  modName: string;
  itemCount: number;
  recipeCount: number;
  tagCount: number;
  textureCount: number;
}

export interface JarImportProgress {
  step: string;
  percent: number;
  filePath: string;
  currentFile?: string;
  processedCount?: number;
  totalCount?: number;
  error?: string;
  stageLabel?: string;
}

// LLM conversion types
export interface LlmConvertData {
  text: string;
  options?: Record<string, unknown>;
}

export interface LlmConvertResult {
  results: unknown[];
  status: 'pending' | 'processing' | 'complete' | 'error';
}

export interface LlmConvertProgress {
  percent: number;
  status: string;
  message?: string;
}

// Recipe export types
export interface RecipeExportOptions {
  format: 'kubejs' | 'datapack';
  outputPath?: string;
  recipeIds?: string[];
}
