/**
 * Recipe Browser - 配方浏览器
 * 
 * M3 核心功能：
 * - 按配方类型分组浏览
 * - 搜索配方
 * - 查看配方详情
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Recipe, RecipeTypeMetadata } from '@delightify/shared';
import { useProjectStore } from '../../store/projectStore';
import { electronAPI } from '../../ipc';
import styles from './style.module.css';

interface RecipeQueryParams {
  search?: string;
  typeId?: string;
  modid?: string;
  page?: number;
  pageSize?: number;
}

export default function RecipeBrowser(): React.ReactElement {
  const { currentProject } = useProjectStore();
  
  // 数据状态
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [recipeTypes, setRecipeTypes] = useState<RecipeTypeMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 筛选状态
  const [params, setParams] = useState<RecipeQueryParams>({
    page: 1,
    pageSize: 50,
  });
  
  // 加载配方列表
  const loadRecipes = useCallback(async () => {
    if (!currentProject) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const api = electronAPI();
      const result = await api.recipesQuery(currentProject.path, {
        search: params.search,
        typeId: params.typeId,
        modid: params.modid,
        page: params.page,
        pageSize: params.pageSize,
      });
      
      if (result.success && result.data) {
        setRecipes(result.data.recipes);
        setTotalCount(result.data.total);
      } else {
        setError(result.error || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, params]);
  
  // 加载配方类型
  const loadRecipeTypes = useCallback(async () => {
    try {
      const api = electronAPI();
      const result = await api.recipeTypesGetAll();
      
      if (result.success && result.data) {
        setRecipeTypes(result.data);
      }
    } catch {
      // 静默失败
    }
  }, []);
  
  // 初始化加载
  useEffect(() => {
    loadRecipes();
    loadRecipeTypes();
  }, [loadRecipes, loadRecipeTypes]);
  
  if (!currentProject) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>请先打开一个项目</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.container}>
      {/* 工具栏 */}
      <div className={styles.toolbar}>
        <h1 className={styles.title}>配方浏览器</h1>
        
        {/* 搜索框 */}
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="搜索配方..."
            value={params.search || ''}
            onChange={(e) => setParams(prev => ({ ...prev, search: e.target.value, page: 1 }))}
          />
        </div>
        
        {/* 配方类型筛选 */}
        <select
          value={params.typeId || ''}
          onChange={(e) => setParams(prev => ({ ...prev, typeId: e.target.value || undefined, page: 1 }))}
        >
          <option value="">所有类型</option>
          {recipeTypes.map(rt => (
            <option key={rt.recipeTypeId} value={rt.recipeTypeId}>
              {rt.displayName}
            </option>
          ))}
        </select>
      </div>
      
      {/* 统计信息 */}
      <div className={styles.stats}>
        共 {totalCount} 个配方
        {params.typeId && (
          <span className={styles.filterTag}>
            类型: {recipeTypes.find(rt => rt.recipeTypeId === params.typeId)?.displayName}
          </span>
        )}
      </div>
      
      {/* 配方列表 */}
      <div className={styles.recipeList}>
        {isLoading ? (
          <div className={styles.loading}>加载中...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : recipes.length === 0 ? (
          <div className={styles.empty}>暂无配方</div>
        ) : (
          recipes.map(recipe => (
            <div key={recipe.recipeId} className={styles.recipeCard}>
              <div className={styles.recipeHeader}>
                <span className={styles.recipeId}>{recipe.recipeId}</span>
                <span className={styles.recipeType}>
                  {recipeTypes.find(rt => rt.recipeTypeId === recipe.typeId)?.displayName || recipe.typeId}
                </span>
              </div>
              <div className={styles.recipeMod}>{recipe.modid}</div>
              {recipe.rawJson && (
                <pre className={styles.recipeJson}>
                  {JSON.stringify(JSON.parse(recipe.rawJson), null, 2).slice(0, 200)}...
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
