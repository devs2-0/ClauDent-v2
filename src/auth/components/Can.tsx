import React from "react";

import { useCan } from "../hooks/useCan";
import type { PermissionKey } from "../types/permission.types";

interface CanProps {
  permission?: PermissionKey | null;
  every?: PermissionKey[];
  some?: PermissionKey[];
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  children: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({
  permission,
  every,
  some,
  fallback = null,
  loadingFallback = null,
  children,
}) => {
  const { allowed, loading, canEvery, canSome } = useCan(permission);

  if (loading) {
    return <>{loadingFallback}</>;
  }

  const hasSinglePermission = permission ? allowed : true;
  const hasEveryPermission = every ? canEvery(every) : true;
  const hasSomePermission = some ? canSome(some) : true;

  const canRender =
    hasSinglePermission && hasEveryPermission && hasSomePermission;

  if (!canRender) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};