import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { usePermissions } from "../hooks/usePermissions";
import type { PermissionKey } from "../types/permission.types";

interface RequirePermissionProps {
  permission?: PermissionKey;
  children?: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({ permission, children }) => {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) return <Navigate to="/dashboard" replace />;

  return <>{children ?? <Outlet />}</>;
};
