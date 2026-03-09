# 🎮 Delightify

> AI-powered recipe compatibility system for Minecraft modpacks - automatically harmonize recipes across different mods

[English](#english) | [中文](#中文)

---

## 中文

### 🎯 项目简介

在 Minecraft 整合包开发中，经常遇到这样的问题：
- 模组A添加的寿司通过料理锅制作
- 模组B添加的寿司却只能通过工作台合成

这种不一致性破坏了游戏的沉浸感。**Delightify** 采用 **LLM 驱动**的智能转换方案，通过语义理解自动生成统一的配方兼容脚本，并在转换过程中积累数据，为未来的规则引擎提供训练基础。

### ✨ 核心特性

- 🤖 **LLM 驱动**: 支持本地模型（Ollama）和在线 API（OpenAI/Anthropic/自定义端点）
- 📥 **灵活输入**: 上传模组 JAR 文件，自动解析物品、配方、材质与翻译数据
- 🗄️ **知识数据库**: 维护原版与模组的物品、配方、材质、翻译数据，从 JAR 自动解析
- 📤 **多格式输出**: KubeJS JSON/Script、Datapack 格式，满足不同需求
- 🎯 **智能标记**: 自动标记低置信度配方，需要人工审核
- 💾 **数据积累**: 记录转换历史（LLM 推荐、用户操作、最终结果），为未来规则引擎做准备
- 🔧 **高度可定制**: 配方类型元数据完全可扩展，支持任意模组
- 💻 **Web 界面**: 基于 React + Node.js 的本地 WebUI，支持实时预览和可视化编辑
- 🔌 **完全离线**: 支持 Ollama 本地模型，无需联网

### 🚀 快速开始

#### 安装

```bash
# 克隆仓库
git clone https://github.com/Aero-Seira/Delightify.git
cd Delightify

# 安装依赖（需要 Node.js 18+ 和 pnpm）
pnpm install

# (推荐) 安装本地模型支持
# 安装 ollama: https://ollama.ai
ollama pull qwen2.5:7b
```

#### 配置 LLM

1. **使用 Ollama (推荐，本地运行)**
   
   确保 Ollama 已安装并运行：
   ```bash
   ollama serve
   ```
   
   系统将自动使用本地 Ollama 模型（配置在 `config/llm_config.json`）

2. **使用在线 API (可选)**
   
   如需使用 OpenAI 或 Anthropic，创建 `.env` 文件：
   ```bash
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   
   编辑 `config/llm_config.json` 启用相应提供商

#### 运行

```bash
# 启动开发服务器（前端 + 后端同时启动）
pnpm dev
```

访问 http://localhost:3000 开始使用！

### 📖 使用示例

**输入配方（JSON格式）:**
```json
{
  "type": "modA:cooking_pot",
  "ingredients": [
    {"item": "minecraft:rice"},
    {"item": "minecraft:fish"}
  ],
  "result": {"item": "modA:sushi"}
}
```

**自动生成 KubeJS 脚本:**
```javascript
ServerEvents.recipes(event => {
  // AI推荐: 烹饪类食物 → farmers_delight:cooking
  event.custom({
    type: 'farmers_delight:cooking',
    ingredients: [
      {item: 'minecraft:rice'},
      {item: 'minecraft:fish'}
    ],
    result: {item: 'modA:sushi'},
    cookingtime: 200
  });
});
```

### 📚 文档链接

- 📘 [系统架构设计](docs/architecture.md) - 原始系统设计和工作流程（历史参考）
- 📐 [技术栈决策](docs/tech-stack.md) - 技术选型决策记录与 ADR
- 🗂️ [项目结构](docs/project-structure.md) - monorepo 结构、数据库 Schema、API 设计
- ⚙️ [配置指南](docs/configuration.md) - LLM 配置、配方类型元数据、输出选项
- 📋 [数据格式规范](docs/data-formats.md) - 输入输出格式的完整规范

### 🏗️ 项目架构

**当前阶段: LLM 驱动 (100%)**
```
用户上传 → 解析 → LLM 转换 → 智能标记 → 交互审核 → 输出
    ↓
快速、智能、可解释
自动积累转换数据
```

**未来规划: 混合架构**
```
规则引擎 (80%) → 本地 LLM (15%) → 人工确认 (5%)
    ↓                ↓                  ↓
  极快              快速               精确
 确定性          智能推理           边界情况
```

通过积累的转换历史数据，系统将逐步构建规则引擎，实现从完全 LLM 驱动到混合架构的平滑过渡。

### 🛣️ 开发路线图

- [x] **阶段 0**: 项目初始化与架构设计
  - [x] 项目结构搭建
  - [x] 架构文档编写
  - [x] 配置系统设计
- [ ] **阶段 1**: 基础骨架（Milestone: v0.1）
  - [ ] pnpm + Turborepo monorepo 初始化
  - [ ] 共享 TypeScript 类型定义（物品、配方、模组、材质）
  - [ ] 数据库 Schema 设计（Drizzle ORM，7 张表）
  - [ ] Fastify 基础路由框架
  - [ ] React + Vite 前端脚手架
- [ ] **阶段 2**: 功能增强 (2周)
  - [ ] 批量处理支持
  - [ ] 多 LLM 提供商支持（OpenAI/Anthropic/自定义）
  - [ ] 交互审核界面
  - [ ] 多格式输出（KubeJS JSON/Script、Datapack）
  - [ ] 转换历史记录系统
  - [ ] 可疑配方标记
- [ ] **阶段 3**: 优化与扩展 (1-2周)
  - [ ] Prompt 优化（Few-shot learning）
  - [ ] 响应缓存机制
  - [ ] 并行处理优化
  - [ ] 数据分析工具
  - [ ] 成本跟踪
- [ ] **未来**: 规则引擎集成
  - [ ] 历史数据分析
  - [ ] 规则提取算法
  - [ ] 混合架构实现
  - [ ] 性能优化

### 🎯 目标用户

- 整合包开发者
- 具有基本计算机知识
- 熟悉 KubeJS/CraftTweaker
- 需要频繁交互批处理配方

### 🤝 贡献指南

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md)

### 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

## English

### 🎯 Overview

**Delightify** solves the common modpack development problem where different mods add similar items with incompatible crafting methods, breaking immersion.

Using **LLM-driven** intelligent conversion, it automatically generates unified recipe compatibility scripts through semantic understanding, while accumulating conversion data to build future rule engines.

### ✨ Features

- 🤖 **LLM-Driven**: Supports local models (Ollama) and online APIs (OpenAI/Anthropic/Custom endpoints)
- 📥 **Flexible Input**: Upload mod JAR files to automatically parse items, recipes, textures and translations
- 🗄️ **Knowledge Database**: Maintains vanilla and mod items, recipes, textures, and translations, auto-parsed from JARs
- 📤 **Multi-format Output**: KubeJS JSON/Script, Datapack format
- 🎯 **Smart Marking**: Automatically marks low-confidence recipes for manual review
- 💾 **Data Accumulation**: Records conversion history (LLM recommendations, user actions, final results) for future rule engine
- 🔧 **Highly Customizable**: Recipe type metadata fully extensible, supports any mod
- 💻 **Web Interface**: React + Node.js local WebUI with real-time preview and visual editing
- 🔌 **Fully Offline**: Supports Ollama local models, no internet required

### 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/Aero-Seira/Delightify.git
cd Delightify

# Install dependencies (requires Node.js 18+ and pnpm)
pnpm install

# (Recommended) Install local model support
# Install Ollama: https://ollama.ai
ollama pull qwen2.5:7b

# Start development server (frontend + backend)
pnpm dev
```

Visit http://localhost:3000 to start!

### 📚 Documentation

- 📘 [System Architecture Design](docs/architecture.md) - Original system design and workflow (historical reference)
- 📐 [Tech Stack Decisions](docs/tech-stack.md) - Technology selection decisions and ADRs
- 🗂️ [Project Structure](docs/project-structure.md) - Monorepo structure, database schema, API design
- ⚙️ [Configuration Guide](docs/configuration.md) - LLM config, recipe type metadata, output options
- 📋 [Data Format Specification](docs/data-formats.md) - Complete specification for input/output formats

### 📊 Architecture

**Current Stage: LLM-Driven (100%)**
```
User Upload → Parse → LLM Conversion → Smart Marking → Interactive Review → Output
    ↓
Fast, intelligent, explainable
Automatically accumulate conversion data
```

**Future Plan: Hybrid Architecture**
```
Rule Engine (80%) → Local LLM (15%) → Manual Review (5%)
    ↓                ↓                  ↓
Very Fast          Fast               Accurate
Deterministic    Smart Reasoning    Edge Cases
```

Through accumulated conversion history data, the system will gradually build a rule engine, achieving a smooth transition from fully LLM-driven to hybrid architecture.

### 🎯 Target Users

- Modpack developers
- Basic computer knowledge
- Familiar with KubeJS/CraftTweaker
- Need frequent interactive batch processing

### 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md)

### 📄 License

MIT License - see [LICENSE](LICENSE)

---

## 📞 联系方式 / Contact

- Issues: [GitHub Issues](https://github.com/Aero-Seira/Delightify/issues)
- Discussions: [GitHub Discussions](https://github.com/Aero-Seira/Delightify/discussions)

**Made with ❤️ for the Minecraft modding community**
