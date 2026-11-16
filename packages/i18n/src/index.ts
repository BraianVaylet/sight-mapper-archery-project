export { en } from './locales/en.js';
export { es } from './locales/es.js';
export {
  decimalSeparator,
  detectLocale,
  formatDate,
  formatDateTime,
  formatNumber,
} from './locale.js';
export {
  catalogs,
  createTranslator,
  DEFAULT_LOCALE,
  hasKey,
  interpolate,
  translateKey,
} from './translate.js';
export type { Params } from './translate.js';
export type { MessageKey, MessageParams, Messages, ParamNames, TranslateArgs } from './types.js';
