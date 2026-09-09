import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { SinPermisosPage } from "@/shared";
import { AuthLoadingScreen } from "../components/AuthLoadingScreen";
import { useCan } from "../hooks/useCan";
import type { PermissionKey } from "../types/permission.types";

interface ProtectedRouteByPermissionProps {
  permission?: PermissionKey | null;
  anyPermission?: PermissionKey[];
  children?: React.ReactNode;
}

export const ProtectedRouteByPermission = ({
  permission,
  anyPermission,
  children,
}: ProtectedRouteByPermissionProps) => {
  const location = useLocation();
  const { allowed, loading, reason, canSome } = useCan(permission);

  if (loading) {
    return (
      <AuthLoadingScreen
        message="Validando permisos..."
        className="min-h-[50vh] bg-transparent"
      />
    );
  }

  if (reason === "no_session") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowed || (anyPermission && !canSome(anyPermission))) {
    return <SinPermisosPage />;
  }

  return <>{children ?? <Outlet />}</>;
};
