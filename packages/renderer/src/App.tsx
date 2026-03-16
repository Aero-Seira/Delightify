import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useI18n } from './i18n';
import { initializeTheme } from './theme';
import ModManagerPage from './pages/ModManager';
import ItemBrowserPage from './pages/ItemBrowser';
import RecipeBrowserPage from './pages/RecipeBrowser';
import RecipeEditorPage from './pages/RecipeEditor';
import ConversionToolPage from './pages/ConversionTool';
import LanguageSwitcher from './components/LanguageSwitcher';
import ThemeToggle from './components/ThemeToggle';
import styles from './App.module.css';

export default function App(): React.ReactElement {
  const { t } = useI18n();

  // 初始化主题
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <BrowserRouter>
      <div className={styles.appContainer}>
        <nav className={styles.sidebar}>
          <h2 className={styles.logo}>Delightify</h2>
          {[
            { to: '/', label: `🗂 ${t('nav.modManager')}` },
            { to: '/items', label: `📦 ${t('nav.itemBrowser')}` },
            { to: '/recipes', label: `📋 ${t('nav.recipeBrowser')}` },
            { to: '/editor', label: `✏️ ${t('nav.recipeEditor')}` },
            { to: '/convert', label: `🤖 ${t('nav.conversionTool')}` },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              {label}
            </NavLink>
          ))}
          <div className={styles.controls}>
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </nav>
        <main className={styles.mainContent}>
          <Routes>
            <Route path="/" element={<ModManagerPage />} />
            <Route path="/items" element={<ItemBrowserPage />} />
            <Route path="/recipes" element={<RecipeBrowserPage />} />
            <Route path="/editor" element={<RecipeEditorPage />} />
            <Route path="/convert" element={<ConversionToolPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
