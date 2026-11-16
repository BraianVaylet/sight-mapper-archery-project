import type { es } from './locales/es.js';

/** Same tree as Spanish, any string at the leaves: a missing or extra key fails to compile. */
type Shape<T> = { -readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };
export type Messages = Shape<typeof es>;

type Paths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Every translatable key, e.g. `errors.core.validation`. An unknown key does not compile. */
export type MessageKey = Paths<typeof es>;

type Lookup<T, Key extends string> = Key extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? Lookup<T[Head], Tail>
    : never
  : Key extends keyof T
    ? T[Key]
    : never;

type PlaceholdersOf<S> = S extends `${string}{{${infer Name}}}${infer Rest}`
  ? Name | PlaceholdersOf<Rest>
  : never;

/** Names of the `{{placeholders}}` in the Spanish message of `K`. */
export type ParamNames<K extends MessageKey> = PlaceholdersOf<Lookup<typeof es, K>>;

export type MessageParams<K extends MessageKey> = Record<ParamNames<K>, string | number>;

/** `t('key')` for plain messages, `t('key', { ... })` when the message has placeholders. */
export type TranslateArgs<K extends MessageKey> = [ParamNames<K>] extends [never]
  ? []
  : [params: MessageParams<K>];
