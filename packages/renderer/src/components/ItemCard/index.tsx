/**
 * 改进的物品卡片组件 - v2.1
 * 
 * 适配 v2.1 简化 Item 类型 (itemId, modid)
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
 * 从 itemId 解析显示名称
 * 例如: "minecraft:stone" -> "stone"
 */
function getItemName(itemId: string): string {
  const parts = itemId.split(':');
  return parts[1] || parts[0] || itemId;
}

/**
 * 格式化显示名称（首字母大写，下划线替换为空格）
 */
function formatDisplayName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
  const itemName = getItemName(item.itemId);
  // 优先使用中文翻译，如果没有则使用格式化后的英文名称
  const displayName = item.displayName || formatDisplayName(itemName);

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className={styles.imageContainer} style={{ width: size, height: size }}>
        <ItemIcon
          itemId={item.itemId}
          displayName={displayName}
          size={size}
        />
      </div>
      
      <div className={styles.info}>
        <span className={styles.name} title={displayName}>
          {displayName}
        </span>
        <span className={styles.meta} title={item.itemId}>
          {item.itemId}
        </span>
      </div>
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
  const itemName = getItemName(item.itemId);
  // 优先使用中文翻译，如果没有则使用格式化后的英文名称
  const displayName = item.displayName || formatDisplayName(itemName);

  return (
    <div
      className={`${styles.listRow} ${selected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <div className={styles.listImage} style={{ width: size, height: size }}>
        <ItemIcon
          itemId={item.itemId}
          displayName={displayName}
          size={size}
        />
      </div>
      
      <div className={styles.listInfo}>
        <span className={styles.listName}>{displayName}</span>
        <span className={styles.listMeta}>{item.itemId}</span>
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
  const itemName = getItemName(item.itemId);
  // 优先使用中文翻译，如果没有则使用格式化后的英文名称
  const displayName = item.displayName || formatDisplayName(itemName);

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailImageContainer}>
        <ItemIcon
          itemId={item.itemId}
          displayName={displayName}
          size={size}
        />
      </div>
      
      <div className={styles.detailInfo}>
        <h3 className={styles.detailName}>{displayName}</h3>
        <p className={styles.detailId}>{item.itemId}</p>
        <p className={styles.detailMod}>模组: {item.modid}</p>
      </div>
    </div>
  );
}
