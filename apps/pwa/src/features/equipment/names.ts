/** The name an archer gives a piece of equipment: their nickname, or what the maker called it. */
export function componentName(ref: {
  nickname?: string | null | undefined;
  manufacturer?: string | null | undefined;
  model?: string | null | undefined;
}): string | undefined {
  if (ref.nickname) return ref.nickname;
  const made = [ref.manufacturer, ref.model].filter(Boolean).join(' ');
  return made === '' ? undefined : made;
}
