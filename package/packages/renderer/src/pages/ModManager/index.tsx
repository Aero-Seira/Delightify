import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

// 本地定义 Mod 类型以避免导入问题
interface Mod {
  modId: string;
  modName: string;
  version?: string;
  mcVersion?: string;
  sourceType: 'builtin' | 'jar' | 'manual';
  jarPath?: string;
  parsedAt?: string;
  itemCount: number;
  recipeCount: number;
}

// 安全地获取 electronAPI
function getElectronAPI() {
  if (typeof window === 'undefined') {
    return null;
  }
  const api = (window as unknown as { electronAPI?: unknown }).electronAPI;
  if (!api) {
    return null;
  }
  return api as {
    jarList: () => Promise<{ success: boolean; data?: Mod[]; error?: string }>;
    jarSelect: () => Promise<{ success: boolean; data?: string | null; error?: string }>;
    jarImport: (filePath: string) => Promise<{ success: boolean; data?: { modId: string; modName: string; itemCount: number; recipeCount: number; tagCount: number; textureCount: number }; error?: string }>;
    jarDelete: (modId: string) => Promise<{ success: boolean; data?: boolean; error?: string }>;
    onJarImportProgress: (callback: (progress: { step: string; percent: number; filePath: string; currentFile?: string; processedCount?: number; totalCount?: number; error?: string }) => void) => () => void;
  };
}

export default function ModManagerPage(): React.ReactElement {
  const { t } = useI18n();
  const [mods, setMods] = useState<Mod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    step: string;
    percent: number;
    currentFile?: string;
    processedCount?: number;
    totalCount?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 检查是否在 Electron 环境中
  const isElectron = typeof window !== 'undefined' && !!(window as unknown as { electronAPI?: unknown }).electronAPI;

  // 加载模组列表
  const loadMods = useCallback(async () => {
    const api = getElectronAPI();
    if (!api) {
      setError('Electron API not available. Please run this app in Electron.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const result = await api.jarList();
      
      if (result.success && result.data) {
        setMods(result.data);
      } else {
        setError(result.error || 'Failed to load mods');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    if (isElectron) {
      loadMods();
    }
  }, [loadMods, isElectron]);

  // 订阅导入进度
  useEffect(() => {
    if (!isElectron) return;

    const api = getElectronAPI();
    if (!api) return;

    unsubscribeRef.current = api.onJarImportProgress((progress) => {
      setImportProgress({
        step: progress.step,
        percent: progress.percent,
        currentFile: progress.currentFile,
        processedCount: progress.processedCount,
        totalCount: progress.totalCount,
      });
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [isElectron]);

  // 选择并导入 JAR 文件
  const handleImportJar = async () => {
    const api = getElectronAPI();
    if (!api) {
      setError('Electron API not available');
      return;
    }

    try {
      setIsImporting(true);
      setError(null);
      setImportProgress({ step: 'reading', percent: 0 });

      const selectResult = await api.jarSelect();
      
      if (!selectResult.success) {
        setError(selectResult.error || 'Failed to select file');
        setIsImporting(false);
        setImportProgress(null);
        return;
      }

      const filePath = selectResult.data;
      if (!filePath) {
        // 用户取消了选择
        setIsImporting(false);
        setImportProgress(null);
        return;
      }

      // 开始导入
      const importResult = await api.jarImport(filePath);
      
      if (importResult.success && importResult.data) {
        // 导入成功，刷新列表
        await loadMods();
      } else {
        setError(importResult.error || 'Failed to import JAR');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error during import');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  // 删除模组
  const handleDeleteMod = async (modId: string, modName: string) => {
    const api = getElectronAPI();
    if (!api) {
      setError('Electron API not available');
      return;
    }

    // 使用简单的确认对话框
    const confirmed = typeof window !== 'undefined' && window.confirm 
      ? window.confirm(`确定要删除模组 "${modName}" 吗？相关的物品和配方数据也会被删除。`)
      : true;
    
    if (!confirmed) {
      return;
    }

    try {
      setIsLoading(true);
      const result = await api.jarDelete(modId);
      
      if (result.success) {
        await loadMods();
      } else {
        setError(result.error || 'Failed to delete mod');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // 获取进度条阶段显示文本
  const getProgressLabel = (step: string): string => {
    const labels: Record<string, string> = {
      reading: '读取 JAR 文件...',
      parsing_lang: '解析语言文件...',
      parsing_tags: '解析物品标签...',
      parsing_recipes: '解析配方...',
      extracting_textures: '提取材质...',
      saving: '保存到数据库...',
      completed: '导入完成！',
      error: '导入出错',
    };
    return labels[step] || step;
  };

  // 如果不是在 Electron 环境中，显示提示
  if (!isElectron) {
    return (
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>模组管理</h1>
          <p className={styles.description}>导入和管理 Minecraft 模组 JAR 文件</p>
        </div>
        <div className={styles.errorMessage}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          请在 Electron 应用中打开此页面。当前运行在浏览器模式中，无法访问系统功能。
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('modManager.title')}</h1>
        <p className={styles.description}>{t('modManager.description')}</p>
      </div>
      
      <div className={styles.content}>
        <div className={styles.actionBar}>
          <span className={styles.actionBarTitle}>
            {t('modManager.jarList')} ({mods.length})
          </span>
          <button 
            className={styles.importButton}
            onClick={handleImportJar}
            disabled={isImporting || isLoading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            {isImporting ? '导入中...' : t('modManager.importJar')}
          </button>
        </div>

        {/* 导入进度显示 */}
        {isImporting && importProgress && (
          <div className={styles.progressContainer}>
            <div className={styles.progressInfo}>
              <span className={styles.progressLabel}>
                {getProgressLabel(importProgress.step)}
              </span>
              <span className={styles.progressPercent}>
                {importProgress.percent}%
              </span>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${importProgress.percent}%` }}
              />
            </div>
            {importProgress.currentFile && (
              <div className={styles.progressFile}>
                {importProgress.currentFile}
              </div>
            )}
            {importProgress.processedCount !== undefined && importProgress.totalCount !== undefined && (
              <div className={styles.progressCount}>
                {importProgress.processedCount} / {importProgress.totalCount}
              </div>
            )}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className={styles.errorMessage}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
            <button 
              className={styles.closeError}
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        )}

        {/* 模组列表 */}
        <div className={styles.modList}>
          {isLoading && mods.length === 0 ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <span>加载中...</span>
            </div>
          ) : mods.length === 0 ? (
            <div className={styles.emptyState}>
              <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              <p className={styles.emptyText}>暂无导入的模组</p>
              <p className={styles.emptyHint}>点击上方按钮导入 Minecraft 模组 JAR 文件</p>
            </div>
          ) : (
            mods.map((mod) => (
              <div key={mod.modId} className={styles.modCard}>
                <div className={styles.modInfo}>
                  <div className={styles.modHeader}>
                    <h3 className={styles.modName}>{mod.modName}</h3>
                    <span className={styles.modId}>{mod.modId}</span>
                  </div>
                  <div className={styles.modMeta}>
                    {mod.version && (
                      <span className={styles.modVersion}>v{mod.version}</span>
                    )}
                    {mod.mcVersion && (
                      <span className={styles.mcVersion}>MC {mod.mcVersion}</span>
                    )}
                  </div>
                  <div className={styles.modStats}>
                    <span className={styles.stat}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="9" y1="9" x2="15" y2="9" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                      {mod.itemCount} 物品
                    </span>
                    <span className={styles.stat}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      {mod.recipeCount} 配方
                    </span>
                  </div>
                </div>
                <div className={styles.modActions}>
                  <button 
                    className={styles.deleteButton}
                    onClick={() => handleDeleteMod(mod.modId, mod.modName)}
                    disabled={isLoading}
                    title="删除"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
