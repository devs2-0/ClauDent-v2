import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth";
import { inventoryService } from "../services/inventoryService";
import type {
  CreateInventoryCategoryInput,
  CreateInventoryProductInput,
  InventoryCategoryRecord,
  InventoryMovement,
  InventoryProduct,
  InventoryStockEntry,
  RegisterInventoryMovementInput,
  RegisterStockEntryInput,
} from "../types/inventory.types";

interface InventoryContextValue {
  products: InventoryProduct[];
  productsLoading: boolean;
  categories: InventoryCategoryRecord[];
  categoriesLoading: boolean;
  movements: InventoryMovement[];
  movementsLoading: boolean;
  stockEntries: InventoryStockEntry[];
  stockEntriesLoading: boolean;
  createCategory: (category: CreateInventoryCategoryInput) => Promise<string>;
  updateCategory: (id: string, updates: Partial<CreateInventoryCategoryInput>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  createProduct: (product: CreateInventoryProductInput) => Promise<string>;
  updateProduct: (id: string, updates: Partial<CreateInventoryProductInput>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  registerMovement: (input: RegisterInventoryMovementInput) => Promise<string>;
  registerStockEntry: (input: RegisterStockEntryInput) => Promise<string>;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [categories, setCategories] = useState<InventoryCategoryRecord[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [stockEntries, setStockEntries] = useState<InventoryStockEntry[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [stockEntriesLoading, setStockEntriesLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setProducts([]);
      setProductsLoading(false);
      return;
    }

    setProductsLoading(true);
    return inventoryService.listenProducts((nextProducts) => {
      setProducts(nextProducts);
      setProductsLoading(false);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setCategories([]);
      setCategoriesLoading(false);
      return;
    }

    setCategoriesLoading(true);
    return inventoryService.listenCategories((nextCategories) => {
      setCategories(nextCategories);
      setCategoriesLoading(false);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setMovements([]);
      setMovementsLoading(false);
      return;
    }

    setMovementsLoading(true);
    return inventoryService.listenMovements((nextMovements) => {
      setMovements(nextMovements);
      setMovementsLoading(false);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setStockEntries([]);
      setStockEntriesLoading(false);
      return;
    }

    setStockEntriesLoading(true);
    return inventoryService.listenStockEntries((nextEntries) => {
      setStockEntries(nextEntries);
      setStockEntriesLoading(false);
    });
  }, [currentUser]);

  const createCategory = async (category: CreateInventoryCategoryInput) => {
    const id = await inventoryService.createCategory(category);
    toast.success("Categoria guardada");
    return id;
  };

  const updateCategory = async (id: string, updates: Partial<CreateInventoryCategoryInput>) => {
    await inventoryService.updateCategory(id, updates);
    toast.success("Categoria actualizada");
  };

  const deleteCategory = async (id: string) => {
    await inventoryService.deleteCategory(id);
    toast.success("Categoria eliminada");
  };

  const createProduct = async (product: CreateInventoryProductInput) => {
    const id = await inventoryService.createProduct(product);
    toast.success("Producto guardado en inventario");
    return id;
  };

  const updateProduct = async (id: string, updates: Partial<CreateInventoryProductInput>) => {
    await inventoryService.updateProduct(id, updates);
    toast.success("Producto actualizado");
  };

  const deleteProduct = async (id: string) => {
    await inventoryService.deleteProduct(id);
    toast.success("Producto desactivado");
  };

  const registerMovement = async (input: RegisterInventoryMovementInput) => {
    const id = await inventoryService.registerMovement(input);
    toast.success("Movimiento registrado");
    return id;
  };

  const registerStockEntry = async (input: RegisterStockEntryInput) => {
    const id = await inventoryService.registerStockEntry(input);
    toast.success("Reabastecimiento registrado");
    return id;
  };

  return (
    <InventoryContext.Provider
      value={{
        products,
        productsLoading,
        categories,
        categoriesLoading,
        movements,
        movementsLoading,
        stockEntries,
        stockEntriesLoading,
        createCategory,
        updateCategory,
        deleteCategory,
        createProduct,
        updateProduct,
        deleteProduct,
        registerMovement,
        registerStockEntry,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventoryContext = () => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error("useInventory must be used within InventoryProvider");
  return context;
};
