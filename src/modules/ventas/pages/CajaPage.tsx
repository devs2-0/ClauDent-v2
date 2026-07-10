import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Landmark,
  Package,
  PackageMinus,
  PackagePlus,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Textarea } from "@/shared/components/ui/textarea";
import { formatCurrency } from "@/shared/utils/utils";
import { toast } from "sonner";

type PaymentMethod = "efectivo" | "tarjeta" | "transferencia";
type InventoryMovementType = "entrada" | "venta" | "uso_clinico" | "merma" | "caducidad";

interface Payment {
  id: string;
  paciente: string;
  concepto: string;
  fecha: string;
  metodo: PaymentMethod;
  monto: number;
  origen: "Cotizacion" | "Venta directa" | "Abono";
}

interface InventoryItem {
  id: string;
  nombre: string;
  categoria: "Vendible" | "Clinico" | "Medicamento";
  stock: number;
  minimo: number;
  precioVenta?: number;
  costo: number;
}

interface InventoryMovement {
  id: string;
  fecha: string;
  producto: string;
  tipo: InventoryMovementType;
  cantidad: number;
  motivo: string;
}

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

const movementLabel: Record<InventoryMovementType, string> = {
  entrada: "Entrada",
  venta: "Venta",
  uso_clinico: "Uso clinico",
  merma: "Merma",
  caducidad: "Caducidad",
};

const initialPayments: Payment[] = [
  {
    id: "PAY-001",
    paciente: "Mariana Lopez",
    concepto: "Limpieza dental + pastillas",
    fecha: "2026-07-10",
    metodo: "efectivo",
    monto: 620,
    origen: "Cotizacion",
  },
  {
    id: "PAY-002",
    paciente: "Carlos Medina",
    concepto: "Abono blanqueamiento",
    fecha: "2026-07-10",
    metodo: "tarjeta",
    monto: 1200,
    origen: "Abono",
  },
  {
    id: "PAY-003",
    paciente: "Sofia Herrera",
    concepto: "Cepillo interdental",
    fecha: "2026-07-10",
    metodo: "transferencia",
    monto: 180,
    origen: "Venta directa",
  },
];

const inventoryItems: InventoryItem[] = [
  { id: "INV-001", nombre: "Pastillas analgesicas", categoria: "Vendible", stock: 18, minimo: 8, precioVenta: 120, costo: 65 },
  { id: "INV-002", nombre: "Cepillo interdental", categoria: "Vendible", stock: 6, minimo: 10, precioVenta: 180, costo: 90 },
  { id: "INV-003", nombre: "Guantes nitrilo caja", categoria: "Clinico", stock: 14, minimo: 6, costo: 150 },
  { id: "INV-004", nombre: "Resina A2", categoria: "Clinico", stock: 3, minimo: 4, costo: 320 },
  { id: "INV-005", nombre: "Enjuague medicado", categoria: "Medicamento", stock: 12, minimo: 5, precioVenta: 210, costo: 120 },
];

const movements: InventoryMovement[] = [
  { id: "MOV-001", fecha: "2026-07-10", producto: "Pastillas analgesicas", tipo: "venta", cantidad: -1, motivo: "Venta asociada a cobro" },
  { id: "MOV-002", fecha: "2026-07-10", producto: "Guantes nitrilo caja", tipo: "uso_clinico", cantidad: -1, motivo: "Limpieza dental" },
  { id: "MOV-003", fecha: "2026-07-09", producto: "Resina A2", tipo: "entrada", cantidad: 4, motivo: "Compra proveedor" },
  { id: "MOV-004", fecha: "2026-07-08", producto: "Enjuague medicado", tipo: "caducidad", cantidad: -2, motivo: "Lote vencido" },
];

const CajaPage: React.FC = () => {
  const [payments, setPayments] = useState(initialPayments);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("todos");
  const [dateFilter, setDateFilter] = useState("2026-07-10");
  const [paymentForm, setPaymentForm] = useState({
    paciente: "",
    concepto: "",
    monto: "",
    metodo: "efectivo" as PaymentMethod,
    notas: "",
  });

  const filteredPayments = useMemo(() => {
    const term = search.toLowerCase().trim();

    return payments.filter((payment) => {
      const matchesText =
        !term ||
        payment.paciente.toLowerCase().includes(term) ||
        payment.concepto.toLowerCase().includes(term) ||
        payment.id.toLowerCase().includes(term);
      const matchesMethod = methodFilter === "todos" || payment.metodo === methodFilter;
      const matchesDate = !dateFilter || payment.fecha === dateFilter;

      return matchesText && matchesMethod && matchesDate;
    });
  }, [payments, search, methodFilter, dateFilter]);

  const cashTotals = useMemo(() => {
    return filteredPayments.reduce(
      (totals, payment) => {
        totals[payment.metodo] += payment.monto;
        totals.total += payment.monto;
        return totals;
      },
      { efectivo: 0, tarjeta: 0, transferencia: 0, total: 0 },
    );
  }, [filteredPayments]);

  const lowStockItems = inventoryItems.filter((item) => item.stock <= item.minimo);
  const sellableItems = inventoryItems.filter((item) => item.precioVenta);

  const handleAddPayment = (event: React.FormEvent) => {
    event.preventDefault();

    if (!paymentForm.paciente || !paymentForm.concepto || !paymentForm.monto) {
      toast.error("Completa paciente, concepto y monto");
      return;
    }

    const nextPayment: Payment = {
      id: `PAY-${String(payments.length + 1).padStart(3, "0")}`,
      paciente: paymentForm.paciente,
      concepto: paymentForm.concepto,
      fecha: dateFilter || new Date().toISOString().split("T")[0],
      metodo: paymentForm.metodo,
      monto: Number(paymentForm.monto),
      origen: "Venta directa",
    };

    setPayments((current) => [nextPayment, ...current]);
    setPaymentForm({ paciente: "", concepto: "", monto: "", metodo: "efectivo", notas: "" });
    toast.success("Pago registrado en caja");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Caja e inventario</h1>
          <p className="text-muted-foreground">
            Registra pagos reales, revisa el corte diario y controla productos vendibles.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="justify-start">
            <CalendarDays className="mr-2 h-4 w-4" />
            Corte del dia
          </Button>
          <Button className="justify-start">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo pago
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total en caja</CardTitle>
            <CircleDollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cashTotals.total)}</div>
            <p className="text-xs text-muted-foreground">{filteredPayments.length} pagos reales filtrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Efectivo</CardTitle>
            <Banknote className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cashTotals.efectivo)}</div>
            <p className="text-xs text-muted-foreground">Disponible para arqueo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tarjeta</CardTitle>
            <CreditCard className="h-5 w-5 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cashTotals.tarjeta)}</div>
            <p className="text-xs text-muted-foreground">Terminal bancaria</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alertas inventario</CardTitle>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockItems.length}</div>
            <p className="text-xs text-muted-foreground">Productos bajo minimo</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pagos" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 md:w-fit md:grid-cols-4">
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="corte">Corte</TabsTrigger>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="pagos" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <CardTitle>Pagos reales</CardTitle>
                    <CardDescription>El corte se calcula desde estos movimientos, no desde cotizaciones.</CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative sm:w-64">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar pago..."
                        className="pl-9"
                      />
                    </div>
                    <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
                    <Select value={methodFilter} onValueChange={setMethodFilter}>
                      <SelectTrigger className="sm:w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Folio</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Metodo</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment) => {
                        const Icon = paymentMethodIcon[payment.metodo];

                        return (
                          <TableRow key={payment.id}>
                            <TableCell className="font-mono text-xs">{payment.id}</TableCell>
                            <TableCell className="font-medium">{payment.paciente}</TableCell>
                            <TableCell>{payment.concepto}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1">
                                <Icon className="h-3.5 w-3.5" />
                                {paymentMethodLabel[payment.metodo]}
                              </Badge>
                            </TableCell>
                            <TableCell>{payment.origen}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(payment.monto)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registrar pago</CardTitle>
                <CardDescription>Para cobros directos o pagos no ligados aun a cotizacion.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddPayment} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Paciente</Label>
                    <Input
                      value={paymentForm.paciente}
                      onChange={(event) => setPaymentForm({ ...paymentForm, paciente: event.target.value })}
                      placeholder="Nombre del paciente"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Concepto</Label>
                    <Input
                      value={paymentForm.concepto}
                      onChange={(event) => setPaymentForm({ ...paymentForm, concepto: event.target.value })}
                      placeholder="Tratamiento o producto"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Monto</Label>
                      <Input
                        type="number"
                        min="0"
                        value={paymentForm.monto}
                        onChange={(event) => setPaymentForm({ ...paymentForm, monto: event.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Metodo</Label>
                      <Select
                        value={paymentForm.metodo}
                        onValueChange={(value) => setPaymentForm({ ...paymentForm, metodo: value as PaymentMethod })}
                      >
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
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea
                      value={paymentForm.notas}
                      onChange={(event) => setPaymentForm({ ...paymentForm, notas: event.target.value })}
                      placeholder="Referencia, observaciones o descuento aplicado"
                      rows={3}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <ReceiptText className="mr-2 h-4 w-4" />
                    Registrar en caja
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="corte">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Corte diario</CardTitle>
                <CardDescription>Resumen por metodo de pago para el dia seleccionado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(["efectivo", "tarjeta", "transferencia"] as PaymentMethod[]).map((method) => {
                  const Icon = paymentMethodIcon[method];
                  return (
                    <div key={method} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{paymentMethodLabel[method]}</p>
                          <p className="text-sm text-muted-foreground">
                            {filteredPayments.filter((payment) => payment.metodo === method).length} operaciones
                          </p>
                        </div>
                      </div>
                      <p className="text-lg font-bold">{formatCurrency(cashTotals[method])}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Arqueo</CardTitle>
                <CardDescription>Front preparado para validar conteo fisico.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Total esperado</p>
                  <p className="text-3xl font-bold">{formatCurrency(cashTotals.total)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Efectivo contado</Label>
                  <Input type="number" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Observaciones</Label>
                  <Textarea rows={4} placeholder="Diferencias, referencias bancarias o notas del cierre" />
                </div>
                <Button className="w-full">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Cerrar corte
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventario">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Inventario vendible y clinico</CardTitle>
                  <CardDescription>Productos que se venden descuentan caja e inventario; material clinico solo inventario.</CardDescription>
                </div>
                <Button variant="outline">
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Entrada
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
                      <TableHead>Stock</TableHead>
                      <TableHead>Minimo</TableHead>
                      <TableHead>Venta</TableHead>
                      <TableHead>Costo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.nombre}</TableCell>
                        <TableCell>
                          <Badge variant={item.categoria === "Vendible" ? "default" : "secondary"}>{item.categoria}</Badge>
                        </TableCell>
                        <TableCell>{item.stock}</TableCell>
                        <TableCell>{item.minimo}</TableCell>
                        <TableCell>{item.precioVenta ? formatCurrency(item.precioVenta) : "No vendible"}</TableCell>
                        <TableCell>{formatCurrency(item.costo)}</TableCell>
                        <TableCell>
                          {item.stock <= item.minimo ? (
                            <Badge variant="destructive">Bajo stock</Badge>
                          ) : (
                            <Badge variant="outline">Disponible</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Productos vendibles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sellableItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{item.nombre}</p>
                      <p className="text-sm text-muted-foreground">Stock: {item.stock}</p>
                    </div>
                    <p className="font-semibold">{formatCurrency(item.precioVenta || 0)}</p>
                  </div>
                ))}
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
                {inventoryItems
                  .filter((item) => !item.precioVenta)
                  .map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{item.nombre}</p>
                        <p className="text-sm text-muted-foreground">No mueve dinero en caja</p>
                      </div>
                      <Badge variant="outline">Stock {item.stock}</Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="movimientos">
          <Card>
            <CardHeader>
              <CardTitle>Movimientos de inventario</CardTitle>
              <CardDescription>Entradas, salidas por venta, uso clinico, merma y caducidad.</CardDescription>
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
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>{movement.fecha}</TableCell>
                        <TableCell className="font-medium">{movement.producto}</TableCell>
                        <TableCell>
                          <Badge variant={movement.tipo === "entrada" ? "default" : "outline"}>
                            {movement.tipo === "entrada" ? (
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
                        <TableCell>{movement.motivo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Flujo preparado</p>
              <p className="text-sm text-muted-foreground">
                Cotizacion crea propuesta; tratamiento registra lo realizado; pago alimenta caja; producto vendido descuenta inventario.
              </p>
            </div>
          </div>
          <Button variant="secondary">
            <WalletCards className="mr-2 h-4 w-4" />
            Ver pendientes de cobro
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CajaPage;
