import type { Timestamp } from "firebase/firestore";
import type { PermissionKey } from "./permission.types";

export type RoleStatus = "active" | "archived";

export interface Role {
  id: string;

  name: string;
  description?: string;
  color?: string;
  icon?: string;

  /**
   * Permisos seleccionados para este rol.
   * No se deben hardcodear nombres de roles para validar acceso.
   * El sistema debe validar usando PermissionKey.
   */
  permissions: PermissionKey[];

  /**
   * Rol creado por el sistema.
   * Ejemplo: admin, dentist, reception.
   * Estos roles no deberían eliminarse desde UI.
   */
  isSystem: boolean;

  /**
   * Si es true, el rol tiene acceso total.
   * Aun así, se recomienda guardar todos los permisos para facilitar UI.
   */
  isAdmin: boolean;

  status: RoleStatus;

  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export type CreateRoleInput = Omit<
  Role,
  "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "status"
> & {
  status?: RoleStatus;
};

export type UpdateRoleInput = Partial<
  Pick<
    Role,
    | "name"
    | "description"
    | "color"
    | "icon"
    | "permissions"
    | "isAdmin"
    | "status"
    | "updatedBy"
  >
>;

export type DefaultRoleDefinition = Pick<
  Role,
  | "id"
  | "name"
  | "description"
  | "color"
  | "icon"
  | "permissions"
  | "isSystem"
  | "isAdmin"
>;