import type { Role } from '../types/role.types';

export const roleExpirationDate = (role: Pick<Role, 'expiresAt'>): Date | null => {
  const value = role.expiresAt;
  const date = value && typeof value.toDate === 'function' ? value.toDate() : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
};

export const isRoleExpired = (role: Role, now = new Date()): boolean => {
  if (!role.temporary || role.isSystem || role.isAdmin) return false;
  const expiration = roleExpirationDate(role);
  // A malformed temporary role must never grant indefinite access.
  return !expiration || expiration <= now;
};

export const withRoleLifetime = (role: Role, now = new Date()): Role =>
  isRoleExpired(role, now) ? { ...role, status: 'archived' } : role;
