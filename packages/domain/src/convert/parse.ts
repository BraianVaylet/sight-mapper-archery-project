const DECIMAL = /^([+-]?)(\d+[.,]?\d*|[.,]\d+)$/;
const MIXED = /^([+-]?)(\d+)[ -]+(\d+)\/(\d+)$/;
const FRACTION = /^([+-]?)(\d+)\/(\d+)$/;

/**
 * Parses a number typed with a comma or a point as decimal separator. Returns `null` when it is
 * not one: user input is never an exception. Thousands separators are not accepted ("1.234,5"
 * is ambiguous), so a string with both separators is rejected by the pattern.
 */
export function parseDecimal(text: string): number | null {
  const match = DECIMAL.exec(text.trim());
  if (match === null) return null;
  const [, sign = '', body = ''] = match;
  const value = Number(`${sign}${body.replace(',', '.')}`);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parses an imperial length typed as decimal (`6.25`, `6,25`), fraction (`1/16`) or mixed number
 * (`6 1/4`, `6-1/4`). The result is in inches, as typed; convert with `toCanonical`.
 */
export function parseImperial(text: string): number | null {
  const trimmed = text.trim();

  const mixed = MIXED.exec(trimmed);
  if (mixed !== null) {
    const [, sign = '', whole = '', numerator = '', denominator = ''] = mixed;
    return signed(sign, fraction(Number(whole), Number(numerator), Number(denominator)));
  }

  const simple = FRACTION.exec(trimmed);
  if (simple !== null) {
    const [, sign = '', numerator = '', denominator = ''] = simple;
    return signed(sign, fraction(0, Number(numerator), Number(denominator)));
  }

  return parseDecimal(trimmed);
}

function fraction(whole: number, numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return whole + numerator / denominator;
}

function signed(sign: string, value: number | null): number | null {
  if (value === null) return null;
  return sign === '-' ? -value : value;
}
