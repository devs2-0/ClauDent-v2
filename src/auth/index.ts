export { PermissionGate } from "./components/PermissionGate";
export { RoleBadge } from "./components/RoleBadge";
export { defaultRoles } from "./constants/defaultRoles";
export { permissionCatalog, permissionKeys } from "./constants/permissionCatalog";
export { RequireAuth } from "./guards/RequireAuth";
export { RequirePermission } from "./guards/RequirePermission";
export { useAuth } from "./hooks/useAuth";
export { useCurrentUserProfile } from "./hooks/useCurrentUserProfile";
export { usePermissions } from "./hooks/usePermissions";
export { default as LoginPage } from "./pages/LoginPage";
export { default as RegisterPage } from "./pages/RegisterPage";
export { default as ResetPasswordPage } from "./pages/ResetPasswordPage";
export { authService } from "./services/authService";
export { permissionService } from "./services/permissionService";
export { roleService } from "./services/roleService";
export { userService } from "./services/userService";
export { AuthProvider } from "./store/AuthProvider";
export type { UserProfile, UserSession } from "./types/auth.types";
export { Can } from "./components/Can";
export { useCan } from "./hooks/useCan";

export type { DenyReason } from "./hooks/useCan";

export type {
  PermissionDefinition,
  PermissionKey,
  PermissionState,
} from "./types/permission.types";

export type {
  AppUser,
  AppUserStatus,
  CreateAppUserInput,
  UpdateAppUserInput,
} from "./types/user.types";

export type {
  CreateRoleInput,
  DefaultRoleDefinition,
  Role,
  RoleStatus,
  UpdateRoleInput,
} from "./types/role.types";

export { ProtectedRouteByPermission } from "./guards/ProtectedRouteByPermission";
export { default as RolesPage } from "./pages/RolesPage";