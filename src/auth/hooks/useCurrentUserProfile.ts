import { useAuth } from "./useAuth";

export const useCurrentUserProfile = () => {
  const { currentUser, authLoading } = useAuth();

  return {
    profile: currentUser
      ? {
          id: currentUser.uid,
          email: currentUser.email || "",
          displayName: currentUser.displayName || undefined,
        }
      : null,
    loading: authLoading,
  };
};
