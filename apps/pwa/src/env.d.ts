/** Injected by `vite.config.ts`: the root `package.json` version, `+<sha>` outside production (`dev` in tests). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Origin of the API. Empty in development: the Vite proxy forwards `/api`. */
  readonly VITE_API_URL?: string;
}
