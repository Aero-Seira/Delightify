#!/usr/bin/env node
/**
 * 打包前的完整准备脚本
 * 确保所有依赖都正确配置
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('[prepack] Starting pre-packaging checks...');

const mainDir = path.resolve(__dirname, '..');
const sharedDir = path.join(mainDir, '../shared');

// 1. 检查 shared 包是否已构建
const sharedDist = path.join(sharedDir, 'dist');
if (!fs.existsSync(sharedDist)) {
  console.error('[prepack] Error: @delightify/shared is not built!');
  console.error('[prepack] Building shared package...');
  
  try {
    execSync('pnpm --filter @delightify/shared build', {
      cwd: path.resolve(mainDir, '../..'),
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('[prepack] Failed to build shared package');
    process.exit(1);
  }
} else {
  console.log('[prepack] ✓ @delightify/shared is built');
}

// 2. 运行 copy-shared 脚本
console.log('[prepack] Copying shared package to node_modules...');
try {
  require('./copy-shared.js');
} catch (err) {
  console.error('[prepack] Failed to copy shared package:', err.message);
  process.exit(1);
}

// 3. 验证 copy-shared 结果
const copiedShared = path.join(mainDir, 'node_modules/@delightify/shared/dist');
if (!fs.existsSync(copiedShared)) {
  console.error('[prepack] Error: copy-shared did not complete successfully');
  process.exit(1);
}

// 4. 检查 better-sqlite3 是否存在
const betterSqlite3 = path.join(mainDir, 'node_modules/better-sqlite3');
if (!fs.existsSync(betterSqlite3)) {
  console.error('[prepack] Warning: better-sqlite3 not found in node_modules');
  console.error('[prepack] Please run "pnpm install" first');
  process.exit(1);
}

console.log('[prepack] ✓ All checks passed');
console.log('[prepack] Ready for packaging!');
