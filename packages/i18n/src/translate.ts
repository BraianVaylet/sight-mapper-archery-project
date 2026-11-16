import type { Locale } from '@sight-mapper/types';
import { en } from './locales/en.js';
import { es } from './locales/es.js';
import type { Messages, MessageKey, TranslateArgs } from './types.js';

export const catalogs: Record<Locale, Messages> = { es, en };

export const DEFAULT_LOCALE: Locale = 'es';

export type Params = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/** Replaces `{{name}}`; a missing param leaves the placeholder visible instead of hiding the bug. */
export function interpolate(message: string, params: Params = {}): string {
  return message.replace(PLACEHOLDER, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null || !Object.hasOwn(node, segment)) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Strict translator: the key must exist and its placeholders are required params. Also usable
 * on the server (emails are rendered per language, ADR-004).
 */
export function createTranslator(locale: Locale) {
  const messages = catalogs[locale];
  return function t<K extends MessageKey>(key: K, ...args: TranslateArgs<K>): string {
    const message = lookup(messages, key);
    if (message === undefined) return key;
    return interpolate(message, args[0] as Params | undefined);
  };
}

/**
 * For keys that arrive as strings at runtime, like an API `messageKey`. A key this build does
 * not know falls back to `fallback` (default: the generic server error) instead of showing a
 * raw key to the archer.
 */
export function translateKey(
  locale: Locale,
  key: string,
  params?: Params,
  fallback: MessageKey = 'errors.core.unexpected',
): string {
  const messages = catalogs[locale];
  const message = lookup(messages, key) ?? lookup(messages, fallback);
  return interpolate(message ?? fallback, params);
}

export function hasKey(key: string): boolean {
  return lookup(es, key) !== undefined;
}
