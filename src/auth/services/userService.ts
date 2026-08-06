import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { permissionKeys } from "../constants/permissionCatalog";
import type { PermissionKey } from "../types/permission.types";
import type { Role } from "../types/role.types";
import type { AppUser, AppUserStatus } from "../types/user.types";

const normalizeRole = (id: string, data: any): Role => ({
  id,
  name: data.name ?? "",
  description: data.description ?? "",
  color: data.color ?? "",
  icon: data.icon ?? "",
  permissions: Array.isArray(data.permissions) ? data.permissions : [],
  isSystem: data.isSystem === true,
  isAdmin: data.isAdmin === true,
  status: data.status ?? "active",
  createdAt: data.createdAt ?? null,
  updatedAt: data.updatedAt ?? null,
  createdBy: data.createdBy ?? null,
  updatedBy: data.updatedBy ?? null,
});

const normalizeUser = (id: string, data: any): AppUser => ({
  uid: data.uid ?? id,
  email: data.email ?? "",
  displayName: data.displayName ?? undefined,
  photoURL: data.photoURL ?? null,
  phone: data.phone ?? null,
  status: data.status ?? "inactive",
  roleIds: Array.isArray(data.roleIds) ? data.roleIds : [],
  primaryRoleId: data.primaryRoleId ?? null,
  permissions: Array.isArray(data.permissions) ? data.permissions : [],
  isAdmin: data.isAdmin === true,
  doctorId: data.doctorId ?? null,
  assistantId: data.assistantId ?? null,
  createdAt: data.createdAt ?? null,
  updatedAt: data.updatedAt ?? null,
  createdBy: data.createdBy ?? null,
  updatedBy: data.updatedBy ?? null,
  lastLoginAt: data.lastLoginAt ?? null,
});

const listActiveRoles = async (): Promise<Role[]> => {
  const snap = await getDocs(collection(db, "roles"));

  return snap.docs
    .map((roleDoc) => normalizeRole(roleDoc.id, roleDoc.data()))
    .filter((role) => role.status === "active");
};

const calculateEffectivePermissions = (
  roleIds: string[],
  roles: Role[],
): { permissions: PermissionKey[]; isAdmin: boolean } => {
  const rolesById = new Map(roles.map((role) => [role.id, role]));
  const effectivePermissions = new Set<PermissionKey>();
  let isAdmin = false;

  roleIds.forEach((roleId) => {
    const role = rolesById.get(roleId);

    if (!role) return;
    if (role.status !== "active") return;

    if (role.isAdmin) {
      isAdmin = true;
      permissionKeys.forEach((permission) =>
        effectivePermissions.add(permission),
      );
      return;
    }

    role.permissions.forEach((permission) =>
      effectivePermissions.add(permission),
    );
  });

  return {
    permissions: Array.from(effectivePermissions),
    isAdmin,
  };
};

const countActiveAdmins = async (): Promise<number> => {
  const adminsQuery = query(
    collection(db, "usuarios"),
    where("isAdmin", "==", true),
    where("status", "==", "active"),
  );

  const snap = await getDocs(adminsQuery);

  return snap.size;
};

export const userService = {
  listUsers: async (): Promise<AppUser[]> => {
    const snap = await getDocs(collection(db, "usuarios"));

    return snap.docs
      .map((userDoc) => normalizeUser(userDoc.id, userDoc.data()))
      .sort((a, b) => a.email.localeCompare(b.email));
  },

  getUser: async (uid: string): Promise<AppUser | null> => {
    const snap = await getDoc(doc(db, "usuarios", uid));

    if (!snap.exists()) return null;

    return normalizeUser(snap.id, snap.data());
  },

  assignRoles: async (
    uid: string,
    roleIds: string[],
    actorUid?: string | null,
  ): Promise<void> => {
    const user = await userService.getUser(uid);

    if (!user) {
      throw new Error("El usuario no existe.");
    }

    const roles = await listActiveRoles();
    const uniqueRoleIds = Array.from(new Set(roleIds));
    const effective = calculateEffectivePermissions(uniqueRoleIds, roles);

    const activeAdminCount = await countActiveAdmins();

    const userWasActiveAdmin = user.status === "active" && user.isAdmin;
    const userWillBeActiveAdmin =
      user.status === "active" && effective.isAdmin === true;

    if (userWasActiveAdmin && !userWillBeActiveAdmin && activeAdminCount <= 1) {
      throw new Error(
        "No se puede quitar el último administrador activo del sistema.",
      );
    }

    await updateDoc(doc(db, "usuarios", uid), {
      roleIds: uniqueRoleIds,
      primaryRoleId: uniqueRoleIds[0] ?? null,
      permissions: effective.permissions,
      isAdmin: effective.isAdmin,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid ?? null,
    });
  },

  updateUserStatus: async (
    uid: string,
    status: AppUserStatus,
    actorUid?: string | null,
  ): Promise<void> => {
    const user = await userService.getUser(uid);

    if (!user) {
      throw new Error("El usuario no existe.");
    }

    const activeAdminCount = await countActiveAdmins();

    const userWasActiveAdmin = user.status === "active" && user.isAdmin;
    const userWillBeActiveAdmin = status === "active" && user.isAdmin;

    if (userWasActiveAdmin && !userWillBeActiveAdmin && activeAdminCount <= 1) {
      throw new Error(
        "No se puede desactivar o bloquear al último administrador activo.",
      );
    }

    await updateDoc(doc(db, "usuarios", uid), {
      status,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid ?? null,
    });
  },

  recalculateUserPermissions: async (
    uid: string,
    actorUid?: string | null,
  ): Promise<void> => {
    const user = await userService.getUser(uid);

    if (!user) {
      throw new Error("El usuario no existe.");
    }

    const roles = await listActiveRoles();
    const effective = calculateEffectivePermissions(user.roleIds, roles);

    await updateDoc(doc(db, "usuarios", uid), {
      permissions: effective.permissions,
      isAdmin: effective.isAdmin,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid ?? null,
    });
  },

  getActiveAdminCount: countActiveAdmins,
};