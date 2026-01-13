# 🎮 Delightify

> AI-powered recipe compatibility system for Minecraft modpacks - automatically harmonize recipes across different mods

[English](#english) | [中文](#中文)

---

## 中文

### 🎯 项目简介

在 Minecraft 整合包开发中，经常遇到这样的问题：
- 模组A添加的寿司通过料理锅制作
- 模组B添加的寿司却只能通过工作台合成

这种不一致性破坏了游戏的沉浸感。**Delightify** 利用 AI 语义理解，自动生成统一的配方兼容脚本。

### ✨ 核心特性

- 🤖 **智能分类**: 自动识别物品并推荐最合适的配方类型
- 📦 **批量处理**: 一次处理多个配方，支持频繁交互审查
- 🎯 **混合架构**: 规则引擎 + 本地小模型，快速且准确
- 💻 **Web界面**: 基于 Gradio 的友好用户界面
- 🔌 **完全离线**: 支持本地模型，无需联网
- 📝 **多格式支持**: 输出 KubeJS / CraftTweaker / 数据包

### 🚀 快速开始

#### 安装

```bash
# 克隆仓库
git clone https://github.com/Aero-Seira/Delightify.git
cd Delightify

# 安装依赖
pip install -r requirements.txt

# (可选) 安装本地模型支持
# 安装 ollama: https://ollama.ai
ollama pull qwen2.5:7b
```

#### 运行

```bash
# 启动 Web UI
python run.py
```

访问 http://localhost:7860 开始使用！

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

### 🏗️ 项目架构

```
规则引擎 (80%) → 本地小模型 (15%) → 人工确认 (5%)
    ↓                ↓                    ↓
  极快              快速                 精确
 确定性          智能推理              边界情况
```

### 🛣️ 开发路线图

- [x] **阶段 0**: 项目初始化
- [ ] **阶段 1**: 原型验证 (MVP)
  - [ ] 规则引擎实现
  - [ ] 基础 Web UI (Gradio)
  - [ ] 配方解析器
- [ ] **阶段 2**: 模型集成
  - [ ] Ollama 本地模型集成
  - [ ] Prompt 优化
  - [ ] 批量处理与交互审查
- [ ] **阶段 3**: 增强功能
  - [ ] 配方验证
  - [ ] 冲突检测
  - [ ] 历史记录与会话保存

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

Using AI semantic understanding, it automatically generates unified recipe compatibility scripts.

### ✨ Features

- 🤖 **Smart Classification**: Automatically categorize items and recommend recipe types
- 📦 **Batch Processing**: Process multiple recipes with interactive review
- 🎯 **Hybrid Architecture**: Rule engine + local small model
- 💻 **Web Interface**: User-friendly Gradio-based UI
- 🔌 **Fully Offline**: Local model support, no internet required
- 📝 **Multi-format**: Output KubeJS / CraftTweaker / Datapacks

### 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/Aero-Seira/Delightify.git
cd Delightify

# Install dependencies
pip install -r requirements.txt

# Run Web UI
python run.py
```

Visit http://localhost:7860 to start!

### 📊 Architecture

```
Layer 1: Rule Engine (80% coverage, <1ms)
   ↓
Layer 2: Local Small Model (15% coverage, ~200ms)
   ↓
Layer 3: Manual Review (5% edge cases)
```

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
