import { render } from '@testing-library/react';
import { AppRoot, createApp } from '../src/app/app.js';
import { memoryHistory } from '../src/router.js';

/** Renders the whole app at `path`, with a fake `fetch` and no real network or browser history. */
export function renderApp(path: string, fetch: typeof globalThis.fetch) {
  const app = createApp({ origin: 'http://api.test', fetch, history: memoryHistory(path) });
  const view = render(<AppRoot app={app} />);
  return { app, ...view };
}
