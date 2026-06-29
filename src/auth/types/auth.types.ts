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

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  roleIds?: string[];
  permissions?: string[];
}
