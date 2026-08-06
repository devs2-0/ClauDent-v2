import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Check,
  CircleDollarSign,
  CreditCard,
  ChevronsUpDown,
  Download,
  Landmark,
  Minus,
  Package,
  Plus,
  ReceiptText,
  ShoppingCart,
  Stethoscope,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { useInventory } from "@/modules/inventario";
import { usePatients } from "@/modules/patients";
import { useDentalServices } from "@/modules/services";
import { DataPagination } from "@/shared/components/DataPagination";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn, formatCurrency, formatDate } from "@/shared/utils/utils";
import { usePagination } from "@/shared/hooks/usePagination";
import { useCashRegister } from "../hooks/useCashRegister";
import { generateSaleReceiptPDF, type SaleReceiptData } from "../services/saleReceiptPdfService";
import type { DirectSaleProductItem, DirectSaleServiceItem, PaymentMethod } from "../types/cash.types";

const today = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().split("T")[0];
};

const paymentMethodLabel: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

const paymentMethodIcon: Record<PaymentMethod, React.ElementType> = {
  efectivo: Banknote,
  tarjeta: CreditCard,
  transferencia: Landmark,
};

const patientFullName = (patient: { nombres: string; apellidos: string }) => {
  return `${patient.nombres} ${patient.apellidos}`.trim();
};

const inventoryProductName = (product: { nombre: string; marca?: string }) => {
  return product.marca ? `${product.nombre} (${product.marca})` : product.nombre;
};

const VentasPage: React.FC = () => {
  const {
    payments,
    paymentsLoading,
    cashClosures,
    registerDirectSale,
  } = useCashRegister();
  const { products, productsLoading } = useInventory();
  const { patients, patientsLoading } = usePatients();
  const { services, servicesLoading } = useDentalServices();

  const [dateFilter, setDateFilter] = useState(today());
  const [patientId, setPatientId] = useState("mostrador");
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [serviceId, setServiceId] = useState("");
  const [serviceQuantity, setServiceQuantity] = useState("1");
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [productQuantity, setProductQuantity] = useState("1");
  const [serviceItems, setServiceItems] = useState<DirectSaleServiceItem[]>([]);
  const [productItems, setProductItems] = useState<DirectSaleProductItem[]>([]);
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmSaleOpen, setIsConfirmSaleOpen] = useState(false);
  const [isSummaryHighlighted, setIsSummaryHighlighted] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<SaleReceiptData | null>(null);

  const openCashClosure = useMemo(
    () => cashClosures.find((closure) => closure.estado === "abierto"),
    [cashClosures],
  );
  const hasOpenCashForSelectedDate = openCashClosure?.fecha === dateFilter;
  const hasOpenCashForAnotherDate = Boolean(openCashClosure && openCashClosure.fecha !== dateFilter);

  const activeServices = useMemo(
    () => services.filter((service) => service.estado === "activo"),
    [services],
  );

  const sellableProducts = useMemo(
    () => products.filter((product) => product.estado === "activo" && product.precioVenta !== null),
    [products],
  );

  const selectedPatient = patients.find((patient) => patient.id === patientId);
  const selectedService = activeServices.find((service) => service.id === serviceId);
  const selectedProduct = sellableProducts.find((product) => product.id === productId);

  const serviceSubtotal = useMemo(
    () => serviceItems.reduce((total, item) => total + item.cantidad * item.precioUnitario, 0),
    [serviceItems],
  );

  const productSubtotal = useMemo(
    () => productItems.reduce((total, item) => total + item.cantidad * item.precioUnitario, 0),
    [productItems],
  );

  const parsedDiscount = Number(discount) || 0;
  const saleTotal = Math.max(0, serviceSubtotal + productSubtotal - parsedDiscount);
  const hasItems = serviceItems.length > 0 || productItems.length > 0;

  const salesForDate = useMemo(
    () => payments.filter((payment) => payment.fecha === dateFilter && payment.estado === "activo"),
    [payments, dateFilter],
  );
  const salesPagination = usePagination(salesForDate, {
    resetKeys: [dateFilter],
  });

  const salesTotalForDate = useMemo(
    () => salesForDate.reduce((total, payment) => total + payment.monto, 0),
    [salesForDate],
  );

  const highlightSummary = () => {
    setIsSummaryHighlighted(true);
    window.setTimeout(() => setIsSummaryHighlighted(false), 700);
  };

  const changeQuantity = (value: string, delta: number) => {
    return String(Math.max(1, (Number(value) || 1) + delta));
  };

  const addServiceItem = () => {
    if (!selectedService) {
      toast.error("Selecciona un tratamiento o servicio");
      return;
    }

    const quantity = Number(serviceQuantity) || 0;
    if (quantity <= 0) {
      toast.error("La cantidad debe ser mayor a cero");
      return;
    }

    setServiceItems((current) => {
      const existing = current.find((item) => item.servicioId === selectedService.id);
      if (existing) {
        return current.map((item) =>
          item.servicioId === selectedService.id
            ? { ...item, cantidad: item.cantidad + quantity }
            : item,
        );
      }

      return [
        ...current,
        {
          servicioId: selectedService.id,
          nombre: selectedService.nombre,
          cantidad: quantity,
          precioUnitario: Number(selectedService.precio) || 0,
        },
      ];
    });
    setServiceId("");
    setServiceQuantity("1");
    highlightSummary();
  };

  const addProductItem = () => {
    if (!selectedProduct) {
      toast.error("Selecciona un producto vendible");
      return;
    }

    const quantity = Number(productQuantity) || 0;
    if (quantity <= 0) {
      toast.error("La cantidad debe ser mayor a cero");
      return;
    }

    const currentQuantity = productItems.find((item) => item.productoId === selectedProduct.id)?.cantidad ?? 0;
    if (currentQuantity + quantity > selectedProduct.stock) {
      toast.error(`Stock insuficiente. Disponible: ${selectedProduct.stock} ${selectedProduct.unidad}`);
      return;
    }

    setProductItems((current) => {
      const existing = current.find((item) => item.productoId === selectedProduct.id);
      if (existing) {
        return current.map((item) =>
          item.productoId === selectedProduct.id
            ? { ...item, cantidad: item.cantidad + quantity }
            : item,
        );
      }

      return [
        ...current,
        {
          productoId: selectedProduct.id,
          nombre: inventoryProductName(selectedProduct),
          cantidad: quantity,
          precioUnitario: Number(selectedProduct.precioVenta) || 0,
        },
      ];
    });
    setProductId("");
    setProductQuantity("1");
    highlightSummary();
  };

  const resetTicket = () => {
    setPatientId("mostrador");
    setMethod("efectivo");
    setServiceId("");
    setProductId("");
    setServiceQuantity("1");
    setProductQuantity("1");
    setServiceItems([]);
    setProductItems([]);
    setDiscount("");
    setNotes("");
  };

  const validateSaleBeforeCheckout = () => {
    if (!hasOpenCashForSelectedDate) {
      toast.error(openCashClosure ? `La caja abierta es del ${openCashClosure.fecha}` : "Abre caja antes de vender");
      return false;
    }

    if (!hasItems) {
      toast.error("Agrega tratamientos o productos al resumen");
      return false;
    }

    if (serviceItems.length > 0 && patientId === "mostrador") {
      toast.error("Selecciona un paciente para registrar tratamientos en historial");
      return false;
    }

    if (parsedDiscount >= serviceSubtotal + productSubtotal) {
      toast.error("El descuento no puede dejar el total en cero");
      return false;
    }

    return true;
  };

  const handleRequestSaleConfirmation = (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    if (!validateSaleBeforeCheckout()) return;
    setIsConfirmSaleOpen(true);
  };

  const handleConfirmSale = async () => {
    if (!validateSaleBeforeCheckout()) return;

    setIsSaving(true);
    try {
      const receiptDraft = {
        fecha: dateFilter,
        hora: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
        pacienteNombre: selectedPatient ? patientFullName(selectedPatient) : "Venta mostrador",
        metodo: method,
        servicios: serviceItems.map((item) => ({ ...item })),
        productos: productItems.map((item) => ({ ...item })),
        subtotalServicios: serviceSubtotal,
        subtotalProductos: productSubtotal,
        descuento: parsedDiscount,
        total: saleTotal,
        notas: notes,
      };
      const paymentId = await registerDirectSale({
        fecha: dateFilter,
        pacienteId: selectedPatient?.id ?? null,
        pacienteNombre: receiptDraft.pacienteNombre,
        metodo: method,
        servicios: serviceItems,
        productos: productItems,
        descuento: parsedDiscount,
        notas: notes,
      });
      setLastReceipt({ ...receiptDraft, paymentId });
      setIsConfirmSaleOpen(false);
      resetTicket();
    } catch (error: any) {
      toast.error(error.message || "No se pudo registrar la venta");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Ventas</h1>
            <Badge variant={hasOpenCashForSelectedDate ? "default" : "destructive"}>
              {hasOpenCashForSelectedDate ? "Caja abierta" : "Caja cerrada"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Cobra tratamientos realizados y productos vendidos. El resumen alimenta caja, historial e inventario.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          <Button type="button" variant="outline" onClick={() => setDateFilter(today())}>
            Hoy
          </Button>
          <Button asChild variant="outline">
            <Link to="/caja">
              <WalletCards className="mr-2 h-4 w-4" />
              Caja
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/inventario">
              <Package className="mr-2 h-4 w-4" />
              Inventario
            </Link>
          </Button>
        </div>
      </div>

      <Card className={hasOpenCashForSelectedDate ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-md ${hasOpenCashForSelectedDate ? "bg-emerald-600" : "bg-amber-500"} text-white`}>
              {hasOpenCashForSelectedDate ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
              <p className="font-semibold">
                {hasOpenCashForSelectedDate
                  ? `Las ventas entran al corte del ${formatDate(dateFilter)}`
                  : hasOpenCashForAnotherDate && openCashClosure
                    ? `Hay una caja abierta del ${formatDate(openCashClosure.fecha)}`
                    : "Abre caja antes de vender"}
              </p>
              <p className="text-sm text-muted-foreground">
                Ventas arma el resumen. Caja solo muestra el dinero real y cierra el corte.
              </p>
            </div>
          </div>
          {!hasOpenCashForSelectedDate && (
            <Button asChild>
              <Link to="/caja">Abrir o revisar caja</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ventas del dia</CardTitle>
            <CircleDollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(salesTotalForDate)}</div>
            <p className="text-xs text-muted-foreground">{salesForDate.length} cobros registrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tratamientos en resumen</CardTitle>
            <Stethoscope className="h-5 w-5 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviceItems.length}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(serviceSubtotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Productos en resumen</CardTitle>
            <ShoppingCart className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productItems.length}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(productSubtotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total a cobrar</CardTitle>
            <ReceiptText className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(saleTotal)}</div>
            <p className="text-xs text-muted-foreground">Después de descuento</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Nueva venta</CardTitle>
            <CardDescription>Usa este resumen para tratamientos, productos o una venta mixta.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRequestSaleConfirmation} className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2 lg:col-span-2">
                  <Label>Paciente</Label>
                  <Select value={patientId} onValueChange={setPatientId} disabled={patientsLoading || isSaving}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mostrador">Venta mostrador / sin paciente</SelectItem>
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patientFullName(patient)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Para tratamientos, selecciona paciente para guardar historial.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Metodo de pago</Label>
                  <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)} disabled={isSaving}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    Tratamientos realizados
                  </p>
                  <p className="text-sm text-muted-foreground">Limpieza, extracción, resina, blanqueamiento u otro servicio clínico.</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-[1fr_132px_auto]">
                  <Select value={serviceId} onValueChange={setServiceId} disabled={servicesLoading || isSaving}>
                    <SelectTrigger>
                      <SelectValue placeholder={activeServices.length ? "Seleccionar tratamiento" : "Sin servicios activos"} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeServices.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.nombre} - {formatCurrency(service.precio)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex h-10 overflow-hidden rounded-md border bg-background">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-none"
                      onClick={() => setServiceQuantity((value) => changeQuantity(value, -1))}
                      disabled={isSaving}
                      aria-label="Disminuir cantidad de tratamiento"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={serviceQuantity}
                      onChange={(event) => setServiceQuantity(event.target.value)}
                      disabled={isSaving}
                      className="h-10 rounded-none border-0 text-center focus-visible:ring-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-none"
                      onClick={() => setServiceQuantity((value) => changeQuantity(value, 1))}
                      disabled={isSaving}
                      aria-label="Aumentar cantidad de tratamiento"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button type="button" onClick={addServiceItem} disabled={isSaving || activeServices.length === 0}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar al resumen
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    Productos vendidos
                  </p>
                  <p className="text-sm text-muted-foreground">Enjuagues, pastas, medicamentos o artículos con precio de venta.</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-[1fr_132px_auto]">
                  <Popover open={isProductSearchOpen} onOpenChange={setIsProductSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isProductSearchOpen}
                        className="h-10 justify-between overflow-hidden px-3 font-normal"
                        disabled={productsLoading || isSaving || sellableProducts.length === 0}
                      >
                        <span className="truncate">
                          {selectedProduct
                            ? `${inventoryProductName(selectedProduct)} - ${formatCurrency(selectedProduct.precioVenta || 0)} / stock ${selectedProduct.stock}`
                            : sellableProducts.length
                              ? "Buscar producto"
                              : "Sin productos vendibles"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por producto, marca o categoria..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron productos.</CommandEmpty>
                          <CommandGroup heading="Productos vendibles">
                            {sellableProducts.map((product) => {
                              const productLabel = inventoryProductName(product);
                              const searchValue = [
                                productLabel,
                                product.nombre,
                                product.marca,
                                product.categoria,
                                product.proveedor,
                              ]
                                .filter(Boolean)
                                .join(" ");

                              return (
                                <CommandItem
                                  key={product.id}
                                  value={searchValue}
                                  onSelect={() => {
                                    setProductId(product.id);
                                    setIsProductSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0",
                                      productId === product.id ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{productLabel}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {formatCurrency(product.precioVenta || 0)} / stock {product.stock} {product.unidad}
                                    </p>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <div className="flex h-10 overflow-hidden rounded-md border bg-background">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-none"
                      onClick={() => setProductQuantity((value) => changeQuantity(value, -1))}
                      disabled={isSaving}
                      aria-label="Disminuir cantidad de producto"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={productQuantity}
                      onChange={(event) => setProductQuantity(event.target.value)}
                      disabled={isSaving}
                      className="h-10 rounded-none border-0 text-center focus-visible:ring-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-none"
                      onClick={() => setProductQuantity((value) => changeQuantity(value, 1))}
                      disabled={isSaving}
                      aria-label="Aumentar cantidad de producto"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button type="button" onClick={addProductItem} disabled={isSaving || sellableProducts.length === 0}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar al resumen
                  </Button>
                </div>
                {selectedProduct && (
                  <p className="text-xs text-muted-foreground">
                    Disponible: {selectedProduct.stock} {selectedProduct.unidad}
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className={cn("transition-all duration-300", isSummaryHighlighted && "ring-2 ring-primary/40 shadow-md")}>
          <CardHeader>
            <CardTitle>Resumen de venta</CardTitle>
            <CardDescription>Revisa los conceptos antes de confirmar el cobro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasItems ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 font-medium">Resumen vacío</p>
                <p className="text-sm text-muted-foreground">Agrega tratamientos o productos.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {serviceItems.map((item) => (
                  <div
                    key={item.servicioId ?? item.nombre}
                    className="flex animate-in items-start justify-between gap-3 rounded-lg border p-3 duration-200 fade-in-0 slide-in-from-top-2"
                  >
                    <div>
                      <Badge variant="secondary" className="mb-2">Tratamiento</Badge>
                      <p className="font-medium">{item.nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.cantidad} x {formatCurrency(item.precioUnitario)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{formatCurrency(item.cantidad * item.precioUnitario)}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => setServiceItems((current) => current.filter((currentItem) => currentItem !== item))}
                        disabled={isSaving}
                        aria-label={`Quitar ${item.nombre}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {productItems.map((item) => (
                  <div
                    key={item.productoId}
                    className="flex animate-in items-start justify-between gap-3 rounded-lg border p-3 duration-200 fade-in-0 slide-in-from-top-2"
                  >
                    <div>
                      <Badge variant="outline" className="mb-2">Producto</Badge>
                      <p className="font-medium">{item.nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.cantidad} x {formatCurrency(item.precioUnitario)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{formatCurrency(item.cantidad * item.precioUnitario)}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => setProductItems((current) => current.filter((currentItem) => currentItem !== item))}
                        disabled={isSaving}
                        aria-label={`Quitar ${item.nombre}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 border-t pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tratamientos</span>
                <span>{formatCurrency(serviceSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Productos</span>
                <span>{formatCurrency(productSubtotal)}</span>
              </div>
              <div className="space-y-2">
                <Label>Descuento</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  placeholder="0.00"
                  disabled={isSaving}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-primary p-4 text-primary-foreground shadow-sm transition-all duration-200">
                <span className="font-semibold">Total a cobrar</span>
                <span className={cn("text-2xl font-bold transition-transform duration-200", isSummaryHighlighted && "scale-105")}>
                  {formatCurrency(saleTotal)}
                </span>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Observaciones, referencia, descuento aplicado..."
                  disabled={isSaving}
                />
              </div>
              <Button
                type="button"
                className="h-12 w-full text-base font-semibold"
                onClick={handleRequestSaleConfirmation}
                disabled={isSaving || !hasOpenCashForSelectedDate || !hasItems}
              >
                <CircleDollarSign className="mr-2 h-4 w-4" />
                {isSaving ? "Cobrando..." : `Cobrar ${formatCurrency(saleTotal)}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas del día</CardTitle>
          <CardDescription>Tratamientos, productos y cobros que ya entraron a caja para la fecha visible.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente / venta</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      Cargando ventas...
                    </TableCell>
                  </TableRow>
                ) : salesForDate.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      Todavía no hay ventas registradas para esta fecha.
                    </TableCell>
                  </TableRow>
                ) : (
                  salesPagination.paginatedItems.map((payment) => {
                    const MethodIcon = paymentMethodIcon[payment.metodo];

                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.pacienteNombre}</TableCell>
                        <TableCell>{payment.concepto}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <MethodIcon className="h-3.5 w-3.5" />
                            {paymentMethodLabel[payment.metodo]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {payment.origen === "cotizacion" ? "Cotizacion" : payment.origen === "abono" ? "Abono" : "Venta directa"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(payment.monto)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {!paymentsLoading && salesForDate.length > 0 && (
          <DataPagination
            itemLabel="ventas"
            page={salesPagination.page}
            pageSize={salesPagination.pageSize}
            totalItems={salesPagination.totalItems}
            startIndex={salesPagination.startIndex}
            endIndex={salesPagination.endIndex}
            canPreviousPage={salesPagination.canPreviousPage}
            canNextPage={salesPagination.canNextPage}
            onPageSizeChange={salesPagination.setPageSize}
            onPreviousPage={salesPagination.previousPage}
            onNextPage={salesPagination.nextPage}
          />
        )}
      </Card>

      <Dialog open={isConfirmSaleOpen} onOpenChange={setIsConfirmSaleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar venta</DialogTitle>
            <DialogDescription>Revisa los datos antes de registrar el cobro definitivo.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Paciente / venta</p>
                <p className="font-medium">{selectedPatient ? patientFullName(selectedPatient) : "Venta mostrador"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Metodo</p>
                <p className="font-medium">{paymentMethodLabel[method]}</p>
              </div>
            </div>

            {serviceItems.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold">Tratamientos</p>
                {serviceItems.map((item) => (
                  <div key={item.servicioId ?? item.nombre} className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{item.cantidad} x {item.nombre}</span>
                    <span className="font-medium">{formatCurrency(item.cantidad * item.precioUnitario)}</span>
                  </div>
                ))}
              </div>
            )}

            {productItems.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold">Productos</p>
                {productItems.map((item) => (
                  <div key={item.productoId} className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{item.cantidad} x {item.nombre}</span>
                    <span className="font-medium">{formatCurrency(item.cantidad * item.precioUnitario)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(serviceSubtotal + productSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Descuento</span>
                <span>-{formatCurrency(parsedDiscount)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-primary p-4 text-primary-foreground">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold">{formatCurrency(saleTotal)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsConfirmSaleOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmSale} disabled={isSaving}>
              <CircleDollarSign className="mr-2 h-4 w-4" />
              {isSaving ? "Registrando..." : "Confirmar venta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(lastReceipt)} onOpenChange={(open) => !open && setLastReceipt(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Venta registrada</DialogTitle>
            <DialogDescription>El recibo PDF es opcional y puedes cerrarlo sin descargar.</DialogDescription>
          </DialogHeader>

          {lastReceipt && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Folio</p>
                    <p className="font-semibold">{lastReceipt.paymentId.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <Badge variant="outline">{paymentMethodLabel[lastReceipt.metodo]}</Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Paciente / venta</p>
                    <p className="font-medium">{lastReceipt.pacienteNombre}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha</p>
                    <p className="font-medium">{formatDate(lastReceipt.fecha)} {lastReceipt.hora}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tratamientos</span>
                  <span>{formatCurrency(lastReceipt.subtotalServicios)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Productos</span>
                  <span>{formatCurrency(lastReceipt.subtotalProductos)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Descuento</span>
                  <span>-{formatCurrency(lastReceipt.descuento)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-primary p-4 text-primary-foreground">
                  <span className="font-semibold">Total pagado</span>
                  <span className="text-2xl font-bold">{formatCurrency(lastReceipt.total)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!lastReceipt) return;
                generateSaleReceiptPDF(lastReceipt);
                toast.success("Recibo PDF generado");
              }}
              disabled={!lastReceipt}
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar PDF opcional
            </Button>
            <Button type="button" onClick={() => setLastReceipt(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VentasPage;
