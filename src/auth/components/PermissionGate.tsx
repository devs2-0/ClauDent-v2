import React from "react";

import { Can } from "./Can";
import type { PermissionKey } from "../types/permission.types";

interface PermissionGateProps {
  permission?: PermissionKey | null;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Alias semántico de Can.
 * Se mantiene para compatibilidad con código existente.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  fallback = null,
  children,
}) => {
  return (
    <Can permission={permission} fallback={fallback}>
      {children}
    </Can>
  );
};