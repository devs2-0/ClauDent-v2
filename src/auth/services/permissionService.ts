import { permissionCatalog, permissionKeys } from "../constants/permissionCatalog";

export const permissionService = {
  listPermissions: () => permissionCatalog,
  isKnownPermission: (permission: string) => permissionKeys.includes(permission),
};
