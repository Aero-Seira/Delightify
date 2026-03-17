import React from 'react';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

export default function ModManagerPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('modManager.title')}</h1>
        <p className={styles.description}>{t('modManager.description')}</p>
      </div>
      
      <div className={styles.content}>
        <div className={styles.actionBar}>
          <span className={styles.actionBarTitle}>{t('modManager.jarList')}</span>
          <button className={styles.importButton}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            {t('modManager.importJar')}
          </button>
        </div>

        <div className={styles.uploadArea}>
          <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          <p className={styles.uploadText}>{t('modManager.dragDrop')}</p>
          <p className={styles.uploadHint}>支持 .jar 格式的 Minecraft 模组文件</p>
        </div>

        <p className={styles.placeholder}>
          功能开发中 — JAR 导入流程将在第二阶段实现
        </p>
      </div>
    </div>
  );
}
