# 项目结构文档 / Project Structure Document

[中文](#中文) | [English](#english)

---

## 中文

### Monorepo 目录树

```
delightify/                          # 项目根目录
├── .github/
│   ├── workflows/                   # CI/CD（类型检查、构建验证）
│   └── ISSUE_TEMPLATE/              # Issue 模板
├── packages/
│   ├── shared/                      # 前后端共享代码包
│   │   ├── package.json             # name: @delightify/shared
│   │   └── src/
│   │       ├── types/               # 共享 TypeScript 类型定义
│   │       │   ├── mod.ts           # Mod 相关类型
│   │       │   ├── item.ts          # 物品类型（Item, ItemStack, Tag）
│   │       │   ├── recipe.ts        # 配方类型（Recipe, RecipeType, RecipeSlot）
│   │       │   ├── texture.ts       # 材质资源类型
│   │       │   ├── translation.ts   # 翻译条目类型
│   │       │   └── index.ts         # 统一导出
│   │       └── constants/           # 共享常量（Minecraft 版本、默认配置等）
│   │
│   ├── backend/                     # Node.js 后端
│   │   ├── package.json             # name: @delightify/backend
│   │   └── src/
│   │       ├── main.ts              # Fastify 入口，启动服务并打开浏览器
│   │       ├── jar-parser/          # JAR 文件解析引擎
│   │       │   ├── index.ts         # 入口，协调解析流程
│   │       │   ├── zip-reader.ts    # ZIP/JAR 文件读取（adm-zip）
│   │       │   ├── recipe-parser.ts # 解析 data/<mod>/recipes/
│   │       │   ├── lang-parser.ts   # 解析 assets/<mod>/lang/
│   │       │   ├── texture-parser.ts# 解析 assets/<mod>/textures/item/（jimp 处理）
│   │       │   ├── tag-parser.ts    # 解析 data/<mod>/tags/items/
│   │       │   └── item-resolver.ts # 三重策略合并，生成物品 ID 列表
│   │       ├── database/            # 数据库层（Drizzle ORM）
│   │       │   ├── schema.ts        # 数据库 Schema 定义（全部表结构）
│   │       │   ├── client.ts        # libsql 连接管理
│   │       │   ├── migrations/      # 数据库迁移文件
│   │       │   └── repositories/    # 数据访问对象
│   │       │       ├── mod.repo.ts
│   │       │       ├── item.repo.ts
│   │       │       ├── recipe.repo.ts
│   │       │       └── texture.repo.ts
│   │       ├── llm/                 # LLM 集成层
│   │       │   ├── providers/       # 多提供商支持
│   │       │   │   ├── ollama.ts
│   │       │   │   ├── openai.ts
│   │       │   │   └── anthropic.ts
│   │       │   ├── prompt-builder.ts# 动态 Prompt 构建（注入数据库物品信息）
│   │       │   └── converter.ts     # 配方转换核心逻辑
│   │       ├── routes/              # Fastify 路由
│   │       │   ├── mods.ts          # /api/mods - 模组管理
│   │       │   ├── items.ts         # /api/items - 物品查询
│   │       │   ├── recipes.ts       # /api/recipes - 配方 CRUD
│   │       │   ├── textures.ts      # /api/textures/:path - 材质服务
│   │       │   └── llm.ts           # /api/llm - LLM 转换接口（WebSocket）
│   │       └── utils/               # 工具函数
│   │
│   └── frontend/                    # React 前端
│       ├── package.json             # name: @delightify/frontend
│       ├── vite.config.ts           # Vite 配置（代理到 backend:3000）
│       └── src/
│           ├── main.tsx             # React 入口
│           ├── App.tsx              # 路由配置
│           ├── components/          # 可复用组件
│           │   ├── ItemIcon/        # 物品图标（16x16 材质渲染）
│           │   ├── RecipeSlot/      # 配方槽位（带物品图标的格子）
│           │   ├── RecipeGrid/      # 配方网格（3x3 工作台等）
│           │   ├── ItemSearch/      # 物品搜索选择器
│           │   └── ConfidenceBadge/ # LLM 置信度标记
│           ├── pages/               # 页面级组件
│           │   ├── ModManager/      # 模组管理（上传 JAR、查看解析状态）
│           │   ├── ItemBrowser/     # 物品浏览器（带材质、搜索、过滤）
│           │   ├── RecipeBrowser/   # 配方浏览器（可视化槽位展示）
│           │   ├── RecipeEditor/    # 配方编辑器（可视化操作）
│           │   └── ConversionTool/  # LLM 转换工具（审核工作流）
│           ├── stores/              # 状态管理（Zustand 或 Jotai）
│           ├── hooks/               # 自定义 Hook
│           └── api/                 # 后端 API 调用封装
│
├── data/                            # 运行时数据目录（gitignore）
│   ├── delightify.db                # SQLite 数据库
│   └── textures/                    # 提取的材质文件
│       ├── minecraft/item/
│       └── <modid>/item/
│
├── pnpm-workspace.yaml              # pnpm workspace 配置
├── turbo.json                       # Turborepo 构建编排
├── package.json                     # 根 package（全局脚本）
└── tsconfig.base.json               # 共享 TypeScript 基础配置
```

---

### 数据库 Schema 设计

系统使用 SQLite（通过 Drizzle ORM + libsql），共设计 7 张表：

#### 表一：mods（模组注册表）

```
mods
├── mod_id        TEXT  PRIMARY KEY        -- 模组 ID（如 farmersdelight）
├── mod_name      TEXT  NOT NULL           -- 模组显示名称
├── version       TEXT                     -- 模组版本号
├── mc_version    TEXT                     -- 目标 Minecraft 版本
├── source_type   TEXT  NOT NULL           -- 数据来源：builtin / jar / manual
├── jar_path      TEXT                     -- JAR 文件路径（source_type=jar 时）
├── parsed_at     TEXT                     -- 最后解析时间（ISO 8601）
├── item_count    INTEGER  DEFAULT 0       -- 已解析物品数
└── recipe_count  INTEGER  DEFAULT 0       -- 已解析配方数
```

#### 表二：items（物品注册表）

```
items
├── item_id            TEXT  PRIMARY KEY   -- 注册名（如 farmersdelight:tomato）
├── mod_id             TEXT  FK→mods       -- 所属模组
├── display_name_key   TEXT                -- lang key（如 item.farmersdelight.tomato）
├── category           TEXT                -- 物品分类（food/tool/block/misc）
├── texture_path       TEXT                -- 材质路径（指向 textures 表）
├── model_path         TEXT                -- 模型路径
├── is_block           INTEGER  DEFAULT 0  -- 是否为方块（0/1）
└── created_at         TEXT                -- 入库时间（ISO 8601）

索引：
  idx_items_mod_id    ON items(mod_id)
  idx_items_category  ON items(category)
```

#### 表三：item_tags（物品标签关联）

```
item_tags
├── item_id       TEXT  FK→items      -- 物品 ID
├── tag_id        TEXT                -- 标签 ID（如 forge:vegetables）
└── source_mod_id TEXT  FK→mods       -- 定义该标签关联的模组

PRIMARY KEY: (item_id, tag_id)
```

#### 表四：recipes（配方数据）

```
recipes
├── recipe_id      TEXT  PRIMARY KEY  -- 文件路径作为唯一标识
│                                       （如 farmersdelight:cooking/tomato_soup）
├── mod_id         TEXT  FK→mods      -- 所属模组
├── recipe_type_id TEXT  FK→recipe_types -- 配方类型
├── input_slots    TEXT               -- 输入槽位数据（JSON 字符串）
├── output_slots   TEXT               -- 输出槽位数据（JSON 字符串）
├── extra_props    TEXT               -- 额外属性（JSON 字符串，如 cookingtime）
└── raw_json       TEXT               -- 原始 JSON 备份
```

#### 表五：recipe_types（配方类型元数据）

```
recipe_types
├── type_id              TEXT  PRIMARY KEY  -- 配方类型 ID
│                                            （如 farmersdelight:cooking）
├── mod_id               TEXT  FK→mods      -- 定义该类型的模组
├── display_name         TEXT               -- 显示名称
├── field_specs          TEXT               -- 字段规格（JSON）
│                                            （描述 input/output 槽位结构）
├── template             TEXT               -- 配方模板（JSON）
├── suitable_categories  TEXT               -- 适用物品分类（JSON 数组）
└── prompt_template      TEXT               -- LLM Prompt 模板
```

#### 表六：translations（翻译数据）

```
translations
├── lang_key   TEXT               -- 翻译键（如 item.farmersdelight.tomato）
├── locale     TEXT               -- 语言代码（zh_cn / en_us 等）
├── value      TEXT  NOT NULL     -- 翻译值
└── mod_id     TEXT  FK→mods      -- 来源模组

PRIMARY KEY: (lang_key, locale)
```

#### 表七：textures（材质资源）

```
textures
├── texture_path  TEXT  PRIMARY KEY  -- 材质路径
│                                      （如 assets/farmersdelight/textures/item/tomato.png）
├── mod_id        TEXT  FK→mods      -- 所属模组
├── local_path    TEXT               -- 提取后的本地路径
├── width         INTEGER            -- 图片宽度（px）
├── height        INTEGER            -- 图片高度（px）
└── file_size     INTEGER            -- 文件大小（bytes）
```

#### 表关系图

```
mods (1) ─────────── (N) items
  │                        │
  │                        │ (N:M)
  │                   item_tags
  │                        │
  │                   tag_id (自由文本)
  │
  ├─── (N) recipes
  │          │
  │          └── recipe_type_id → recipe_types (N) ──── (1) mods
  │
  ├─── (N) translations
  │
  └─── (N) textures
```

---

### JAR 解析流程

```
用户上传 JAR 文件
       │
       ▼
  zip-reader.ts
  读取 JAR 内容列表
       │
       ├──► lang-parser.ts
       │    解析 assets/{modid}/lang/en_us.json
       │    提取 item.{modid}.{name} → {modid}:{name}
       │
       ├──► tag-parser.ts
       │    解析 data/{modid}/tags/items/*.json
       │    提取 values 数组中的物品 ID
       │
       ├──► recipe-parser.ts
       │    解析 data/{modid}/recipes/*.json
       │    提取 ingredient / result 中的物品 ID
       │    同时构建 recipe_types 元数据
       │
       └──► texture-parser.ts
            解析 assets/{modid}/textures/item/*.png
            使用 jimp 处理图片（验证格式、提取尺寸）
                 │
                 ▼
         item-resolver.ts
         三重策略合并去重
         生成最终物品 ID 列表
                 │
                 ▼
         database/repositories/
         写入数据库
         更新 mods.item_count / recipe_count
                 │
                 ▼
         WebSocket 推送进度
         → 前端 ModManager 页面
```

#### 三重物品 ID 提取策略详解

**策略一：Lang 文件反推**
- 读取 `assets/{modid}/lang/en_us.json`（优先）或 `zh_cn.json`
- 匹配 key 模式 `item.{modid}.{item_name}` → 物品 ID `{modid}:{item_name}`
- 同时收集翻译文本，写入 `translations` 表
- 覆盖场景：所有有本地化翻译的物品（绝大多数面向玩家的物品）

**策略二：Tags 文件补充**
- 遍历 `data/{modid}/tags/items/` 下的所有 `.json` 文件
- 提取 `values` 数组中的每一项（格式如 `farmersdelight:tomato`）
- 过滤掉以 `#` 开头的标签引用（`#forge:vegetables`）
- 覆盖场景：有标签但无翻译的物品（内部物品、无名称物品）

**策略三：Recipes 文件扫描**
- 遍历 `data/{modid}/recipes/` 下的所有 `.json` 文件
- 递归扫描 JSON 中所有 `item` 字段
- 覆盖场景：参与配方的物品（包括其他模组物品的跨模组引用）

---

### API 路由设计

#### REST 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/mods` | 获取已导入的模组列表 |
| POST | `/api/mods/import` | 导入 JAR 文件（接受文件路径数组） |
| GET | `/api/mods/:modId` | 获取单个模组详情 |
| DELETE | `/api/mods/:modId` | 删除模组及其数据 |
| GET | `/api/items` | 分页查询物品（支持 modId, category, search 过滤） |
| GET | `/api/items/:itemId` | 获取单个物品详情（含翻译、标签、配方） |
| GET | `/api/recipes` | 查询配方（支持 modId, typeId, itemId 过滤） |
| GET | `/api/recipes/:recipeId` | 获取单个配方 |
| GET | `/api/textures/*` | 静态材质文件服务 |
| GET | `/api/recipe-types` | 获取所有配方类型 |

#### WebSocket 接口

| 路径 | 描述 |
|------|------|
| `WS /api/ws/import` | JAR 导入进度推送（实时更新解析状态） |
| `WS /api/ws/convert` | LLM 转换流式输出（streaming response） |

---

### 前端页面设计

#### ModManager（模组管理页）

```
核心功能：
  ├── 模组列表（已导入 / 未导入）
  ├── 导入流程
  │   ├── 文件选择（浏览本地 JAR）
  │   ├── 解析进度条（WebSocket 实时推送）
  │   │   └── 分步骤：读取文件 → 解析物品 → 解析配方 → 提取材质
  │   └── 解析结果摘要（物品数、配方数、错误数）
  └── 模组详情面板
      ├── 基础信息（版本、MC 版本、来源）
      ├── 统计数据（物品数、配方数）
      └── 操作（重新解析、删除）
```

#### ItemBrowser（物品浏览器）

```
核心功能：
  ├── 网格视图
  │   ├── 物品图标（16x16 材质，ItemIcon 组件）
  │   └── 物品名称（从 translations 表获取）
  ├── 侧边筛选器
  │   ├── 按模组过滤
  │   ├── 按分类过滤（food/tool/block/misc）
  │   └── 按标签过滤
  ├── 搜索框（模糊搜索物品名称或 ID）
  └── 物品详情面板（点击触发）
      ├── 物品图标（放大显示）
      ├── 注册名、显示名、所属模组
      ├── 所有标签
      └── 相关配方（可视化展示）
```

#### RecipeBrowser（配方浏览器）

```
核心功能：
  ├── 按配方类型分组显示
  ├── 配方卡片
  │   ├── 可视化槽位展示（RecipeGrid 组件）
  │   │   └── 每个槽位渲染 ItemIcon 组件
  │   └── 额外属性显示（烹饪时间、经验值等）
  └── 搜索（按输入/输出物品 ID 或名称）
```

#### RecipeEditor（配方编辑器）

```
核心功能：
  ├── 拖拽式配方编辑
  │   ├── 配方类型选择器
  │   ├── 可视化槽位网格（根据配方类型动态渲染）
  │   └── 物品搜索选择器（点击槽位触发）
  ├── 实时预览 KubeJS 输出代码
  └── 保存 / 导出操作
```

#### ConversionTool（LLM 转换工具）

```
核心功能：
  ├── 批量上传待转换配方
  ├── LLM 转换
  │   ├── 流式转换进度（WebSocket streaming）
  │   └── 置信度可视化（ConfidenceBadge 组件）
  └── 审核工作流
      ├── 逐条审核（接受 / 拒绝 / 编辑）
      ├── 低置信度高亮提示
      └── 批量操作（全部接受、筛选低置信度）
```

---

### 开发路线图

#### 阶段 1：基础骨架（Milestone: v0.1）

- [ ] pnpm + Turborepo monorepo 初始化
- [ ] `@delightify/shared` 类型定义（物品、配方、模组、材质）
- [ ] 数据库 Schema 定义（Drizzle ORM，7 张表）
- [ ] Fastify 基础路由框架（模组、物品、配方接口骨架）
- [ ] React + Vite 前端脚手架
- [ ] CI/CD：GitHub Actions 类型检查 + 构建验证

#### 阶段 2：数据入库（Milestone: v0.2）

- [ ] JAR 解析引擎（zip-reader, lang-parser, tag-parser, recipe-parser）
- [ ] 三重策略物品 ID 提取（item-resolver）
- [ ] 材质提取（texture-parser，jimp 处理）
- [ ] 翻译数据导入（中英文双语）
- [ ] Minecraft 原版种子数据（内置原版物品/配方/材质）
- [ ] WebSocket 进度推送

#### 阶段 3：可视化 UI（Milestone: v0.3）

- [ ] ItemIcon 组件（16x16 材质渲染）
- [ ] RecipeSlot / RecipeGrid 组件
- [ ] ModManager 页面（上传 + 进度 + 详情）
- [ ] ItemBrowser 页面（网格 + 筛选 + 搜索）
- [ ] RecipeBrowser 页面（按类型分组 + 可视化）

#### 阶段 4：LLM 转换（Milestone: v0.4）

- [ ] 多提供商 LLM 客户端（Ollama / OpenAI / Anthropic）
- [ ] Prompt 构建器（注入数据库物品信息、配方类型字段规格）
- [ ] 流式转换（WebSocket streaming）
- [ ] 转换审核工作流（逐条审核 + 置信度可视化）
- [ ] KubeJS 代码生成与导出

---

## English

### Monorepo Directory Tree

```
delightify/                          # Project root
├── .github/
│   ├── workflows/                   # CI/CD (type checking, build validation)
│   └── ISSUE_TEMPLATE/              # Issue templates
├── packages/
│   ├── shared/                      # Shared code package (frontend + backend)
│   │   ├── package.json             # name: @delightify/shared
│   │   └── src/
│   │       ├── types/               # Shared TypeScript type definitions
│   │       │   ├── mod.ts           # Mod-related types
│   │       │   ├── item.ts          # Item types (Item, ItemStack, Tag)
│   │       │   ├── recipe.ts        # Recipe types (Recipe, RecipeType, RecipeSlot)
│   │       │   ├── texture.ts       # Texture resource types
│   │       │   ├── translation.ts   # Translation entry types
│   │       │   └── index.ts         # Unified exports
│   │       └── constants/           # Shared constants (MC versions, defaults)
│   │
│   ├── backend/                     # Node.js backend
│   │   ├── package.json             # name: @delightify/backend
│   │   └── src/
│   │       ├── main.ts              # Fastify entry point, starts server and opens browser
│   │       ├── jar-parser/          # JAR file parsing engine
│   │       │   ├── index.ts         # Entry, orchestrates parsing flow
│   │       │   ├── zip-reader.ts    # ZIP/JAR file reading (adm-zip)
│   │       │   ├── recipe-parser.ts # Parses data/<mod>/recipes/
│   │       │   ├── lang-parser.ts   # Parses assets/<mod>/lang/
│   │       │   ├── texture-parser.ts# Parses assets/<mod>/textures/item/ (jimp)
│   │       │   ├── tag-parser.ts    # Parses data/<mod>/tags/items/
│   │       │   └── item-resolver.ts # Triple-strategy merge, generates item ID list
│   │       ├── database/            # Database layer (Drizzle ORM)
│   │       │   ├── schema.ts        # Database schema definition (all tables)
│   │       │   ├── client.ts        # libsql connection management
│   │       │   ├── migrations/      # Database migration files
│   │       │   └── repositories/    # Data access objects
│   │       │       ├── mod.repo.ts
│   │       │       ├── item.repo.ts
│   │       │       ├── recipe.repo.ts
│   │       │       └── texture.repo.ts
│   │       ├── llm/                 # LLM integration layer
│   │       │   ├── providers/       # Multi-provider support
│   │       │   │   ├── ollama.ts
│   │       │   │   ├── openai.ts
│   │       │   │   └── anthropic.ts
│   │       │   ├── prompt-builder.ts# Dynamic prompt building (injects DB item info)
│   │       │   └── converter.ts     # Recipe conversion core logic
│   │       ├── routes/              # Fastify routes
│   │       │   ├── mods.ts          # /api/mods - mod management
│   │       │   ├── items.ts         # /api/items - item queries
│   │       │   ├── recipes.ts       # /api/recipes - recipe CRUD
│   │       │   ├── textures.ts      # /api/textures/:path - texture serving
│   │       │   └── llm.ts           # /api/llm - LLM conversion (WebSocket)
│   │       └── utils/               # Utility functions
│   │
│   └── frontend/                    # React frontend
│       ├── package.json             # name: @delightify/frontend
│       ├── vite.config.ts           # Vite config (proxy to backend:3000)
│       └── src/
│           ├── main.tsx             # React entry point
│           ├── App.tsx              # Route configuration
│           ├── components/          # Reusable components
│           │   ├── ItemIcon/        # Item icon (16x16 texture rendering)
│           │   ├── RecipeSlot/      # Recipe slot (grid cell with item icon)
│           │   ├── RecipeGrid/      # Recipe grid (3x3 crafting table etc.)
│           │   ├── ItemSearch/      # Item search selector
│           │   └── ConfidenceBadge/ # LLM confidence indicator
│           ├── pages/               # Page-level components
│           │   ├── ModManager/      # Mod management (upload JAR, view parse status)
│           │   ├── ItemBrowser/     # Item browser (texture, search, filter)
│           │   ├── RecipeBrowser/   # Recipe browser (visual slot display)
│           │   ├── RecipeEditor/    # Recipe editor (visual editing)
│           │   └── ConversionTool/  # LLM conversion tool (review workflow)
│           ├── stores/              # State management (Zustand or Jotai)
│           ├── hooks/               # Custom hooks
│           └── api/                 # Backend API call wrappers
│
├── data/                            # Runtime data directory (gitignored)
│   ├── delightify.db                # SQLite database
│   └── textures/                    # Extracted texture files
│       ├── minecraft/item/
│       └── <modid>/item/
│
├── pnpm-workspace.yaml              # pnpm workspace config
├── turbo.json                       # Turborepo build orchestration
├── package.json                     # Root package (global scripts)
└── tsconfig.base.json               # Shared TypeScript base config
```

---

### Database Schema Design

The system uses SQLite (via Drizzle ORM + libsql), with 7 tables:

#### Table 1: mods (Mod Registry)

```
mods
├── mod_id        TEXT  PRIMARY KEY        -- Mod ID (e.g., farmersdelight)
├── mod_name      TEXT  NOT NULL           -- Mod display name
├── version       TEXT                     -- Mod version number
├── mc_version    TEXT                     -- Target Minecraft version
├── source_type   TEXT  NOT NULL           -- Data source: builtin / jar / manual
├── jar_path      TEXT                     -- JAR file path (when source_type=jar)
├── parsed_at     TEXT                     -- Last parse time (ISO 8601)
├── item_count    INTEGER  DEFAULT 0       -- Number of parsed items
└── recipe_count  INTEGER  DEFAULT 0       -- Number of parsed recipes
```

#### Table 2: items (Item Registry)

```
items
├── item_id            TEXT  PRIMARY KEY   -- Registry name (e.g., farmersdelight:tomato)
├── mod_id             TEXT  FK→mods       -- Owning mod
├── display_name_key   TEXT                -- lang key (e.g., item.farmersdelight.tomato)
├── category           TEXT                -- Item category (food/tool/block/misc)
├── texture_path       TEXT                -- Texture path (references textures table)
├── model_path         TEXT                -- Model path
├── is_block           INTEGER  DEFAULT 0  -- Whether it's a block (0/1)
└── created_at         TEXT                -- Entry time (ISO 8601)

Indexes:
  idx_items_mod_id    ON items(mod_id)
  idx_items_category  ON items(category)
```

#### Table 3: item_tags (Item-Tag Associations)

```
item_tags
├── item_id       TEXT  FK→items      -- Item ID
├── tag_id        TEXT                -- Tag ID (e.g., forge:vegetables)
└── source_mod_id TEXT  FK→mods       -- Mod that defines this tag association

PRIMARY KEY: (item_id, tag_id)
```

#### Table 4: recipes (Recipe Data)

```
recipes
├── recipe_id      TEXT  PRIMARY KEY  -- File path as unique identifier
│                                       (e.g., farmersdelight:cooking/tomato_soup)
├── mod_id         TEXT  FK→mods      -- Owning mod
├── recipe_type_id TEXT  FK→recipe_types -- Recipe type
├── input_slots    TEXT               -- Input slot data (JSON string)
├── output_slots   TEXT               -- Output slot data (JSON string)
├── extra_props    TEXT               -- Extra properties (JSON string, e.g., cookingtime)
└── raw_json       TEXT               -- Original JSON backup
```

#### Table 5: recipe_types (Recipe Type Metadata)

```
recipe_types
├── type_id              TEXT  PRIMARY KEY  -- Recipe type ID
│                                            (e.g., farmersdelight:cooking)
├── mod_id               TEXT  FK→mods      -- Mod that defines this type
├── display_name         TEXT               -- Display name
├── field_specs          TEXT               -- Field specifications (JSON)
│                                            (describes input/output slot structure)
├── template             TEXT               -- Recipe template (JSON)
├── suitable_categories  TEXT               -- Suitable item categories (JSON array)
└── prompt_template      TEXT               -- LLM prompt template
```

#### Table 6: translations (Translation Data)

```
translations
├── lang_key   TEXT               -- Translation key (e.g., item.farmersdelight.tomato)
├── locale     TEXT               -- Language code (zh_cn / en_us etc.)
├── value      TEXT  NOT NULL     -- Translation value
└── mod_id     TEXT  FK→mods      -- Source mod

PRIMARY KEY: (lang_key, locale)
```

#### Table 7: textures (Texture Resources)

```
textures
├── texture_path  TEXT  PRIMARY KEY  -- Texture path
│                                      (e.g., assets/farmersdelight/textures/item/tomato.png)
├── mod_id        TEXT  FK→mods      -- Owning mod
├── local_path    TEXT               -- Local path after extraction
├── width         INTEGER            -- Image width (px)
├── height        INTEGER            -- Image height (px)
└── file_size     INTEGER            -- File size (bytes)
```

#### Table Relationship Diagram

```
mods (1) ─────────── (N) items
  │                        │
  │                        │ (N:M)
  │                   item_tags
  │                        │
  │                   tag_id (free text)
  │
  ├─── (N) recipes
  │          │
  │          └── recipe_type_id → recipe_types (N) ──── (1) mods
  │
  ├─── (N) translations
  │
  └─── (N) textures
```

---

### JAR Parsing Flow

```
User uploads JAR file
       │
       ▼
  zip-reader.ts
  Reads JAR content listing
       │
       ├──► lang-parser.ts
       │    Parses assets/{modid}/lang/en_us.json
       │    Extracts item.{modid}.{name} → {modid}:{name}
       │
       ├──► tag-parser.ts
       │    Parses data/{modid}/tags/items/*.json
       │    Extracts item IDs from values arrays
       │
       ├──► recipe-parser.ts
       │    Parses data/{modid}/recipes/*.json
       │    Extracts item IDs from ingredient / result
       │    Also builds recipe_types metadata
       │
       └──► texture-parser.ts
            Parses assets/{modid}/textures/item/*.png
            Processes images with jimp (validate format, extract dimensions)
                 │
                 ▼
         item-resolver.ts
         Triple-strategy merge and deduplication
         Generates final item ID list
                 │
                 ▼
         database/repositories/
         Write to database
         Update mods.item_count / recipe_count
                 │
                 ▼
         WebSocket progress push
         → Frontend ModManager page
```

#### Triple Item ID Extraction Strategy Details

**Strategy 1: Lang File Inference**
- Reads `assets/{modid}/lang/en_us.json` (preferred) or `zh_cn.json`
- Matches key pattern `item.{modid}.{item_name}` → item ID `{modid}:{item_name}`
- Simultaneously collects translation text, written to the `translations` table
- Coverage: All items with localization translations (vast majority of player-facing items)

**Strategy 2: Tags File Supplement**
- Iterates all `.json` files under `data/{modid}/tags/items/`
- Extracts each entry in the `values` array (format: `farmersdelight:tomato`)
- Filters out tag references starting with `#` (e.g., `#forge:vegetables`)
- Coverage: Items with tags but no translations (internal items, unnamed items)

**Strategy 3: Recipes File Scan**
- Iterates all `.json` files under `data/{modid}/recipes/`
- Recursively scans all `item` fields in JSON
- Coverage: Items participating in recipes (including cross-mod item references)

---

### API Route Design

#### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mods` | Get list of imported mods |
| POST | `/api/mods/import` | Import JAR files (accepts array of file paths) |
| GET | `/api/mods/:modId` | Get single mod details |
| DELETE | `/api/mods/:modId` | Delete mod and its data |
| GET | `/api/items` | Paginated item query (supports modId, category, search filters) |
| GET | `/api/items/:itemId` | Get single item details (with translations, tags, recipes) |
| GET | `/api/recipes` | Query recipes (supports modId, typeId, itemId filters) |
| GET | `/api/recipes/:recipeId` | Get single recipe |
| GET | `/api/textures/*` | Static texture file serving |
| GET | `/api/recipe-types` | Get all recipe types |

#### WebSocket Endpoints

| Path | Description |
|------|-------------|
| `WS /api/ws/import` | JAR import progress push (real-time parse status updates) |
| `WS /api/ws/convert` | LLM conversion streaming output |

---

### Frontend Page Design

#### ModManager (Mod Management)

```
Core features:
  ├── Mod list (imported / not imported)
  ├── Import flow
  │   ├── File selection (browse local JAR)
  │   ├── Parse progress bar (WebSocket real-time push)
  │   │   └── Steps: read file → parse items → parse recipes → extract textures
  │   └── Parse result summary (item count, recipe count, error count)
  └── Mod details panel
      ├── Basic info (version, MC version, source)
      ├── Statistics (item count, recipe count)
      └── Actions (re-parse, delete)
```

#### ItemBrowser (Item Browser)

```
Core features:
  ├── Grid view
  │   ├── Item icon (16x16 texture, ItemIcon component)
  │   └── Item name (from translations table)
  ├── Sidebar filters
  │   ├── Filter by mod
  │   ├── Filter by category (food/tool/block/misc)
  │   └── Filter by tag
  ├── Search box (fuzzy search by name or ID)
  └── Item details panel (click to open)
      ├── Item icon (enlarged display)
      ├── Registry name, display name, owning mod
      ├── All tags
      └── Related recipes (visual display)
```

#### RecipeBrowser (Recipe Browser)

```
Core features:
  ├── Grouped by recipe type
  ├── Recipe cards
  │   ├── Visual slot display (RecipeGrid component)
  │   │   └── Each slot renders ItemIcon component
  │   └── Extra properties display (cook time, experience, etc.)
  └── Search (by input/output item ID or name)
```

#### RecipeEditor (Recipe Editor)

```
Core features:
  ├── Drag-and-drop recipe editing
  │   ├── Recipe type selector
  │   ├── Visual slot grid (dynamically rendered by recipe type)
  │   └── Item search selector (triggered by clicking a slot)
  ├── Real-time KubeJS output preview
  └── Save / export actions
```

#### ConversionTool (LLM Conversion Tool)

```
Core features:
  ├── Batch upload of recipes to convert
  ├── LLM conversion
  │   ├── Streaming conversion progress (WebSocket streaming)
  │   └── Confidence visualization (ConfidenceBadge component)
  └── Review workflow
      ├── Per-item review (accept / reject / edit)
      ├── Low-confidence highlight prompts
      └── Batch operations (accept all, filter low-confidence)
```

---

### Development Roadmap

#### Phase 1: Foundation (Milestone: v0.1)

- [ ] pnpm + Turborepo monorepo initialization
- [ ] `@delightify/shared` type definitions (items, recipes, mods, textures)
- [ ] Database schema definition (Drizzle ORM, 7 tables)
- [ ] Fastify basic route framework (mod, item, recipe endpoint scaffolding)
- [ ] React + Vite frontend scaffold
- [ ] CI/CD: GitHub Actions type checking + build validation

#### Phase 2: Data Ingestion (Milestone: v0.2)

- [ ] JAR parsing engine (zip-reader, lang-parser, tag-parser, recipe-parser)
- [ ] Triple-strategy item ID extraction (item-resolver)
- [ ] Texture extraction (texture-parser, jimp processing)
- [ ] Translation data import (bilingual Chinese/English)
- [ ] Minecraft vanilla seed data (built-in vanilla items/recipes/textures)
- [ ] WebSocket progress push

#### Phase 3: Visual UI (Milestone: v0.3)

- [ ] ItemIcon component (16x16 texture rendering)
- [ ] RecipeSlot / RecipeGrid components
- [ ] ModManager page (upload + progress + details)
- [ ] ItemBrowser page (grid + filters + search)
- [ ] RecipeBrowser page (grouped by type + visual display)

#### Phase 4: LLM Conversion (Milestone: v0.4)

- [ ] Multi-provider LLM client (Ollama / OpenAI / Anthropic)
- [ ] Prompt builder (injects database item info, recipe type field specs)
- [ ] Streaming conversion (WebSocket streaming)
- [ ] Conversion review workflow (per-item review + confidence visualization)
- [ ] KubeJS code generation and export
