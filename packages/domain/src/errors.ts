/**
 * Thrown for caller bugs (non-finite numbers, non-positive distances). Cases an archer can reach
 * are never exceptions: they come back as a `CalcFailure` (SIGHT-MATH §3, errors.md §4.5).
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export type CalcErrorCode =
  'SM-CALC-422-001' | 'SM-CALC-422-002' | 'SM-CALC-422-003' | 'SM-CALC-422-004' | 'SM-CALC-422-005';

export type CalcFailure = {
  readonly ok: false;
  readonly code: CalcErrorCode;
  readonly params: Readonly<Record<string, number>>;
};
