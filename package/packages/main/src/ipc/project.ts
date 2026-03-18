/**
 * Project IPC Handlers - 项目相关的 IPC 处理器
 * 处理项目管理相关的所有主进程操作
 */

import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { 
  Project, 
  CreateProjectData, 
  UpdateProjectData,
  ProjectListResult, 
  ProjectResult,
  ProjectDeleteResult,
  ModLoader
} from '@delightify/shared';
import { appPaths } from '../services/paths';
import { readFile, writeFile, access, mkdir, rm } from 'fs/promises';
import * as path from 'path';

// 内存中存储当前项目
let currentProject: Project | null = null;

/**
 * 从 projects.json 读取项目列表
 */
async function readProjects(): Promise<Project[]> {
  try {
    await access(appPaths.projectsJson);
    const content = await readFile(appPaths.projectsJson, 'utf-8');
    const data = JSON.parse(content);
    // 支持两种格式: 直接数组或 { projects: [] } 包装
    const projects = Array.isArray(data) ? data : data.projects;
    return Array.isArray(projects) ? projects : [];
  } catch {
    return [];
  }
}

/**
 * 写入项目列表到 projects.json
 */
async function writeProjects(projects: Project[]): Promise<void> {
  await mkdir(path.dirname(appPaths.projectsJson), { recursive: true });
  await writeFile(
    appPaths.projectsJson, 
    JSON.stringify({ projects }, null, 2), 
    'utf-8'
  );
}

/**
 * 生成唯一项目 ID
 */
function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 验证 Minecraft 版本格式
 */
function validateMcVersion(version: string): boolean {
  // 支持 1.16.5, 1.18.2, 1.19.2, 1.20.1 等格式
  return /^1\.\d+(\.\d+)?$/.test(version);
}

/**
 * 探测模组加载器版本（基于目录结构启发式）
 */
async function detectModLoader(projectPath: string): Promise<{ modLoader?: ModLoader; modLoaderVersion?: string }> {
  try {
    const files = await readFile(path.join(projectPath, 'mods'), 'utf-8').catch(() => null);
    
    // 检查 version.json（Forge/Fabric 安装器生成）
    const versionJsonPath = path.join(projectPath, 'version.json');
    try {
      const versionContent = await readFile(versionJsonPath, 'utf-8');
      const versionData = JSON.parse(versionContent);
      if (versionData.id) {
        if (versionData.id.includes('forge')) {
          const match = versionData.id.match(/forge-([\d.]+)/);
          return { modLoader: 'forge', modLoaderVersion: match?.[1] };
        }
        if (versionData.id.includes('fabric')) {
          return { modLoader: 'fabric' };
        }
        if (versionData.id.includes('neoforge')) {
          return { modLoader: 'neoforge' };
        }
      }
    } catch {
      // 忽略读取错误
    }
    
    // 检查 mods 目录特征
    const modsPath = path.join(projectPath, 'mods');
    try {
      await access(modsPath);
      // 进一步检查可以通过扫描 JAR 文件
    } catch {
      // 目录不存在
    }
    
    return {};
  } catch {
    return {};
  }
}

/**
 * 统计项目数据（模组、物品、配方数量）
 * 这是一个异步操作，会触发数据库查询
 */
async function updateProjectStats(projectPath: string): Promise<{ totalMods: number; totalItems: number; totalRecipes: number }> {
  // TODO: 实现实际的数据库统计
  // 这里先返回 0，后续通过数据库服务实现
  return { totalMods: 0, totalItems: 0, totalRecipes: 0 };
}

/**
 * 注册项目相关的 IPC 处理器
 */
export function registerProjectHandlers(): void {
  // ========== PROJECT_LIST: 获取项目列表 ==========
  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async (): Promise<ProjectListResult> => {
    try {
      const projects = await readProjects();
      return { success: true, data: projects, total: projects.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '读取项目列表失败';
      console.error('PROJECT_LIST 错误:', error);
      return { success: false, error: errorMessage };
    }
  });

  // ========== PROJECT_OPEN: 打开/选择项目目录 ==========
  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async (_event, projectId?: string): Promise<ProjectResult & { canceled?: boolean }> => {
    try {
      // 如果提供了 projectId，直接打开已有项目
      if (projectId) {
        const projects = await readProjects();
        const project = projects.find(p => p.id === projectId);
        
        if (!project) {
          return { success: false, error: '项目不存在' };
        }
        
        // 更新最后打开时间
        project.lastOpenedAt = new Date().toISOString();
        await writeProjects(projects);
        
        currentProject = project;
        return { success: true, data: project };
      }
      
      // 否则显示目录选择对话框
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择 Minecraft 整合包目录',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true, data: null };
      }

      const selectedPath = result.filePaths[0];
      const projects = await readProjects();
      
      // 检查该路径是否已有项目
      const existingProject = projects.find(p => p.path === selectedPath);
      if (existingProject) {
        existingProject.lastOpenedAt = new Date().toISOString();
        await writeProjects(projects);
        currentProject = existingProject;
        return { success: true, data: existingProject };
      }

      return { success: true, data: null, error: '该目录尚未创建项目，请先创建项目' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '打开项目失败';
      console.error('PROJECT_OPEN 错误:', error);
      return { success: false, error: errorMessage };
    }
  });

  // ========== PROJECT_CREATE: 创建新项目 ==========
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, data: CreateProjectData): Promise<ProjectResult> => {
    try {
      const { name, path: projectPath, mcVersion, modLoader, modLoaderVersion, description } = data;

      // 验证必要参数
      if (!name?.trim()) {
        return { success: false, error: '项目名称不能为空' };
      }
      
      if (!projectPath?.trim()) {
        return { success: false, error: '项目路径不能为空' };
      }

      if (!mcVersion?.trim()) {
        return { success: false, error: 'Minecraft 版本不能为空' };
      }

      if (!validateMcVersion(mcVersion)) {
        return { success: false, error: 'Minecraft 版本格式无效（例如：1.20.1）' };
      }

      if (!modLoader) {
        return { success: false, error: '请选择模组加载器' };
      }

      // 确保项目目录存在
      try {
        await access(projectPath);
      } catch {
        // 目录不存在则创建
        await mkdir(projectPath, { recursive: true });
      }

      const projects = await readProjects();

      // 检查路径是否已存在项目
      if (projects.some(p => p.path === projectPath)) {
        return { success: false, error: '该路径已存在项目' };
      }

      // 检查项目名称是否重复
      if (projects.some(p => p.name === name)) {
        return { success: false, error: '项目名称已存在' };
      }

      // 创建 Delightify 项目目录结构
      const delightifyDir = path.join(projectPath, '.delightify');
      await mkdir(delightifyDir, { recursive: true });

      // 创建项目数据库目录（后续初始化数据库）
      const projectDbPath = appPaths.projectDb(projectPath);
      await mkdir(path.dirname(projectDbPath), { recursive: true });

      // 尝试自动探测模组加载器版本
      let detectedLoaderVersion = modLoaderVersion;
      if (!detectedLoaderVersion) {
        const detected = await detectModLoader(projectPath);
        detectedLoaderVersion = detected.modLoaderVersion;
      }

      // 创建项目对象
      const now = new Date().toISOString();
      const newProject: Project = {
        id: generateProjectId(),
        name: name.trim(),
        description: description?.trim() || '',
        path: projectPath,
        mcVersion: mcVersion.trim(),
        modLoader,
        modLoaderVersion: detectedLoaderVersion,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        isFavorite: false,
        totalMods: 0,
        totalItems: 0,
        totalRecipes: 0,
      };

      projects.push(newProject);
      await writeProjects(projects);
      
      currentProject = newProject;

      console.log(`项目创建成功: ${newProject.name} (${newProject.id})`);
      return { success: true, data: newProject };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建项目失败';
      console.error('PROJECT_CREATE 错误:', error);
      return { success: false, error: errorMessage };
    }
  });

  // ========== PROJECT_UPDATE: 更新项目 ==========
  ipcMain.handle('project:update', async (_event, projectId: string, data: UpdateProjectData): Promise<ProjectResult> => {
    try {
      const projects = await readProjects();
      const projectIndex = projects.findIndex(p => p.id === projectId);
      
      if (projectIndex === -1) {
        return { success: false, error: '项目不存在' };
      }

      const project = projects[projectIndex];

      // 检查新名称是否与其他项目重复
      if (data.name && data.name !== project.name) {
        if (projects.some(p => p.name === data.name && p.id !== projectId)) {
          return { success: false, error: '项目名称已存在' };
        }
      }

      // 更新字段
      const updatedProject: Project = {
        ...project,
        ...(data.name && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description.trim() }),
        ...(data.mcVersion && { mcVersion: data.mcVersion.trim() }),
        ...(data.modLoader && { modLoader: data.modLoader }),
        ...(data.modLoaderVersion !== undefined && { modLoaderVersion: data.modLoaderVersion }),
        ...(data.isFavorite !== undefined && { isFavorite: data.isFavorite }),
        ...(data.icon !== undefined && { icon: data.icon }),
        updatedAt: new Date().toISOString(),
      };

      projects[projectIndex] = updatedProject;
      await writeProjects(projects);

      // 如果更新的是当前项目，同步更新内存中的对象
      if (currentProject?.id === projectId) {
        currentProject = updatedProject;
      }

      console.log(`项目更新成功: ${updatedProject.name} (${updatedProject.id})`);
      return { success: true, data: updatedProject };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新项目失败';
      console.error('PROJECT_UPDATE 错误:', error);
      return { success: false, error: errorMessage };
    }
  });

  // ========== PROJECT_DELETE: 删除项目 ==========
  ipcMain.handle('project:delete', async (_event, projectId: string): Promise<ProjectDeleteResult> => {
    try {
      const projects = await readProjects();
      const projectIndex = projects.findIndex(p => p.id === projectId);
      
      if (projectIndex === -1) {
        return { success: false, error: '项目不存在' };
      }

      const project = projects[projectIndex];

      // 从列表中移除
      projects.splice(projectIndex, 1);
      await writeProjects(projects);

      // 如果删除的是当前项目，清空当前项目
      if (currentProject?.id === projectId) {
        currentProject = null;
      }

      // 可选：删除项目目录中的 .delightify 文件夹
      // 注意：这里只删除配置，不删除整合包本身
      try {
        const delightifyDir = path.join(project.path, '.delightify');
        await rm(delightifyDir, { recursive: true, force: true });
        console.log(`已删除项目配置目录: ${delightifyDir}`);
      } catch {
        // 忽略删除错误
      }

      console.log(`项目删除成功: ${project.name} (${project.id})`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除项目失败';
      console.error('PROJECT_DELETE 错误:', error);
      return { success: false, error: errorMessage };
    }
  });

  // ========== PROJECT_GET_CURRENT: 获取当前项目 ==========
  ipcMain.handle(IPC_CHANNELS.PROJECT_GET_CURRENT, async (): Promise<ProjectResult> => {
    try {
      return { success: true, data: currentProject };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取当前项目失败';
      console.error('PROJECT_GET_CURRENT 错误:', error);
      return { success: false, error: errorMessage };
    }
  });

  // ========== 额外的辅助 IPC 处理器 ==========
  
  // 选择目录对话框（用于创建项目时的路径选择）
  ipcMain.handle('project:select-directory', async (): Promise<{ canceled: boolean; filePaths?: string[] }> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择项目目录',
    });
    return {
      canceled: result.canceled,
      filePaths: result.filePaths,
    };
  });
}
