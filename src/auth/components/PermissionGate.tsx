import React from "react";
import { usePermissions } from "../hooks/usePermissions";
import type { PermissionKey } from "../types/permission.types";

interface PermissionGateProps {
  permission?: PermissionKey;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({ permission, fallback = null, children }) => {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) return <>{fallback}</>;

  return <>{children}</>;
};
