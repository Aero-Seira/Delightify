import React from 'react';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

export default function RecipeEditorPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('recipeEditor.title')}</h1>
      <p className={styles.description}>{t('recipeEditor.description')}</p>
      <div className={styles.content}>
        <p className={styles.placeholder}>
          Coming soon — drag-and-drop recipe editor (Phase 3).
        </p>
      </div>
    </div>
  );
}
