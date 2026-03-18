/**
 * ZIP 文件读取器
 * 基于 adm-zip 封装，用于读取 JAR 文件内容
 */

import AdmZip from 'adm-zip';
import type { ZipReader, JarEntry } from './types';

/**
 * 使用 adm-zip 实现的 ZIP 读取器
 */
export class AdmZipReader implements ZipReader {
  private zip: AdmZip;

  constructor(filePath: string) {
    try {
      this.zip = new AdmZip(filePath);
    } catch (error) {
      throw new Error(`Failed to open JAR file: ${filePath}. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取 JAR 中的所有条目
   */
  getEntries(): JarEntry[] {
    const entries = this.zip.getEntries();
    return entries.map((entry) => ({
      entryName: entry.entryName,
      isDirectory: entry.isDirectory,
      size: entry.header.size,
      modTime: entry.header.time,
      getData: () => entry.getData(),
    }));
  }

  /**
   * 读取特定路径的文件内容
   * @param path 文件路径（在 JAR 内的路径）
   * @returns 文件内容 Buffer，如果不存在则返回 null
   */
  readFile(path: string): Buffer | null {
    const entry = this.zip.getEntry(path);
    if (!entry) {
      return null;
    }
    return entry.getData();
  }

  /**
   * 提取所有匹配指定模式的文件
   * @param pattern 正则表达式模式
   * @returns 匹配的文件内容数组
   */
  extractMatching(pattern: RegExp): Array<{ path: string; data: Buffer }> {
    const results: Array<{ path: string; data: Buffer }> = [];
    const entries = this.zip.getEntries();

    for (const entry of entries) {
      if (!entry.isDirectory && pattern.test(entry.entryName)) {
        results.push({
          path: entry.entryName,
          data: entry.getData(),
        });
      }
    }

    return results;
  }

  /**
   * 关闭读取器（adm-zip 不需要显式关闭，此方法用于接口兼容）
   */
  close(): void {
    // adm-zip 不需要显式关闭文件句柄
  }
}

/**
 * 创建 ZIP 读取器工厂函数
 */
export function createZipReader(filePath: string): ZipReader {
  return new AdmZipReader(filePath);
}

/**
 * 检查文件是否为有效的 ZIP/JAR 文件
 */
export function isValidZipFile(filePath: string): boolean {
  try {
    const zip = new AdmZip(filePath);
    // 尝试读取条目列表来验证文件完整性
    zip.getEntries();
    return true;
  } catch {
    return false;
  }
}

/**
 * 从 JAR 路径中提取模组 ID
 * 策略：
 * 1. 优先从 mods.toml 或 fabric.mod.json 中读取
 * 2. 回退到从文件名推断（去掉版本号）
 */
export function extractModIdFromJar(filePath: string): string | null {
  try {
    const zip = new AdmZip(filePath);

    // 尝试读取 Forge 的 mods.toml
    const modsToml = zip.readAsText('META-INF/mods.toml');
    if (modsToml) {
      const match = modsToml.match(/modId\s*=\s*"([^"]+)"/);
      if (match) {
        return match[1];
      }
    }

    // 尝试读取 Fabric 的 fabric.mod.json
    const fabricModJson = zip.readAsText('fabric.mod.json');
    if (fabricModJson) {
      try {
        const fabricMod = JSON.parse(fabricModJson);
        if (fabricMod.id) {
          return fabricMod.id;
        }
      } catch {
        // JSON 解析失败，继续尝试其他方法
      }
    }

    // 从文件名推断：去掉版本号和扩展名
    const fileName = filePath.split(/[\\/]/).pop() || '';
    // 匹配常见模式：modid-1.20.1-1.0.0.jar 或 modid-1.0.0.jar
    const nameMatch = fileName.match(/^([a-z0-9_]+)-/i);
    if (nameMatch) {
      return nameMatch[1].toLowerCase();
    }

    // 最后的回退：文件名（去掉扩展名）
    return fileName.replace(/\.jar$/i, '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  } catch {
    return null;
  }
}

/**
 * 从 JAR 中提取模组元信息
 */
export function extractModInfo(filePath: string): {
  modId: string;
  modName: string;
  version?: string;
  description?: string;
  mcVersion?: string;
} | null {
  try {
    const zip = new AdmZip(filePath);
    let modId: string | undefined;
    let modName: string | undefined;
    let version: string | undefined;
    let description: string | undefined;
    let mcVersion: string | undefined;

    // 尝试读取 Forge 的 mods.toml
    const modsToml = zip.readAsText('META-INF/mods.toml');
    if (modsToml) {
      // 解析 modId
      const modIdMatch = modsToml.match(/modId\s*=\s*"([^"]+)"/);
      if (modIdMatch) modId = modIdMatch[1];

      // 解析 displayName
      const nameMatch = modsToml.match(/displayName\s*=\s*"([^"]+)"/);
      if (nameMatch) modName = nameMatch[1];

      // 解析 version
      const versionMatch = modsToml.match(/version\s*=\s*"([^"]+)"/);
      if (versionMatch) version = versionMatch[1];

      // 解析 description
      const descMatch = modsToml.match(/description\s*=\s*"([^"]+)"/);
      if (descMatch) description = descMatch[1];

      // 解析 Minecraft 版本依赖
      const mcVersionMatch = modsToml.match(/minecraftVersion\s*=\s*"\[?([^\],\]]+)]?"/);
      if (mcVersionMatch) mcVersion = mcVersionMatch[1];
    }

    // 如果 Forge 元数据不完整，尝试 Fabric
    if (!modId || !modName) {
      const fabricModJson = zip.readAsText('fabric.mod.json');
      if (fabricModJson) {
        try {
          const fabricMod = JSON.parse(fabricModJson);
          modId = modId || fabricMod.id;
          modName = modName || fabricMod.name;
          version = version || fabricMod.version;
          description = description || fabricMod.description;

          // 从 depends 中提取 Minecraft 版本
          if (fabricMod.depends?.minecraft) {
            const mcDep = fabricMod.depends.minecraft;
            if (typeof mcDep === 'string') {
              const mcMatch = mcDep.match(/[\d.]+/);
              if (mcMatch) mcVersion = mcMatch[0];
            }
          }
        } catch {
          // JSON 解析失败
        }
      }
    }

    // 确保至少 modId 存在
    if (!modId) {
      modId = extractModIdFromJar(filePath) || 'unknown';
    }

    // 确保 modName 存在
    if (!modName) {
      modName = modId;
    }

    return {
      modId,
      modName,
      version,
      description,
      mcVersion,
    };
  } catch {
    return null;
  }
}
