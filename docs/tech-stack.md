# 技术栈决策文档 / Technology Stack Decision Document

[中文](#中文) | [English](#english)

---

## 中文

### 项目定位变更说明

**原定位**：配方格式转换工具
- 工作流程：用户上传 JSON → LLM 转换 → 输出 KubeJS 脚本
- 技术栈：Python + Gradio（快速 MVP 方案）

**新定位**：Minecraft 知识数据库平台
- 维护原版与模组的物品、配方、配方类型、翻译、材质资源
- 从用户上传的 JAR 文件自动解析模组数据
- 支持可视化操作（配方槽位编辑、物品浏览）
- 支持自动化程序可视化展示（LLM 转换审核工作流）

这一变更的核心驱动力是：原有方案缺乏结构化数据支撑，LLM 在不了解具体物品/配方上下文的情况下无法准确转换；而数据库驱动方案能将物品 ID、配方类型字段规格等信息注入 Prompt，大幅提升转换质量。

---

### 技术栈最终选型

| 层级 | 选型 | 备选方案 | 选择理由 |
|------|------|---------|---------|
| 包管理 | pnpm + Turborepo | npm, yarn | monorepo 磁盘占用最优，幽灵依赖防护，硬链接缓存 |
| 项目结构 | monorepo（packages/shared, main, renderer） | 单仓库 | 主进程与渲染进程共享 TypeScript 类型，消除类型重复定义 |
| 后端运行时 | Node.js + TypeScript | Python, Java, Rust | LLM SDK 官方支持，前后端语言统一，单进程分发 |
| 数据库 | SQLite via Drizzle ORM + libsql | PostgreSQL, better-sqlite3 | 零配置本地部署，libsql 无 Native Addon，类型安全 |
| 图像处理 | jimp | sharp | 纯 JS 实现，无 Native Addon，避免打包复杂度 |
| LLM 集成 | openai + ollama 官方 Node SDK | LangChain | 官方维护，功能完整，无需额外框架 |
| 前端框架 | React + TypeScript + Vite | Vue, Svelte | 生态成熟，组件库丰富，Vite 构建速度快 |
| UI 交互 | **Electron + React** | 本地 WebUI、Tauri、NiceGUI | 原生桌面体验，无需浏览器，IPC 替代 HTTP，文件系统访问更直接 |
| 后端框架 | ~~Fastify~~ → **Electron 主进程（IPC）** | Express, Fastify, Hono | Electron 环境下 IPC 比 HTTP 更高效，零端口冲突，无需网络栈 |

---

### JAR 解析方案说明

#### 为何放弃 Java

Java 在本项目中的唯一技术优势是：在运行时通过反射读取 Forge/Fabric 模组注册表，获取 100% 完整的物品 ID 列表。然而：

- **LLM 生态弱**：Java 中调用 OpenAI/Ollama 需要引入繁重的 HTTP 客户端，无官方 SDK 支持
- **UI 开发繁琐**：Swing/JavaFX 开发体验差，Web 框架（Vaadin 等）学习成本高
- **打包复杂**：JRE 打包产物较大，与 Node.js 相比无优势
- **团队成本高**：整合包开发者群体以脚本玩家为主，Python/JS 更亲切

#### Node.js 三重策略覆盖率

Node.js 无法在运行时访问 JVM 注册表，但通过以下三重策略可以达到 ~98% 的物品 ID 覆盖率：

```
策略一：Lang 文件反推
  assets/{modid}/lang/en_us.json
  key: "item.{modid}.{item_name}" → ID: "{modid}:{item_name}"
  覆盖：所有有翻译的物品（绝大多数面向玩家的物品）

策略二：Tags 文件补充
  data/{modid}/tags/items/*.json
  values 数组 → 物品 ID 列表
  覆盖：被标记的物品（包括跨模组物品引用）

策略三：Recipes 文件扫描
  data/{modid}/recipes/*.json
  ingredient / result 字段 → 物品 ID
  覆盖：所有参与配方的物品
```

三重合并去重后，剩余 ~2% 为无配方、无 lang key 的纯内部物品（如内部中间物、调试物品），整合包开发者通常无需操作这些物品。

---

### 参考设计：PCL2CE 的理念借鉴

本项目在路径管理和状态管理上参考了 [PCL2CE（PCL 社区版）](https://github.com/PCL-Community/PCL-CE) 的设计理念：

1. **多层路径分离**（对应 PCL2CE `Paths.cs`）：应用数据、项目数据、缓存三个独立路径体系，互不耦合，支持灵活部署和迁移
2. **列表与当前选择解耦**（对应 PCL2CE `States.cs`）：项目注册表（持久化到 `projects.json`）与当前打开项目（运行时状态）分离，切换项目不影响注册表数据
3. **实例配置随实例走**（对应 PCL2CE `Config.cs` 的 `ConfigSource.GameInstance`）：每个整合包项目有 `.delightify/` 目录存放项目级数据，项目可以独立迁移、备份、分享
4. **自动发现 + 手动添加并存**：自动扫描常见路径（如整合包启动器目录），同时支持手动添加项目，兼顾便捷性与灵活性

---

### 放弃 Fastify WebUI 改用 Electron 的理由（ADR 风格）

#### ADR-007: 放弃本地 WebUI，采用 Electron 桌面应用

- **提案**：保留原有本地 WebUI 方案（Fastify + 浏览器访问 localhost）
- **决策**：放弃，改用 Electron 桌面应用
- **放弃本地 WebUI 的理由**：
  - 需要用户手动打开浏览器，不符合 IDE 类工具的使用习惯
  - 无法直接读写文件系统（受浏览器沙箱限制），JAR 导入需要绕行
  - 端口冲突风险（3000 端口被其他程序占用时无法启动）
  - 无法使用原生文件选择器、系统通知、任务栏集成等桌面 OS 特性
- **选择 Electron 的理由**：
  - IPC 原生通信，无需 HTTP 栈，零端口冲突，性能更高
  - 直接调用 Node.js `fs` API 操作整合包文件，读写更高效
  - 与桌面 OS 深度集成（原生文件选择器、系统通知、任务栏）
  - 用户体验与 PCL2、HMCL 等整合包工具一致，目标用户更熟悉
  - 现有 Node.js 后端逻辑 **100% 复用**，仅将 Fastify routes 替换为 IPC handlers

---

### 前端方案演进路径

```
阶段一（当前）                     阶段二（未来可选）
─────────────                     ────────────────
Electron 桌面应用                   可选支持 Web 模式

主进程（Node.js）                   Fastify 后端（复用 services 层）
    │ IPC                               │ HTTP
    ↓                                   ↓
渲染进程（React）                   React 前端（100% 复用）
    │                                   │
Electron 原生窗口                   浏览器访问 localhost
```

两个阶段共享同一套 services 层代码，阶段二扩展仅需：
1. 在 services 层之上添加 Fastify HTTP adapter
2. 前端 IPC 调用改为 HTTP fetch（可通过抽象层统一）

services 层代码（JAR 解析、数据库、LLM）**0% 改动**。

---

### 包管理器选择说明

#### pnpm 在 monorepo 场景下的优势

**磁盘节省原理（硬链接 vs 复制）**

```
npm/yarn（复制模式）：
  packages/main/node_modules/typescript      (实际文件，15MB)
  packages/renderer/node_modules/typescript  (实际文件，15MB)
  磁盘占用：30MB

pnpm（硬链接模式）：
  ~/.pnpm-store/typescript@5.x/              (实际文件，15MB)
  packages/main/node_modules/typescript      (硬链接 → store)
  packages/renderer/node_modules/typescript  (硬链接 → store)
  磁盘占用：15MB（节省 50%）
```

在大型 monorepo 中，磁盘节省效果更显著（通常 30-60%）。

**幽灵依赖防护**

npm 会将所有依赖扁平化到根 `node_modules`，导致子包可以直接 `require` 自己未声明的依赖（幽灵依赖）。这在打包时会导致难以追踪的运行时错误。

pnpm 使用符号链接隔离每个包的依赖，只有在 `package.json` 中声明的依赖才能被访问，从根本上消除幽灵依赖问题。

**Turborepo 构建编排**

```
构建依赖关系：
  @delightify/shared  →  @delightify/main
                      →  @delightify/renderer

Turborepo 保证：
  1. shared 先于 main 和 renderer 构建
  2. main 和 renderer 可以并行构建（互不依赖）
  3. 增量构建缓存（未修改的包不重新构建）
```

---

### 放弃方案记录（ADR 风格）

#### ADR-001: 放弃 Python 全栈

- **提案**：保持原有 Python 技术栈，用 FastAPI + NiceGUI 替代 Gradio
- **决策**：放弃
- **理由**：
  - 前后端类型不同步：Python 类型提示无法直接共享到前端 TypeScript
  - 打包产物较大：PyInstaller 打包含 Python 解释器约 80-120MB
  - NiceGUI 表达能力仍有上限：配方槽位可视化编辑难以实现
  - Node.js 技术栈可完全覆盖 Python 在本项目中的所有使用场景

#### ADR-002: 放弃 Gradio / NiceGUI

- **提案**：使用 Gradio 或 NiceGUI 作为前端框架
- **决策**：放弃
- **理由**：
  - UI 表达能力有天花板，无法实现配方槽位可视化编辑（拖拽、右键）
  - Gradio 状态管理混乱，复杂多步骤流程（审核工作流）难以维护
  - 两者都绑定 Python 生态，无法与 Node.js 后端无缝集成

#### ADR-003: 放弃 Java 全栈

- **提案**：用 Java + Spring Boot 实现后端（可利用 JVM 读取模组注册表）
- **决策**：放弃
- **理由**：
  - LLM 生态弱，无官方 Java SDK（OpenAI/Ollama）
  - UI 开发繁琐（Swing/JavaFX/Vaadin）
  - 三重策略已达 ~98% 覆盖率，不值得引入 Java 的技术复杂度

#### ADR-004: 放弃 Docker

- **提案**：将应用打包为 Docker 镜像分发
- **决策**：放弃
- **理由**：
  - 目标用户（整合包开发者）安装 Docker 门槛过高
  - 整合包 JAR 文件通常几十 GB，挂载到容器较为复杂
  - 本地 Node.js 运行零配置，无需额外基础设施

#### ADR-005: 放弃本地 WebUI，采用 Electron

- **提案**：使用本地 WebUI（Fastify + 浏览器访问 localhost）
- **决策**：放弃本地 WebUI，改用 Electron（已更新决策，详见 ADR-007）
- **理由**：
  - Electron 打包体积（~150MB）在整合包开发者群体中不构成障碍
  - 直接文件系统访问、IPC 通信、桌面 OS 集成带来的体验提升远超体积成本
  - Tauri 需要 Rust 知识，当前阶段不纳入考虑（可作为未来 v2 方案）

#### ADR-006: 放弃纯云端 SaaS

- **提案**：将应用部署为云端服务，用户通过 Web 访问
- **决策**：放弃
- **理由**：
  - JAR 文件上传不现实，单整合包可达几十 GB
  - 用户的 Minecraft 实例在本地，需要与本地文件系统交互
  - 本地 WebUI 方案未来可无缝升级为云端（代码完全复用）

---

## English

### Project Repositioning

**Original Positioning**: Recipe format conversion tool
- Workflow: Upload JSON → LLM conversion → Output KubeJS scripts
- Tech stack: Python + Gradio (rapid MVP approach)

**New Positioning**: Minecraft knowledge database platform
- Maintains vanilla and mod items, recipes, recipe types, translations, and texture resources
- Automatically parses mod data from user-uploaded JAR files
- Supports visual operations (recipe slot editing, item browsing)
- Supports automated visualization (LLM conversion review workflow)

The core driver for this change: the original approach lacked structured data support, and LLM couldn't accurately convert recipes without knowing specific item/recipe context. A database-driven approach can inject item IDs, recipe type field specs, etc. into prompts, significantly improving conversion quality.

---

### Final Technology Stack

| Layer | Choice | Alternatives | Rationale |
|-------|--------|-------------|-----------|
| Package Management | pnpm + Turborepo | npm, yarn | Optimal monorepo disk usage, ghost dependency protection, hard-link cache |
| Project Structure | monorepo (packages/shared, main, renderer) | Single repo | Share TypeScript types between main and renderer processes, eliminate type duplication |
| Backend Runtime | Node.js + TypeScript | Python, Java, Rust | Official LLM SDK support, unified language stack, single-process distribution |
| Database | SQLite via Drizzle ORM + libsql | PostgreSQL, better-sqlite3 | Zero-config local deployment, no Native Addon in libsql, type-safe |
| Image Processing | jimp | sharp | Pure JS implementation, no Native Addon, avoids bundling complexity |
| LLM Integration | openai + ollama official Node SDK | LangChain | Officially maintained, feature-complete, no extra framework needed |
| Frontend Framework | React + TypeScript + Vite | Vue, Svelte | Mature ecosystem, rich component libraries, fast Vite builds |
| UI Interaction | **Electron + React** | Local WebUI, Tauri, NiceGUI | Native desktop experience, no browser needed, IPC replaces HTTP, direct filesystem access |
| Backend Framework | ~~Fastify~~ → **Electron Main Process (IPC)** | Express, Fastify, Hono | IPC is more efficient than HTTP in Electron, zero port conflicts, no network stack needed |

---

### JAR Parsing Strategy

#### Why We Rejected Java

Java's only technical advantage in this project is runtime reflection to read Forge/Fabric mod registries for 100% complete item ID lists. However:

- **Weak LLM ecosystem**: No official Java SDK for OpenAI/Ollama; requires heavy HTTP client integration
- **Tedious UI development**: Poor Swing/JavaFX developer experience; web frameworks (Vaadin, etc.) have high learning curves
- **Complex packaging**: JRE bundled packages are large; no advantage over Node.js
- **High team costs**: Modpack developers are mostly script-oriented; Python/JS is more accessible

#### Node.js Triple-Strategy Coverage

Node.js cannot access JVM registries at runtime, but the following three strategies achieve ~98% item ID coverage:

```
Strategy 1: Lang File Inference
  assets/{modid}/lang/en_us.json
  key: "item.{modid}.{item_name}" → ID: "{modid}:{item_name}"
  Coverage: All items with translations (vast majority of player-facing items)

Strategy 2: Tags File Supplement
  data/{modid}/tags/items/*.json
  values array → item ID list
  Coverage: Tagged items (including cross-mod item references)

Strategy 3: Recipes File Scan
  data/{modid}/recipes/*.json
  ingredient / result fields → item IDs
  Coverage: All items participating in recipes
```

After triple-merge deduplication, the remaining ~2% are purely internal items with no recipes and no lang keys (e.g., internal intermediaries, debug items). Modpack developers typically don't need to work with these items.

---

### Reference Design: Lessons from PCL2CE

This project draws from the design philosophy of [PCL2CE (PCL Community Edition)](https://github.com/PCL-Community/PCL-CE) for path management and state management:

1. **Multi-layer path separation** (corresponding to PCL2CE `Paths.cs`): Three independent path systems for app data, project data, and cache — fully decoupled, supporting flexible deployment and migration
2. **List vs. current selection decoupled** (corresponding to PCL2CE `States.cs`): Project registry (persisted to `projects.json`) is separated from currently open project (runtime state), so switching projects doesn't affect the registry
3. **Instance config travels with instance** (corresponding to PCL2CE `Config.cs` `ConfigSource.GameInstance`): Each modpack project has a `.delightify/` directory for project-level data, making projects independently migratable, backupable, and shareable
4. **Auto-discovery + manual addition**: Automatically scans common paths (e.g., launcher directories), while also supporting manual project addition for both convenience and flexibility

---

### Rationale for Abandoning Fastify WebUI in Favor of Electron (ADR Style)

#### ADR-007: Abandon Local WebUI, Adopt Electron Desktop Application

- **Proposal**: Retain the original local WebUI approach (Fastify + browser at localhost)
- **Decision**: Rejected; adopt Electron desktop application instead
- **Reasons for abandoning local WebUI**:
  - Requires users to manually open a browser — inconsistent with IDE-class tool UX expectations
  - Cannot directly read/write the filesystem (browser sandbox limitations); JAR import requires workarounds
  - Port conflict risk (startup fails if port 3000 is occupied by another process)
  - Cannot use native file pickers, system notifications, taskbar integration, or other desktop OS features
- **Reasons for choosing Electron**:
  - Native IPC communication — no HTTP stack, zero port conflicts, higher performance
  - Direct access to Node.js `fs` API for modpack file operations — more efficient reads and writes
  - Deep desktop OS integration (native file picker, system notifications, taskbar)
  - User experience consistent with tools like PCL2 and HMCL that the target audience is familiar with
  - Existing Node.js backend logic is **100% reusable** — only replaces Fastify routes with IPC handlers

---

### Frontend Evolution Path

```
Phase 1 (Current)                  Phase 2 (Optional Future)
─────────────────                  ─────────────────────────
Electron Desktop App               Optional Web Mode

Main Process (Node.js)             Fastify Backend (reuses services layer)
    │ IPC                               │ HTTP
    ↓                                   ↓
Renderer Process (React)           React Frontend (100% reuse)
    │                                   │
Electron native window             Browser at localhost
```

Both phases share the same services layer code. Phase 2 expansion only requires:
1. Adding a Fastify HTTP adapter on top of the services layer
2. Replacing IPC calls with HTTP fetch in the frontend (can be unified via an abstraction layer)

Services layer code (JAR parsing, database, LLM) requires **0% changes**.

---

### Package Manager Rationale

#### pnpm Advantages in Monorepo Scenarios

**Disk Savings (Hard Links vs Copies)**

```
npm/yarn (copy mode):
  packages/main/node_modules/typescript      (actual file, 15MB)
  packages/renderer/node_modules/typescript  (actual file, 15MB)
  Disk usage: 30MB

pnpm (hard-link mode):
  ~/.pnpm-store/typescript@5.x/              (actual file, 15MB)
  packages/main/node_modules/typescript      (hard link → store)
  packages/renderer/node_modules/typescript  (hard link → store)
  Disk usage: 15MB (50% savings)
```

In large monorepos, disk savings are even more significant (typically 30-60%).

**Ghost Dependency Protection**

npm flattens all dependencies to the root `node_modules`, allowing sub-packages to `require` undeclared dependencies (ghost dependencies). This causes hard-to-trace runtime errors during bundling.

pnpm uses symlinks to isolate each package's dependencies; only dependencies declared in `package.json` are accessible, fundamentally eliminating ghost dependency issues.

**Turborepo Build Orchestration**

```
Build dependency graph:
  @delightify/shared  →  @delightify/main
                      →  @delightify/renderer

Turborepo guarantees:
  1. shared builds before main and renderer
  2. main and renderer build in parallel (no mutual dependency)
  3. Incremental build cache (unchanged packages skip rebuild)
```

---

### Rejected Alternatives (ADR Style)

#### ADR-001: Reject Python Full Stack

- **Proposal**: Keep existing Python stack, replace Gradio with FastAPI + NiceGUI
- **Decision**: Rejected
- **Rationale**:
  - Type desync between frontend and backend: Python type hints cannot be directly shared to frontend TypeScript
  - Larger bundle: PyInstaller with Python interpreter ~80-120MB
  - NiceGUI still has expression limits: recipe slot visual editing is difficult
  - Node.js stack fully covers all Python use cases in this project

#### ADR-002: Reject Gradio / NiceGUI

- **Proposal**: Use Gradio or NiceGUI as frontend framework
- **Decision**: Rejected
- **Rationale**:
  - UI expression ceiling; cannot implement recipe slot visual editing (drag-and-drop, right-click)
  - Gradio state management is chaotic; complex multi-step flows (review workflow) are hard to maintain
  - Both are tied to the Python ecosystem, cannot seamlessly integrate with Node.js backend

#### ADR-003: Reject Java Full Stack

- **Proposal**: Implement backend in Java + Spring Boot (can use JVM to read mod registries)
- **Decision**: Rejected
- **Rationale**:
  - Weak LLM ecosystem, no official Java SDK (OpenAI/Ollama)
  - Tedious UI development (Swing/JavaFX/Vaadin)
  - Triple strategy already achieves ~98% coverage; not worth the Java complexity

#### ADR-004: Reject Docker

- **Proposal**: Package application as Docker image for distribution
- **Decision**: Rejected
- **Rationale**:
  - Target users (modpack developers) face too high a barrier to install Docker
  - Modpack JAR files often reach tens of GB; mounting into containers is complex
  - Local Node.js runs with zero configuration, no extra infrastructure needed

#### ADR-005: Abandon Local WebUI, Adopt Electron

- **Proposal**: Use local WebUI (Fastify + browser at localhost)
- **Decision**: Rejected local WebUI; adopted Electron instead (decision updated, see ADR-007)
- **Rationale**:
  - Electron bundle size (~150MB) is not a barrier for the modpack developer community
  - The UX gains from direct filesystem access, IPC communication, and desktop OS integration far outweigh the size cost
  - Tauri requires Rust knowledge, which is not currently feasible (may be revisited as a future v2 option)

#### ADR-006: Reject Pure Cloud SaaS

- **Proposal**: Deploy application as cloud service, users access via Web
- **Decision**: Rejected
- **Rationale**:
  - JAR file uploads are impractical; single modpacks can reach tens of GB
  - Users' Minecraft instances are local; local filesystem interaction is needed
  - Local WebUI can seamlessly upgrade to cloud in the future (full code reuse)
