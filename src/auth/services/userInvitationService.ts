import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { AppUserStatus, Role } from "@/auth";
import type { PermissionKey } from "@/auth/types/permission.types";

export type InvitationStaffType = "administrative" | "doctor" | "assistant";

export interface UserInvitation {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  status: AppUserStatus;
  roleIds: string[];
  primaryRoleId: string | null;
  permissions: PermissionKey[];
  isAdmin: boolean;

  staffType: InvitationStaffType;
  doctorId: string | null;
  assistantId: string | null;

  consumed: boolean;
  cancelled?: boolean;
  visible?: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
  consumedBy?: string | null;
}

export interface CreateUserInvitationInput {
  email: string;
  displayName: string;
  phone?: string;
  status: AppUserStatus;
  roleIds: string[];
  staffType?: InvitationStaffType;
  doctorId?: string | null;
  assistantId?: string | null;
}

const invitationsCollection = collection(db, "invitacionesUsuarios");

export const normalizeInvitationEmail = (email: string) => {
  return email.trim().toLowerCase();
};

const calculateEffectivePermissions = (roleIds: string[], roles: Role[]) => {
  const activeRolesById = new Map(
    roles
      .filter((role) => role.status === "active")
      .map((role) => [role.id, role]),
  );

  const permissions = new Set<PermissionKey>();
  let isAdmin = false;

  roleIds.forEach((roleId) => {
    const role = activeRolesById.get(roleId);
    if (!role) return;

    if (role.isAdmin) {
      isAdmin = true;
    }

    (role.permissions ?? []).forEach((permission) => {
      permissions.add(permission);
    });
  });

  return {
    permissions: Array.from(permissions),
    isAdmin,
  };
};

const mapInvitation = (id: string, data: Record<string, unknown>): UserInvitation => {
  return {
    id,
    email: typeof data.email === "string" ? data.email : id,
    displayName:
      typeof data.displayName === "string" ? data.displayName : "",
    phone: typeof data.phone === "string" ? data.phone : null,
    status:
      data.status === "inactive" || data.status === "blocked"
        ? data.status
        : "active",
    roleIds: Array.isArray(data.roleIds) ? (data.roleIds as string[]) : [],
    primaryRoleId:
      typeof data.primaryRoleId === "string" ? data.primaryRoleId : null,
    permissions: Array.isArray(data.permissions)
      ? (data.permissions as PermissionKey[])
      : [],
    isAdmin: data.isAdmin === true,
    consumed: data.consumed === true,
    cancelled: data.cancelled === true,
    visible: data.visible !== false,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
    consumedBy: typeof data.consumedBy === "string" ? data.consumedBy : null,

    staffType:
      data.staffType === "doctor" || data.staffType === "assistant"
        ? data.staffType
        : "administrative",
    doctorId: typeof data.doctorId === "string" ? data.doctorId : null,
    assistantId:
      typeof data.assistantId === "string" ? data.assistantId : null,
  };
};

export const userInvitationService = {
  listPendingInvitations: async () => {
    const q = query(
      invitationsCollection,
      where("consumed", "==", false),
      where("cancelled", "==", false),
    );

    const snap = await getDocs(q);

    return snap.docs.map((item) => mapInvitation(item.id, item.data()));
  },

  createInvitation: async (
    input: CreateUserInvitationInput,
    roles: Role[],
    actorUid?: string | null,
  ) => {
    const email = normalizeInvitationEmail(input.email);
    const displayName = input.displayName.trim();
    const phone = input.phone?.trim() || null;
    const roleIds = Array.from(new Set(input.roleIds.filter(Boolean)));
    const status = input.status;
    const staffType =
      input.staffType === "doctor" || input.staffType === "assistant"
        ? input.staffType
        : "administrative";

    const doctorId =
      staffType === "doctor" ? input.doctorId?.trim() || null : null;

    const assistantId =
      staffType === "assistant" ? input.assistantId?.trim() || null : null;

    if (staffType === "doctor" && !doctorId) {
      throw new Error("Selecciona el doctor vinculado a esta invitación.");
    }

    if (staffType === "assistant" && !assistantId) {
      throw new Error("Selecciona el asistente vinculado a esta invitación.");
    }

    if (!email) {
      throw new Error("El correo es obligatorio.");
    }

    if (!displayName) {
      throw new Error("El nombre es obligatorio.");
    }

    const invitationRef = doc(db, "invitacionesUsuarios", email);
    const existingInvitation = await getDoc(invitationRef);

    if (existingInvitation.exists()) {
      const current = existingInvitation.data();

      if (current.consumed !== true && current.cancelled !== true) {
        throw new Error("Ya existe una invitación pendiente para este correo.");
      }
    }

    const effective = calculateEffectivePermissions(roleIds, roles);

    await setDoc(invitationRef, {
      email,
      displayName,
      phone,
      status,
      roleIds,
      primaryRoleId: roleIds[0] ?? null,
      permissions: effective.permissions,
      isAdmin: effective.isAdmin,
      staffType,
      doctorId,
      assistantId,
      consumed: false,
      cancelled: false,
      visible: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actorUid ?? null,
      updatedBy: actorUid ?? null,
      consumedAt: null,
      consumedBy: null,
    });

    return {
      id: email,
      email,
      displayName,
      phone,
      status,
      roleIds,
      primaryRoleId: roleIds[0] ?? null,
      permissions: effective.permissions,
      isAdmin: effective.isAdmin,
      consumed: false,
      cancelled: false,
      visible: true,
      createdBy: actorUid ?? null,
      updatedBy: actorUid ?? null,
      consumedBy: null,
      staffType,
      doctorId,
      assistantId,
    } satisfies UserInvitation;
  },

  cancelInvitation: async (email: string, actorUid?: string | null) => {
    const normalizedEmail = normalizeInvitationEmail(email);

    await updateDoc(doc(db, "invitacionesUsuarios", normalizedEmail), {
      consumed: true,
      cancelled: true,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actorUid ?? null,
    });
  },

  softDeleteUserAccess: async (uid: string, actorUid?: string | null) => {
    await updateDoc(doc(db, "usuarios", uid), {
      status: "blocked",
      roleIds: [],
      primaryRoleId: null,
      permissions: [],
      isAdmin: false,
      visible: false,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedBy: actorUid ?? null,
      updatedBy: actorUid ?? null,
      deletedFromAuth: false,
    });
  },
};
