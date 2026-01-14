# 前端项目结构模板 / Frontend Project Structure Template

[中文](#中文) | [English](#english)

---

## 中文

本文档提供了 Delightify 前端项目的完整目录结构和文件组织方式，作为未来实施的参考。

### 目录结构

```
frontend/
├── public/                          # 静态资源
│   ├── favicon.ico
│   ├── logo.svg
│   └── robots.txt
│
├── src/
│   ├── assets/                      # 资源文件
│   │   ├── images/
│   │   ├── icons/
│   │   └── styles/
│   │       ├── globals.css
│   │       ├── variables.css
│   │       └── themes.css
│   │
│   ├── components/                  # 可复用组件
│   │   ├── common/                  # 通用组件
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Button.test.tsx
│   │   │   │   └── Button.module.css
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── Dropdown/
│   │   │   ├── Tooltip/
│   │   │   └── LoadingSpinner/
│   │   │
│   │   ├── layout/                  # 布局组件
│   │   │   ├── Header/
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Header.module.css
│   │   │   ├── Sidebar/
│   │   │   ├── Footer/
│   │   │   └── MainLayout/
│   │   │
│   │   ├── upload/                  # 上传相关组件
│   │   │   ├── FileUploader/
│   │   │   │   ├── FileUploader.tsx
│   │   │   │   ├── FileUploader.test.tsx
│   │   │   │   └── index.ts
│   │   │   ├── DropZone/
│   │   │   ├── FileList/
│   │   │   └── UploadProgress/
│   │   │
│   │   ├── editor/                  # 编辑器组件
│   │   │   ├── MonacoEditor/
│   │   │   │   ├── MonacoEditor.tsx
│   │   │   │   ├── config.ts
│   │   │   │   └── themes.ts
│   │   │   ├── RecipeEditor/
│   │   │   └── DiffViewer/
│   │   │
│   │   ├── review/                  # 审核相关组件
│   │   │   ├── RecipeCard/
│   │   │   ├── RecipeComparison/
│   │   │   │   ├── RecipeComparison.tsx
│   │   │   │   ├── RecipeComparison.test.tsx
│   │   │   │   └── index.ts
│   │   │   ├── ConfidenceIndicator/
│   │   │   ├── WarningList/
│   │   │   └── ActionButtons/
│   │   │
│   │   ├── batch/                   # 批量操作组件
│   │   │   ├── BatchToolbar/
│   │   │   ├── RecipeTable/
│   │   │   ├── FilterPanel/
│   │   │   └── SearchBar/
│   │   │
│   │   └── visualization/           # 可视化组件
│   │       ├── ProgressChart/
│   │       ├── StatisticsCard/
│   │       └── ConversionFlowDiagram/
│   │
│   ├── pages/                       # 页面组件
│   │   ├── Home/
│   │   │   ├── HomePage.tsx
│   │   │   ├── HomePage.test.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── Upload/
│   │   │   ├── UploadPage.tsx
│   │   │   ├── UploadPage.test.tsx
│   │   │   └── components/          # 页面特定组件
│   │   │       ├── UploadGuide.tsx
│   │   │       └── FormatValidator.tsx
│   │   │
│   │   ├── Processing/
│   │   │   ├── ProcessingPage.tsx
│   │   │   └── components/
│   │   │       ├── ProcessingQueue.tsx
│   │   │       ├── ProgressMonitor.tsx
│   │   │       └── ErrorPanel.tsx
│   │   │
│   │   ├── Review/
│   │   │   ├── ReviewPage.tsx
│   │   │   ├── ReviewPage.test.tsx
│   │   │   └── components/
│   │   │       ├── ReviewList.tsx
│   │   │       ├── ReviewDetail.tsx
│   │   │       └── ReviewFilters.tsx
│   │   │
│   │   ├── History/
│   │   │   ├── HistoryPage.tsx
│   │   │   └── components/
│   │   │       ├── HistoryTable.tsx
│   │   │       ├── HistoryDetail.tsx
│   │   │       └── ExportDialog.tsx
│   │   │
│   │   ├── Settings/
│   │   │   ├── SettingsPage.tsx
│   │   │   └── components/
│   │   │       ├── LLMConfig.tsx
│   │   │       ├── OutputConfig.tsx
│   │   │       └── UIPreferences.tsx
│   │   │
│   │   └── NotFound/
│   │       └── NotFoundPage.tsx
│   │
│   ├── hooks/                       # 自定义 Hooks
│   │   ├── useRecipes.ts            # 配方数据管理
│   │   ├── useConversion.ts         # 转换操作
│   │   ├── useWebSocket.ts          # WebSocket 连接
│   │   ├── useLocalStorage.ts       # 本地存储
│   │   ├── useKeyboard.ts           # 键盘快捷键
│   │   ├── useTheme.ts              # 主题管理
│   │   └── useDebounce.ts           # 防抖
│   │
│   ├── services/                    # API 服务层
│   │   ├── api/
│   │   │   ├── client.ts            # API 客户端配置
│   │   │   ├── recipes.ts           # 配方相关 API
│   │   │   ├── conversion.ts        # 转换相关 API
│   │   │   ├── history.ts           # 历史记录 API
│   │   │   └── settings.ts          # 设置 API
│   │   │
│   │   ├── websocket/
│   │   │   ├── client.ts            # WebSocket 客户端
│   │   │   └── handlers.ts          # 消息处理器
│   │   │
│   │   └── storage/
│   │       ├── localStorage.ts      # 本地存储服务
│   │       └── sessionStorage.ts    # 会话存储服务
│   │
│   ├── store/                       # 状态管理
│   │   ├── index.ts                 # Store 入口
│   │   ├── recipeStore.ts           # 配方状态
│   │   ├── conversionStore.ts       # 转换状态
│   │   ├── uiStore.ts               # UI 状态
│   │   └── settingsStore.ts         # 设置状态
│   │
│   ├── types/                       # TypeScript 类型定义
│   │   ├── recipe.ts                # 配方相关类型
│   │   ├── conversion.ts            # 转换相关类型
│   │   ├── api.ts                   # API 响应类型
│   │   ├── ui.ts                    # UI 组件类型
│   │   └── index.ts                 # 类型导出
│   │
│   ├── utils/                       # 工具函数
│   │   ├── format.ts                # 格式化工具
│   │   ├── validation.ts            # 验证工具
│   │   ├── parser.ts                # 解析工具
│   │   ├── download.ts              # 下载工具
│   │   ├── constants.ts             # 常量定义
│   │   └── helpers.ts               # 辅助函数
│   │
│   ├── routes/                      # 路由配置
│   │   ├── index.tsx                # 路由定义
│   │   └── ProtectedRoute.tsx       # 受保护路由
│   │
│   ├── App.tsx                      # 根组件
│   ├── App.test.tsx                 # 根组件测试
│   ├── main.tsx                     # 应用入口
│   └── vite-env.d.ts                # Vite 类型定义
│
├── tests/                           # 测试文件
│   ├── unit/                        # 单元测试
│   ├── integration/                 # 集成测试
│   └── e2e/                         # 端到端测试
│
├── .env.example                     # 环境变量示例
├── .eslintrc.json                   # ESLint 配置
├── .prettierrc                      # Prettier 配置
├── index.html                       # HTML 模板
├── package.json                     # 依赖配置
├── tsconfig.json                    # TypeScript 配置
├── tsconfig.node.json               # Node TypeScript 配置
└── vite.config.ts                   # Vite 配置
```

### 核心文件示例

#### 1. package.json

```json
{
  "name": "delightify-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\""
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@monaco-editor/react": "^4.6.0",
    "zustand": "^4.4.7",
    "@tanstack/react-query": "^5.12.0",
    "antd": "^5.12.0",
    "axios": "^1.6.2",
    "dayjs": "^1.11.10",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "prettier": "^3.1.1",
    "typescript": "^5.2.2",
    "vite": "^5.0.8",
    "vitest": "^1.0.4",
    "@playwright/test": "^1.40.0"
  }
}
```

#### 2. vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['antd'],
          'editor-vendor': ['@monaco-editor/react'],
        },
      },
    },
  },
});
```

#### 3. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@pages/*": ["./src/pages/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@services/*": ["./src/services/*"],
      "@store/*": ["./src/store/*"],
      "@types/*": ["./src/types/*"],
      "@utils/*": ["./src/utils/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### 4. 类型定义示例 (src/types/recipe.ts)

```typescript
export interface Recipe {
  id: string;
  internalId: string;
  source: RecipeSource;
  recipeData: RecipeData;
  parsingInfo: ParsingInfo;
}

export interface RecipeSource {
  type: 'json_upload' | 'kubejs_script' | 'manual_input';
  filename: string;
  uploadTime: string;
  originalFormat: string;
  lineNumber?: number;
  batchId?: string;
}

export interface RecipeData {
  inputs: RecipeInput[];
  outputs: RecipeOutput[];
  originalType: string;
  extraProperties: Record<string, any>;
}

export interface RecipeInput {
  type: 'item' | 'tag' | 'fluid' | 'energy';
  item?: string;
  tag?: string;
  fluid?: string;
  count?: number;
  nbt?: Record<string, any>;
  chance?: number;
}

export interface RecipeOutput extends RecipeInput {}

export interface ParsingInfo {
  status: 'success' | 'partial' | 'failed';
  warnings: Warning[];
  errors: Error[];
  timestamp: string;
  parserVersion?: string;
}

export interface Warning {
  code: string;
  message: string;
  field?: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ConvertedRecipe extends Recipe {
  llmRecommendation: LLMRecommendation;
  convertedRecipeData: RecipeData;
  conversionMetadata: ConversionMetadata;
}

export interface LLMRecommendation {
  targetType: string;
  confidence: number;
  reasoning: string;
  alternatives: Alternative[];
  analysis: Analysis;
  warnings: string[];
  requiresReview: boolean;
}

export interface Alternative {
  type: string;
  confidence: number;
  reason: string;
}

export interface Analysis {
  itemCategory: string;
  recipeCharacteristics: string;
  keyIndicators: string[];
}

export interface ConversionMetadata {
  llmProvider: string;
  llmModel: string;
  processingTimeMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: string;
}
```

### 命名约定

#### 文件命名
- **组件文件**: PascalCase (例如: `RecipeCard.tsx`)
- **Hook 文件**: camelCase with 'use' prefix (例如: `useRecipes.ts`)
- **工具函数**: camelCase (例如: `formatRecipe.ts`)
- **常量文件**: camelCase (例如: `constants.ts`)
- **类型文件**: camelCase (例如: `recipe.ts`)

#### 代码命名
- **组件**: PascalCase (例如: `RecipeCard`)
- **函数**: camelCase (例如: `formatRecipe`)
- **常量**: UPPER_SNAKE_CASE (例如: `API_BASE_URL`)
- **类型/接口**: PascalCase (例如: `Recipe`, `RecipeData`)
- **枚举**: PascalCase (例如: `RecipeStatus`)

### 组件组织原则

1. **单一职责**: 每个组件只做一件事
2. **可复用性**: 通用组件放在 `components/common/`
3. **就近原则**: 页面特定组件放在页面目录的 `components/` 子目录
4. **测试覆盖**: 每个组件都应有对应的测试文件
5. **类型安全**: 所有组件都使用 TypeScript 并定义 Props 接口

---

## English

This document provides the complete directory structure and file organization for the Delightify frontend project as a reference for future implementation.

### Directory Structure

See Chinese section above for the complete structure.

### Core File Examples

#### Key Files Included:
1. **package.json** - Dependencies and scripts
2. **vite.config.ts** - Vite configuration with aliases and proxy
3. **tsconfig.json** - TypeScript configuration with path mapping
4. **Type Definitions** - Complete TypeScript interfaces

### Naming Conventions

#### File Naming
- **Component files**: PascalCase (e.g., `RecipeCard.tsx`)
- **Hook files**: camelCase with 'use' prefix (e.g., `useRecipes.ts`)
- **Utility functions**: camelCase (e.g., `formatRecipe.ts`)
- **Constant files**: camelCase (e.g., `constants.ts`)
- **Type files**: camelCase (e.g., `recipe.ts`)

#### Code Naming
- **Components**: PascalCase (e.g., `RecipeCard`)
- **Functions**: camelCase (e.g., `formatRecipe`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **Types/Interfaces**: PascalCase (e.g., `Recipe`, `RecipeData`)
- **Enums**: PascalCase (e.g., `RecipeStatus`)

### Component Organization Principles

1. **Single Responsibility**: Each component does one thing
2. **Reusability**: Common components in `components/common/`
3. **Proximity**: Page-specific components in page's `components/` subdirectory
4. **Test Coverage**: Every component should have a corresponding test file
5. **Type Safety**: All components use TypeScript with defined Props interfaces
