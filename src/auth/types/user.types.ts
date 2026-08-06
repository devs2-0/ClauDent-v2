import type { Timestamp } from "firebase/firestore";
import type { PermissionKey } from "./permission.types";

export type AppUserStatus = "active" | "inactive" | "blocked";

export interface AppUser {
  /**
   * Debe ser el mismo uid de Firebase Auth.
   */
  uid: string;

  email: string;
  displayName?: string;
  photoURL?: string | null;
  phone?: string | null;

  /**
   * Control interno del sistema.
   * blocked debe impedir operar aunque el usuario exista en Firebase Auth.
   */
  status: AppUserStatus;

  /**
   * ClauDent soportará varios roles por usuario.
   * Esto permite comportamiento tipo Discord.
   */
  roleIds: string[];

  /**
   * Rol principal para mostrar badge, color o etiqueta en UI.
   * No debe usarse como única fuente de permisos.
   */
  primaryRoleId?: string | null;

  /**
   * Permisos finales calculados a partir de los roles asignados.
   * Este campo facilita guards, menús, UI y futuras reglas de Firestore.
   */
  permissions: PermissionKey[];

  /**
   * Acceso administrativo calculado.
   * Debe ser true si al menos uno de sus roles tiene isAdmin = true.
   */
  isAdmin: boolean;

  /**
   * Relaciones futuras con módulos.
   */
  doctorId?: string | null;
  assistantId?: string | null;

  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  lastLoginAt?: Timestamp | null;
}

export type CreateAppUserInput = Omit<
  AppUser,
  "createdAt" | "updatedAt" | "createdBy" | "updatedBy" | "lastLoginAt"
>;

export type UpdateAppUserInput = Partial<
  Pick<
    AppUser,
    | "displayName"
    | "photoURL"
    | "phone"
    | "status"
    | "roleIds"
    | "primaryRoleId"
    | "permissions"
    | "isAdmin"
    | "doctorId"
    | "assistantId"
    | "updatedBy"
  >
>;