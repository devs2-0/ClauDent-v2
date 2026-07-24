import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { permissionKeys } from "../constants/permissionCatalog";
import type { PermissionKey } from "../types/permission.types";
import type { AppUser } from "../types/user.types";
import type { Role, RoleStatus } from "../types/role.types";

interface RoleFormPayload {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  permissions: PermissionKey[];
}

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

const uniquePermissions = (permissions: PermissionKey[]): PermissionKey[] => {
  return Array.from(new Set(permissions));
};

const calculateEffectivePermissions = (
  roleIds: string[],
  rolesById: Map<string, Role>,
): { permissions: PermissionKey[]; isAdmin: boolean } => {
  const effectivePermissions = new Set<PermissionKey>();
  let isAdmin = false;

  roleIds.forEach((roleId) => {
    const role = rolesById.get(roleId);

    if (!role) return;
    if (role.status !== "active") return;

    if (role.isAdmin) {
      isAdmin = true;
      permissionKeys.forEach((permission) => effectivePermissions.add(permission));
      return;
    }

    role.permissions.forEach((permission) => {
      effectivePermissions.add(permission);
    });
  });

  return {
    permissions: Array.from(effectivePermissions),
    isAdmin,
  };
};

export const roleService = {
  listRoles: async (): Promise<Role[]> => {
    const snap = await getDocs(collection(db, "roles"));

    return snap.docs
      .map((roleDoc) => normalizeRole(roleDoc.id, roleDoc.data()))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  getRole: async (roleId: string): Promise<Role | null> => {
    const snap = await getDoc(doc(db, "roles", roleId));

    if (!snap.exists()) return null;

    return normalizeRole(snap.id, snap.data());
  },

  createRole: async (
    payload: RoleFormPayload,
    actorUid?: string | null,
  ): Promise<Role> => {
    const roleRef = doc(collection(db, "roles"));
    const now = serverTimestamp() as unknown as Timestamp;

    const role: Role = {
      id: roleRef.id,
      name: payload.name.trim(),
      description: payload.description?.trim() ?? "",
      color: payload.color ?? "",
      icon: payload.icon ?? "",
      permissions: uniquePermissions(payload.permissions),
      isSystem: false,
      isAdmin: false,
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: actorUid ?? null,
      updatedBy: actorUid ?? null,
    };

    await setDoc(roleRef, role);

    return role;
  },

  updateRole: async (
    roleId: string,
    payload: Partial<RoleFormPayload> & { status?: RoleStatus },
    actorUid?: string | null,
  ): Promise<void> => {
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: actorUid ?? null,
    };

    if (payload.name !== undefined) {
      updatePayload.name = payload.name.trim();
    }

    if (payload.description !== undefined) {
      updatePayload.description = payload.description.trim();
    }

    if (payload.color !== undefined) {
      updatePayload.color = payload.color;
    }

    if (payload.icon !== undefined) {
      updatePayload.icon = payload.icon;
    }

    if (payload.status !== undefined) {
      updatePayload.status = payload.status;
    }

    if (payload.permissions !== undefined) {
      updatePayload.permissions = uniquePermissions(payload.permissions);
    }

    await updateDoc(doc(db, "roles", roleId), updatePayload);
    await roleService.recalculateUsersByRole(roleId, actorUid);
  },

  deleteRole: async (roleId: string): Promise<void> => {
    const role = await roleService.getRole(roleId);

    if (!role) {
      throw new Error("El rol no existe.");
    }

    if (role.isSystem) {
      throw new Error("No se puede eliminar un rol del sistema.");
    }

    const usageCount = await roleService.getRoleUsageCount(roleId);

    if (usageCount > 0) {
      throw new Error(
        `No se puede eliminar este rol porque está asignado a ${usageCount} usuario(s).`,
      );
    }

    await deleteDoc(doc(db, "roles", roleId));
  },

  getRoleUsageCount: async (roleId: string): Promise<number> => {
    const usersQuery = query(
      collection(db, "usuarios"),
      where("roleIds", "array-contains", roleId),
    );

    const snap = await getDocs(usersQuery);

    return snap.size;
  },

  recalculateUsersByRole: async (
    roleId: string,
    actorUid?: string | null,
  ): Promise<void> => {
    const roles = await roleService.listRoles();
    const rolesById = new Map(roles.map((role) => [role.id, role]));

    const usersQuery = query(
      collection(db, "usuarios"),
      where("roleIds", "array-contains", roleId),
    );

    const usersSnap = await getDocs(usersQuery);

    if (usersSnap.empty) return;

    const batch = writeBatch(db);

    usersSnap.docs.forEach((userDoc) => {
      const user = normalizeUser(userDoc.id, userDoc.data());
      const effective = calculateEffectivePermissions(user.roleIds, rolesById);

      batch.update(userDoc.ref, {
        permissions: effective.permissions,
        isAdmin: effective.isAdmin,
        updatedAt: serverTimestamp(),
        updatedBy: actorUid ?? null,
      });
    });

    await batch.commit();
  },

  recalculateUserPermissions: async (
    uid: string,
    actorUid?: string | null,
  ): Promise<void> => {
    const userSnap = await getDoc(doc(db, "usuarios", uid));

    if (!userSnap.exists()) return;

    const roles = await roleService.listRoles();
    const rolesById = new Map(roles.map((role) => [role.id, role]));
    const user = normalizeUser(userSnap.id, userSnap.data());
    const effective = calculateEffectivePermissions(user.roleIds, rolesById);

    await updateDoc(doc(db, "usuarios", uid), {
      permissions: effective.permissions,
      isAdmin: effective.isAdmin,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid ?? null,
    });
  },
};