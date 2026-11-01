import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { usePreferences } from '../src/app/preferences.js';

beforeEach(() => {
  usePreferences.setState({ theme: 'system', locale: 'es' });
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
});
