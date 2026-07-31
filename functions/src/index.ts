import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";
import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
initializeApp();

type UserStatus = "active" | "inactive" | "blocked";

interface Role {
  id: string;
  name?: string;
  permissions?: string[];
  isAdmin?: boolean;
  status?: "active" | "archived";
}

interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  phone?: string | null;
  status: UserStatus;
  roleIds: string[];
  permissions: string[];
  isAdmin: boolean;
}

const db = getFirestore();

const callableOptions = {
  region: "us-central1",
  cors: true,
};

const normalizeEmail = (email: unknown) => {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
};

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const normalizeRoleIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
};

const getCurrentUserProfile = async (uid: string): Promise<AppUser | null> => {
  const snap = await db.doc(`usuarios/${uid}`).get();

  if (!snap.exists) return null;

  const data = snap.data() ?? {};

  return {
    uid,
    email: typeof data.email === "string" ? data.email : "",
    displayName:
      typeof data.displayName === "string" ? data.displayName : undefined,
    phone: typeof data.phone === "string" ? data.phone : null,
    status: (data.status as UserStatus) ?? "inactive",
    roleIds: Array.isArray(data.roleIds) ? data.roleIds : [],
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    isAdmin: data.isAdmin === true,
  };
};

const assertPermission = async (
  requestUid: string | undefined,
  permission: string,
) => {
  if (!requestUid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const profile = await getCurrentUserProfile(requestUid);

  if (!profile || profile.status !== "active") {
    throw new HttpsError("permission-denied", "Usuario inactivo o bloqueado.");
  }

  if (profile.isAdmin) return profile;

  if (!profile.permissions.includes(permission)) {
    throw new HttpsError(
      "permission-denied",
      "No tienes permisos para esta acción.",
    );
  }

  return profile;
};

const listActiveRoles = async (): Promise<Role[]> => {
  const snap = await db.collection("roles").get();

  return snap.docs
    .map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        name: typeof data.name === "string" ? data.name : "",
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        isAdmin: data.isAdmin === true,
        status: data.status === "archived" ? "archived" : "active",
      } as Role;
    })
    .filter((role) => role.status === "active");
};

const calculateEffectivePermissions = async (roleIds: string[]) => {
  const roles = await listActiveRoles();
  const rolesById = new Map(roles.map((role) => [role.id, role]));

  const permissions = new Set<string>();
  let isAdmin = false;

  roleIds.forEach((roleId) => {
    const role = rolesById.get(roleId);
    if (!role) return;

    if (role.isAdmin) {
      isAdmin = true;
    }

    (role.permissions ?? []).forEach((permission) =>
      permissions.add(permission),
    );
  });

  return {
    permissions: Array.from(permissions),
    isAdmin,
  };
};

const countActiveAdmins = async () => {
  const snap = await db
    .collection("usuarios")
    .where("isAdmin", "==", true)
    .where("status", "==", "active")
    .get();

  return snap.size;
};

const assertNotLeavingWithoutAdmin = async (
  uid: string,
  nextStatus: UserStatus,
  nextIsAdmin: boolean,
) => {
  const currentUser = await getCurrentUserProfile(uid);

  if (!currentUser) return;

  const currentlyActiveAdmin =
    currentUser.status === "active" && currentUser.isAdmin;

  const willBeActiveAdmin = nextStatus === "active" && nextIsAdmin;

  if (!currentlyActiveAdmin || willBeActiveAdmin) return;

  const activeAdmins = await countActiveAdmins();

  if (activeAdmins <= 1) {
    throw new HttpsError(
      "failed-precondition",
      "No se puede dejar el sistema sin un administrador activo.",
    );
  }
};

export const createEmployeeUser = onCall(
    callableOptions,
    async (request: CallableRequest) => {
    const actor = await assertPermission(request.auth?.uid, "users.create");

    const email = normalizeEmail(request.data?.email);
    const displayName = normalizeString(request.data?.displayName);
    const password = normalizeString(request.data?.password);
    const phone = normalizeString(request.data?.phone);
    const roleIds = normalizeRoleIds(request.data?.roleIds);
    const status: UserStatus =
        request.data?.status === "inactive" || request.data?.status === "blocked"
        ? request.data.status
        : "active";

    if (!email) {
        throw new HttpsError("invalid-argument", "El correo es obligatorio.");
    }

    if (!displayName) {
        throw new HttpsError("invalid-argument", "El nombre es obligatorio.");
    }

    if (password.length < 6) {
        throw new HttpsError(
        "invalid-argument",
        "La contraseña debe tener al menos 6 caracteres.",
        );
    }

    const effective = await calculateEffectivePermissions(roleIds);

    const authUser = await getAuth().createUser({
        email,
        password,
        displayName,
        disabled: status !== "active",
        emailVerified: false,
    });

    try {
        await db.doc(`usuarios/${authUser.uid}`).set({
        uid: authUser.uid,
        email,
        displayName,
        phone: phone || null,
        status,
        roleIds,
        primaryRoleId: roleIds[0] ?? null,
        permissions: effective.permissions,
        isAdmin: effective.isAdmin,
        photoURL: null,
        doctorId: null,
        assistantId: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: actor.uid,
        updatedBy: actor.uid,
        lastLoginAt: null,
        });

        return {
        uid: authUser.uid,
        email,
        displayName,
        status,
        };
    } catch (error) {
        await getAuth().deleteUser(authUser.uid);
        throw error;
    }
    },
);

export const assignEmployeeRoles = onCall(
  callableOptions,
  async (request: CallableRequest) => {
    const actor = await assertPermission(request.auth?.uid, "roles.assign");

    const uid = normalizeString(request.data?.uid);
    const roleIds = normalizeRoleIds(request.data?.roleIds);

    if (!uid) {
      throw new HttpsError("invalid-argument", "Falta el UID del usuario.");
    }

    const user = await getCurrentUserProfile(uid);

    if (!user) {
      throw new HttpsError("not-found", "El usuario no existe.");
    }

    const effective = await calculateEffectivePermissions(roleIds);

    await assertNotLeavingWithoutAdmin(uid, user.status, effective.isAdmin);

    await db.doc(`usuarios/${uid}`).update({
      roleIds,
      primaryRoleId: roleIds[0] ?? null,
      permissions: effective.permissions,
      isAdmin: effective.isAdmin,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    });

    return {
      uid,
      roleIds,
      permissions: effective.permissions,
      isAdmin: effective.isAdmin,
    };
  },
);

export const updateEmployeeStatus = onCall(
  callableOptions,
  async (request: CallableRequest) => {
    const actor = await assertPermission(request.auth?.uid, "users.update");

    const uid = normalizeString(request.data?.uid);
    const status = request.data?.status as UserStatus;

    if (!uid) {
      throw new HttpsError("invalid-argument", "Falta el UID del usuario.");
    }

    if (!["active", "inactive", "blocked"].includes(status)) {
      throw new HttpsError("invalid-argument", "Estado inválido.");
    }

    const user = await getCurrentUserProfile(uid);

    if (!user) {
      throw new HttpsError("not-found", "El usuario no existe.");
    }

    await assertNotLeavingWithoutAdmin(uid, status, user.isAdmin);

    await Promise.all([
      getAuth().updateUser(uid, {
        disabled: status !== "active",
      }),
      db.doc(`usuarios/${uid}`).update({
        status,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      }),
    ]);

    return {
      uid,
      status,
    };
  },
);

export const deleteEmployeeUser = onCall(
  callableOptions,
  async (request: CallableRequest) => {
    await assertPermission(request.auth?.uid, "users.delete");

    const uid = normalizeString(request.data?.uid);

    if (!uid) {
      throw new HttpsError("invalid-argument", "Falta el UID del usuario.");
    }

    const user = await getCurrentUserProfile(uid);

    if (!user) {
      throw new HttpsError("not-found", "El usuario no existe.");
    }

    await assertNotLeavingWithoutAdmin(uid, "inactive", false);

    await getAuth().deleteUser(uid);

    await db.doc(`usuarios/${uid}`).update({
      status: "blocked",
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      deletedFromAuth: true,
    });

    return {
      uid,
      deleted: true,
    };
  },
);