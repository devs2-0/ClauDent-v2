import React from "react";

import { ProtectedRouteByPermission } from "./ProtectedRouteByPermission";
import type { PermissionKey } from "../types/permission.types";

interface RequirePermissionProps {
  permission?: PermissionKey | null;
  children?: React.ReactNode;
}

/**
 * Alias de compatibilidad.
 * Para rutas nuevas se recomienda usar ProtectedRouteByPermission.
 */
export const RequirePermission = ({
  permission,
  children,
}: RequirePermissionProps) => {
  return (
    <ProtectedRouteByPermission permission={permission}>
      {children}
    </ProtectedRouteByPermission>
  );
};