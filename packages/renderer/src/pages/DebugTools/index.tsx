import React, { useState, useEffect } from 'react';
import { electronAPI } from '../../ipc';
import styles from './style.module.css';

interface TableInfo {
  name: string;
  rowCount: number;
}

interface CacheInfo {
  cacheDir: string;
  fileCount: number;
  totalSizeFormatted: string;
}

export default function DebugToolsPage(): React.ReactElement {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [dbPaths, setDbPaths] = useState<Record<string, string> | null>(null);
  const [queryResult, setQueryResult] = useState<unknown[] | null>(null);
  const [query, setQuery] = useState('SELECT * FROM items LIMIT 10');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 加载数据库信息
  const loadInfo = async () => {
    try {
      setLoading(true);
      const api = electronAPI();
      
      // 获取表信息
      const tablesRes = await api.debugDbTables();
      if (tablesRes.success) {
        setTables(tablesRes.data || []);
      }
      
      // 获取缓存信息
      const cacheRes = await api.debugCacheInfo();
      if (cacheRes.success) {
        setCacheInfo(cacheRes.data || null);
      }
      
      // 获取数据库路径
      const pathsRes = await api.debugDbPath();
      if (pathsRes.success) {
        setDbPaths(pathsRes.data || null);
      }
    } catch (err) {
      console.error('Failed to load debug info:', err);
      setMessage('加载失败: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
  }, []);

  // 执行查询
  const executeQuery = async () => {
    try {
      setLoading(true);
      const api = electronAPI();
      const result = await api.debugDbQuery(query);
      if (result.success) {
        setQueryResult(result.data || []);
        setMessage(null);
      } else {
        setMessage('查询失败: ' + result.error);
      }
    } catch (err) {
      setMessage('查询失败: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  // 删除模组
  const deleteMod = async (modId: string) => {
    if (!confirm(`确定要删除模组 "${modId}" 及其所有数据吗？`)) return;
    
    try {
      setLoading(true);
      const api = electronAPI();
      const result = await api.debugDbDeleteMod(modId);
      if (result.success) {
        setMessage(`已删除模组: ${modId}`);
        loadInfo();
      } else {
        setMessage('删除失败: ' + result.error);
      }
    } catch (err) {
      setMessage('删除失败: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  // 清空数据库
  const clearAll = async () => {
    if (!confirm('⚠️ 危险操作！\n\n确定要清空整个数据库吗？\n所有数据（模组、物品、配方、材质）都将被删除！')) return;
    if (!confirm('再次确认：真的要清空所有数据吗？此操作不可恢复！')) return;
    
    try {
      setLoading(true);
      const api = electronAPI();
      const result = await api.debugDbClearAll();
      if (result.success) {
        setMessage('数据库已清空');
        setQueryResult(null);
        loadInfo();
      } else {
        setMessage('清空失败: ' + result.error);
      }
    } catch (err) {
      setMessage('清空失败: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>数据库管理工具</h1>
      
      {message && (
        <div className={styles.message}>
          {message}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* 数据库路径 */}
      <section className={styles.section}>
        <h2>数据库路径</h2>
        {dbPaths && (
          <div className={styles.pathList}>
            <div className={styles.pathItem}>
              <span className={styles.pathLabel}>Global DB:</span>
              <code className={styles.pathValue}>{dbPaths.globalDb}</code>
            </div>
            <div className={styles.pathItem}>
              <span className={styles.pathLabel}>Texture Cache:</span>
              <code className={styles.pathValue}>{dbPaths.textureCache}</code>
            </div>
          </div>
        )}
      </section>

      {/* 表统计 */}
      <section className={styles.section}>
        <h2>数据表统计</h2>
        <div className={styles.tableGrid}>
          {tables.map(table => (
            <div key={table.name} className={styles.tableCard}>
              <span className={styles.tableName}>{table.name}</span>
              <span className={styles.tableCount}>{table.rowCount} 行</span>
            </div>
          ))}
        </div>
      </section>

      {/* 缓存信息 */}
      <section className={styles.section}>
        <h2>材质缓存</h2>
        {cacheInfo && (
          <div className={styles.cacheCard}>
            <div className={styles.cacheStat}>
              <span className={styles.cacheLabel}>文件数量:</span>
              <span className={styles.cacheValue}>{cacheInfo.fileCount}</span>
            </div>
            <div className={styles.cacheStat}>
              <span className={styles.cacheLabel}>总大小:</span>
              <span className={styles.cacheValue}>{cacheInfo.totalSizeFormatted}</span>
            </div>
          </div>
        )}
      </section>

      {/* 查询工具 */}
      <section className={styles.section}>
        <h2>SQL 查询工具</h2>
        <div className={styles.queryBox}>
          <textarea
            className={styles.queryInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            placeholder="输入 SELECT 查询..."
          />
          <button 
            className={styles.queryBtn}
            onClick={executeQuery}
            disabled={loading}
          >
            执行查询
          </button>
        </div>
        
        {queryResult && (
          <div className={styles.resultBox}>
            <h3>查询结果 ({queryResult.length} 行)</h3>
            <pre className={styles.resultPre}>
              {JSON.stringify(queryResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* 危险操作 */}
      <section className={styles.section}>
        <h2 className={styles.dangerTitle}>⚠️ 危险操作</h2>
        <div className={styles.dangerZone}>
          <button 
            className={styles.clearBtn}
            onClick={clearAll}
            disabled={loading}
          >
            🗑️ 清空整个数据库
          </button>
          <p className={styles.warning}>
            此操作将删除所有数据，包括模组、物品、配方和材质缓存。
          </p>
        </div>
      </section>

      {/* 刷新按钮 */}
      <button 
        className={styles.refreshBtn}
        onClick={loadInfo}
        disabled={loading}
      >
        {loading ? '加载中...' : '🔄 刷新信息'}
      </button>
    </div>
  );
}
