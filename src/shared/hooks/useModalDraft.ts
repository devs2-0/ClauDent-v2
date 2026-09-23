import { useMemo } from "react";
import { useAuth } from "@/auth";
import { createModalDraftStore } from "@/shared/utils/modalDraft";

// Account- and form-scoped drafts, with session fallback when storage is blocked.
export const useModalDraft = <T,>(formKey: string) => {
  const { currentUser } = useAuth();
  const key = currentUser ? `claudent.draft.v1.${currentUser.uid}.${formKey}` : null;
  return useMemo(() => createModalDraftStore<T>(key), [key]);
};
