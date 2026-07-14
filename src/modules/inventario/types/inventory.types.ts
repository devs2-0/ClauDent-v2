export type InventoryCategory = string;
export type InventoryStatus = "activo" | "inactivo";
export type InventoryMovementType = "entrada" | "venta" | "uso_clinico" | "devolucion" | "merma" | "caducidad" | "ajuste";
export type InventoryReferenceType = "manual" | "pago" | "cotizacion" | "tratamiento" | "entrada_stock";

export interface InventoryCategoryRecord {
  id: string;
  nombre: string;
  descripcion: string;
  estado: InventoryStatus;
  sistema?: boolean;
}

export interface InventoryProduct {
  id: string;
  nombre: string;
  nombreNormalizado?: string;
  marca?: string;
  marcaNormalizada?: string;
  categoria: InventoryCategory;
  unidad: string;
  stock: number;
  stockMinimo: number;
  costoUnitario: number;
  precioVenta: number | null;
  proveedor?: string;
  estado: InventoryStatus;
  notas?: string;
}

export interface InventoryMovement {
  id: string;
  productoId: string;
  productoNombre: string;
  fecha: string;
  tipo: InventoryMovementType;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  motivo: string;
  referenciaTipo: InventoryReferenceType;
  referenciaId?: string | null;
  lote?: string;
  fechaVencimiento?: string | null;
  proveedor?: string;
  documentoCompra?: string;
}

export type CreateInventoryProductInput = Omit<InventoryProduct, "id">;

export type CreateInventoryCategoryInput = Omit<InventoryCategoryRecord, "id" | "estado" | "sistema"> & {
  estado?: InventoryStatus;
};

export interface RegisterInventoryMovementInput {
  productoId: string;
  fecha: string;
  tipo: InventoryMovementType;
  cantidad: number;
  motivo: string;
  referenciaTipo?: InventoryReferenceType;
  referenciaId?: string | null;
  lote?: string;
  fechaVencimiento?: string | null;
  proveedor?: string;
  documentoCompra?: string;
}

export interface InventoryStockEntryItem {
  productoId: string;
  productoNombre?: string;
  cantidad: number;
  lote: string;
  fechaVencimiento?: string | null;
}

export interface InventoryStockEntry {
  id: string;
  fecha: string;
  proveedor: string;
  documentoCompra: string;
  notas?: string;
  items: InventoryStockEntryItem[];
  totalProductos: number;
  totalUnidades: number;
}

export interface RegisterStockEntryInput {
  fecha: string;
  proveedor: string;
  documentoCompra: string;
  notas?: string;
  items: InventoryStockEntryItem[];
}
