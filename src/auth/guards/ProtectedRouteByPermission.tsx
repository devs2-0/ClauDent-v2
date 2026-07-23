import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { SinPermisosPage } from "@/shared";
import { useCan } from "../hooks/useCan";
import type { PermissionKey } from "../types/permission.types";

interface ProtectedRouteByPermissionProps {
  permission?: PermissionKey | null;
  children?: React.ReactNode;
}

export const ProtectedRouteByPermission = ({
  permission,
  children,
}: ProtectedRouteByPermissionProps) => {
  const location = useLocation();
  const { allowed, loading, reason } = useCan(permission);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Validando permisos...
      </div>
    );
  }

  if (reason === "no_session") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowed) {
    return <SinPermisosPage />;
  }

  return <>{children ?? <Outlet />}</>;
};