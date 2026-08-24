import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { understoodActionSchema, type UnderstoodAction } from '@/features/actions/action-schema';

const reviewDraftStorageKey = 'handled.action-review-draft.v1';

export type ActionReviewDraft = {
  action: UnderstoodAction;
  captureId: string;
  timezone: string;
};

type ActionReviewContextValue = {
  clearDraft: () => void;
  draft: ActionReviewDraft | null;
  setDraft: (draft: ActionReviewDraft) => void;
};

const ActionReviewContext = createContext<ActionReviewContextValue | null>(null);

export function ActionReviewProvider({ children }: PropsWithChildren) {
  const [draft, setDraftState] = useState<ActionReviewDraft | null>(null);

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(reviewDraftStorageKey).then((storedDraft) => {
      if (!active || !storedDraft) return;

      try {
        const parsed = JSON.parse(storedDraft) as Partial<ActionReviewDraft>;
        const action = understoodActionSchema.safeParse(parsed.action);
        if (
          action.success &&
          typeof parsed.captureId === 'string' &&
          typeof parsed.timezone === 'string'
        ) {
          setDraftState({
            action: action.data,
            captureId: parsed.captureId,
            timezone: parsed.timezone,
          });
        }
      } catch {
        // An incomplete local draft should never block the user from recording again.
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const setDraft = useCallback((nextDraft: ActionReviewDraft) => {
    setDraftState(nextDraft);
    void AsyncStorage.setItem(reviewDraftStorageKey, JSON.stringify(nextDraft));
  }, []);

  const clearDraft = useCallback(() => {
    setDraftState(null);
    void AsyncStorage.removeItem(reviewDraftStorageKey);
  }, []);

  const value = useMemo(() => ({ clearDraft, draft, setDraft }), [clearDraft, draft, setDraft]);

  return <ActionReviewContext.Provider value={value}>{children}</ActionReviewContext.Provider>;
}

export function useActionReview() {
  const context = useContext(ActionReviewContext);
  if (!context) throw new Error('useActionReview must be used inside ActionReviewProvider.');
  return context;
}
