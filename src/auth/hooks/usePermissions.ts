import { useMemo } from "react";
import { permissionKeys } from "../constants/permissionCatalog";
import { useAuth } from "./useAuth";
import type { PermissionKey, PermissionState } from "../types/permission.types";

export const usePermissions = (): PermissionState => {
  const { currentUser } = useAuth();

  const permissions = useMemo<PermissionKey[]>(() => {
    if (!currentUser) return [];
    return permissionKeys;
  }, [currentUser]);

  const hasPermission = (permission?: PermissionKey | null) => {
    if (!permission) return true;
    if (!currentUser) return false;
    return permissions.includes(permission);
  };

  return {
    permissions,
    hasPermission,
    hasEveryPermission: (requiredPermissions) => requiredPermissions.every(hasPermission),
    hasSomePermission: (requiredPermissions) => requiredPermissions.some(hasPermission),
  };
};
