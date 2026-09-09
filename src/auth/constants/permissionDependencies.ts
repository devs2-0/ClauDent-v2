import type { PermissionKey } from "../types/permission.types";

// Viewing a module never grants an action. Dependencies only restrict grants.
const sectionParents: Partial<Record<PermissionKey, PermissionKey>> = {
  "patients.record.view": "patients.view",
  "patients.clinicalHistory.view": "patients.record.view",
  "patients.clinicalHistory.update": "patients.clinicalHistory.view",
  "patients.procedures.view": "patients.record.view",
  "patients.procedures.create": "patients.procedures.view",
  "patients.procedures.update": "patients.procedures.view",
  "patients.procedures.delete": "patients.procedures.view",
  "patients.payments.view": "patients.record.view",
  "patients.quotations.view": "patients.record.view",
  "patients.odontogram.view": "patients.record.view",
  "patients.odontogram.update": "patients.odontogram.view",
  "patients.attachments.view": "patients.record.view",
  "patients.attachments.upload": "patients.attachments.view",
  "patients.attachments.delete": "patients.attachments.view",
  "agenda.doctors.manage": "agenda.doctors.view",
  "agenda.assistants.manage": "agenda.assistants.view",
  "agenda.blocks.create": "agenda.availability.view",
  "agenda.blocks.delete": "agenda.availability.view",
  "security.sessions.revoke": "security.sessions.view",
};

export const getPermissionDependencies = (permission: PermissionKey): PermissionKey[] => {
  const module = permission.split(".")[0];
  const parent = sectionParents[permission] ??
    (!["dashboard", "audit", "security"].includes(module) && permission !== `${module}.view`
      ? `${module}.view` as PermissionKey
      : undefined);
  return parent ? [parent, ...getPermissionDependencies(parent)] : [];
};

export const hasGrantedPermission = (grants: readonly PermissionKey[], permission: PermissionKey): boolean =>
  grants.includes(permission) && getPermissionDependencies(permission).every((parent) => grants.includes(parent));

export const removeOrphanPermissions = (grants: PermissionKey[]): PermissionKey[] =>
  [...new Set(grants)].filter((permission) => hasGrantedPermission(grants, permission));

export const togglePermissionGrant = (grants: PermissionKey[], permission: PermissionKey): PermissionKey[] => {
  if (grants.includes(permission)) return removeOrphanPermissions(grants.filter((item) => item !== permission));
  if (!getPermissionDependencies(permission).every((parent) => grants.includes(parent))) return grants;
  return [...grants, permission];
};
