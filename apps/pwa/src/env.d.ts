/** Injected by `vite.config.ts` from `VITE_APP_VERSION` (`dev` when unset). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Origin of the API. Empty in development: the Vite proxy forwards `/api`. */
  readonly VITE_API_URL?: string;
  readonly VITE_APP_VERSION?: string;
}
