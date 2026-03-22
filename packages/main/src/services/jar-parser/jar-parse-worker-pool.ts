/**
 * JAR 解析 Worker 池
 * 
 * 管理 Worker 线程池，提供并行 JAR 解析能力
 */

import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';
import type { JarParseResult, JarParseProgress, ParserOptions } from './types';

interface WorkerTask {
  filePath: string;
  cacheDir: string;
  options: ParserOptions;
  onProgress: (progress: JarParseProgress) => void;
  resolve: (result: JarParseResult) => void;
  reject: (error: Error) => void;
}

/**
 * 获取 Worker 文件路径
 * 根据环境自动选择 .ts 或 .js 文件
 */
function getWorkerPath(): string {
  // 检查是否在开发模式
  // 1. 检查 NODE_ENV
  // 2. 检查源代码目录是否存在
  const isDev = process.env.NODE_ENV === 'development' || 
                fs.existsSync(path.join(__dirname, '../../src'));
  
  if (isDev) {
    // 开发模式：使用 TypeScript 文件，通过 tsx 运行
    const tsPath = path.join(__dirname, '../src/services/jar-parser/jar-parse-worker.ts');
    if (fs.existsSync(tsPath)) {
      return tsPath;
    }
    // 备选路径
    const altTsPath = path.join(__dirname, '../../src/services/jar-parser/jar-parse-worker.ts');
    if (fs.existsSync(altTsPath)) {
      return altTsPath;
    }
  }
  
  // 生产模式：使用编译后的 JavaScript 文件
  const jsPath = path.join(__dirname, 'jar-parse-worker.js');
  if (fs.existsSync(jsPath)) {
    return jsPath;
  }
  
  // 默认返回 TypeScript 路径（开发模式回退）
  return path.join(__dirname, 'jar-parse-worker.ts');
}

/**
 * 使用 Worker 解析单个 JAR 文件
 * 
 * @param filePath JAR 文件路径
 * @param cacheDir 纹理缓存目录
 * @param options 解析选项
 * @param onProgress 进度回调
 * @returns 解析结果
 */
export function parseJarWithWorker(
  filePath: string,
  cacheDir: string,
  options: ParserOptions,
  onProgress?: (progress: JarParseProgress) => void
): Promise<JarParseResult> {
  return new Promise((resolve, reject) => {
    const workerPath = getWorkerPath();
    const isDev = workerPath.endsWith('.ts');
    
    console.log(`[Worker] Starting JAR parse worker: ${workerPath} (dev mode: ${isDev})`);
    
    // 创建 Worker
    const workerOptions: import('worker_threads').WorkerOptions = {
      workerData: {
        filePath,
        cacheDir,
        options,
      },
    };
    
    // 开发模式下使用 tsx 加载 TypeScript
    if (isDev) {
      workerOptions.execArgv = ['-r', 'tsx'];
    }
    
    const worker = new Worker(workerPath, workerOptions);

    // 处理消息
    worker.on('message', (message: { type: string; progress?: JarParseProgress; result?: JarParseResult; error?: string }) => {
      switch (message.type) {
        case 'progress':
          if (message.progress && onProgress) {
            onProgress(message.progress);
          }
          break;
        case 'result':
          if (message.result) {
            console.log(`[Worker] JAR parse completed: ${message.result.modInfo.modId}`);
            resolve(message.result);
            worker.terminate().catch(() => {});
          }
          break;
        case 'error':
          reject(new Error(message.error || 'Worker error'));
          worker.terminate().catch(() => {});
          break;
      }
    });

    // 处理错误
    worker.on('error', (error) => {
      console.error('[Worker] Worker error:', error);
      reject(error);
      worker.terminate().catch(() => {});
    });

    // 处理退出
    worker.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });

    // 设置超时（5分钟）
    setTimeout(() => {
      reject(new Error('Worker timeout'));
      worker.terminate().catch(() => {});
    }, 5 * 60 * 1000);
  });
}

/**
 * 并行解析多个 JAR 文件
 * 
 * @param filePaths JAR 文件路径列表
 * @param cacheDir 纹理缓存目录
 * @param options 解析选项
 * @param onProgress 进度回调（每个文件）
 * @returns 解析结果列表
 */
export async function parseMultipleJarsWithWorkers(
  filePaths: string[],
  cacheDir: string,
  options: ParserOptions,
  onProgress?: (filePath: string, progress: JarParseProgress) => void
): Promise<Array<{ filePath: string; result?: JarParseResult; error?: string }>> {
  // 限制并发数，避免过多 Worker 同时运行
  const maxConcurrency = Math.min(4, filePaths.length);
  const results: Array<{ filePath: string; result?: JarParseResult; error?: string }> = [];
  
  // 创建任务队列
  const queue = [...filePaths];
  const running: Promise<void>[] = [];

  async function processNext(filePath: string): Promise<void> {
    try {
      const result = await parseJarWithWorker(
        filePath,
        cacheDir,
        options,
        (progress) => onProgress?.(filePath, progress)
      );
      results.push({ filePath, result });
    } catch (error) {
      results.push({
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 处理队列中的下一个任务
    const next = queue.shift();
    if (next) {
      await processNext(next);
    }
  }

  // 启动初始批次
  const initialBatch = queue.splice(0, maxConcurrency);
  await Promise.all(initialBatch.map(processNext));

  return results;
}

/**
 * 检查是否支持 Worker
 */
export function isWorkerSupported(): boolean {
  try {
    // Worker Threads 在 Node.js 10.5.0+ 可用，在 12+ 默认启用
    require('worker_threads');
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取 Worker 状态信息（用于调试）
 */
export function getWorkerInfo(): {
  supported: boolean;
  workerPath: string;
  isDev: boolean;
} {
  const workerPath = getWorkerPath();
  return {
    supported: isWorkerSupported(),
    workerPath,
    isDev: workerPath.endsWith('.ts'),
  };
}
