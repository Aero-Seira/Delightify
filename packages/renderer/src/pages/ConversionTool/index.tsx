import React from 'react';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

export default function ConversionToolPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('conversionTool.title')}</h1>
      <p className={styles.description}>{t('conversionTool.description')}</p>
      <div className={styles.content}>
        <p className={styles.placeholder}>
          Coming soon — LLM conversion with confidence scoring (Phase 4).
        </p>
      </div>
    </div>
  );
}
