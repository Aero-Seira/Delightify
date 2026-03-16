import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '@delightify/shared';
import type { Project, CreateProjectData, ProjectListResult, ProjectResult } from '@delightify/shared';
import { appPaths } from '../services/paths';
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import * as path from 'path';

// In-memory storage for current project
let currentProject: Project | null = null;

/**
 * Read projects from projects.json
 */
async function readProjects(): Promise<Project[]> {
  try {
    await access(appPaths.projectsJson);
    const content = await readFile(appPaths.projectsJson, 'utf-8');
    const projects = JSON.parse(content) as Project[];
    return Array.isArray(projects) ? projects : [];
  } catch {
    return [];
  }
}

/**
 * Write projects to projects.json
 */
async function writeProjects(projects: Project[]): Promise<void> {
  await writeFile(appPaths.projectsJson, JSON.stringify(projects, null, 2), 'utf-8');
}

/**
 * Generate unique project ID
 */
function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function registerProjectHandlers(): void {
  // PROJECT_LIST: Return list of registered projects from projects.json
  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async (): Promise<ProjectListResult> => {
    try {
      const projects = await readProjects();
      return { success: true, data: projects };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to read projects';
      console.error('PROJECT_LIST error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // PROJECT_OPEN: Open dialog to select modpack directory
  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async (): Promise<ProjectResult> => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select modpack root directory',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      const selectedPath = result.filePaths[0];
      const projects = await readProjects();
      
      // Check if project already exists at this path
      const existingProject = projects.find(p => p.path === selectedPath);
      if (existingProject) {
        currentProject = existingProject;
        return { success: true, data: existingProject };
      }

      // Create new project entry for selected directory
      const projectName = path.basename(selectedPath);
      const newProject: Project = {
        id: generateProjectId(),
        name: projectName,
        path: selectedPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      projects.push(newProject);
      await writeProjects(projects);
      currentProject = newProject;

      return { success: true, data: newProject };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open project';
      console.error('PROJECT_OPEN error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // PROJECT_CREATE: Create a new project at specified directory
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, data: CreateProjectData): Promise<ProjectResult> => {
    try {
      const { name, path: projectPath, mcVersion, loader } = data;

      if (!name || !projectPath) {
        return { success: false, error: 'Project name and path are required' };
      }

      // Ensure project directory exists
      try {
        await access(projectPath);
      } catch {
        // Create directory if it doesn't exist
        await mkdir(projectPath, { recursive: true });
      }

      const projects = await readProjects();

      // Check if project already exists at this path
      if (projects.some(p => p.path === projectPath)) {
        return { success: false, error: 'A project already exists at this path' };
      }

      const newProject: Project = {
        id: generateProjectId(),
        name,
        path: projectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mcVersion,
        loader,
      };

      projects.push(newProject);
      await writeProjects(projects);
      currentProject = newProject;

      return { success: true, data: newProject };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create project';
      console.error('PROJECT_CREATE error:', error);
      return { success: false, error: errorMessage };
    }
  });

  // PROJECT_GET_CURRENT: Return the currently active project
  ipcMain.handle(IPC_CHANNELS.PROJECT_GET_CURRENT, async (): Promise<ProjectResult> => {
    try {
      return { success: true, data: currentProject };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get current project';
      console.error('PROJECT_GET_CURRENT error:', error);
      return { success: false, error: errorMessage };
    }
  });
}
