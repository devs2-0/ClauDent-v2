import type { AppUser } from "./user.types";

export interface UserSession {
  id: string;
  userId?: string;
  userEmail?: string | null;
  userName?: string | null;
  deviceType: string;
  deviceLabel?: string;
  browser: string;
  browserVersion?: string;
  os?: string;
  platform?: string;
  language?: string;
  timezone?: string;
  screen?: string;
  viewport?: string;
  userAgent?: string;
  online?: boolean;
  visibility?: string;
  startedAt?: any;
  updatedAt?: any;
  lastActive: any;
  status?: "active" | "revoked";
  revokedAt?: any;
  revokedByUid?: string | null;
  revokedByEmail?: string | null;
  revokedByName?: string | null;
  revokeReason?: string | null;
  isCurrent: boolean;
}

/**
 * Alias temporal para no romper imports existentes.
 * A futuro se puede migrar todo a AppUser.
 */
export type UserProfile = AppUser;
