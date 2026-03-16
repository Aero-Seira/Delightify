import type { TranslationData } from '@delightify/shared';

const en: TranslationData = {
  common: {
    appName: 'Delightify',
    loading: 'Loading...',
    error: 'Error',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    filter: 'Filter',
  },
  nav: {
    modManager: 'Mod Manager',
    itemBrowser: 'Item Browser',
    recipeBrowser: 'Recipe Browser',
    recipeEditor: 'Recipe Editor',
    conversionTool: 'Conversion Tool',
  },
  modManager: {
    title: 'Mod Manager',
    description: 'Import and manage JAR mod files',
    importJar: 'Import JAR',
    dragDrop: 'Drop JAR files here',
    jarList: 'JAR File List',
    parseResult: 'Parse Result',
  },
  itemBrowser: {
    title: 'Item Browser',
    description: 'Browse and search all imported items',
    searchPlaceholder: 'Search items...',
    categoryFilter: 'Category Filter',
    modFilter: 'Mod Filter',
  },
  recipeBrowser: {
    title: 'Recipe Browser',
    description: 'Browse all recipes',
    typeFilter: 'Type Filter',
    inputOutputSearch: 'Input/Output Search',
  },
  recipeEditor: {
    title: 'Recipe Editor',
    description: 'Create and edit recipes',
    newRecipe: 'New Recipe',
    saveRecipe: 'Save Recipe',
    exportKubeJS: 'Export KubeJS',
  },
  conversionTool: {
    title: 'Conversion Tool',
    description: 'Convert recipe formats',
    startConversion: 'Start Conversion',
    conversionProgress: 'Conversion Progress',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    theme: 'Theme',
  },
  theme: {
    light: 'Light',
    dark: 'Dark',
    system: 'Auto',
  },
  welcome: {
    message: 'Welcome to {{appName}}',
  },
};

export default en;
