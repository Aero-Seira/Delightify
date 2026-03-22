/**
 * 改进的物品卡片组件
 * 
 * 特性：
 * 1. 使用 ItemIcon 组件显示2D纹理
 * 2. 统一的 fallback 显示
 * 3. 支持网格、列表、详情三种视图
 */

import React from 'react';
import type { Item } from '@delightify/shared';
import ItemIcon from '../ItemIcon';
import styles from './style.module.css';

interface ItemCardProps {
  item: Item;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

/**
 * 物品卡片组件 - 网格视图
 */
export default function ItemCard({
  item,
  size = 64,
  selected = false,
  onClick,
  onDoubleClick,
}: ItemCardProps): React.ReactElement {
  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className={styles.imageContainer} style={{ width: size, height: size }}>
        <ItemIcon
          itemId={item.itemId}
          displayName={item.displayName}
          size={size}
        />
      </div>
      
      <div className={styles.info}>
        <span className={styles.name} title={item.displayName || item.itemId}>
          {item.displayName || item.itemId}
        </span>
        <span className={styles.meta} title={`${item.modId}:${item.name || item.itemId.split(':')[1]}`}>
          {item.modId}:{item.name || item.itemId.split(':')[1]}
        </span>
      </div>

      {/* 类别标签 */}
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
 */
export function ItemListRow({
  item,
  size = 32,
  selected = false,
  onClick,
}: Omit<ItemCardProps, 'onDoubleClick'>): React.ReactElement {
  return (
    <div
      className={`${styles.listRow} ${selected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <div className={styles.listImage} style={{ width: size, height: size }}>
        <ItemIcon
          itemId={item.itemId}
          displayName={item.displayName}
          size={size}
        />
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
 */
export function ItemDetailCard({
  item,
}: {
  item: Item;
}): React.ReactElement {
  const size = 128;

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailImageContainer}>
        <ItemIcon
          itemId={item.itemId}
          displayName={item.displayName}
          size={size}
        />
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
