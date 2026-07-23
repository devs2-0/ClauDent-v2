import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "./useAuth";
import type { AppUser } from "../types/user.types";

interface UseCurrentUserProfileResult {
  profile: AppUser | null;
  loading: boolean;
  error: Error | null;
}

export const useCurrentUserProfile = (): UseCurrentUserProfileResult => {
  const { currentUser, authLoading } = useAuth();

  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!currentUser) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const userRef = doc(db, "usuarios", currentUser.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setProfile(null);
          setError(null);
          setLoading(false);
          return;
        }

        const data = snapshot.data();

        setProfile({
          uid: currentUser.uid,
          email: data.email ?? currentUser.email ?? "",
          displayName: data.displayName ?? currentUser.displayName ?? undefined,
          photoURL: data.photoURL ?? currentUser.photoURL ?? null,
          phone: data.phone ?? null,

          status: data.status ?? "inactive",

          roleIds: Array.isArray(data.roleIds) ? data.roleIds : [],
          primaryRoleId: data.primaryRoleId ?? null,

          permissions: Array.isArray(data.permissions) ? data.permissions : [],
          isAdmin: data.isAdmin === true,

          doctorId: data.doctorId ?? null,
          assistantId: data.assistantId ?? null,

          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
          createdBy: data.createdBy ?? null,
          updatedBy: data.updatedBy ?? null,
          lastLoginAt: data.lastLoginAt ?? null,
        } as AppUser);

        setError(null);
        setLoading(false);
      },
      (firebaseError) => {
        setProfile(null);
        setError(firebaseError);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [authLoading, currentUser]);

  return {
    profile,
    loading,
    error,
  };
};