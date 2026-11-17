import { cx, touchTarget } from '../touch.js';

export type LanguageOption<V extends string> = {
  value: V;
  /** Short code shown on the button: `ES`, `EN`. */
  code: string;
  /** The language named in itself ("Español", "English"), read after the code. */
  name: string;
};

export type LanguageSwitchProps<V extends string> = {
  /** Accessible name of the group, already translated. */
  label: string;
  options: readonly LanguageOption<V>[];
  value: V;
  onChange: (value: V) => void;
};

/**
 * The compact language switch of the screens without a session (RF-ACC-04): there is no Settings
 * before signing in, and someone has to be able to read the app. Each option is a toggle button
 * with its own `lang`, so a screen reader pronounces "English" in English, and its name keeps the
 * visible code ("EN English") so voice control finds it by what is on screen.
 */
export function LanguageSwitch<V extends string>({
  label,
  options,
  value,
  onChange,
}: LanguageSwitchProps<V>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-sm border-2 border-border bg-surface"
    >
      {options.map((option, index) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            lang={option.value}
            // The visible code stays in the name (WCAG 2.5.3): "ES Español".
            aria-label={`${option.code} ${option.name}`}
            aria-pressed={pressed}
            style={touchTarget}
            onClick={() => onChange(option.value)}
            className={cx(
              'px-2 font-mono text-[13px] font-semibold tracking-[0.1em]',
              index > 0 && 'border-l-2 border-border',
              pressed ? 'bg-accent text-accent-ink' : 'bg-transparent text-text hover:bg-raised',
            )}
          >
            {option.code}
          </button>
        );
      })}
    </div>
  );
}
