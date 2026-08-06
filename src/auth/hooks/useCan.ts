import { useCallback, useMemo } from "react";

import { useAuth } from "./useAuth";
import { useCurrentUserProfile } from "./useCurrentUserProfile";
import type { PermissionKey } from "../types/permission.types";

export type DenyReason =
  | "loading"
  | "no_session"
  | "no_profile"
  | "inactive_user"
  | "blocked_user"
  | "no_role"
  | "missing_permission";

interface UseCanResult {
  allowed: boolean;
  loading: boolean;
  reason: DenyReason | null;
  can: (permission?: PermissionKey | null) => boolean;
  canEvery: (permissions: PermissionKey[]) => boolean;
  canSome: (permissions: PermissionKey[]) => boolean;
  permissions: PermissionKey[];
}

export const useCan = (permission?: PermissionKey | null): UseCanResult => {
  const { currentUser, authLoading } = useAuth();
  const { profile, loading: profileLoading } = useCurrentUserProfile();

  const loading = authLoading || profileLoading;

  const permissions = useMemo<PermissionKey[]>(() => {
    if (!profile?.permissions || !Array.isArray(profile.permissions)) {
      return [];
    }

    return profile.permissions;
  }, [profile]);

  const reason = useMemo<DenyReason | null>(() => {
    if (loading) return "loading";
    if (!currentUser) return "no_session";
    if (!profile) return "no_profile";
    if (profile.status === "blocked") return "blocked_user";
    if (profile.status !== "active") return "inactive_user";
    if (!profile.roleIds || profile.roleIds.length === 0) return "no_role";

    return null;
  }, [currentUser, loading, profile]);

  const can = useCallback(
    (targetPermission?: PermissionKey | null): boolean => {
      if (!targetPermission) return true;

      if (loading) return false;
      if (!currentUser) return false;
      if (!profile) return false;
      if (profile.status !== "active") return false;
      if (!profile.roleIds || profile.roleIds.length === 0) return false;

      if (profile.isAdmin) return true;

      return permissions.includes(targetPermission);
    },
    [currentUser, loading, permissions, profile],
  );

  const canEvery = useCallback(
    (requiredPermissions: PermissionKey[]): boolean => {
      return requiredPermissions.every((requiredPermission) =>
        can(requiredPermission),
      );
    },
    [can],
  );

  const canSome = useCallback(
    (requiredPermissions: PermissionKey[]): boolean => {
      return requiredPermissions.some((requiredPermission) =>
        can(requiredPermission),
      );
    },
    [can],
  );

  return {
    allowed: can(permission),
    loading,
    reason: permission ? (can(permission) ? null : reason ?? "missing_permission") : null,
    can,
    canEvery,
    canSome,
    permissions,
  };
};