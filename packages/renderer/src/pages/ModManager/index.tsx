import React from 'react';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

export default function ModManagerPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('modManager.title')}</h1>
      <p className={styles.description}>{t('modManager.description')}</p>
      <div className={styles.content}>
        <p className={styles.placeholder}>
          Coming soon — JAR import flow will appear here (Phase 2).
        </p>
      </div>
    </div>
  );
}
