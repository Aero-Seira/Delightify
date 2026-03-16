import type { TranslationData } from '@delightify/shared';

const zhCN: TranslationData = {
  common: {
    appName: 'Delightify',
    loading: '加载中...',
    error: '错误',
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    edit: '编辑',
    create: '创建',
    search: '搜索',
    filter: '筛选',
  },
  nav: {
    modManager: '模组管理',
    itemBrowser: '物品浏览器',
    recipeBrowser: '配方浏览器',
    recipeEditor: '配方编辑器',
    conversionTool: '转换工具',
  },
  modManager: {
    title: '模组管理',
    description: '导入和管理 JAR 模组文件',
    importJar: '导入 JAR',
    dragDrop: '拖放 JAR 文件到此处',
    jarList: 'JAR 文件列表',
    parseResult: '解析结果',
  },
  itemBrowser: {
    title: '物品浏览器',
    description: '浏览和搜索所有导入的物品',
    searchPlaceholder: '搜索物品...',
    categoryFilter: '分类筛选',
    modFilter: '模组筛选',
  },
  recipeBrowser: {
    title: '配方浏览器',
    description: '浏览所有配方',
    typeFilter: '类型筛选',
    inputOutputSearch: '输入/输出搜索',
  },
  recipeEditor: {
    title: '配方编辑器',
    description: '创建和编辑配方',
    newRecipe: '新建配方',
    saveRecipe: '保存配方',
    exportKubeJS: '导出 KubeJS',
  },
  conversionTool: {
    title: '转换工具',
    description: '转换配方格式',
    startConversion: '开始转换',
    conversionProgress: '转换进度',
  },
  settings: {
    title: '设置',
    language: '语言',
    theme: '主题',
  },
  theme: {
    light: '浅色',
    dark: '深色',
    system: '自动',
  },
  welcome: {
    message: '欢迎使用 {{appName}}',
  },
};

export default zhCN;
