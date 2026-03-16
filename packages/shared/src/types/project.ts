/**
 * Project types for Delightify
 */

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  mcVersion?: string;
  loader?: 'forge' | 'fabric' | 'neoforge' | 'quilt';
}

export interface CreateProjectData {
  name: string;
  path: string;
  mcVersion?: string;
  loader?: 'forge' | 'fabric' | 'neoforge' | 'quilt';
}

export interface ProjectListResult {
  success: boolean;
  data?: Project[];
  error?: string;
}

export interface ProjectResult {
  success: boolean;
  data?: Project | null;
  error?: string;
}
