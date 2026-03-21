import React, { useEffect, useState } from 'react';
import type { Item } from '@delightify/shared';
import { BlockRenderer3D, BlockRenderer2D } from '../BlockRenderer';
import type { RenderMode } from '../RenderModeToggle';
import { electronAPI } from '../../ipc';
import styles from './style.module.css';

interface ItemCardProps {
  item: Item;
  renderMode?: RenderMode;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

/**
 * 物品卡片组件
 * 支持 3D/2D 渲染模式切换
 */
export default function ItemCard({
  item,
  renderMode = '2d',
  size = 64,
  selected = false,
  onClick,
  onDoubleClick,
}: ItemCardProps): React.ReactElement {
  const [textureData, setTextureData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 获取物品首字母作为回退显示
  const fallbackChar = (item.displayName || item.name || item.itemId).charAt(0).toUpperCase();
  
  // 加载纹理数据
  useEffect(() => {
    let mounted = true;
    
    async function loadTexture() {
      if (!item.textureCacheName) {
        setIsLoading(false);
        return;
      }
      
      try {
        const api = electronAPI();
        const result = await api.itemsGetTexture(item.itemId);
        if (mounted && result.success && result.data) {
          setTextureData(result.data);
        }
      } catch (error) {
        console.warn('[ItemCard] Failed to load texture:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    
    loadTexture();
    
    return () => {
      mounted = false;
    };
  }, [item.itemId, item.textureCacheName]);
  
  const handleClick = () => {
    onClick?.();
  };

  const handleDoubleClick = () => {
    onDoubleClick?.();
  };

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div className={styles.imageContainer} style={{ width: size, height: size }}>
        {isLoading ? (
          <div className={styles.loading} style={{ width: size, height: size }}>
            <div className={styles.spinner} />
          </div>
        ) : textureData ? (
          renderMode === '3d' && item.textureType === 'block' ? (
            <BlockRenderer3D
              textureUrl={textureData}
              size={size}
              fallbackChar={fallbackChar}
            />
          ) : (
            <BlockRenderer2D
              textureUrl={textureData}
              size={size}
              fallbackChar={fallbackChar}
            />
          )
        ) : (
          <div className={styles.fallback} style={{ width: size, height: size }}>
            <span className={styles.fallbackChar}>{fallbackChar}</span>
          </div>
        )}
        
        {/* 渲染模式指示器 - 仅 3D 模式显示 */}
        {renderMode === '3d' && item.textureType === 'block' && textureData && (
          <div className={styles.renderIndicator} title="3D 渲染">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5L19.5 8 12 11.5 4.5 8 12 4.5z"/>
            </svg>
          </div>
        )}
      </div>
      
      <div className={styles.info}>
        <span className={styles.name} title={item.displayName || item.itemId}>
          {item.displayName || item.itemId}
        </span>
        <span className={styles.meta} title={`${item.modId}:${item.name || item.itemId.split(':')[1]}`}>
          {item.modId}:{item.name || item.itemId.split(':')[1]}
        </span>
      </div>

      {/* 类别标签 - 简化为小圆点 */}
      {item.category && (
        <div 
          className={styles.categoryDot} 
          title={item.category}
          data-category={item.category}
        />
      )}
    </div>
  );
}

/**
 * 紧凑列表项组件
 * 用于列表视图
 */
export function ItemListRow({
  item,
  renderMode = '2d',
  size = 32,
  selected = false,
  onClick,
}: ItemCardProps): React.ReactElement {
  const [textureData, setTextureData] = useState<string | null>(null);
  
  const fallbackChar = (item.displayName || item.name || item.itemId).charAt(0).toUpperCase();

  useEffect(() => {
    let mounted = true;
    
    async function loadTexture() {
      if (!item.textureCacheName) return;
      
      try {
        const api = electronAPI();
        const result = await api.itemsGetTexture(item.itemId);
        if (mounted && result.success && result.data) {
          setTextureData(result.data);
        }
      } catch (error) {
        console.warn('[ItemListRow] Failed to load texture:', error);
      }
    }
    
    loadTexture();
    
    return () => {
      mounted = false;
    };
  }, [item.itemId, item.textureCacheName]);

  return (
    <div
      className={`${styles.listRow} ${selected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <div className={styles.listImage} style={{ width: size, height: size }}>
        {textureData ? (
          renderMode === '3d' && item.textureType === 'block' ? (
            <BlockRenderer3D
              textureUrl={textureData}
              size={size}
              fallbackChar={fallbackChar}
            />
          ) : (
            <BlockRenderer2D
              textureUrl={textureData}
              size={size}
              fallbackChar={fallbackChar}
            />
          )
        ) : (
          <div className={styles.listFallback}>
            {fallbackChar}
          </div>
        )}
      </div>
      
      <div className={styles.listInfo}>
        <span className={styles.listName}>{item.displayName || item.itemId}</span>
        <span className={styles.listMeta}>
          {item.modId}:{item.name || item.itemId.split(':')[1]}
          {item.category && ` · ${item.category}`}
        </span>
      </div>
    </div>
  );
}

/**
 * 物品详情卡片
 * 更大的展示，用于详情页
 */
export function ItemDetailCard({
  item,
  renderMode = '3d',
}: {
  item: Item;
  renderMode?: RenderMode;
}): React.ReactElement {
  const [textureData, setTextureData] = useState<string | null>(null);
  const size = 128;
  
  const fallbackChar = (item.displayName || item.name || item.itemId).charAt(0).toUpperCase();

  useEffect(() => {
    let mounted = true;
    
    async function loadTexture() {
      if (!item.textureCacheName) return;
      
      try {
        const api = electronAPI();
        const result = await api.itemsGetTexture(item.itemId);
        if (mounted && result.success && result.data) {
          setTextureData(result.data);
        }
      } catch (error) {
        console.warn('[ItemDetailCard] Failed to load texture:', error);
      }
    }
    
    loadTexture();
    
    return () => {
      mounted = false;
    };
  }, [item.itemId, item.textureCacheName]);

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailImageContainer}>
        {textureData ? (
          renderMode === '3d' && item.textureType === 'block' ? (
            <BlockRenderer3D
              textureUrl={textureData}
              size={size}
              fallbackChar={fallbackChar}
            />
          ) : (
            <BlockRenderer2D
              textureUrl={textureData}
              size={size}
              fallbackChar={fallbackChar}
            />
          )
        ) : (
          <div className={styles.detailFallback} style={{ width: size, height: size }}>
            <span>{fallbackChar}</span>
          </div>
        )}
      </div>
      
      <div className={styles.detailInfo}>
        <h3 className={styles.detailName}>{item.displayName || item.itemId}</h3>
        <p className={styles.detailId}>{item.modId}:{item.name || item.itemId.split(':')[1]}</p>
        
        {item.category && (
          <div className={styles.detailTags}>
            <span className={styles.tag}>{item.category}</span>
            {item.textureType && (
              <span className={styles.tag}>{item.textureType}</span>
            )}
          </div>
        )}

        {item.tagIds && item.tagIds.length > 0 && (
          <div className={styles.tagsSection}>
            <h4>标签</h4>
            <div className={styles.tagList}>
              {item.tagIds.map(tag => (
                <span key={tag} className={styles.smallTag}>{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
