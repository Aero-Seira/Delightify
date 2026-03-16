#!/usr/bin/env node
/**
 * 打包前将 @delightify/shared 复制到 main 的 node_modules 中
 * 解决 electron-builder 打包时找不到 workspace 依赖的问题
 */

const fs = require('fs');
const path = require('path');

// 路径配置
const mainDir = path.resolve(__dirname, '..');
const sharedDir = path.resolve(mainDir, '../shared');
const sharedSrc = path.join(sharedDir, 'dist');
const sharedPkg = path.join(sharedDir, 'package.json');
const sharedDestDir = path.resolve(mainDir, 'node_modules/@delightify/shared');
const sharedDest = path.join(sharedDestDir, 'dist');

console.log('[copy-shared] Starting...');

// 检查源目录是否存在
if (!fs.existsSync(sharedSrc)) {
  console.error(`[copy-shared] Error: Source directory not found: ${sharedSrc}`);
  console.error('[copy-shared] Please run "pnpm build" first to build the shared package.');
  process.exit(1);
}

// 检查 package.json 是否存在
if (!fs.existsSync(sharedPkg)) {
  console.error(`[copy-shared] Error: package.json not found: ${sharedPkg}`);
  process.exit(1);
}

// 创建目标目录
try {
  fs.mkdirSync(sharedDestDir, { recursive: true });
  console.log(`[copy-shared] Created directory: ${sharedDestDir}`);
} catch (err) {
  console.error(`[copy-shared] Error creating directory: ${err.message}`);
  process.exit(1);
}

// 复制 package.json
try {
  fs.copyFileSync(sharedPkg, path.join(sharedDestDir, 'package.json'));
  console.log(`[copy-shared] Copied package.json`);
} catch (err) {
  console.error(`[copy-shared] Error copying package.json: ${err.message}`);
  process.exit(1);
}

// 复制文件函数
function copyDir(src, dest) {
  // 如果目标已存在，先删除
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }

  // 创建新目录
  fs.mkdirSync(dest, { recursive: true });

  // 读取源目录
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 复制 dist 目录
try {
  copyDir(sharedSrc, sharedDest);
  console.log(`[copy-shared] Copied ${sharedSrc} -> ${sharedDest}`);
  console.log('[copy-shared] Done!');
} catch (err) {
  console.error(`[copy-shared] Error copying files: ${err.message}`);
  process.exit(1);
}
