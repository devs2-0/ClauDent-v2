"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEmployeeUser = exports.updateEmployeeStatus = exports.assignEmployeeRoles = exports.createEmployeeUser = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const callableOptions = {
    region: "us-central1",
    cors: true,
};
const normalizeEmail = (email) => {
    if (typeof email !== "string")
        return "";
    return email.trim().toLowerCase();
};
const normalizeString = (value) => {
    if (typeof value !== "string")
        return "";
    return value.trim();
};
const normalizeRoleIds = (value) => {
    if (!Array.isArray(value))
        return [];
    return Array.from(new Set(value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)));
};
const getCurrentUserProfile = async (uid) => {
    const snap = await db.doc(`usuarios/${uid}`).get();
    if (!snap.exists)
        return null;
    const data = snap.data() ?? {};
    return {
        uid,
        email: typeof data.email === "string" ? data.email : "",
        displayName: typeof data.displayName === "string" ? data.displayName : undefined,
        phone: typeof data.phone === "string" ? data.phone : null,
        status: data.status ?? "inactive",
        roleIds: Array.isArray(data.roleIds) ? data.roleIds : [],
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        isAdmin: data.isAdmin === true,
    };
};
const assertPermission = async (requestUid, permission) => {
    if (!requestUid) {
        throw new https_1.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    const profile = await getCurrentUserProfile(requestUid);
    if (!profile || profile.status !== "active") {
        throw new https_1.HttpsError("permission-denied", "Usuario inactivo o bloqueado.");
    }
    if (profile.isAdmin)
        return profile;
    if (!profile.permissions.includes(permission)) {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos para esta acción.");
    }
    return profile;
};
const listActiveRoles = async () => {
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
        };
    })
        .filter((role) => role.status === "active");
};
const calculateEffectivePermissions = async (roleIds) => {
    const roles = await listActiveRoles();
    const rolesById = new Map(roles.map((role) => [role.id, role]));
    const permissions = new Set();
    let isAdmin = false;
    roleIds.forEach((roleId) => {
        const role = rolesById.get(roleId);
        if (!role)
            return;
        if (role.isAdmin) {
            isAdmin = true;
        }
        (role.permissions ?? []).forEach((permission) => permissions.add(permission));
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
const assertNotLeavingWithoutAdmin = async (uid, nextStatus, nextIsAdmin) => {
    const currentUser = await getCurrentUserProfile(uid);
    if (!currentUser)
        return;
    const currentlyActiveAdmin = currentUser.status === "active" && currentUser.isAdmin;
    const willBeActiveAdmin = nextStatus === "active" && nextIsAdmin;
    if (!currentlyActiveAdmin || willBeActiveAdmin)
        return;
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) {
        throw new https_1.HttpsError("failed-precondition", "No se puede dejar el sistema sin un administrador activo.");
    }
};
exports.createEmployeeUser = (0, https_1.onCall)(callableOptions, async (request) => {
    const actor = await assertPermission(request.auth?.uid, "users.create");
    const email = normalizeEmail(request.data?.email);
    const displayName = normalizeString(request.data?.displayName);
    const password = normalizeString(request.data?.password);
    const phone = normalizeString(request.data?.phone);
    const roleIds = normalizeRoleIds(request.data?.roleIds);
    const status = request.data?.status === "inactive" || request.data?.status === "blocked"
        ? request.data.status
        : "active";
    if (!email) {
        throw new https_1.HttpsError("invalid-argument", "El correo es obligatorio.");
    }
    if (!displayName) {
        throw new https_1.HttpsError("invalid-argument", "El nombre es obligatorio.");
    }
    if (password.length < 6) {
        throw new https_1.HttpsError("invalid-argument", "La contraseña debe tener al menos 6 caracteres.");
    }
    const effective = await calculateEffectivePermissions(roleIds);
    const authUser = await (0, auth_1.getAuth)().createUser({
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
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
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
    }
    catch (error) {
        await (0, auth_1.getAuth)().deleteUser(authUser.uid);
        throw error;
    }
});
exports.assignEmployeeRoles = (0, https_1.onCall)(callableOptions, async (request) => {
    const actor = await assertPermission(request.auth?.uid, "roles.assign");
    const uid = normalizeString(request.data?.uid);
    const roleIds = normalizeRoleIds(request.data?.roleIds);
    if (!uid) {
        throw new https_1.HttpsError("invalid-argument", "Falta el UID del usuario.");
    }
    const user = await getCurrentUserProfile(uid);
    if (!user) {
        throw new https_1.HttpsError("not-found", "El usuario no existe.");
    }
    const effective = await calculateEffectivePermissions(roleIds);
    await assertNotLeavingWithoutAdmin(uid, user.status, effective.isAdmin);
    await db.doc(`usuarios/${uid}`).update({
        roleIds,
        primaryRoleId: roleIds[0] ?? null,
        permissions: effective.permissions,
        isAdmin: effective.isAdmin,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
    });
    return {
        uid,
        roleIds,
        permissions: effective.permissions,
        isAdmin: effective.isAdmin,
    };
});
exports.updateEmployeeStatus = (0, https_1.onCall)(callableOptions, async (request) => {
    const actor = await assertPermission(request.auth?.uid, "users.update");
    const uid = normalizeString(request.data?.uid);
    const status = request.data?.status;
    if (!uid) {
        throw new https_1.HttpsError("invalid-argument", "Falta el UID del usuario.");
    }
    if (!["active", "inactive", "blocked"].includes(status)) {
        throw new https_1.HttpsError("invalid-argument", "Estado inválido.");
    }
    const user = await getCurrentUserProfile(uid);
    if (!user) {
        throw new https_1.HttpsError("not-found", "El usuario no existe.");
    }
    await assertNotLeavingWithoutAdmin(uid, status, user.isAdmin);
    await Promise.all([
        (0, auth_1.getAuth)().updateUser(uid, {
            disabled: status !== "active",
        }),
        db.doc(`usuarios/${uid}`).update({
            status,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedBy: actor.uid,
        }),
    ]);
    return {
        uid,
        status,
    };
});
exports.deleteEmployeeUser = (0, https_1.onCall)(callableOptions, async (request) => {
    await assertPermission(request.auth?.uid, "users.delete");
    const uid = normalizeString(request.data?.uid);
    if (!uid) {
        throw new https_1.HttpsError("invalid-argument", "Falta el UID del usuario.");
    }
    const user = await getCurrentUserProfile(uid);
    if (!user) {
        throw new https_1.HttpsError("not-found", "El usuario no existe.");
    }
    await assertNotLeavingWithoutAdmin(uid, "inactive", false);
    await (0, auth_1.getAuth)().deleteUser(uid);
    await db.doc(`usuarios/${uid}`).update({
        status: "blocked",
        deletedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        deletedFromAuth: true,
    });
    return {
        uid,
        deleted: true,
    };
});
