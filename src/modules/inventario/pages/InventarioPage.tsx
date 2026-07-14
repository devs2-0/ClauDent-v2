import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Edit,
  Layers,
  Package,
  PackageMinus,
  PackagePlus,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Textarea } from "@/shared/components/ui/textarea";
import { formatCurrency, formatDate } from "@/shared/utils/utils";
import { useInventory } from "../hooks/useInventory";
import type {
  InventoryCategory,
  InventoryCategoryRecord,
  InventoryMovementType,
  InventoryProduct,
  InventoryStatus,
  InventoryStockEntryItem,
} from "../types/inventory.types";

const today = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().split("T")[0];
};

const movementLabel: Record<InventoryMovementType, string> = {
  entrada: "Reabastecimiento",
  venta: "Venta",
  uso_clinico: "Uso clinico",
  devolucion: "Devolucion",
  merma: "Merma",
  caducidad: "Caducidad",
  ajuste: "Ajuste",
};

const defaultManualMovementType: InventoryMovementType = "merma";

const manualMovementDescriptions: Partial<Record<InventoryMovementType, string>> = {
  uso_clinico: "Material usado en consulta sin venderse como producto.",
  devolucion: "Producto que regresa al inventario.",
  merma: "Producto danado, perdido, roto o inutilizable.",
  caducidad: "Producto vencido que debe salir del stock.",
  ajuste: "Correccion por conteo fisico; puede sumar o restar.",
};

const categoryPageSize = 6;

const emptyProductForm = {
  nombre: "",
  marca: "",
  categoria: "vendible" as InventoryCategory,
  unidad: "pieza",
  stock: "",
  stockMinimo: "",
  costoUnitario: "",
  precioVenta: "",
  proveedor: "",
  estado: "activo" as InventoryStatus,
  notas: "",
};

const emptyCategoryForm = {
  nombre: "",
  descripcion: "",
};

const emptyEntryItemForm = {
  productoId: "",
  cantidad: "",
  lote: "",
  fechaVencimiento: "",
};

const InventarioPage: React.FC = () => {
  const {
    products,
    productsLoading,
    categories,
    categoriesLoading,
    movements,
    movementsLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    createProduct,
    updateProduct,
    deleteProduct,
    registerMovement,
    registerStockEntry,
  } = useInventory();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategory | "todos">("todos");
  const [dateFilter, setDateFilter] = useState(today());
  const [categoryPage, setCategoryPage] = useState(1);

  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isSavingMovement, setIsSavingMovement] = useState(false);
  const [isSavingStockEntry, setIsSavingStockEntry] = useState(false);

  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isStockEntryDialogOpen, setIsStockEntryDialogOpen] = useState(false);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const [productForm, setProductForm] = useState(emptyProductForm);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [movementForm, setMovementForm] = useState<{
    productoId: string;
    tipo: InventoryMovementType;
    cantidad: string;
    motivo: string;
  }>({
    productoId: "",
    tipo: defaultManualMovementType,
    cantidad: "",
    motivo: "",
  });
  const [stockEntryForm, setStockEntryForm] = useState({
    proveedor: "",
    documentoCompra: "",
    notas: "",
  });
  const [entryItemForm, setEntryItemForm] = useState(emptyEntryItemForm);
  const [entryItems, setEntryItems] = useState<InventoryStockEntryItem[]>([]);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.estado === "activo"),
    [categories],
  );

  const activeProducts = useMemo(
    () => products.filter((product) => product.estado === "activo"),
    [products],
  );

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]));
  }, [categories]);

  const getCategoryLabel = (categoryId: string) => {
    return categoryById.get(categoryId)?.nombre ?? categoryId;
  };

  const getProductDisplayName = (product: Pick<InventoryProduct, "nombre" | "marca">) => {
    return product.marca ? `${product.nombre} (${product.marca})` : product.nombre;
  };

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase().trim();

    return products.filter((product) => {
      const searchableText = `${product.nombre} ${product.marca ?? ""}`.toLowerCase();
      const matchesText = !term || searchableText.includes(term);
      const matchesCategory = categoryFilter === "todos" || product.categoria === categoryFilter;
      return matchesText && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => !dateFilter || movement.fecha === dateFilter);
  }, [movements, dateFilter]);

  const lowStockProducts = useMemo(
    () => activeProducts.filter((product) => product.stock <= product.stockMinimo),
    [activeProducts],
  );

  const replenishmentProducts = useMemo(
    () => [...activeProducts].sort((left, right) => {
      const leftGap = left.stock - left.stockMinimo;
      const rightGap = right.stock - right.stockMinimo;
      return leftGap - rightGap || left.nombre.localeCompare(right.nombre);
    }),
    [activeProducts],
  );

  const sellableProducts = useMemo(
    () => activeProducts.filter((product) => product.precioVenta !== null),
    [activeProducts],
  );

  const clinicalProducts = useMemo(
    () => activeProducts.filter((product) => product.categoria === "clinico"),
    [activeProducts],
  );

  const inventoryValue = useMemo(
    () => products.reduce((total, product) => total + product.stock * product.costoUnitario, 0),
    [products],
  );

  const productCountByCategory = useMemo(() => {
    return products.reduce((counts, product) => {
      counts.set(product.categoria, (counts.get(product.categoria) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());
  }, [products]);

  const totalCategoryPages = Math.max(1, Math.ceil(categories.length / categoryPageSize));
  const paginatedCategories = categories.slice((categoryPage - 1) * categoryPageSize, categoryPage * categoryPageSize);

  const selectedEntryProduct = activeProducts.find((product) => product.id === entryItemForm.productoId);
  const entryTotalUnits = entryItems.reduce((total, item) => total + item.cantidad, 0);

  const openProductDialog = (product?: InventoryProduct) => {
    if (product) {
      setEditingProductId(product.id);
      setProductForm({
        nombre: product.nombre,
        marca: product.marca ?? "",
        categoria: product.categoria,
        unidad: product.unidad,
        stock: String(product.stock),
        stockMinimo: String(product.stockMinimo),
        costoUnitario: String(product.costoUnitario),
        precioVenta: product.precioVenta === null ? "" : String(product.precioVenta),
        proveedor: product.proveedor ?? "",
        estado: product.estado,
        notas: product.notas ?? "",
      });
    } else {
      setEditingProductId(null);
      setProductForm({
        ...emptyProductForm,
        categoria: activeCategories[0]?.id ?? "vendible",
      });
    }
    setIsProductDialogOpen(true);
  };

  const openCategoryDialog = (category?: InventoryCategoryRecord) => {
    if (category) {
      setEditingCategoryId(category.id);
      setCategoryForm({
        nombre: category.nombre,
        descripcion: category.descripcion,
      });
    } else {
      setEditingCategoryId(null);
      setCategoryForm(emptyCategoryForm);
    }
    setIsCategoryDialogOpen(true);
  };

  const handleSaveProduct = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!productForm.nombre.trim()) {
      toast.error("Escribe el nombre del producto");
      return;
    }

    if (!productForm.categoria) {
      toast.error("Selecciona categoria");
      return;
    }

    setIsSavingProduct(true);
    try {
      const payload = {
        nombre: productForm.nombre.trim(),
        marca: productForm.marca.trim(),
        categoria: productForm.categoria,
        unidad: productForm.unidad.trim() || "pieza",
        stock: Number(productForm.stock) || 0,
        stockMinimo: Number(productForm.stockMinimo) || 0,
        costoUnitario: Number(productForm.costoUnitario) || 0,
        precioVenta: productForm.precioVenta === "" ? null : Number(productForm.precioVenta) || 0,
        proveedor: productForm.proveedor.trim(),
        estado: productForm.estado,
        notas: productForm.notas,
      };

      if (editingProductId) {
        await updateProduct(editingProductId, payload);
      } else {
        await createProduct(payload);
      }
      setIsProductDialogOpen(false);
      setEditingProductId(null);
      setProductForm(emptyProductForm);
    } catch (error: any) {
      toast.error(error.message || "No se pudo guardar el producto");
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleSaveCategory = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!categoryForm.nombre.trim()) {
      toast.error("Escribe el nombre de la categoria");
      return;
    }

    setIsSavingCategory(true);
    try {
      if (editingCategoryId) {
        await updateCategory(editingCategoryId, {
          nombre: categoryForm.nombre.trim(),
          descripcion: categoryForm.descripcion.trim(),
        });
      } else {
        await createCategory({
          nombre: categoryForm.nombre.trim(),
          descripcion: categoryForm.descripcion.trim(),
        });
      }
      setIsCategoryDialogOpen(false);
      setEditingCategoryId(null);
      setCategoryForm(emptyCategoryForm);
    } catch (error: any) {
      toast.error(error.message || "No se pudo guardar la categoria");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (category: InventoryCategoryRecord) => {
    if (category.sistema) {
      toast.error("No se puede eliminar una categoria del sistema");
      return;
    }

    if (!window.confirm(`Eliminar la categoria "${category.nombre}"?`)) return;

    try {
      await deleteCategory(category.id);
    } catch (error: any) {
      toast.error(error.message || "No se pudo eliminar la categoria");
    }
  };

  const handleToggleProductStatus = async (product: InventoryProduct) => {
    try {
      if (product.estado === "activo") {
        await deleteProduct(product.id);
      } else {
        await updateProduct(product.id, { estado: "activo" });
      }
    } catch (error: any) {
      toast.error(error.message || "No se pudo cambiar el estado del producto");
    }
  };

  const addEntryItem = () => {
    if (!selectedEntryProduct) {
      toast.error("Selecciona un producto");
      return;
    }

    const quantity = Number(entryItemForm.cantidad) || 0;
    if (quantity <= 0) {
      toast.error("La cantidad debe ser positiva");
      return;
    }

    if (!entryItemForm.lote.trim()) {
      toast.error("Escribe el lote");
      return;
    }

    setEntryItems((current) => [
      ...current,
      {
        productoId: selectedEntryProduct.id,
        productoNombre: getProductDisplayName(selectedEntryProduct),
        cantidad: quantity,
        lote: entryItemForm.lote.trim(),
        fechaVencimiento: entryItemForm.fechaVencimiento || null,
      },
    ]);
    setEntryItemForm(emptyEntryItemForm);
  };

  const handleRegisterStockEntry = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stockEntryForm.proveedor.trim() || !stockEntryForm.documentoCompra.trim()) {
      toast.error("Escribe proveedor y documento de compra");
      return;
    }

    if (entryItems.length === 0) {
      toast.error("Agrega al menos un producto a reabastecer");
      return;
    }

    setIsSavingStockEntry(true);
    try {
      await registerStockEntry({
        fecha: dateFilter || today(),
        proveedor: stockEntryForm.proveedor.trim(),
        documentoCompra: stockEntryForm.documentoCompra.trim(),
        notas: stockEntryForm.notas,
        items: entryItems,
      });
      setStockEntryForm({ proveedor: "", documentoCompra: "", notas: "" });
      setEntryItemForm(emptyEntryItemForm);
      setEntryItems([]);
      setIsStockEntryDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "No se pudo registrar el reabastecimiento");
    } finally {
      setIsSavingStockEntry(false);
    }
  };

  const handleRegisterMovement = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!movementForm.productoId || !movementForm.cantidad) {
      toast.error("Selecciona producto y cantidad");
      return;
    }

    const movementNote = movementForm.motivo.trim() || movementLabel[movementForm.tipo];

    setIsSavingMovement(true);
    try {
      await registerMovement({
        productoId: movementForm.productoId,
        fecha: dateFilter || today(),
        tipo: movementForm.tipo,
        cantidad: Number(movementForm.cantidad) || 0,
        motivo: movementNote,
        referenciaTipo: "manual",
      });
      setMovementForm({ productoId: "", tipo: defaultManualMovementType, cantidad: "", motivo: "" });
      setIsMovementDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "No se pudo registrar el movimiento");
    } finally {
      setIsSavingMovement(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventario</h1>
          <p className="text-muted-foreground">
            Administra productos, categorias, reabastecimientos por lote y movimientos de stock.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          <Button type="button" variant="outline" onClick={() => setDateFilter(today())}>
            Hoy
          </Button>
          <Button variant="outline" onClick={() => setIsStockEntryDialogOpen(true)}>
            <Truck className="mr-2 h-4 w-4" />
            Reabastecer
          </Button>
          <Button variant="outline" onClick={() => openCategoryDialog()}>
            <Layers className="mr-2 h-4 w-4" />
            Categoria
          </Button>
          <Button onClick={() => openProductDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Producto
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Productos activos</CardTitle>
            <Package className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProducts.length}</div>
            <p className="text-xs text-muted-foreground">{products.length} en catalogo total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bajo minimo</CardTitle>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockProducts.length}</div>
            <p className="text-xs text-muted-foreground">Requieren revision</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categorias</CardTitle>
            <Layers className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCategories.length}</div>
            <p className="text-xs text-muted-foreground">Disponibles en productos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor stock</CardTitle>
            <ClipboardList className="h-5 w-5 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(inventoryValue)}</div>
            <p className="text-xs text-muted-foreground">Costo estimado en inventario</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="productos" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 md:w-fit md:grid-cols-5">
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="reabastecer">Reabastecer</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
        </TabsList>

        <TabsContent value="productos">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle>Productos de inventario</CardTitle>
                  <CardDescription>Catalogo editable de productos, materiales y medicamentos.</CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar producto..."
                      className="pl-9"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as InventoryCategory | "todos")}>
                    <SelectTrigger className="sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      {activeCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={() => openProductDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Producto
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Minimo</TableHead>
                      <TableHead>Venta</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          Cargando inventario...
                        </TableCell>
                      </TableRow>
                    ) : filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          No hay productos para este filtro.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <p className="font-medium">{getProductDisplayName(product)}</p>
                            <p className="text-xs text-muted-foreground">Costo {formatCurrency(product.costoUnitario)} / {product.unidad}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={product.categoria === "vendible" ? "default" : "secondary"}>
                              {getCategoryLabel(product.categoria)}
                            </Badge>
                          </TableCell>
                          <TableCell>{product.stock} {product.unidad}</TableCell>
                          <TableCell>{product.stockMinimo}</TableCell>
                          <TableCell>{product.precioVenta !== null ? formatCurrency(product.precioVenta) : "No vendible"}</TableCell>
                          <TableCell>{product.proveedor || "-"}</TableCell>
                          <TableCell>
                            {product.estado === "inactivo" ? (
                              <Badge variant="secondary">Inactivo</Badge>
                            ) : product.stock <= product.stockMinimo ? (
                              <Badge variant="destructive">Bajo stock</Badge>
                            ) : (
                              <Badge variant="outline">Activo</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => openProductDialog(product)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant={product.estado === "activo" ? "destructive" : "outline"}
                                size="sm"
                                onClick={() => handleToggleProductStatus(product)}
                              >
                                {product.estado === "activo" ? (
                                  <Trash2 className="mr-2 h-4 w-4" />
                                ) : (
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                )}
                                {product.estado === "activo" ? "Desactivar" : "Activar"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reabastecer">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Reabastecer</CardTitle>
                  <CardDescription>Selecciona productos registrados y suma stock por lote.</CardDescription>
                </div>
                <Button onClick={() => setIsStockEntryDialogOpen(true)}>
                  <Truck className="mr-2 h-4 w-4" />
                  Reabastecer
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Stock actual</TableHead>
                      <TableHead>Minimo</TableHead>
                      <TableHead>Faltante</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Accion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          Cargando reabastecimiento...
                        </TableCell>
                      </TableRow>
                    ) : replenishmentProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          No hay productos registrados para reabastecer.
                        </TableCell>
                      </TableRow>
                    ) : (
                      replenishmentProducts.map((product) => {
                        const shortage = Math.max(product.stockMinimo - product.stock, 0);

                        return (
                          <TableRow key={product.id}>
                            <TableCell>
                              <p className="font-medium">{getProductDisplayName(product)}</p>
                              <p className="text-xs text-muted-foreground">{product.unidad}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getCategoryLabel(product.categoria)}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={product.stock < product.stockMinimo ? "destructive" : "secondary"}>
                                {product.stock} {product.unidad}
                              </Badge>
                            </TableCell>
                            <TableCell>{product.stockMinimo} {product.unidad}</TableCell>
                            <TableCell>{shortage > 0 ? `${shortage} ${product.unidad}` : "Al minimo"}</TableCell>
                            <TableCell>{product.proveedor || "Sin proveedor"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEntryItemForm({ ...emptyEntryItemForm, productoId: product.id });
                                  setIsStockEntryDialogOpen(true);
                                }}
                              >
                                Reabastecer
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categorias">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Categorias de inventario</CardTitle>
                  <CardDescription>Organiza productos y evita eliminar categorias que ya tienen productos.</CardDescription>
                </div>
                <Button onClick={() => openCategoryDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Categoria
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Descripcion</TableHead>
                      <TableHead>Productos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoriesLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          Cargando categorias...
                        </TableCell>
                      </TableRow>
                    ) : paginatedCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          No hay categorias registradas.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedCategories.map((category) => {
                        const productCount = productCountByCategory.get(category.id) ?? 0;

                        return (
                          <TableRow key={category.id}>
                            <TableCell className="font-medium">
                              {category.nombre}
                              {category.sistema && <Badge variant="secondary" className="ml-2">Sistema</Badge>}
                            </TableCell>
                            <TableCell className="max-w-[360px] text-muted-foreground">{category.descripcion || "-"}</TableCell>
                            <TableCell>{productCount}</TableCell>
                            <TableCell>
                              <Badge variant={category.estado === "activo" ? "outline" : "secondary"}>{category.estado}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openCategoryDialog(category)}
                                  disabled={category.sistema}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteCategory(category)}
                                  disabled={category.sistema || productCount > 0}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Pagina {categoryPage} de {totalCategoryPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCategoryPage((page) => Math.max(1, page - 1))}
                    disabled={categoryPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCategoryPage((page) => Math.min(totalCategoryPages, page + 1))}
                    disabled={categoryPage === totalCategoryPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Movimientos de inventario</CardTitle>
                  <CardDescription>Historial de entradas, ventas y salidas reales del stock.</CardDescription>
                </div>
                <Button onClick={() => setIsMovementDialogOpen(true)}>
                  <PackageMinus className="mr-2 h-4 w-4" />
                  Salida o ajuste
                </Button>
              </div>
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Usa la accion manual solo cuando el stock cambia sin una venta normal: merma, caducidad,
                    devolucion, uso clinico o correccion por conteo. Las ventas se descuentan desde Ventas/Caja
                    y las compras se registran en Reabastecer.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementsLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          Cargando movimientos...
                        </TableCell>
                      </TableRow>
                    ) : filteredMovements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          No hay movimientos para la fecha seleccionada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMovements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>{formatDate(movement.fecha)}</TableCell>
                          <TableCell className="font-medium">{movement.productoNombre}</TableCell>
                          <TableCell>
                            <Badge variant={movement.tipo === "entrada" ? "default" : "outline"}>
                              {movement.cantidad > 0 ? (
                                <PackagePlus className="mr-1 h-3.5 w-3.5" />
                              ) : (
                                <PackageMinus className="mr-1 h-3.5 w-3.5" />
                              )}
                              {movementLabel[movement.tipo]}
                            </Badge>
                          </TableCell>
                          <TableCell className={movement.cantidad > 0 ? "text-emerald-700" : "text-destructive"}>
                            {movement.cantidad > 0 ? `+${movement.cantidad}` : movement.cantidad}
                          </TableCell>
                          <TableCell>{movement.stockAnterior}{" -> "}{movement.stockNuevo}</TableCell>
                          <TableCell>{movement.lote || "-"}</TableCell>
                          <TableCell>{movement.proveedor || "-"}</TableCell>
                          <TableCell>{movement.motivo}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resumen">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Productos vendibles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sellableProducts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No hay productos vendibles.</p>
                ) : (
                  sellableProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{product.nombre}</p>
                        <p className="text-sm text-muted-foreground">Stock: {product.stock} {product.unidad}</p>
                      </div>
                      <p className="font-semibold">{formatCurrency(product.precioVenta || 0)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-5 w-5 text-primary" />
                  Uso clinico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {clinicalProducts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No hay material clinico registrado.</p>
                ) : (
                  clinicalProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{product.nombre}</p>
                        <p className="text-sm text-muted-foreground">No mueve dinero en caja</p>
                      </div>
                      <Badge variant="outline">Stock {product.stock}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProductId ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            <DialogDescription>Alta de producto nuevo. Si ya existe, usa reabastecer.</DialogDescription>
          </DialogHeader>
          <form id="product-form" onSubmit={handleSaveProduct} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={productForm.nombre} onChange={(event) => setProductForm({ ...productForm, nombre: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={productForm.marca} onChange={(event) => setProductForm({ ...productForm, marca: event.target.value })} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={productForm.categoria} onValueChange={(value) => setProductForm({ ...productForm, categoria: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Input value={productForm.unidad} onChange={(event) => setProductForm({ ...productForm, unidad: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{editingProductId ? "Stock actual" : "Stock inicial"}</Label>
                <Input
                  type="number"
                  value={productForm.stock}
                  onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })}
                  disabled={Boolean(editingProductId)}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock minimo</Label>
                <Input type="number" value={productForm.stockMinimo} onChange={(event) => setProductForm({ ...productForm, stockMinimo: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Costo unitario</Label>
                <Input type="number" step="0.01" value={productForm.costoUnitario} onChange={(event) => setProductForm({ ...productForm, costoUnitario: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Precio venta</Label>
                <Input type="number" step="0.01" value={productForm.precioVenta} onChange={(event) => setProductForm({ ...productForm, precioVenta: event.target.value })} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Proveedor principal</Label>
                <Input value={productForm.proveedor} onChange={(event) => setProductForm({ ...productForm, proveedor: event.target.value })} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={productForm.estado} onValueChange={(value) => setProductForm({ ...productForm, estado: value as InventoryStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={productForm.notas} onChange={(event) => setProductForm({ ...productForm, notas: event.target.value })} rows={3} />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsProductDialogOpen(false)} disabled={isSavingProduct}>
              Cancelar
            </Button>
            <Button type="submit" form="product-form" disabled={isSavingProduct}>
              {isSavingProduct ? "Guardando..." : "Guardar producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingCategoryId ? "Editar categoria" : "Nueva categoria"}</DialogTitle>
            <DialogDescription>Crea categorias reutilizables para organizar los productos.</DialogDescription>
          </DialogHeader>
          <form id="category-form" onSubmit={handleSaveCategory} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={categoryForm.nombre} onChange={(event) => setCategoryForm({ ...categoryForm, nombre: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descripcion</Label>
              <Textarea value={categoryForm.descripcion} onChange={(event) => setCategoryForm({ ...categoryForm, descripcion: event.target.value })} rows={3} />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)} disabled={isSavingCategory}>
              Cancelar
            </Button>
            <Button type="submit" form="category-form" disabled={isSavingCategory}>
              {isSavingCategory ? "Guardando..." : "Guardar categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStockEntryDialogOpen} onOpenChange={setIsStockEntryDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Reabastecer stock por lote</DialogTitle>
            <DialogDescription>Suma stock a productos existentes por proveedor y documento.</DialogDescription>
          </DialogHeader>
          <form id="stock-entry-form" onSubmit={handleRegisterStockEntry} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Input value={stockEntryForm.proveedor} onChange={(event) => setStockEntryForm({ ...stockEntryForm, proveedor: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Documento de compra</Label>
                <Input value={stockEntryForm.documentoCompra} onChange={(event) => setStockEntryForm({ ...stockEntryForm, documentoCompra: event.target.value })} placeholder="Factura, nota o remision" />
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_110px_140px_170px_auto]">
                <Select value={entryItemForm.productoId} onValueChange={(value) => setEntryItemForm({ ...entryItemForm, productoId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={activeProducts.length ? "Producto" : "No hay productos activos"} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {getProductDisplayName(product)} - stock {product.stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={entryItemForm.cantidad}
                  onChange={(event) => setEntryItemForm({ ...entryItemForm, cantidad: event.target.value })}
                  placeholder="Cantidad"
                />
                <Input value={entryItemForm.lote} onChange={(event) => setEntryItemForm({ ...entryItemForm, lote: event.target.value })} placeholder="Lote" />
                <Input type="date" value={entryItemForm.fechaVencimiento} onChange={(event) => setEntryItemForm({ ...entryItemForm, fechaVencimiento: event.target.value })} />
                <Button type="button" variant="outline" onClick={addEntryItem} disabled={activeProducts.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar
                </Button>
              </div>
            </div>

            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entryItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Agrega productos a reabastecer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    entryItems.map((item, index) => (
                      <TableRow key={`${item.productoId}-${item.lote}-${index}`}>
                        <TableCell className="font-medium">{item.productoNombre}</TableCell>
                        <TableCell>+{item.cantidad}</TableCell>
                        <TableCell>{item.lote}</TableCell>
                        <TableCell>{item.fechaVencimiento ? formatDate(item.fechaVencimiento) : "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setEntryItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                            aria-label={`Quitar ${item.productoNombre}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={stockEntryForm.notas} onChange={(event) => setStockEntryForm({ ...stockEntryForm, notas: event.target.value })} rows={3} />
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Resumen reabastecimiento</p>
                <p className="text-xl font-semibold">{entryItems.length} productos</p>
                <p className="text-sm text-muted-foreground">{entryTotalUnits} unidades</p>
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsStockEntryDialogOpen(false)} disabled={isSavingStockEntry}>
              Cancelar
            </Button>
            <Button type="submit" form="stock-entry-form" disabled={isSavingStockEntry || entryItems.length === 0}>
              {isSavingStockEntry ? "Registrando..." : "Confirmar reabastecimiento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Salida o ajuste de inventario</DialogTitle>
            <DialogDescription>Para cambios de stock que no son venta ni reabastecimiento.</DialogDescription>
          </DialogHeader>
          <form id="movement-form" onSubmit={handleRegisterMovement} className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Registra casos como producto danado, caducidad, uso clinico, devolucion o diferencia por conteo fisico.
              La nota es opcional; el sistema guardara el tipo de movimiento y el stock anterior/nuevo.
            </div>
            <div className="space-y-2">
              <Label>Producto</Label>
              <Select value={movementForm.productoId} onValueChange={(value) => setMovementForm({ ...movementForm, productoId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={activeProducts.length ? "Seleccionar producto" : "No hay productos activos"} />
                </SelectTrigger>
                <SelectContent>
                    {activeProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {getProductDisplayName(product)} - stock {product.stock}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de salida o ajuste</Label>
                <Select value={movementForm.tipo} onValueChange={(value) => setMovementForm({ ...movementForm, tipo: value as InventoryMovementType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="merma">Merma / producto danado</SelectItem>
                    <SelectItem value="caducidad">Caducidad</SelectItem>
                    <SelectItem value="uso_clinico">Uso clinico interno</SelectItem>
                    <SelectItem value="devolucion">Devolucion al stock</SelectItem>
                    <SelectItem value="ajuste">Ajuste por conteo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {manualMovementDescriptions[movementForm.tipo]}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={movementForm.cantidad}
                  onChange={(event) => setMovementForm({ ...movementForm, cantidad: event.target.value })}
                  placeholder={movementForm.tipo === "ajuste" ? "Puede ser negativo" : "0"}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nota opcional</Label>
              <Textarea
                value={movementForm.motivo}
                onChange={(event) => setMovementForm({ ...movementForm, motivo: event.target.value })}
                rows={3}
                placeholder="Ej. caja danada, producto vencido, diferencia en conteo..."
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsMovementDialogOpen(false)} disabled={isSavingMovement}>
              Cancelar
            </Button>
            <Button type="submit" form="movement-form" disabled={isSavingMovement || activeProducts.length === 0}>
              {isSavingMovement ? "Registrando..." : "Registrar movimiento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventarioPage;
