import { useAuth } from "./useAuth";
import type { AppUser } from "../types/user.types";

interface UseCurrentUserProfileResult {
  profile: AppUser | null;
  loading: boolean;
  error: Error | null;
}

export const useCurrentUserProfile = (): UseCurrentUserProfileResult => {
  const { currentUserProfile, profileLoading, profileError } = useAuth();

  return {
    profile: currentUserProfile,
    loading: profileLoading,
    error: profileError,
  };
};
