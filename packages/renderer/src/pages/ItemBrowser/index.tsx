import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Item } from '@delightify/shared';
import type { ItemCategory } from '../../components/CategoryLegend';
import ItemCard, { ItemListRow, ItemDetailCard } from '../../components/ItemCard';
import CategoryLegend from '../../components/CategoryLegend';
import { electronAPI } from '../../ipc';
import styles from './style.module.css';

interface QueryFilters {
  search: string;
  category: string;
  modId: string;
  tag: string;
  textureType: 'all' | 'item' | 'block' | 'unknown';
}

const ITEMS_PER_PAGE_OPTIONS = [20, 50, 100, 200];
const VIEW_MODES = ['grid', 'list', 'detail'] as const;
type ViewMode = typeof VIEW_MODES[number];

export default function ItemBrowser(): React.ReactElement {
  // 数据状态
  const [items, setItems] = useState<Item[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // 过滤状态
  const [filters, setFilters] = useState<QueryFilters>({
    search: '',
    category: '',
    modId: '',
    tag: '',
    textureType: 'all',
  });
  
  // 视图状态
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [itemSize, setItemSize] = useState(64);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  
  // 可用选项
  const [categories, setCategories] = useState<string[]>([]);
  const [mods, setMods] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // 加载物品数据
  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const api = electronAPI();
      const response = await api.itemsQuery({
        page: currentPage,
        pageSize,
        search: filters.search,
        category: filters.category,
        modId: filters.modId,
        tag: filters.tag,
        textureType: filters.textureType === 'all' ? undefined : filters.textureType,
      });
      
      if (response.success && response.data) {
        setItems(response.data.items as Item[]);
        setTotalCount(response.data.total);
      } else {
        setError(response.error || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, filters]);

  // 加载可用选项
  const loadOptions = useCallback(async () => {
    try {
      const api = electronAPI();
      const [catsResult, modsResult, tagsResult] = await Promise.all([
        api.itemsGetCategories(),
        api.modsQuery(),
        api.tagsQuery(),
      ]);
      
      if (catsResult.success && catsResult.data) {
        setCategories(catsResult.data.map(c => c.category));
      }
      
      if (modsResult.success && modsResult.data) {
        setMods(modsResult.data.map(m => m.modId));
      }
      
      if (tagsResult.success && tagsResult.data) {
        setTags(tagsResult.data);
      }
    } catch {
      // 静默失败，不影响主功能
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadItems();
    loadOptions();
  }, [loadItems, loadOptions]);

  // 从 localStorage 恢复设置
  useEffect(() => {
    const savedViewMode = localStorage.getItem('itemBrowser.viewMode') as ViewMode | null;
    const savedItemSize = localStorage.getItem('itemBrowser.itemSize');
    
    if (savedViewMode && VIEW_MODES.includes(savedViewMode)) setViewMode(savedViewMode);
    if (savedItemSize) setItemSize(parseInt(savedItemSize, 10));
  }, []);

  // 保存设置到 localStorage
  useEffect(() => {
    localStorage.setItem('itemBrowser.viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('itemBrowser.itemSize', itemSize.toString());
  }, [itemSize]);

  // 计算总页数
  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize]);

  // 过滤条件改变时重置到第一页
  const updateFilter = (key: keyof QueryFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // 清除所有过滤
  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      modId: '',
      tag: '',
      textureType: 'all',
    });
    setCurrentPage(1);
  };

  // 渲染物品卡片
  const renderItem = (item: Item) => {
    const isSelected = selectedItem?.id === item.id;
    
    switch (viewMode) {
      case 'list':
        return (
          <ItemListRow
            key={item.id}
            item={item}
            size={32}
            selected={isSelected}
            onClick={() => setSelectedItem(item)}
          />
        );
      case 'detail':
        if (isSelected) {
          return (
            <div key={item.id} className={styles.detailItemWrapper}>
              <ItemDetailCard item={item} />
            </div>
          );
        }
        return (
          <ItemListRow
            key={item.id}
            item={item}
            size={32}
            selected={isSelected}
            onClick={() => setSelectedItem(item)}
          />
        );
      default: // grid
        return (
          <ItemCard
            key={item.id}
            item={item}
            size={itemSize}
            selected={isSelected}
            onClick={() => setSelectedItem(item)}
            onDoubleClick={() => {
              console.log('Open item details:', item);
            }}
          />
        );
    }
  };

  // 检查是否有过滤条件
  const hasFilters = filters.search || filters.modId || filters.category || filters.textureType !== 'all' || filters.tag;

  return (
    <div className={styles.container}>
      {/* 工具栏 - 使用 Flexbox 重新布局 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* 搜索框 */}
          <div className={`${styles.searchBox} ${searchFocused ? styles.focused : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="搜索物品名称、ID..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {filters.search && (
              <button 
                className={styles.clearSearch}
                onClick={() => updateFilter('search', '')}
                title="清除搜索"
              >
                ×
              </button>
            )}
          </div>

          {/* 过滤下拉框组 */}
          <select
            value={filters.modId}
            onChange={(e) => updateFilter('modId', e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">所有模组</option>
            {mods.map(mod => (
              <option key={mod} value={mod}>{mod}</option>
            ))}
          </select>

          <select
            value={filters.category}
            onChange={(e) => updateFilter('category', e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">所有类别</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={filters.textureType}
            onChange={(e) => updateFilter('textureType', e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">所有类型</option>
            <option value="item">物品</option>
            <option value="block">方块</option>
            <option value="unknown">未知</option>
          </select>

          <select
            value={filters.tag}
            onChange={(e) => updateFilter('tag', e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">所有标签</option>
            {tags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          {/* 清除过滤按钮 */}
          {hasFilters && (
            <button
              className={styles.clearFiltersBtn}
              onClick={clearFilters}
              title="清除所有过滤"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              清除
            </button>
          )}
        </div>

        <div className={styles.toolbarRight}>
          {/* 视图模式切换 */}
          <div className={styles.viewModeToggle}>
            {VIEW_MODES.map(mode => (
              <button
                key={mode}
                className={`${styles.viewModeBtn} ${viewMode === mode ? styles.active : ''}`}
                onClick={() => setViewMode(mode)}
                title={mode === 'grid' ? '网格视图' : mode === 'list' ? '列表视图' : '详情视图'}
              >
                {mode === 'grid' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"/>
                  </svg>
                )}
                {mode === 'list' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"/>
                  </svg>
                )}
                {mode === 'detail' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 4h18v2H3V4zm0 7h12v2H3v-2zm0 7h18v2H3v-2z"/>
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* 图标大小切换 */}
          <div className={styles.sizeToggle}>
            {[32, 48, 64].map(size => (
              <button
                key={size}
                className={`${styles.sizeBtn} ${itemSize === size ? styles.active : ''}`}
                onClick={() => setItemSize(size)}
                title={`${size}px`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* 类别图例 */}
          <CategoryLegend
            compact
            selectedCategory={filters.category as ItemCategory || null}
            onCategoryClick={(cat) => updateFilter('category', cat || '')}
          />
        </div>
      </div>

      {/* 结果统计 */}
      <div className={styles.stats}>
        <span className={styles.count}>共 {totalCount.toLocaleString()} 个物品</span>
        {filters.search && (
          <span className={styles.filterTag}>
            搜索: <strong>{filters.search}</strong>
            <button onClick={() => updateFilter('search', '')}>×</button>
          </span>
        )}
        {filters.modId && (
          <span className={styles.filterTag}>
            模组: <strong>{filters.modId}</strong>
            <button onClick={() => updateFilter('modId', '')}>×</button>
          </span>
        )}
        {filters.category && (
          <span className={styles.filterTag}>
            类别: <strong>{filters.category}</strong>
            <button onClick={() => updateFilter('category', '')}>×</button>
          </span>
        )}
        {filters.textureType !== 'all' && (
          <span className={styles.filterTag}>
            类型: <strong>{filters.textureType === 'block' ? '方块' : filters.textureType === 'item' ? '物品' : '未知'}</strong>
            <button onClick={() => updateFilter('textureType', 'all')}>×</button>
          </span>
        )}
        {filters.tag && (
          <span className={styles.filterTag}>
            标签: <strong>{filters.tag}</strong>
            <button onClick={() => updateFilter('tag', '')}>×</button>
          </span>
        )}
      </div>

      {/* 物品列表 */}
      <div className={`${styles.content} ${styles[viewMode]}`}>
        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>加载中...</p>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <p>加载失败: {error}</p>
            <button onClick={loadItems}>重试</button>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p>没有找到匹配的物品</p>
            {hasFilters && (
              <button
                className={styles.clearFilters}
                onClick={clearFilters}
              >
                清除过滤条件
              </button>
            )}
          </div>
        ) : (
          items.map(renderItem)
        )}
      </div>

      {/* 分页 */}
      {!isLoading && items.length > 0 && (
        <div className={styles.pagination}>
          <div className={styles.pageInfo}>
            第 {currentPage} / {totalPages} 页
          </div>
          
          <div className={styles.pageButtons}>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
            >
              首页
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              上一页
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={currentPage === pageNum ? styles.activePage : ''}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              下一页
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              末页
            </button>
          </div>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setCurrentPage(1);
            }}
            className={styles.pageSizeSelect}
          >
            {ITEMS_PER_PAGE_OPTIONS.map(size => (
              <option key={size} value={size}>{size} / 页</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
