/**
 * 改进的物品图标组件
 * 
 * 特性：
 * 1. 使用 useTexture hook 进行智能纹理加载
 * 2. 更好的 fallback 显示（紫黑格子 + 字母）
 * 3. 平滑的加载动画
 * 4. 支持像素完美渲染
 */

import React, { useMemo } from 'react';
import { useTexture } from '../../hooks/useTexture';
import styles from './style.module.css';

interface ItemIconProps {
  /** 物品ID */
  itemId: string;
  /** 显示名称（用于 fallback） */
  displayName?: string;
  /** 尺寸 */
  size?: number;
  /** 额外的 CSS 类 */
  className?: string;
  /** 是否启用缓存 */
  enableCache?: boolean;
}

/**
 * 生成稳定的颜色
 */
function useStableColor(itemId: string): string {
  return useMemo(() => {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
      '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
      '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    ];
    let hash = 0;
    for (let i = 0; i < itemId.length; i++) {
      hash = itemId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, [itemId]);
}

/**
 * 获取首字母
 */
function useInitial(itemId: string, displayName?: string): string {
  return useMemo(() => {
    const text = displayName || itemId;
    const parts = text.split(':');
    const name = parts[1] || parts[0];
    const firstWord = name.split(/[_\s]+/)[0];
    return firstWord.charAt(0).toUpperCase();
  }, [itemId, displayName]);
}

/**
 * 紫黑格子缺失纹理 SVG
 */
const MISSING_TEXTURE_SVG = `data:image/svg+xml;base64,${btoa(`
<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="m" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#1a0a2e"/>
      <rect x="8" width="8" height="8" fill="#0d0221"/>
      <rect y="8" width="8" height="8" fill="#0d0221"/>
      <rect x="8" y="8" width="8" height="8" fill="#1a0a2e"/>
    </pattern>
  </defs>
  <rect width="64" height="64" fill="url(#m)"/>
</svg>
`)}`;

export default function ItemIcon({
  itemId,
  displayName,
  size = 32,
  className = '',
  enableCache = true,
}: ItemIconProps): React.ReactElement {
  const { data, loading, error } = useTexture(itemId, { enableCache });
  const color = useStableColor(itemId);
  const initial = useInitial(itemId, displayName);

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
  };

  // 加载状态 - 显示骨架屏
  if (loading) {
    return (
      <div
        className={`${styles.container} ${styles.loading} ${className}`}
        style={containerStyle}
        title={itemId}
      >
        <div className={styles.skeleton} />
      </div>
    );
  }

  // 错误状态 - 显示紫黑格子 + 字母
  if (error || !data) {
    return (
      <div
        className={`${styles.container} ${styles.fallback} ${className}`}
        style={containerStyle}
        title={itemId}
      >
        <img
          src={MISSING_TEXTURE_SVG}
          alt=""
          className={styles.missingTexture}
          style={{ width: size, height: size }}
        />
        <span
          className={styles.initial}
          style={{
            fontSize: size * 0.5,
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}
        >
          {initial}
        </span>
      </div>
    );
  }

  // 正常显示纹理
  return (
    <div
      className={`${styles.container} ${className}`}
      style={containerStyle}
      title={itemId}
    >
      <img
        src={data}
        alt={displayName || itemId}
        className={styles.texture}
        style={{
          width: size,
          height: size,
          imageRendering: 'pixelated',
        }}
        draggable={false}
      />
    </div>
  );
}

/**
 * 小型图标变体
 */
export function ItemIconSmall(props: Omit<ItemIconProps, 'size'>): React.ReactElement {
  return <ItemIcon {...props} size={16} />;
}

/**
 * 中型图标变体
 */
export function ItemIconMedium(props: Omit<ItemIconProps, 'size'>): React.ReactElement {
  return <ItemIcon {...props} size={32} />;
}

/**
 * 大型图标变体
 */
export function ItemIconLarge(props: Omit<ItemIconProps, 'size'>): React.ReactElement {
  return <ItemIcon {...props} size={64} />;
}
