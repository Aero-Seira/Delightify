import React from 'react';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

export default function RecipeBrowserPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('recipeBrowser.title')}</h1>
        <p className={styles.description}>{t('recipeBrowser.description')}</p>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input 
            type="text" 
            className={styles.searchInput}
            placeholder={t('recipeBrowser.inputOutputSearch')}
          />
        </div>
        <select className={styles.filterSelect}>
          <option>{t('recipeBrowser.typeFilter')}</option>
        </select>
      </div>

      <div className={styles.content}>
        <p className={styles.placeholder}>
          功能开发中 — 配方浏览器将在第二阶段实现
        </p>
      </div>
    </div>
  );
}
