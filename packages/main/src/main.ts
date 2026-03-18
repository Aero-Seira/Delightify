import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerAllHandlers } from './ipc';
import { appPaths } from './services/paths';
import { createGlobalDbClient, closeAllConnections, schema } from './services/database';

const isDev = process.env.NODE_ENV === 'development';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
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
