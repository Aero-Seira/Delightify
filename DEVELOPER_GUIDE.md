# Delightify 开发者入门指南

> 写给不熟悉技术栈的开发者：从零开始理解和修改本项目

---

## 📋 项目总览

Delightify 是一个 **桌面应用程序**，用网页技术（React）+ 桌面外壳（Electron）构建。

### 为什么要这样设计？
- **网页技术（React）**：界面开发快速、组件丰富、热更新方便
- **桌面外壳（Electron）**：能访问本地文件（读取 JAR）、独立窗口运行

---

## 🏗️ 项目结构（Monorepo）

项目分为 3 个包（package），相互依赖：

```
packages/
├── shared/          ← 共享类型定义（所有包都能用）
├── main/            ← Electron 主进程（Node.js，负责文件操作）
└── renderer/        ← React 前端（用户看到的界面）
```

### 简单类比
| 概念 | 现实类比 | 作用 |
|------|----------|------|
| `main` | 餐厅后厨 | 处理文件、数据库、系统操作 |
| `renderer` | 餐厅前台 | 展示界面、接收用户点击 |
| `shared` | 菜单价格表 | 前后台共享的信息标准 |

---

## 🎨 前端部分（renderer）

### 1. 组件文件在哪？
```
packages/renderer/src/
├── pages/           ← 5个主要页面
│   ├── ModManager/      ← 模组管理页面
│   ├── ItemBrowser/     ← 物品浏览器
│   ├── RecipeBrowser/   ← 配方浏览器
│   ├── RecipeEditor/    ← 配方编辑器
│   └── ConversionTool/  ← 转换工具
├── components/      ← 可复用组件
│   ├── LanguageSwitcher/  ← 语言切换
│   └── ThemeToggle/       ← 主题切换
├── i18n/           ← 多语言配置
├── theme/          ← 主题管理
└── styles/         ← 全局样式
```

### 2. 如何修改页面内容？

**示例：修改"模组管理"页面的标题**

打开 `packages/renderer/src/pages/ModManager/index.tsx`：

```tsx
import React from 'react';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

export default function ModManagerPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      {/* 修改这里：原本显示 "模组管理" */}
      <h1 className={styles.title}>{t('modManager.title')}</h1>
      
      {/* 或者直接写死文字（不推荐，但适合快速测试） */}
      <h1 className={styles.title}>我的自定义标题</h1>
      
      <p className={styles.description}>{t('modManager.description')}</p>
    </div>
  );
}
```

### 3. 如何修改样式？

**方式一：修改单个页面样式**

打开对应页面的 `style.module.css`：

```css
/* packages/renderer/src/pages/ModManager/style.module.css */

.container {
  /* 修改背景色 */
  background-color: var(--bg-secondary);
  
  /* 修改内边距 */
  padding: 40px;
  
  /* 添加边框 */
  border: 2px solid var(--accent);
}

.title {
  /* 修改文字颜色 */
  color: red;  /* 直接用颜色值，或继续使用变量如 var(--accent) */
  
  /* 修改字体大小 */
  font-size: 32px;
}
```

**方式二：修改全局样式（影响所有页面）**

打开 `packages/renderer/src/styles/global.css`：

```css
/* 修改全局背景色 */
[data-theme="light"] {
  --bg-primary: #f0f0f0;    /* 原来是 #ffffff */
  --accent: #ff6b6b;        /* 原来是蓝色，改成红色 */
}

[data-theme="dark"] {
  --bg-primary: #1a1a1a;    /* 原来是 #000000 */
  --accent: #ff6b6b;        /* 深色模式也改红色 */
}
```

### 4. 颜色变量对照表

| 变量名 | 浅色模式 | 深色模式 | 用途 |
|--------|----------|----------|------|
| `--bg-primary` | 纯白 #fff | 纯黑 #000 | 页面背景 |
| `--bg-secondary` | 灰白 #f5f5f7 | 深灰 #1c1c1e | 侧边栏背景 |
| `--accent` | 蓝 #0071e3 | 亮蓝 #0a84ff | 按钮、高亮 |
| `--text-primary` | 黑 #1d1d1f | 白 #f5f5f7 | 主要文字 |
| `--text-secondary` | 灰 #86868b | 浅灰 #a1a1a6 | 次要文字 |

---

## 🌐 国际化（多语言）

### 如何添加/修改文字？

**步骤 1**：打开语言文件
```
packages/renderer/src/i18n/locales/
├── zh-CN.ts    ← 中文
└── en.ts       ← 英文
```

**步骤 2**：添加新的翻译键

```typescript
// zh-CN.ts
export default {
  // ... 其他已有内容
  
  myNewSection: {
    title: '我的新页面',
    description: '这是页面描述',
    buttonText: '点击我',
  },
};

// en.ts
export default {
  // ... 其他已有内容
  
  myNewSection: {
    title: 'My New Page',
    description: 'This is the page description',
    buttonText: 'Click Me',
  },
};
```

**步骤 3**：在页面中使用

```tsx
import { useI18n } from '../../i18n';

function MyPage() {
  const { t } = useI18n();
  
  return (
    <div>
      <h1>{t('myNewSection.title')}</h1>
      <p>{t('myNewSection.description')}</p>
      <button>{t('myNewSection.buttonText')}</button>
    </div>
  );
}
```

### 带参数的翻译

```typescript
// 语言文件中
welcome: '你好，{{name}}！今天是{{day}}。'

// 页面中使用
t('welcome', { name: '张三', day: '星期一' })
// 结果：你好，张三！今天是星期一。
```

---

## 🎭 主题系统（深色/浅色）

### 核心概念

主题通过 CSS 变量实现。`data-theme` 属性控制使用哪套颜色：

```html
<!-- 浅色模式 -->
<html data-theme="light">

<!-- 深色模式 -->
<html data-theme="dark">
```

### 如何修改主题切换逻辑？

打开 `packages/renderer/src/theme/store.ts`：

```typescript
export const useTheme = create<ThemeState>((set, get) => ({
  mode: 'system',           // 默认跟随系统
  // 改成 'light' 或 'dark' 可强制默认主题
  
  resolvedMode: 'light',
  
  setMode: (mode) => {
    // 切换主题时执行的操作
    set({ mode, resolvedMode: resolveTheme(mode) });
    
    // 保存到本地存储（下次打开记住）
    localStorage.setItem('theme-mode', mode);
    
    // 应用到 HTML 标签
    document.documentElement.setAttribute(
      'data-theme', 
      resolveTheme(mode)
    );
  },
  
  toggleMode: () => {
    const { mode, setMode } = get();
    // 循环切换：light → dark → system → light
    const next = mode === 'light' ? 'dark' : 
                 mode === 'dark' ? 'system' : 'light';
    setMode(next);
  },
}));
```

---

## 🧩 组件开发示例

### 创建一个简单的按钮组件

**步骤 1**：创建组件目录和文件
```
packages/renderer/src/components/MyButton/
├── index.tsx
└── style.module.css
```

**步骤 2**：编写组件代码**

```tsx
// index.tsx
import React from 'react';
import styles from './style.module.css';

interface MyButtonProps {
  text: string;           // 按钮文字（必填）
  onClick?: () => void;   // 点击回调（可选）
  variant?: 'primary' | 'secondary';  // 样式变体（可选，默认 primary）
}

export default function MyButton({ 
  text, 
  onClick, 
  variant = 'primary' 
}: MyButtonProps): React.ReactElement {
  return (
    <button 
      className={`${styles.button} ${styles[variant]}`}
      onClick={onClick}
    >
      {text}
    </button>
  );
}
```

**步骤 3**：编写样式**

```css
/* style.module.css */
.button {
  padding: 12px 24px;
  border-radius: 10px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* 主按钮样式 */
.primary {
  background-color: var(--accent);
  color: white;
}

.primary:hover {
  background-color: var(--accent-hover);
  transform: translateY(-1px);
}

/* 次要按钮样式 */
.secondary {
  background-color: var(--surface-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.secondary:hover {
  background-color: var(--surface-secondary);
}
```

**步骤 4**：在页面中使用**

```tsx
import MyButton from '../../components/MyButton';

function MyPage() {
  return (
    <div>
      <MyButton 
        text="主要按钮" 
        variant="primary"
        onClick={() => alert('点击了！')}
      />
      <MyButton 
        text="次要按钮" 
        variant="secondary"
      />
    </div>
  );
}
```

---

## 🔧 常见开发任务速查

### 1. 添加新页面

**步骤**：
1. 在 `packages/renderer/src/pages/` 创建新文件夹（如 `MyPage/`）
2. 创建 `index.tsx` 和 `style.module.css`
3. 在 `App.tsx` 中添加路由

```tsx
// App.tsx
import MyPage from './pages/MyPage';

// 在 Routes 中添加
<Route path="/mypage" element={<MyPage />} />

// 在侧边栏导航中添加
{ to: '/mypage', label: `🌟 ${t('nav.myPage')}` },
```

### 2. 修改侧边栏

打开 `packages/renderer/src/App.tsx`：

```tsx
<nav className={styles.sidebar}>
  {/* 修改 Logo */}
  <h2 className={styles.logo}>我的应用名称</h2>
  
  {/* 修改导航项 */}
  {[
    { to: '/', label: `🏠 ${t('nav.home')}` },      // 修改图标和文字
    { to: '/new', label: `✨ 新页面` },              // 添加新项
    // ...
  ].map(...)}
  
  <div className={styles.controls}>
    <ThemeToggle />
    <LanguageSwitcher />
    {/* 在这里添加新控件 */}
  </div>
</nav>
```

### 3. 修改窗口大小

打开 `packages/main/src/main.ts`：

```typescript
const win = new BrowserWindow({
  width: 1400,    // 修改宽度（默认 1280）
  height: 900,    // 修改高度（默认 800）
  // ...
});
```

### 4. 修改应用标题

打开 `packages/renderer/index.html`：

```html
<title>我的应用名称</title>
```

---

## 🚀 开发工作流

### 启动开发服务器

```bash
# 在项目根目录执行
pnpm dev
```

会同时启动：
- **主进程**（Electron）：监听文件变化自动重启
- **渲染进程**（React）：Vite 热更新，保存即刷新

### 构建生产版本

```bash
pnpm build
```

生成文件在：
- `packages/main/dist/` - 主进程代码
- `packages/renderer/dist/` - 前端代码

### 代码检查

```bash
pnpm typecheck    # TypeScript 类型检查（必过才能提交）
```

---

## 🐛 调试技巧

### 1. 查看界面（渲染进程）
按 `Ctrl+Shift+I`（或菜单：View → Developer → Developer Tools）

### 2. 查看主进程日志
终端会输出 `console.log` 的内容

### 3. 修改代码后没生效？
- 检查终端是否有红色报错
- 刷新页面（Ctrl+R）
- 重启 `pnpm dev`

### 4. 样式不生效？
- 检查类名是否拼写正确（CSS Modules 要求精确匹配）
- 检查 CSS 变量名是否正确
- 在 DevTools 中查看元素实际应用的样式

---

## 📚 技术栈参考

| 技术 | 用途 | 学习资源 |
|------|------|----------|
| React | 界面框架 | https://zh-hans.react.dev/ |
| TypeScript | 类型安全的 JavaScript | https://www.typescriptlang.org/zh/ |
| CSS Modules | 组件级 CSS | 文件名 `.module.css` |
| Zustand | 状态管理（比 Redux 简单） | https://docs.pmnd.rs/zustand |
| Electron | 桌面应用外壳 | https://www.electronjs.org/zh/docs/latest |

---

## 💡 最佳实践

1. **不要直接修改 `node_modules`** - 修改会被重置
2. **优先使用 CSS 变量** - 确保深色/浅色模式都能正常显示
3. **文字走 i18n** - 即使只做中文，也便于后期维护
4. **组件要独立** - 一个组件一个文件夹，包含自己的样式
5. **经常运行 `pnpm typecheck`** - 尽早发现类型错误

---

如有其他问题，随时询问！
