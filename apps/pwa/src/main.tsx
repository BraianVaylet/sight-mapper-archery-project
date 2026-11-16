import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRoot, createApp } from './app/app.js';
import { PwaUpdate } from './app/pwa-update.js';
import { I18nProvider } from './app/i18n.js';
import { applyTheme, usePreferences } from './app/preferences.js';
import './styles.css';

applyTheme(usePreferences.getState().theme);

const container = document.getElementById('root');
if (container === null) throw new Error('index.html has no #root');

const app = createApp({ origin: import.meta.env.VITE_API_URL ?? '' });

createRoot(container).render(
  <StrictMode>
    <AppRoot app={app} />
    <I18nProvider>
      <PwaUpdate />
    </I18nProvider>
  </StrictMode>,
);
