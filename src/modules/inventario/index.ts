export { useInventory } from "./hooks/useInventory";
export { default as InventarioPage } from "./pages/InventarioPage";
export { inventoryService } from "./services/inventoryService";
export { InventoryProvider } from "./store/InventoryProvider";
export type {
  CreateInventoryCategoryInput,
  CreateInventoryProductInput,
  InventoryCategoryRecord,
  InventoryCategory,
  InventoryMovement,
  InventoryMovementType,
  InventoryProduct,
  InventoryReferenceType,
  InventoryStatus,
  InventoryStockEntry,
  InventoryStockEntryItem,
  RegisterInventoryMovementInput,
  RegisterStockEntryInput,
} from "./types/inventory.types";
