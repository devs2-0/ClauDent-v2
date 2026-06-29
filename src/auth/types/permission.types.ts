export type PermissionKey = string;

export interface PermissionDefinition {
  key: PermissionKey;
  module: string;
  description: string;
}

export interface PermissionState {
  permissions: PermissionKey[];
  hasPermission: (permission?: PermissionKey | null) => boolean;
  hasEveryPermission: (permissions: PermissionKey[]) => boolean;
  hasSomePermission: (permissions: PermissionKey[]) => boolean;
}
