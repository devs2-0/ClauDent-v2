import type { PermissionKey } from '@/auth/types/permission.types';

// Preserve both existing grants. Neither grants access without the inventory view.
export const canRegisterStockEntry = (can: (permission: PermissionKey) => boolean) =>
  can('inventory.view') && (can('inventory.stock.adjust') || can('inventory.purchaseList.manage'));
