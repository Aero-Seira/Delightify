import React from 'react';
import styles from './style.module.css';

export type RenderMode = '3d' | '2d';

interface RenderModeToggleProps {
  mode: RenderMode;
  onChange: (mode: RenderMode) => void;
  disabled?: boolean;
}

/**
 * 渲染模式切换组件
 * 允许用户在 3D 三视图和 2D 正面之间切换
 */
export default function RenderModeToggle({
  mode,
  onChange,
  disabled = false,
}: RenderModeToggleProps): React.ReactElement {
  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
      <span className={styles.label}>渲染模式:</span>
      <div className={styles.toggleGroup}>
        <button
          className={`${styles.button} ${mode === '3d' ? styles.active : ''}`}
          onClick={() => onChange('3d')}
          disabled={disabled}
          title="3D 三视图 - 更接近游戏内效果"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2l-9 5v10l9 5 9-5V7l-9-5z" />
            <path d="M12 12L3 7" />
            <path d="M12 12l9-5" />
            <path d="M12 12v10" />
          </svg>
          <span>3D</span>
        </button>
        <button
          className={`${styles.button} ${mode === '2d' ? styles.active : ''}`}
          onClick={() => onChange('2d')}
          disabled={disabled}
          title="2D 正面 - 更好的性能"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
          <span>2D</span>
        </button>
      </div>
    </div>
  );
}

/**
 * 渲染模式设置面板
 * 包含更多渲染选项
 */
export function RenderSettingsPanel({
  mode,
  onChange,
  itemSize,
  onItemSizeChange,
}: {
  mode: RenderMode;
  onChange: (mode: RenderMode) => void;
  itemSize: number;
  onItemSizeChange: (size: number) => void;
}): React.ReactElement {
  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <h4>渲染模式</h4>
        <div className={styles.modeOptions}>
          <label className={`${styles.modeOption} ${mode === '3d' ? styles.selected : ''}`}>
            <input
              type="radio"
              name="renderMode"
              value="3d"
              checked={mode === '3d'}
              onChange={(e) => onChange(e.target.value as RenderMode)}
            />
            <div className={styles.modeInfo}>
              <span className={styles.modeTitle}>3D 三视图</span>
              <span className={styles.modeDesc}>模拟游戏内物品栏效果，显示三个面</span>
            </div>
          </label>
          <label className={`${styles.modeOption} ${mode === '2d' ? styles.selected : ''}`}>
            <input
              type="radio"
              name="renderMode"
              value="2d"
              checked={mode === '2d'}
              onChange={(e) => onChange(e.target.value as RenderMode)}
            />
            <div className={styles.modeInfo}>
              <span className={styles.modeTitle}>2D 正面</span>
              <span className={styles.modeDesc}>仅显示正面纹理，更好的性能</span>
            </div>
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <h4>图标大小</h4>
        <div className={styles.sizeOptions}>
          {[32, 48, 64].map((size) => (
            <button
              key={size}
              className={`${styles.sizeButton} ${itemSize === size ? styles.active : ''}`}
              onClick={() => onItemSizeChange(size)}
            >
              {size}px
            </button>
          ))}
        </div>
      </div>

      <div className={styles.hint}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>
          3D 模式会渲染方块的三个面，更接近游戏内效果，但会消耗更多资源。
          如果浏览大量物品时遇到卡顿，建议切换到 2D 模式。
        </span>
      </div>
    </div>
  );
}
