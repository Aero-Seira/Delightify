// IPC channel constants shared between main and renderer processes

export const IPC_CHANNELS = {
  // Project management
  PROJECT_LIST: 'project:list',
  PROJECT_OPEN: 'project:open',
  PROJECT_CREATE: 'project:create',
  PROJECT_GET_CURRENT: 'project:get-current',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_SELECT_DIRECTORY: 'project:select-directory',

  // JAR import
  JAR_IMPORT: 'jar:import',
  JAR_IMPORT_PROGRESS: 'jar:import:progress',
  JAR_LIST: 'jar:list',
  JAR_SELECT: 'jar:select',
  JAR_DELETE: 'jar:delete',
  JAR_GET_DETAILS: 'jar:get-details',

  // Item queries
  ITEMS_QUERY: 'items:query',
  ITEMS_GET_TEXTURE: 'items:get-texture',

  // Recipe CRUD
  RECIPES_LIST: 'recipes:list',
  RECIPES_CREATE: 'recipes:create',
  RECIPES_UPDATE: 'recipes:update',
  RECIPES_DELETE: 'recipes:delete',
  RECIPES_EXPORT: 'recipes:export',

  // LLM conversion
  LLM_CONVERT: 'llm:convert',
  LLM_CONVERT_PROGRESS: 'llm:convert:progress',
  LLM_CANCEL: 'llm:cancel',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
