import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import ModManagerPage from './pages/ModManager';
import ItemBrowserPage from './pages/ItemBrowser';
import RecipeBrowserPage from './pages/RecipeBrowser';
import RecipeEditorPage from './pages/RecipeEditor';
import ConversionToolPage from './pages/ConversionTool';

export default function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
        <nav
          style={{
            width: 200,
            background: '#1e1e2e',
            color: '#cdd6f4',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.2rem', color: '#cba6f7' }}>
            Delightify
          </h2>
          {[
            { to: '/', label: '🗂 Mods' },
            { to: '/items', label: '📦 Items' },
            { to: '/recipes', label: '📋 Recipes' },
            { to: '/editor', label: '✏️ Editor' },
            { to: '/convert', label: '🤖 Convert' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                color: isActive ? '#cba6f7' : '#cdd6f4',
                textDecoration: 'none',
                padding: '0.4rem 0.6rem',
                borderRadius: 4,
                background: isActive ? '#313244' : 'transparent',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem', background: '#1e1e2e', color: '#cdd6f4' }}>
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
