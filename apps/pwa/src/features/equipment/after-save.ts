import { useNavigate } from '@tanstack/react-router';
import * as z from 'zod/mini';

/**
 * Where a form of new equipment goes after saving when the archer came from a guide (F1-17): back to
 * the Home guide, or on to the new setup with what they just loaded already chosen. A closed list, not
 * a free path: nothing the URL says can send them anywhere else.
 */
export const afterSaveSearch = z.catch(z.optional(z.enum(['home', 'setup'])), undefined);
export type AfterSave = 'home' | 'setup';

type Kind = 'bow' | 'sight' | 'arrowSet';

export function useAfterSave(
  kind: Kind,
  fallback: '/bows' | '/sights' | '/arrows',
  next: AfterSave | undefined,
) {
  const navigate = useNavigate();
  /** `createdId` is set only when the form made a new one: an edit goes back to its list. */
  return async (createdId: string | undefined): Promise<void> => {
    if (createdId === undefined || next === undefined) return navigate({ to: fallback });
    if (next === 'home') return navigate({ to: '/' });
    return navigate({
      to: '/setups/new',
      search:
        kind === 'bow'
          ? { bow: createdId }
          : kind === 'sight'
            ? { sight: createdId }
            : { arrowSet: createdId },
    });
  };
}
