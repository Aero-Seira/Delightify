import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n';
import styles from './style.module.css';

// Icons
const ModManagerIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const ItemBrowserIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const RecipeBrowserIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const RecipeEditorIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const ConversionToolIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4" />
    <path d="m5 5 2.83 2.83" />
    <path d="M19 5l-2.83 2.83" />
    <path d="M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    <path d="M12 18v4" />
    <path d="m5 19 2.83-2.83" />
    <path d="M19 19l-2.83-2.83" />
  </svg>
);

const HomeIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ProjectIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const CollapseIcon: React.FC<{ collapsed: boolean }> = ({ collapsed }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={`${styles.collapseIcon} ${collapsed ? styles.collapseIconRotated : ''}`}
  >
    <path d="m11 17-5-5 5-5" />
    <path d="m18 17-5-5 5-5" />
  </svg>
);

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ collapsed, onToggleCollapse }: SidebarProps): React.ReactElement {
  const { t } = useI18n();
  const location = useLocation();

  const mainNavItems = [
    { to: '/', icon: HomeIcon, label: t('nav.dashboard'), exact: true },
    { to: '/projects', icon: ProjectIcon, label: t('nav.projectManager'), exact: false },
  ];

  const toolNavItems = [
    { to: '/mods', icon: ModManagerIcon, label: t('nav.modManager'), exact: false },
    { to: '/items', icon: ItemBrowserIcon, label: t('nav.itemBrowser'), exact: false },
    { to: '/recipes', icon: RecipeBrowserIcon, label: t('nav.recipeBrowser'), exact: false },
    { to: '/editor', icon: RecipeEditorIcon, label: t('nav.recipeEditor'), exact: false },
    { to: '/convert', icon: ConversionToolIcon, label: t('nav.conversionTool'), exact: false },
  ];

  const isActive = (to: string, exact: boolean): boolean => {
    if (exact) {
      return location.pathname === to;
    }
    return location.pathname.startsWith(to);
  };

  const renderNavItem = (item: { to: string; icon: React.FC; label: string; exact: boolean }) => {
    const Icon = item.icon;
    const active = isActive(item.to, item.exact);
    
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.exact}
        className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
        data-title={item.label}
      >
        <span className={styles.navIcon}>
          <Icon />
        </span>
        <span className={styles.navText}>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
      {/* Logo Section */}
        <div className={styles.logoSection}>
        <img 
          src="/assets/delightify_icon.png" 
          alt="Delightify" 
          className={styles.logoIcon}
        />
        <span className={styles.logoText}>Delightify</span>
      </div>

      {/* Navigation */}
      <nav className={styles.navigation}>
        <div className={styles.navSection}>
          {!collapsed && <div className={styles.sectionTitle}>{t('sidebar.main')}</div>}
          {mainNavItems.map(renderNavItem)}
        </div>

        <div className={styles.navSection}>
          {!collapsed && <div className={styles.sectionTitle}>{t('sidebar.tools')}</div>}
          {toolNavItems.map(renderNavItem)}
        </div>
      </nav>

      {/* Collapse Button */}
      <div className={styles.collapseButton}>
        <button className={styles.collapseBtn} onClick={onToggleCollapse}>
          <CollapseIcon collapsed={collapsed} />
          <span className={styles.collapseText}>{t('sidebar.collapse')}</span>
        </button>
      </div>
    </aside>
  );
}
