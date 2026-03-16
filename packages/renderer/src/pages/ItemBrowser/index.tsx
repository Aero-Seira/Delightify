import React from 'react';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

export default function ItemBrowserPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('itemBrowser.title')}</h1>
      <p className={styles.description}>{t('itemBrowser.description')}</p>
      <div className={styles.content}>
        <p className={styles.placeholder}>
          Coming soon — item grid with search and filters (Phase 3).
        </p>
      </div>
    </div>
  );
}
