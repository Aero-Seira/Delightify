import React, { useState, useEffect } from 'react';
import { electronAPI } from '../../ipc';
import styles from './style.module.css';

interface ItemIconProps {
  itemId: string;
  size?: number;
  className?: string;
}

/**
 * ItemIcon 组件
 * 显示 Minecraft 物品的图标（16x16 或指定尺寸）
 * 自动从缓存或数据库加载材质
 */
export default function ItemIcon({ 
  itemId, 
  size = 32,
  className = '' 
}: ItemIconProps): React.ReactElement {
  const [textureData, setTextureData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadTexture() {
      if (!itemId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);

        const api = electronAPI();
        const result = await api.itemsGetTexture(itemId);

        if (!mounted) return;

        if (result.success && result.data) {
          setTextureData(result.data);
        } else {
          setError(true);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('[ItemIcon] Failed to load texture:', err);
        setError(true);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTexture();

    return () => {
      mounted = false;
    };
  }, [itemId]);

  // 生成首字母作为 fallback
  const getInitial = () => {
    const parts = itemId.split(':');
    const name = parts[1] || parts[0];
    // 对于类似 tomato_seeds 的物品，取第一个单词的首字母
    const firstWord = name.split('_')[0];
    return firstWord.charAt(0).toUpperCase();
  };

  // 根据 itemId 生成稳定的背景色
  const getBackgroundColor = () => {
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
  };

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
  };

  if (loading) {
    return (
      <div 
        className={`${styles.container} ${styles.loading} ${className}`}
        style={containerStyle}
        title={itemId}
      >
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error || !textureData) {
    return (
      <div 
        className={`${styles.container} ${styles.fallback} ${className}`}
        style={{
          ...containerStyle,
          backgroundColor: getBackgroundColor(),
        }}
        title={itemId}
      >
        <span className={styles.initial}>{getInitial()}</span>
      </div>
    );
  }

  return (
    <div 
      className={`${styles.container} ${className}`}
      style={containerStyle}
      title={itemId}
    >
      <img 
        src={textureData}
        alt={itemId}
        className={styles.image}
        style={{
          width: size,
          height: size,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}
