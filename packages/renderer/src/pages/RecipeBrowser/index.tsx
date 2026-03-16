import React from 'react';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

export default function RecipeBrowserPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('recipeBrowser.title')}</h1>
      <p className={styles.description}>{t('recipeBrowser.description')}</p>
      <div className={styles.content}>
        <p className={styles.placeholder}>
          Coming soon — recipe cards with visual slots (Phase 3).
        </p>
      </div>
    </div>
  );
}
