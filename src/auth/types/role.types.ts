import type { PermissionKey } from "./permission.types";

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: PermissionKey[];
  isSystem?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface DefaultRoleDefinition extends Omit<Role, "id"> {
  id: string;
}
