import { useCan } from "./useCan";
import type { PermissionKey, PermissionState } from "../types/permission.types";

export const usePermissions = (): PermissionState => {
  const { permissions, can, canEvery, canSome } = useCan();

  const hasPermission = (permission?: PermissionKey | null) => {
    return can(permission);
  };

  return {
    permissions,
    hasPermission,
    hasEveryPermission: canEvery,
    hasSomePermission: canSome,
  };
};