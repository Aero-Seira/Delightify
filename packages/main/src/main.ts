import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { registerAllHandlers } from './ipc';
import { appPaths } from './services/paths';
import { createGlobalDbClient, closeAllConnections, schema } from './services/database';
import { initResourceLoader } from './services/jar-parser/resource-loader';
import { initTextureResolver } from './services/resource-renderer/texture-resolver';

// 检测是否为开发环境
// 使用多种方式检测，确保在打包后的应用中能正确识别
// 1. 检查是否存在 src 目录（开发模式特征）
// 2. 检查 NODE_ENV
// 3. 在应用 ready 后使用 app.isPackaged
const fs = require('fs');

// 检查是否在开发模式（通过检查是否存在源码目录特征）
const isDevMode = (): boolean => {
  // 如果 NODE_ENV 明确设置为 development，则是开发模式
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // 检查是否在源码目录中运行（有 src 目录）
  const hasSrcDir = fs.existsSync(path.join(__dirname, '../src'));
  
  // 检查是否存在 renderer 源码目录（开发模式特征）
  const hasRendererSrc = fs.existsSync(path.join(__dirname, '../../renderer/src'));
  
  return hasSrcDir || hasRendererSrc;
};

let isDev = isDevMode();

console.log('[Main] NODE_ENV:', process.env.NODE_ENV);
console.log('[Main] isDev (initial):', isDev);
console.log('[Main] __dirname:', __dirname);

/**
 * 获取生产环境 index.html 的路径
 * 在打包后的应用中，renderer/dist 会被复制到 main/dist/renderer
 */
function getProductionIndexPath(): string {
  // 在 Electron 中，process.resourcesPath 指向 Resources 目录
  // macOS: Delightify.app/Contents/Resources
  // Windows: resources
  const resourcesPath = process.resourcesPath;
  const appPath = app.getAppPath();
  
  // asar 包内的路径（当 asar 启用时，Electron 会自动处理 asar 路径）
  // __dirname 在 asar 内指向 dist 目录
  const asarRendererPath = path.join(__dirname, 'renderer', 'index.html');
  const asarDistPath = path.join(__dirname, '..', 'renderer', 'index.html');
  
  // 开发模式路径
  const devPath = path.join(__dirname, '..', '..', 'renderer', 'dist', 'index.html');
  
  // Windows 便携版特定路径
  const winPortablePaths = [
    path.join(resourcesPath, 'app.asar', 'dist', 'renderer', 'index.html'),
    path.join(resourcesPath, 'app', 'dist', 'renderer', 'index.html'),
    path.join(appPath, 'dist', 'renderer', 'index.html'),
    path.join(process.cwd(), 'dist', 'renderer', 'index.html'),
  ];
  
  // 尝试多个可能的路径（按优先级排序）
  const paths = [
    { path: asarRendererPath, name: 'asar-renderer' },
    { path: asarDistPath, name: 'asar-dist' },
    ...winPortablePaths.map((p, i) => ({ path: p, name: `win-portable-${i + 1}` })),
    { path: devPath, name: 'dev' },
  ];
  
  console.log('[Main] Searching for index.html...');
  console.log('[Main] __dirname:', __dirname);
  console.log('[Main] process.resourcesPath:', resourcesPath);
  console.log('[Main] app.getAppPath():', appPath);
  console.log('[Main] process.cwd():', process.cwd());
  console.log('[Main] platform:', process.platform);
  
  for (const { path: testPath, name } of paths) {
    const exists = fs.existsSync(testPath);
    console.log(`[Main] Checking ${name}:`, testPath, exists ? '✓ EXISTS' : '✗ NOT FOUND');
    if (exists) {
      console.log(`[Main] ✓ Found index.html at (${name}):`, testPath);
      return testPath;
    }
  }
  
  // 调试：尝试列出各种目录的内容
  console.warn('[Main] ✗ Could not find index.html in any location');
  
  const dirsToCheck = [
    { path: __dirname, name: '__dirname' },
    { path: path.dirname(__dirname), name: 'parent of __dirname' },
    { path: resourcesPath, name: 'resourcesPath' },
    { path: appPath, name: 'appPath' },
  ];
  
  for (const { path: dirPath, name } of dirsToCheck) {
    try {
      if (fs.existsSync(dirPath)) {
        const contents = fs.readdirSync(dirPath);
        console.warn(`[Main] Contents of ${name} (${dirPath}):`, contents);
      } else {
        console.warn(`[Main] ${name} does not exist:`, dirPath);
      }
    } catch (e) {
      console.warn(`[Main] Error listing ${name}:`, (e as Error).message);
    }
  }
  
  // 默认返回第一个路径
  return asarRendererPath;
}

/**
 * 检测 Vite dev server 是否运行
 */
async function isViteDevServerRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:5173');
    return response.ok;
  } catch {
    return false;
  }
}

async function createWindow(): Promise<void> {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[Main] Preload script path:', preloadPath);
  console.log('[Main] isDev:', isDev);
  
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      // 开发模式下允许加载本地资源
      webSecurity: !isDev,
    },
  });

  // 监听 preload 加载错误
  win.webContents.on('preload-error', (_event: any, preloadPath: string, error: Error) => {
    console.error('[Main] Preload error:', preloadPath, error);
  });

  // 监听控制台消息
  win.webContents.on('console-message', (_event: any, level: number, message: string, _line: number, _sourceId: string) => {
    if (message.includes('electronAPI') || message.includes('Preload') || level === 3) {
      console.log(`[Renderer:${level}] ${message}`);
    }
  });

  // 检测 Vite dev server 是否运行
  const viteRunning = await isViteDevServerRunning();
  console.log('[Main] Vite dev server running:', viteRunning);

  if (viteRunning) {
    console.log('[Main] Loading Vite dev server at http://localhost:5173');
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
    
    // 开发模式下，当页面加载完成后，手动检查 preload 是否生效
    win.webContents.on('did-finish-load', () => {
      console.log('[Main] Page did finish load');
      win.webContents.executeJavaScript(`
        console.log('[Preload Check] electronAPI available:', !!window.electronAPI);
        console.log('[Preload Check] typeof electronAPI:', typeof window.electronAPI);
        if (!window.electronAPI) {
          console.error('[Preload Check] electronAPI is NOT available! Preload script may have failed to load.');
        }
      `);
    });
  } else {
    console.log('[Main] Loading production build');
    const indexPath = getProductionIndexPath();
    console.log('[Main] Loading index.html from:', indexPath);
    
    // 检查文件是否存在
    const fileExists = fs.existsSync(indexPath);
    console.log('[Main] File exists:', fileExists);
    
    if (!fileExists) {
      // 显示调试信息页面
      const debugInfo = `
        <!DOCTYPE html>
        <html>
          <head><title>Debug Info</title></head>
          <body style="font-family: monospace; padding: 20px; background: #1a1a1a; color: #00ff00;">
            <h1>⚠️ Production Build Debug</h1>
            <h2>File Not Found</h2>
            <pre style="background: #333; padding: 15px; border-radius: 5px;">
indexPath: ${indexPath}
fileExists: ${fileExists}
__dirname: ${__dirname}
process.resourcesPath: ${process.resourcesPath}
app.getAppPath(): ${app.getAppPath()}
app.isPackaged: ${app.isPackaged}
NODE_ENV: ${process.env.NODE_ENV}
isDev: ${isDev}
            </pre>
            <h3>Directory Listing Attempts:</h3>
            <script>
              document.write('<p>Check console for directory listings</p>');
            </script>
          </body>
        </html>
      `;
      win.loadURL(`data:text/html,${encodeURIComponent(debugInfo)}`);
      win.webContents.openDevTools();
      return;
    }
    
    // 加载文件
    win.loadFile(indexPath).catch((err: Error) => {
      console.error('[Main] Failed to load index.html:', err);
      win.loadURL(`data:text/html,${encodeURIComponent(`
        <html>
          <body style="font-family: sans-serif; padding: 40px; color: #333;">
            <h1>Failed to load application</h1>
            <p>Error: ${err.message}</p>
            <p>Path: ${indexPath}</p>
          </body>
        </html>
      `)}`);
    });
    
    // 生产环境也打开 DevTools 以便调试（可以稍后移除）
    win.webContents.openDevTools();
  }
}

/**
 * 初始化应用
 * - 创建必要的目录结构
 * - 初始化全局数据库连接
 */
async function initializeApp(): Promise<void> {
  console.log('[Main] Initializing application...');
  
  try {
    // 1. 确保目录结构存在
    await appPaths.ensureDirectories();
    console.log('[Main] Directories ensured');
    
    // 2. 初始化全局数据库连接
    const globalDb = createGlobalDbClient(appPaths.globalDb);
    console.log('[Main] Global database initialized:', appPaths.globalDb);
    
    // 3. 验证数据库连接
    const result = await globalDb.execute('SELECT COUNT(*) as count FROM mods');
    console.log('[Main] Database connection verified, mods count:', result.rows[0]?.count || 0);
    
    // 4. 初始化资源加载器（在后台异步加载，不阻塞启动）
    initTextureResolver().catch(err => {
      console.warn('[Main] Failed to initialize texture resolver:', err);
    });
    
    console.log('[Main] Application initialized successfully');
  } catch (error) {
    console.error('[Main] Failed to initialize application:', error);
    // 即使初始化失败，也继续启动应用，让用户可以看到错误信息
  }
}

app.whenReady().then(async () => {
  // 0. 先初始化路径（必须在 app.whenReady() 之后）
  appPaths.initialize();
  
  // 更新 isDev 状态（现在 app.isPackaged 可用了）
  isDev = !app.isPackaged;
  console.log('[Main] app.isPackaged:', app.isPackaged);
  console.log('[Main] isDev (final):', isDev);
  
  // 1. 初始化应用（目录、数据库等）
  await initializeApp();
  
  // 注册 IPC 处理器
  registerAllHandlers();
  
  // 创建窗口
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前清理资源
app.on('before-quit', () => {
  console.log('[Main] Application quitting, cleaning up resources...');
  closeAllConnections();
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
});
