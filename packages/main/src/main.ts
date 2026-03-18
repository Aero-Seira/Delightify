import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { registerAllHandlers } from './ipc';
import { appPaths } from './services/paths';
import { createGlobalDbClient, closeAllConnections, schema } from './services/database';

// 检测是否为开发环境
// 使用 NODE_ENV，因为在应用 ready 之前 app.isPackaged 可能不可用
const isDev = process.env.NODE_ENV === 'development';

console.log('[Main] NODE_ENV:', process.env.NODE_ENV);
console.log('[Main] isDev:', isDev);

/**
 * 获取生产环境 index.html 的路径
 * 在打包后的应用中，renderer/dist 会被复制到 main/dist/renderer
 */
function getProductionIndexPath(): string {
  const fs = require('fs');
  
  // 在 Electron 中，process.resourcesPath 指向 Resources 目录
  // macOS: Delightify.app/Contents/Resources
  // Windows: resources
  const resourcesPath = process.resourcesPath;
  
  // asar 包内的路径（当 asar 启用时，Electron 会自动处理 asar 路径）
  // __dirname 在 asar 内指向 dist 目录
  const asarRendererPath = path.join(__dirname, 'renderer', 'index.html');
  const asarDistPath = path.join(__dirname, '..', 'renderer', 'index.html');
  
  // 开发模式路径
  const devPath = path.join(__dirname, '..', '..', 'renderer', 'dist', 'index.html');
  
  // 尝试多个可能的路径
  const paths = [
    { path: asarRendererPath, name: 'asar-renderer' },
    { path: asarDistPath, name: 'asar-dist' },
    { path: devPath, name: 'dev' },
    { path: path.join(resourcesPath, 'app.asar', 'dist', 'renderer', 'index.html'), name: 'resources-asar' },
    { path: path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'), name: 'appPath' },
  ];
  
  console.log('[Main] Searching for index.html...');
  console.log('[Main] __dirname:', __dirname);
  console.log('[Main] process.resourcesPath:', resourcesPath);
  console.log('[Main] app.getAppPath():', app.getAppPath());
  
  for (const { path: testPath, name } of paths) {
    console.log(`[Main] Checking ${name}:`, testPath);
    if (fs.existsSync(testPath)) {
      console.log(`[Main] ✓ Found index.html at (${name}):`, testPath);
      return testPath;
    }
  }
  
  // 调试：列出 __dirname 内容
  console.warn('[Main] ✗ Could not find index.html in any location');
  try {
    console.warn('[Main] Contents of __dirname:', fs.readdirSync(__dirname));
  } catch (e) {
    console.warn('[Main] Error listing __dirname:', e);
  }
  
  // 默认返回第一个路径
  return asarRendererPath;
}

function createWindow(): void {
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

  if (isDev) {
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
    const fs = require('fs');
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
    
    console.log('[Main] Application initialized successfully');
  } catch (error) {
    console.error('[Main] Failed to initialize application:', error);
    // 即使初始化失败，也继续启动应用，让用户可以看到错误信息
  }
}

app.whenReady().then(async () => {
  // 0. 先初始化路径（必须在 app.whenReady() 之后）
  appPaths.initialize();
  
  // 1. 初始化应用（目录、数据库等）
  await initializeApp();
  
  // 注册 IPC 处理器
  registerAllHandlers();
  
  // 创建窗口
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
