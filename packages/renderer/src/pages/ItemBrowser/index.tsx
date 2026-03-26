import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Item, SearchField } from '@delightify/shared';
import type { ItemCategory } from '../../components/CategoryLegend';
import ItemCard, { ItemListRow, ItemDetailCard } from '../../components/ItemCard';
import CategoryLegend from '../../components/CategoryLegend';
import SearchableSelect from '../../components/SearchableSelect';
import ErrorBoundary from '../../components/ErrorBoundary';
import { electronAPI } from '../../ipc';
import { useProjectStore } from '../../store/projectStore';
import styles from './style.module.css';

interface QueryFilters {
  search: string;
  searchField: SearchField;
  category: string;
  modId: string;
  tag: string;
}

const SEARCH_FIELD_OPTIONS: { value: SearchField; label: string; icon: string }[] = [
  { value: 'all', label: '全部', icon: '🔍' },
  { value: 'id', label: 'ID', icon: '🆔' },
  { value: 'name', label: '名称', icon: '📝' },
  { value: 'tag', label: '标签', icon: '🏷️' },
];

const ITEMS_PER_PAGE_OPTIONS = [20, 50, 100, 200];
const VIEW_MODES = ['grid', 'list', 'detail'] as const;
type ViewMode = typeof VIEW_MODES[number];

export default function ItemBrowser(): React.ReactElement {
  const { currentProject } = useProjectStore();
  
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
    searchField: 'all',
    category: '',
    modId: '',
    tag: '',
  });
  
  // 视图状态
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [itemSize, setItemSize] = useState(64);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  
  // 可用选项
  const [mods, setMods] = useState<Array<{ modid: string; name?: string }>>([]);
  const [tags, setTags] = useState<Array<{ tagId: string; itemCount: number }>>([]);

  // 加载物品数据
  const loadItems = useCallback(async () => {
    if (!currentProject) {
      setError('请先打开一个项目');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const api = electronAPI();
      const response = await api.itemsQuery(currentProject.path, {
        page: currentPage,
        pageSize,
        search: filters.search || undefined,
        searchField: filters.searchField,
        modid: filters.modId || undefined,
        tagId: filters.tag || undefined,
      });
      
      if (response.success && response.data) {
        setItems(response.data.items);
        setTotalCount(response.data.total);
      } else {
        setError(response.error || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, currentPage, pageSize, filters]);

  // 加载可用选项
  const loadOptions = useCallback(async () => {
    if (!currentProject) return;
    
    try {
      const api = electronAPI();
      const [modsResult, tagsResult] = await Promise.all([
        api.modsQuery(currentProject.path),
        api.tagsQuery(currentProject.path),
      ]);
      
      if (modsResult.success && modsResult.data) {
        setMods(modsResult.data);
      }
      
      if (tagsResult.success && tagsResult.data) {
        setTags(tagsResult.data);
      }
    } catch {
      // 静默失败，不影响主功能
    }
  }, [currentProject]);

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
      searchField: 'all',
      category: '',
      modId: '',
      tag: '',
    });
    setCurrentPage(1);
  };

  // 获取当前搜索字段的显示文本
  const currentSearchFieldLabel = SEARCH_FIELD_OPTIONS.find(opt => opt.value === filters.searchField)?.label || '全部';

  // 渲染物品卡片
  const renderItem = (item: Item) => {
    // 使用 itemId 作为唯一标识
    const itemKey = item.itemId || `item-${Math.random()}`;
    const isSelected = selectedItem?.itemId === item.itemId;
    
    // 确保 item 有必要的字段
    if (!item.itemId) {
      console.warn('Item missing itemId:', item);
      return null;
    }
    
    switch (viewMode) {
      case 'list':
        return (
          <ItemListRow
            key={itemKey}
            item={item}
            size={32}
            selected={isSelected}
            onClick={() => setSelectedItem(item)}
          />
        );
      case 'detail':
        if (isSelected) {
          return (
            <div key={itemKey} className={styles.detailItemWrapper}>
              <ItemDetailCard item={item} />
            </div>
          );
        }
        return (
          <ItemListRow
            key={itemKey}
            item={item}
            size={32}
            selected={isSelected}
            onClick={() => setSelectedItem(item)}
          />
        );
      default: // grid
        return (
          <ItemCard
            key={itemKey}
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
  const hasFilters = filters.search || filters.modId || filters.category || filters.tag;

  // 如果没有项目，显示提示
  if (!currentProject) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
          </svg>
          <p>请先打开一个项目</p>
          <p className={styles.emptyHint}>需要先打开一个整合包项目才能浏览物品</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className={styles.container}>
      {/* 工具栏 - 使用 Flexbox 重新布局 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* 专业搜索栏 */}
          <div className={`${styles.searchBar} ${searchFocused ? styles.focused : ''}`}>
            {/* 搜索字段选择器 */}
            <div className={styles.searchFieldSelector}>
              <select
                value={filters.searchField}
                onChange={(e) => updateFilter('searchField', e.target.value as SearchField)}
                title="选择搜索字段"
              >
                {SEARCH_FIELD_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* 分隔线 */}
            <div className={styles.searchDivider} />
            
            {/* 搜索输入框 */}
            <div className={styles.searchInputWrapper}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder={
                  filters.searchField === 'id' ? '搜索物品ID...' :
                  filters.searchField === 'name' ? '搜索中文名称...' :
                  filters.searchField === 'tag' ? '搜索标签ID...' :
                  '搜索ID、名称或标签...'
                }
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
          </div>

          {/* 模组筛选 - 可搜索 */}
          <SearchableSelect
            value={filters.modId}
            options={[
              { value: '', label: '所有模组' },
              ...mods.map(mod => ({
                value: mod.modid,
                label: mod.name || mod.modid,
                description: mod.name ? mod.modid : undefined,
              })),
            ]}
            placeholder="📦 所有模组"
            onChange={(value) => updateFilter('modId', value)}
            className={styles.filterSelect}
            title="筛选模组"
          />

          {/* 标签筛选 - 可搜索 */}
          <SearchableSelect
            value={filters.tag}
            options={[
              { value: '', label: '所有标签' },
              ...tags.map(tag => ({
                value: tag.tagId,
                label: tag.tagId,
                description: `${tag.itemCount} 个物品`,
              })),
            ]}
            placeholder="🏷️ 所有标签"
            onChange={(value) => updateFilter('tag', value)}
            className={styles.filterSelect}
            title="筛选标签"
          />

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
            {SEARCH_FIELD_OPTIONS.find(o => o.value === filters.searchField)?.label}:
            <strong>{filters.search}</strong>
            <button onClick={() => updateFilter('search', '')}>×</button>
          </span>
        )}
        {filters.modId && (
          <span className={styles.filterTag}>
            模组: <strong>{filters.modId}</strong>
            <button onClick={() => updateFilter('modId', '')}>×</button>
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
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>加载失败: {error}</p>
            <button onClick={loadItems}>重试</button>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            {mods.length === 0 ? (
              <>
                <p>还没有导入任何数据</p>
                <p className={styles.emptyHint}>请先前往「数据导入」导入数据</p>
              </>
            ) : hasFilters ? (
              <>
                <p>没有找到匹配的物品</p>
                <button
                  className={styles.clearFilters}
                  onClick={clearFilters}
                >
                  清除过滤条件
                </button>
              </>
            ) : (
              <p>该项目没有包含任何物品</p>
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
    </ErrorBoundary>
  );
}
