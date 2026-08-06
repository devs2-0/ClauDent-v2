import type { AppUser } from "./user.types";

export interface UserSession {
  id: string;
  deviceType: string;
  deviceLabel?: string;
  browser: string;
  browserVersion?: string;
  os?: string;
  platform?: string;
  lastActive: any;
  isCurrent: boolean;
}

/**
 * Alias temporal para no romper imports existentes.
 * A futuro se puede migrar todo a AppUser.
 */
export type UserProfile = AppUser;