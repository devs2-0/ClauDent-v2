import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addAuditLog } from "@/modules/audit/services/auditService";
import { cleanData, safeDate } from "@/shared/utils/firestoreData";
import type {
  CreateInventoryCategoryInput,
  CreateInventoryProductInput,
  InventoryCategoryRecord,
  InventoryMovement,
  InventoryMovementType,
  InventoryProduct,
  InventoryStockEntry,
  RegisterInventoryMovementInput,
  RegisterStockEntryInput,
} from "../types/inventory.types";

export const INVENTORY_PRODUCTS_COLLECTION = "inventarioProductos";
export const INVENTORY_CATEGORIES_COLLECTION = "inventarioCategorias";
export const INVENTORY_MOVEMENTS_COLLECTION = "inventarioMovimientos";
export const INVENTORY_STOCK_ENTRIES_COLLECTION = "inventarioEntradas";

export const DEFAULT_INVENTORY_CATEGORIES: InventoryCategoryRecord[] = [
  { id: "vendible", nombre: "Vendible", descripcion: "Productos que se venden al paciente.", estado: "activo", sistema: true },
  { id: "clinico", nombre: "Clinico", descripcion: "Material de uso clinico interno.", estado: "activo", sistema: true },
  { id: "medicamento", nombre: "Medicamento", descripcion: "Medicamentos y articulos controlados.", estado: "activo", sistema: true },
];

const outputMovementTypes: InventoryMovementType[] = ["venta", "uso_clinico", "merma", "caducidad"];
const movementAuditLabel: Record<InventoryMovementType, string> = {
  entrada: "Reabastecimiento",
  venta: "Venta",
  uso_clinico: "Uso clinico",
  devolucion: "Devolucion",
  merma: "Merma",
  caducidad: "Caducidad",
  ajuste: "Ajuste",
};

const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const formatProductDisplayName = (name: string, brand?: string) => {
  const cleanName = name.trim();
  const cleanBrand = brand?.trim();
  return cleanBrand ? `${cleanName} (${cleanBrand})` : cleanName;
};

const formatSignedQuantity = (quantity: number) => {
  return quantity > 0 ? `+${quantity}` : String(quantity);
};

const compactAuditItems = (items: string[]) => {
  if (items.length <= 4) return items.join("; ");
  return `${items.slice(0, 4).join("; ")}; +${items.length - 4} mas`;
};

const toFirestoreDate = (date: string) => new Date(`${date}T00:00:00`);

const safeOptionalDate = (timestamp: any): string | null => {
  if (!timestamp) return null;
  return safeDate(timestamp);
};

export const resolveMovementQuantity = (tipo: InventoryMovementType, cantidad: number) => {
  const normalizedQuantity = Math.abs(Number(cantidad) || 0);
  if (tipo === "ajuste") return Number(cantidad) || 0;
  return outputMovementTypes.includes(tipo) ? -normalizedQuantity : normalizedQuantity;
};

const mergeDefaultCategories = (categories: InventoryCategoryRecord[]) => {
  const categoryIds = new Set(categories.map((category) => category.id));
  return [
    ...DEFAULT_INVENTORY_CATEGORIES.filter((category) => !categoryIds.has(category.id)),
    ...categories,
  ];
};

const mapCategory = (id: string, data: any): InventoryCategoryRecord => ({
  id,
  nombre: data.nombre ?? "",
  descripcion: data.descripcion ?? "",
  estado: data.estado ?? "activo",
  sistema: Boolean(data.sistema),
});

const mapProduct = (id: string, data: any): InventoryProduct => ({
  id,
  nombre: data.nombre ?? "",
  nombreNormalizado: data.nombreNormalizado ?? normalizeName(data.nombre ?? ""),
  marca: data.marca ?? "",
  marcaNormalizada: data.marcaNormalizada ?? normalizeName(data.marca ?? ""),
  categoria: data.categoria ?? "clinico",
  unidad: data.unidad ?? "pieza",
  stock: Number(data.stock) || 0,
  stockMinimo: Number(data.stockMinimo) || 0,
  costoUnitario: Number(data.costoUnitario) || 0,
  precioVenta: data.precioVenta === null || data.precioVenta === undefined ? null : Number(data.precioVenta) || 0,
  proveedor: data.proveedor ?? "",
  estado: data.estado ?? "activo",
  notas: data.notas ?? "",
});

const mapMovement = (id: string, data: any): InventoryMovement => ({
  id,
  productoId: data.productoId ?? "",
  productoNombre: data.productoNombre ?? "",
  fecha: safeDate(data.fecha),
  tipo: data.tipo ?? "ajuste",
  cantidad: Number(data.cantidad) || 0,
  stockAnterior: Number(data.stockAnterior) || 0,
  stockNuevo: Number(data.stockNuevo) || 0,
  motivo: data.motivo ?? "",
  referenciaTipo: data.referenciaTipo ?? "manual",
  referenciaId: data.referenciaId ?? null,
  lote: data.lote ?? "",
  fechaVencimiento: safeOptionalDate(data.fechaVencimiento),
  proveedor: data.proveedor ?? "",
  documentoCompra: data.documentoCompra ?? "",
});

const mapStockEntry = (id: string, data: any): InventoryStockEntry => ({
  id,
  fecha: safeDate(data.fecha),
  proveedor: data.proveedor ?? "",
  documentoCompra: data.documentoCompra ?? "",
  notas: data.notas ?? "",
  items: Array.isArray(data.items) ? data.items : [],
  totalProductos: Number(data.totalProductos) || 0,
  totalUnidades: Number(data.totalUnidades) || 0,
});

const assertUniqueProductName = async (name: string, brand = "", excludeId?: string) => {
  const normalizedName = normalizeName(name);
  const normalizedBrand = normalizeName(brand);
  const snapshot = await getDocs(collection(db, INVENTORY_PRODUCTS_COLLECTION));
  const duplicated = snapshot.docs.some((productDoc) => {
    if (excludeId && productDoc.id === excludeId) return false;
    const data = productDoc.data();
    const productBrand = data.marcaNormalizada ?? normalizeName(data.marca ?? "");
    return normalizeName(data.nombre ?? "") === normalizedName && productBrand === normalizedBrand;
  });

  if (duplicated) {
    throw new Error("Ya existe un producto con ese nombre y marca. Reabastece el producto existente.");
  }
};

const assertUniqueCategoryName = async (name: string, excludeId?: string) => {
  const normalizedName = normalizeName(name);
  const defaultDuplicated = DEFAULT_INVENTORY_CATEGORIES.some((category) => {
    if (excludeId && category.id === excludeId) return false;
    return normalizeName(category.nombre) === normalizedName;
  });

  if (defaultDuplicated) {
    throw new Error("Ya existe una categoria con ese nombre.");
  }

  const snapshot = await getDocs(collection(db, INVENTORY_CATEGORIES_COLLECTION));
  const duplicated = snapshot.docs.some((categoryDoc) => {
    if (excludeId && categoryDoc.id === excludeId) return false;
    const data = categoryDoc.data();
    return normalizeName(data.nombre ?? "") === normalizedName;
  });

  if (duplicated) {
    throw new Error("Ya existe una categoria con ese nombre.");
  }
};

const assertCategoryExists = async (categoryId: string) => {
  if (DEFAULT_INVENTORY_CATEGORIES.some((category) => category.id === categoryId)) return;

  const categorySnap = await getDoc(doc(db, INVENTORY_CATEGORIES_COLLECTION, categoryId));
  if (!categorySnap.exists()) {
    throw new Error("La categoria seleccionada no existe.");
  }

  const category = mapCategory(categorySnap.id, categorySnap.data());
  if (category.estado !== "activo") {
    throw new Error("La categoria seleccionada no esta activa.");
  }
};

export const inventoryService = {
  listenProducts: (onChange: (products: InventoryProduct[]) => void) => {
    const productsQuery = query(collection(db, INVENTORY_PRODUCTS_COLLECTION), orderBy("nombre", "asc"));
    return onSnapshot(productsQuery, (snapshot) => {
      onChange(snapshot.docs.map((productDoc) => mapProduct(productDoc.id, productDoc.data())));
    });
  },

  listenCategories: (onChange: (categories: InventoryCategoryRecord[]) => void) => {
    const categoriesQuery = query(collection(db, INVENTORY_CATEGORIES_COLLECTION), orderBy("nombre", "asc"));
    return onSnapshot(categoriesQuery, (snapshot) => {
      const categories = snapshot.docs.map((categoryDoc) => mapCategory(categoryDoc.id, categoryDoc.data()));
      onChange(mergeDefaultCategories(categories));
    });
  },

  listenMovements: (onChange: (movements: InventoryMovement[]) => void) => {
    const movementsQuery = query(collection(db, INVENTORY_MOVEMENTS_COLLECTION), orderBy("fecha", "desc"));
    return onSnapshot(movementsQuery, (snapshot) => {
      onChange(snapshot.docs.map((movementDoc) => mapMovement(movementDoc.id, movementDoc.data())));
    });
  },

  listenStockEntries: (onChange: (entries: InventoryStockEntry[]) => void) => {
    const entriesQuery = query(collection(db, INVENTORY_STOCK_ENTRIES_COLLECTION), orderBy("fecha", "desc"));
    return onSnapshot(entriesQuery, (snapshot) => {
      onChange(snapshot.docs.map((entryDoc) => mapStockEntry(entryDoc.id, entryDoc.data())));
    });
  },

  createCategory: async (category: CreateInventoryCategoryInput) => {
    const name = category.nombre.trim();
    if (!name) throw new Error("Escribe el nombre de la categoria.");
    await assertUniqueCategoryName(name);

    const categoryRef = await addDoc(collection(db, INVENTORY_CATEGORIES_COLLECTION), cleanData({
      nombre: name,
      nombreNormalizado: normalizeName(name),
      descripcion: category.descripcion?.trim() ?? "",
      estado: category.estado ?? "activo",
      sistema: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await addAuditLog("CREATE", "inventario", `Categoria creada: ${name}`);
    return categoryRef.id;
  },

  updateCategory: async (id: string, updates: Partial<CreateInventoryCategoryInput>) => {
    if (DEFAULT_INVENTORY_CATEGORIES.some((category) => category.id === id)) {
      throw new Error("Las categorias del sistema no se editan desde aqui.");
    }

    const payload: Record<string, any> = { ...updates, updatedAt: serverTimestamp() };
    if (updates.nombre !== undefined) {
      const name = updates.nombre.trim();
      if (!name) throw new Error("Escribe el nombre de la categoria.");
      await assertUniqueCategoryName(name, id);
      payload.nombre = name;
      payload.nombreNormalizado = normalizeName(name);
    }

    await updateDoc(doc(db, INVENTORY_CATEGORIES_COLLECTION, id), cleanData(payload));
    await addAuditLog("UPDATE", "inventario", `Categoria actualizada: ${id}`);
  },

  deleteCategory: async (id: string) => {
    if (DEFAULT_INVENTORY_CATEGORIES.some((category) => category.id === id)) {
      throw new Error("No se puede eliminar una categoria del sistema.");
    }

    const productsWithCategory = await getDocs(query(
      collection(db, INVENTORY_PRODUCTS_COLLECTION),
      where("categoria", "==", id),
      limit(1),
    ));

    if (!productsWithCategory.empty) {
      throw new Error("No se puede eliminar la categoria porque tiene productos asignados.");
    }

    await deleteDoc(doc(db, INVENTORY_CATEGORIES_COLLECTION, id));
    await addAuditLog("DELETE", "inventario", `Categoria eliminada: ${id}`);
  },

  createProduct: async (product: CreateInventoryProductInput) => {
    const name = product.nombre.trim();
    const brand = product.marca?.trim() ?? "";
    if (!name) throw new Error("Escribe el nombre del producto.");
    await assertUniqueProductName(name, brand);
    await assertCategoryExists(product.categoria || "clinico");

    const initialStock = Number(product.stock) || 0;
    if (initialStock < 0) {
      throw new Error("El stock inicial no puede ser negativo.");
    }

    const payload = cleanData({
      ...product,
      nombre: name,
      nombreNormalizado: normalizeName(name),
      marca: brand,
      marcaNormalizada: normalizeName(brand),
      categoria: product.categoria || "clinico",
      unidad: product.unidad.trim() || "pieza",
      stock: initialStock,
      stockMinimo: Number(product.stockMinimo) || 0,
      costoUnitario: Number(product.costoUnitario) || 0,
      precioVenta: product.precioVenta === null || product.precioVenta === undefined ? null : Number(product.precioVenta) || 0,
      proveedor: product.proveedor?.trim() ?? "",
      estado: product.estado ?? "activo",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const productRef = doc(collection(db, INVENTORY_PRODUCTS_COLLECTION));
    const batch = writeBatch(db);
    batch.set(productRef, payload);

    if (initialStock > 0) {
      const movementRef = doc(collection(db, INVENTORY_MOVEMENTS_COLLECTION));
      batch.set(movementRef, cleanData({
        productoId: productRef.id,
        productoNombre: formatProductDisplayName(name, brand),
        fecha: new Date(),
        tipo: "entrada",
        cantidad: initialStock,
        stockAnterior: 0,
        stockNuevo: initialStock,
        motivo: "Stock inicial",
        referenciaTipo: "manual",
        referenciaId: productRef.id,
        proveedor: product.proveedor?.trim() ?? "",
        createdAt: serverTimestamp(),
      }));
    }

    await batch.commit();
    await addAuditLog(
      "CREATE",
      "inventario",
      `Producto creado: ${formatProductDisplayName(name, brand)} | Stock inicial: ${initialStock} ${product.unidad.trim() || "pieza"} | Minimo: ${Number(product.stockMinimo) || 0}`,
    );
    return productRef.id;
  },

  updateProduct: async (id: string, updates: Partial<CreateInventoryProductInput>) => {
    const productRef = doc(db, INVENTORY_PRODUCTS_COLLECTION, id);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
      throw new Error("No se encontro el producto de inventario.");
    }

    const currentProduct = mapProduct(productSnap.id, productSnap.data());
    const payload: Record<string, any> = { ...updates, updatedAt: serverTimestamp() };
    delete payload.stock;

    if (updates.nombre !== undefined || updates.marca !== undefined) {
      const name = updates.nombre !== undefined ? updates.nombre.trim() : currentProduct.nombre;
      const brand = updates.marca !== undefined ? updates.marca.trim() : currentProduct.marca ?? "";
      if (!name) throw new Error("Escribe el nombre del producto.");
      await assertUniqueProductName(name, brand, id);
      if (updates.nombre !== undefined) {
        payload.nombre = name;
        payload.nombreNormalizado = normalizeName(name);
      }
      if (updates.marca !== undefined) {
        payload.marca = brand;
        payload.marcaNormalizada = normalizeName(brand);
      }
    }

    if (updates.categoria !== undefined) {
      await assertCategoryExists(updates.categoria);
    }

    if ("precioVenta" in updates) {
      if (updates.precioVenta === null || updates.precioVenta === undefined) {
        payload.precioVenta = updates.precioVenta ?? null;
      } else {
        payload.precioVenta = Number(updates.precioVenta) || 0;
      }
    }

    if (updates.proveedor !== undefined) payload.proveedor = updates.proveedor.trim();
    if (updates.unidad !== undefined) payload.unidad = updates.unidad.trim() || "pieza";

    await updateDoc(productRef, cleanData(payload));

    const displayName = formatProductDisplayName(payload.nombre ?? currentProduct.nombre, payload.marca ?? currentProduct.marca);
    await addAuditLog(
      "UPDATE",
      "inventario",
      `Producto actualizado: ${displayName} | Stock actual: ${currentProduct.stock} ${payload.unidad ?? currentProduct.unidad} | Minimo: ${payload.stockMinimo ?? currentProduct.stockMinimo}`,
    );
  },

  deleteProduct: async (id: string) => {
    const productRef = doc(db, INVENTORY_PRODUCTS_COLLECTION, id);
    const productSnap = await getDoc(productRef);
    const product = productSnap.exists() ? mapProduct(productSnap.id, productSnap.data()) : null;

    await updateDoc(productRef, cleanData({
      estado: "inactivo",
      updatedAt: serverTimestamp(),
    }));
    await addAuditLog(
      "UPDATE",
      "inventario",
      `Producto desactivado: ${product ? formatProductDisplayName(product.nombre, product.marca) : id}`,
    );
  },

  registerMovement: async (input: RegisterInventoryMovementInput) => {
    const rawQuantity = Number(input.cantidad) || 0;
    if (input.tipo !== "ajuste" && rawQuantity <= 0) {
      throw new Error("La cantidad debe ser positiva.");
    }
    if (input.tipo === "ajuste" && rawQuantity === 0) {
      throw new Error("El ajuste no puede ser cero.");
    }

    const movementResult = await runTransaction(db, async (transaction) => {
      const productRef = doc(db, INVENTORY_PRODUCTS_COLLECTION, input.productoId);
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists()) {
        throw new Error("No se encontro el producto de inventario.");
      }

      const product = mapProduct(productSnap.id, productSnap.data());
      const quantity = resolveMovementQuantity(input.tipo, input.cantidad);
      const nextStock = product.stock + quantity;

      if (nextStock < 0) {
        throw new Error("No hay stock suficiente para registrar este movimiento.");
      }

      const movementRef = doc(collection(db, INVENTORY_MOVEMENTS_COLLECTION));
      transaction.update(productRef, {
        stock: nextStock,
        updatedAt: serverTimestamp(),
      });
      transaction.set(movementRef, cleanData({
        productoId: product.id,
        productoNombre: formatProductDisplayName(product.nombre, product.marca),
        fecha: toFirestoreDate(input.fecha),
        tipo: input.tipo,
        cantidad: quantity,
        stockAnterior: product.stock,
        stockNuevo: nextStock,
        motivo: input.motivo,
        referenciaTipo: input.referenciaTipo ?? "manual",
        referenciaId: input.referenciaId ?? null,
        lote: input.lote ?? "",
        fechaVencimiento: input.fechaVencimiento ? toFirestoreDate(input.fechaVencimiento) : null,
        proveedor: input.proveedor ?? "",
        documentoCompra: input.documentoCompra ?? "",
        createdAt: serverTimestamp(),
      }));

      const productName = formatProductDisplayName(product.nombre, product.marca);
      return {
        id: movementRef.id,
        auditDetail: `${movementAuditLabel[input.tipo]}: ${productName} ${formatSignedQuantity(quantity)} | Stock ${product.stock} -> ${nextStock} | Motivo: ${input.motivo}`,
      };
    });

    await addAuditLog("UPDATE", "inventario", movementResult.auditDetail);
    return movementResult.id;
  },

  registerStockEntry: async (input: RegisterStockEntryInput) => {
    const provider = input.proveedor.trim();
    const documentNumber = input.documentoCompra.trim();
    if (!provider) throw new Error("Escribe el proveedor del reabastecimiento.");
    if (!documentNumber) throw new Error("Escribe el documento de compra.");
    if (!input.items.length) throw new Error("Agrega al menos un producto a reabastecer.");

    input.items.forEach((item) => {
      if (!item.productoId) throw new Error("Selecciona producto en todos los renglones.");
      if ((Number(item.cantidad) || 0) <= 0) throw new Error("Las cantidades de reabastecimiento deben ser positivas.");
      if (!item.lote.trim()) throw new Error("Escribe el lote de todos los productos.");
    });

    const entryResult = await runTransaction(db, async (transaction) => {
      const products = [];

      for (const item of input.items) {
        const productRef = doc(db, INVENTORY_PRODUCTS_COLLECTION, item.productoId);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) throw new Error("No se encontro un producto de inventario.");

        products.push({
          item,
          ref: productRef,
          product: mapProduct(productSnap.id, productSnap.data()),
        });
      }

      const entryRef = doc(collection(db, INVENTORY_STOCK_ENTRIES_COLLECTION));
      const entryItems = products.map(({ item, product }) => ({
        productoId: product.id,
        productoNombre: formatProductDisplayName(product.nombre, product.marca),
        cantidad: Math.abs(Number(item.cantidad) || 0),
        lote: item.lote.trim(),
        fechaVencimiento: item.fechaVencimiento || null,
      }));
      const totalUnidades = entryItems.reduce((total, item) => total + item.cantidad, 0);

      transaction.set(entryRef, cleanData({
        fecha: toFirestoreDate(input.fecha),
        proveedor: provider,
        documentoCompra: documentNumber,
        notas: input.notas ?? "",
        items: entryItems,
        totalProductos: entryItems.length,
        totalUnidades,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      const auditItems: string[] = [];

      products.forEach(({ item, product, ref }) => {
        const quantity = Math.abs(Number(item.cantidad) || 0);
        const nextStock = product.stock + quantity;
        const movementRef = doc(collection(db, INVENTORY_MOVEMENTS_COLLECTION));
        const productName = formatProductDisplayName(product.nombre, product.marca);

        transaction.update(ref, {
          stock: nextStock,
          proveedor: provider,
          updatedAt: serverTimestamp(),
        });
        transaction.set(movementRef, cleanData({
          productoId: product.id,
          productoNombre: productName,
          fecha: toFirestoreDate(input.fecha),
          tipo: "entrada",
          cantidad: quantity,
          stockAnterior: product.stock,
          stockNuevo: nextStock,
          motivo: `Reabastecimiento ${documentNumber} - lote ${item.lote.trim()}`,
          referenciaTipo: "entrada_stock",
          referenciaId: entryRef.id,
          lote: item.lote.trim(),
          fechaVencimiento: item.fechaVencimiento ? toFirestoreDate(item.fechaVencimiento) : null,
          proveedor: provider,
          documentoCompra: documentNumber,
          createdAt: serverTimestamp(),
        }));

        auditItems.push(`${productName} +${quantity} (${product.stock} -> ${nextStock})`);
      });

      return {
        id: entryRef.id,
        auditDetail: `Reabastecimiento ${documentNumber} | Proveedor: ${provider} | ${totalUnidades} unidades | ${compactAuditItems(auditItems)}`,
      };
    });

    await addAuditLog("UPDATE", "inventario", entryResult.auditDetail);
    return entryResult.id;
  },
};
