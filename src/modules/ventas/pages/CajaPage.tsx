import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Landmark,
  Lock,
  Plus,
  Power,
  ReceiptText,
  Search,
  Unlock,
  WalletCards,
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
import { formatCurrency, formatDate } from "@/shared/utils/utils";
import { useCashRegister } from "../hooks/useCashRegister";
import type { CashClosureTotals, CashCutSummary, CashMovement, CashMovementType, PaymentMethod } from "../types/cash.types";

const today = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().split("T")[0];
};

const paymentMethods: PaymentMethod[] = ["efectivo", "tarjeta", "transferencia"];

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

const cashMovementLabel: Record<CashMovementType, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
};

const emptyTotals: CashClosureTotals = {
  efectivo: 0,
  tarjeta: 0,
  transferencia: 0,
  total: 0,
};

const createEmptyCashSummary = (): CashCutSummary => ({
  totales: { ...emptyTotals },
  totalIngresos: 0,
  totalEgresos: 0,
  balanceNeto: 0,
  fondoInicial: 0,
  efectivoFinal: 0,
  desgloseMetodos: paymentMethods.map((method) => ({
    metodo: method,
    ingresos: 0,
    egresos: 0,
    neto: 0,
  })),
});

const isOpeningCashMovement = (movement: Pick<CashMovement, "concepto" | "referenciaTipo">) => {
  return movement.referenciaTipo === "apertura" || movement.concepto.toLowerCase().includes("apertura");
};

const buildCashSummary = (movements: CashMovement[]): CashCutSummary => {
  const summary = createEmptyCashSummary();
  let ingresosEfectivo = 0;
  let egresosEfectivo = 0;

  movements
    .filter((movement) => movement.estado === "activo")
    .forEach((movement) => {
      const amount = Number(movement.monto) || 0;

      if (isOpeningCashMovement(movement)) {
        if (movement.tipo === "ingreso") summary.fondoInicial += amount;
        return;
      }

      const methodTotals = summary.desgloseMetodos.find((item) => item.metodo === movement.metodo);
      if (!methodTotals) return;

      if (movement.tipo === "ingreso") {
        summary.totalIngresos += amount;
        summary.totales[movement.metodo] += amount;
        summary.totales.total += amount;
        methodTotals.ingresos += amount;
        methodTotals.neto += amount;
        if (movement.metodo === "efectivo") ingresosEfectivo += amount;
      } else {
        summary.totalEgresos += amount;
        methodTotals.egresos += amount;
        methodTotals.neto -= amount;
        if (movement.metodo === "efectivo") egresosEfectivo += amount;
      }
    });

  summary.balanceNeto = summary.totalIngresos - summary.totalEgresos;
  summary.efectivoFinal = summary.fondoInicial + ingresosEfectivo - egresosEfectivo;
  return summary;
};

const CajaPage: React.FC = () => {
  const {
    payments,
    paymentsLoading,
    cashClosures,
    cashMovements,
    cashMovementsLoading,
    openCashRegister,
    createCashMovement,
    createPayment,
    closeCashRegister,
    autoCloseCashRegister,
  } = useCashRegister();

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "todos">("todos");
  const [dateFilter, setDateFilter] = useState(today());
  const [activeTab, setActiveTab] = useState("pagos");
  const [selectedClosureId, setSelectedClosureId] = useState<string | null>(null);

  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isOpeningCash, setIsOpeningCash] = useState(false);
  const [isClosingCash, setIsClosingCash] = useState(false);
  const [isAutoClosingCash, setIsAutoClosingCash] = useState(false);
  const [isSavingCashMovement, setIsSavingCashMovement] = useState(false);

  const [isOpenCashDialogOpen, setIsOpenCashDialogOpen] = useState(false);
  const [isCashMovementDialogOpen, setIsCashMovementDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    pacienteNombre: "",
    concepto: "",
    monto: "",
    metodo: "efectivo" as PaymentMethod,
    notas: "",
  });

  const [cashCloseForm, setCashCloseForm] = useState({
    efectivoContado: "",
    observaciones: "",
  });

  const [openCashForm, setOpenCashForm] = useState({
    fondoInicial: "",
    observaciones: "",
  });

  const [cashMovementForm, setCashMovementForm] = useState({
    tipo: "egreso" as CashMovementType,
    metodo: "efectivo" as PaymentMethod,
    concepto: "",
    monto: "",
    nota: "",
  });

  const filteredPayments = useMemo(() => {
    const term = search.toLowerCase().trim();

    return payments.filter((payment) => {
      const matchesText =
        !term ||
        payment.pacienteNombre.toLowerCase().includes(term) ||
        payment.concepto.toLowerCase().includes(term) ||
        payment.id.toLowerCase().includes(term);
      const matchesMethod = methodFilter === "todos" || payment.metodo === methodFilter;
      const matchesDate = !dateFilter || payment.fecha === dateFilter;

      return matchesText && matchesMethod && matchesDate;
    });
  }, [payments, search, methodFilter, dateFilter]);

  const openCashClosure = useMemo(
    () => cashClosures.find((closure) => closure.estado === "abierto"),
    [cashClosures],
  );

  const selectedDateCashMovements = useMemo(() => {
    return cashMovements.filter((movement) => !dateFilter || movement.fecha === dateFilter);
  }, [cashMovements, dateFilter]);

  const openCashMovements = useMemo(() => {
    if (!openCashClosure) return [];
    return cashMovements.filter((movement) => movement.corteId === openCashClosure.id);
  }, [cashMovements, openCashClosure]);

  const closuresForDate = useMemo(
    () => cashClosures.filter((closure) => closure.fecha === dateFilter),
    [cashClosures, dateFilter],
  );
  const closedClosuresForDate = closuresForDate.filter((closure) => closure.estado === "cerrado");
  const lastClosureForDate = closedClosuresForDate[0];
  const hasAnyClosureForDate = closuresForDate.length > 0;
  const hasOpenCashForSelectedDate = openCashClosure?.fecha === dateFilter;
  const hasOpenCashForAnotherDate = Boolean(openCashClosure && openCashClosure.fecha !== dateFilter);
  const canOpenSelectedDate = !openCashClosure;
  const openCashButtonLabel = openCashClosure ? "Caja abierta" : lastClosureForDate ? "Abrir nuevo turno" : "Abrir caja";

  const selectedClosureForDetail = useMemo(() => {
    const explicitClosure = selectedClosureId
      ? closuresForDate.find((closure) => closure.id === selectedClosureId)
      : null;

    if (explicitClosure) return explicitClosure;
    if (hasOpenCashForSelectedDate && openCashClosure) return openCashClosure;
    return lastClosureForDate ?? closuresForDate[0] ?? null;
  }, [closuresForDate, hasOpenCashForSelectedDate, lastClosureForDate, openCashClosure, selectedClosureId]);

  const selectedClosureMovements = useMemo(() => {
    if (!selectedClosureForDetail) return selectedDateCashMovements;
    return cashMovements.filter((movement) => movement.corteId === selectedClosureForDetail.id);
  }, [cashMovements, selectedClosureForDetail, selectedDateCashMovements]);

  const displayedCashMovements = useMemo(() => {
    return selectedClosureMovements;
  }, [selectedClosureMovements]);

  const activeDisplayedCashMovements = useMemo(
    () => displayedCashMovements.filter((movement) => movement.estado === "activo"),
    [displayedCashMovements],
  );

  const openCashSummary = useMemo(() => buildCashSummary(openCashMovements), [openCashMovements]);
  const cashSummary = useMemo(() => buildCashSummary(displayedCashMovements), [displayedCashMovements]);
  const cashSummaryForClosing = openCashClosure ? openCashSummary : cashSummary;

  const cashStatus = useMemo(() => {
    if (hasOpenCashForSelectedDate) {
      return {
        label: "ABIERTA",
        title: "Caja abierta",
        description: `El corte del ${formatDate(dateFilter)} esta activo y listo para recibir cobros.`,
        nextAction: "Al final del turno cierra manual o automatico.",
        Icon: Unlock,
        cardClass: "border-emerald-300 bg-emerald-50",
        iconClass: "bg-emerald-600 text-white",
        badgeClass: "bg-emerald-600 text-white hover:bg-emerald-600",
      };
    }

    if (hasOpenCashForAnotherDate && openCashClosure) {
      return {
        label: "PENDIENTE",
        title: "Caja pendiente de cierre",
        description: `Hay una caja abierta del ${formatDate(openCashClosure.fecha)}. Cierra ese corte antes de operar el ${formatDate(dateFilter)}.`,
        nextAction: "Ve al corte pendiente y cierralo.",
        Icon: AlertTriangle,
        cardClass: "border-amber-300 bg-amber-50",
        iconClass: "bg-amber-500 text-white",
        badgeClass: "bg-amber-500 text-white hover:bg-amber-500",
      };
    }

    if (lastClosureForDate) {
      return {
        label: "CERRADA",
        title: "Turno cerrado",
        description: `Hay ${closedClosuresForDate.length} corte${closedClosuresForDate.length === 1 ? "" : "s"} cerrado${closedClosuresForDate.length === 1 ? "" : "s"} para el ${formatDate(dateFilter)}.`,
        nextAction: canOpenSelectedDate ? "Puedes abrir otro turno para este dia." : "Consulta el resumen o selecciona otro dia.",
        Icon: Lock,
        cardClass: "border-slate-300 bg-slate-50",
        iconClass: "bg-slate-700 text-white",
        badgeClass: "bg-slate-700 text-white hover:bg-slate-700",
      };
    }

    return {
      label: "SIN ABRIR",
      title: "Caja sin abrir",
      description: `Todavia no hay corte para el ${formatDate(dateFilter)}.`,
      nextAction: "Abre caja para empezar a cobrar.",
      Icon: Power,
      cardClass: "border-red-200 bg-red-50",
      iconClass: "bg-red-600 text-white",
      badgeClass: "bg-red-600 text-white hover:bg-red-600",
    };
  }, [canOpenSelectedDate, closedClosuresForDate.length, dateFilter, hasOpenCashForAnotherDate, hasOpenCashForSelectedDate, lastClosureForDate, openCashClosure]);

  const CashStatusIcon = cashStatus.Icon;
  const selectedClosureIndex = selectedClosureForDetail
    ? closuresForDate.findIndex((closure) => closure.id === selectedClosureForDetail.id)
    : -1;
  const selectedClosureLabel = selectedClosureForDetail && selectedClosureIndex >= 0
    ? `Turno ${closuresForDate.length - selectedClosureIndex}`
    : "Fecha completa";

  const handleAddPayment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!paymentForm.pacienteNombre.trim() || !paymentForm.concepto.trim() || !paymentForm.monto) {
      toast.error("Completa paciente, concepto y monto");
      return;
    }

    if (!hasOpenCashForSelectedDate) {
      toast.error(openCashClosure ? `Cierra primero la caja del ${openCashClosure.fecha}` : "Abre caja antes de cobrar");
      return;
    }

    setIsSavingPayment(true);
    try {
      await createPayment({
        pacienteNombre: paymentForm.pacienteNombre.trim(),
        concepto: paymentForm.concepto.trim(),
        fecha: dateFilter || today(),
        metodo: paymentForm.metodo,
        monto: Number(paymentForm.monto) || 0,
        origen: "venta_directa",
        pacienteId: null,
        cotizacionId: null,
        notas: paymentForm.notas,
      });
      setPaymentForm({ pacienteNombre: "", concepto: "", monto: "", metodo: "efectivo", notas: "" });
      setIsPaymentDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "No se pudo registrar el pago");
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleOpenCashRegister = async (event: React.FormEvent) => {
    event.preventDefault();

    if (openCashClosure) {
      toast.error(`Ya hay una caja abierta del ${openCashClosure.fecha}. Cierrala antes de abrir otra.`);
      return;
    }

    setIsOpeningCash(true);
    try {
      await openCashRegister({
        fecha: dateFilter || today(),
        fondoInicial: Number(openCashForm.fondoInicial) || 0,
        observaciones: openCashForm.observaciones,
      });
      setOpenCashForm({ fondoInicial: "", observaciones: "" });
      setIsOpenCashDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "No se pudo abrir la caja");
    } finally {
      setIsOpeningCash(false);
    }
  };

  const handleRegisterCashMovement = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!cashMovementForm.concepto.trim() || !cashMovementForm.monto) {
      toast.error("Completa concepto y monto");
      return;
    }

    if (!hasOpenCashForSelectedDate) {
      toast.error(openCashClosure ? `Cierra primero la caja del ${openCashClosure.fecha}` : "Abre caja antes de registrar movimientos");
      return;
    }

    setIsSavingCashMovement(true);
    try {
      await createCashMovement({
        fecha: dateFilter || today(),
        tipo: cashMovementForm.tipo,
        metodo: cashMovementForm.metodo,
        concepto: cashMovementForm.concepto.trim(),
        monto: Number(cashMovementForm.monto) || 0,
        nota: cashMovementForm.nota,
        referenciaTipo: "manual",
      });
      setCashMovementForm({ tipo: "egreso", metodo: "efectivo", concepto: "", monto: "", nota: "" });
      setIsCashMovementDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "No se pudo registrar el movimiento de caja");
    } finally {
      setIsSavingCashMovement(false);
    }
  };

  const handleCloseCashRegister = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!openCashClosure) {
      toast.error("No hay una caja abierta para cerrar");
      return;
    }

    if (!cashCloseForm.efectivoContado) {
      toast.error("Escribe el efectivo contado o usa cierre automatico");
      return;
    }

    setIsClosingCash(true);
    try {
      await closeCashRegister({
        fecha: openCashClosure?.fecha || dateFilter || today(),
        totales: cashSummaryForClosing.totales,
        efectivoContado: Number(cashCloseForm.efectivoContado) || 0,
        observaciones: cashCloseForm.observaciones,
        tipoCierre: "manual",
      });
      setCashCloseForm({ efectivoContado: "", observaciones: "" });
    } catch (error: any) {
      toast.error(error.message || "No se pudo cerrar el corte");
    } finally {
      setIsClosingCash(false);
    }
  };

  const handleAutoCloseCashRegister = async () => {
    if (!openCashClosure) {
      toast.error("No hay una caja abierta para cerrar");
      return;
    }

    setIsAutoClosingCash(true);
    try {
      await autoCloseCashRegister(`Cierre automatico del corte ${openCashClosure.fecha}`);
      setCashCloseForm({ efectivoContado: "", observaciones: "" });
    } catch (error: any) {
      toast.error(error.message || "No se pudo cerrar el corte automatico");
    } finally {
      setIsAutoClosingCash(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Caja</h1>
            <Badge className={cashStatus.badgeClass}>{cashStatus.label}</Badge>
          </div>
          <p className="text-muted-foreground">
            Controla cobros reales, turnos, cortes y movimientos contables.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateFilter}
              onChange={(event) => {
                setDateFilter(event.target.value);
                setSelectedClosureId(null);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDateFilter(today());
                setSelectedClosureId(null);
              }}
            >
              Hoy
            </Button>
          </div>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              if (canOpenSelectedDate) {
                setIsOpenCashDialogOpen(true);
                return;
              }
              if (openCashClosure) {
                setDateFilter(openCashClosure.fecha);
                setSelectedClosureId(openCashClosure.id);
              }
              setActiveTab("corte");
            }}
          >
            {canOpenSelectedDate ? (
              <Power className="mr-2 h-4 w-4" />
            ) : (
              <ReceiptText className="mr-2 h-4 w-4" />
            )}
            {canOpenSelectedDate ? openCashButtonLabel : "Ver caja"}
          </Button>
          <Button className="justify-start" onClick={() => setIsPaymentDialogOpen(true)} disabled={!hasOpenCashForSelectedDate}>
            <CircleDollarSign className="mr-2 h-4 w-4" />
            Nuevo cobro
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => setIsCashMovementDialogOpen(true)}
            disabled={!hasOpenCashForSelectedDate}
          >
            <ReceiptText className="mr-2 h-4 w-4" />
            Movimiento
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos del corte</CardTitle>
            <CircleDollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cashSummary.totalIngresos)}</div>
            <p className="text-xs text-muted-foreground">{activeDisplayedCashMovements.length} movimientos activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Efectivo esperado</CardTitle>
            <Banknote className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cashSummary.efectivoFinal)}</div>
            <p className="text-xs text-muted-foreground">Fondo + ingresos - egresos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Egresos</CardTitle>
            <CreditCard className="h-5 w-5 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cashSummary.totalEgresos)}</div>
            <p className="text-xs text-muted-foreground">Salidas manuales de caja</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Turnos del dia</CardTitle>
            <ReceiptText className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{closuresForDate.length}</div>
            <p className="text-xs text-muted-foreground">Aperturas registradas</p>
          </CardContent>
        </Card>
      </div>

      <Card className={cashStatus.cardClass}>
        <CardContent className="grid gap-4 p-5 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-md ${cashStatus.iconClass}`}>
              <CashStatusIcon className="h-8 w-8" />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cashStatus.badgeClass}>{cashStatus.label}</Badge>
                <p className="text-xl font-bold text-foreground">{cashStatus.title}</p>
              </div>
              <p className="text-sm text-muted-foreground">{cashStatus.description}</p>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Fecha visible</p>
                  <p className="font-medium">{formatDate(dateFilter)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Turno abierto</p>
                  <p className="font-medium">{openCashClosure ? formatDate(openCashClosure.fecha) : "Ninguno"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Siguiente accion</p>
                  <p className="font-medium">{cashStatus.nextAction}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
            {hasOpenCashForAnotherDate && openCashClosure && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDateFilter(openCashClosure.fecha);
                  setSelectedClosureId(openCashClosure.id);
                  setActiveTab("corte");
                }}
              >
                Ver pendiente
              </Button>
            )}
            {canOpenSelectedDate && (
              <Button type="button" onClick={() => setIsOpenCashDialogOpen(true)}>
                <Power className="mr-2 h-4 w-4" />
                {openCashButtonLabel}
              </Button>
            )}
            {lastClosureForDate && !openCashClosure && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedClosureId(lastClosureForDate.id);
                  setActiveTab("corte");
                }}
              >
                Ver corte cerrado
              </Button>
            )}
            {openCashClosure && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDateFilter(openCashClosure.fecha);
                  setSelectedClosureId(openCashClosure.id);
                  setActiveTab("corte");
                }}
              >
                Ver arqueo
              </Button>
            )}
            {openCashClosure && (
              <Button type="button" variant="secondary" onClick={handleAutoCloseCashRegister} disabled={isAutoClosingCash || isClosingCash}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {isAutoClosingCash ? "Cerrando..." : "Cerrar automatico"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 md:w-fit">
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="corte">Corte</TabsTrigger>
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
                    <Select value={methodFilter} onValueChange={(value) => setMethodFilter(value as PaymentMethod | "todos")}>
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
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                            Cargando pagos...
                          </TableCell>
                        </TableRow>
                      ) : filteredPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                            No hay pagos registrados para este filtro.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPayments.map((payment) => {
                          const Icon = paymentMethodIcon[payment.metodo];

                          return (
                            <TableRow key={payment.id}>
                              <TableCell className="font-mono text-xs">#{payment.id.slice(0, 6)}</TableCell>
                              <TableCell className="font-medium">{payment.pacienteNombre}</TableCell>
                              <TableCell>{payment.concepto}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="gap-1">
                                  <Icon className="h-3.5 w-3.5" />
                                  {paymentMethodLabel[payment.metodo]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {payment.origen === "cotizacion" ? "Cotizacion" : payment.origen === "abono" ? "Abono" : "Venta directa"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={payment.estado === "activo" ? "default" : "secondary"}>
                                  {payment.estado}
                                </Badge>
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
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registrar pago</CardTitle>
                <CardDescription>
                  {hasOpenCashForSelectedDate
                    ? "Para cobros directos o pagos no ligados aun a cotizacion."
                    : openCashClosure
                      ? `Cierra la caja del ${formatDate(openCashClosure.fecha)} antes de cobrar en esta fecha.`
                      : "Abre caja antes de registrar cobros."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddPayment} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Paciente</Label>
                    <Input
                      value={paymentForm.pacienteNombre}
                      onChange={(event) => setPaymentForm({ ...paymentForm, pacienteNombre: event.target.value })}
                      placeholder="Nombre del paciente"
                      disabled={isSavingPayment}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Concepto</Label>
                    <Input
                      value={paymentForm.concepto}
                      onChange={(event) => setPaymentForm({ ...paymentForm, concepto: event.target.value })}
                      placeholder="Tratamiento o producto"
                      disabled={isSavingPayment}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Monto</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentForm.monto}
                        onChange={(event) => setPaymentForm({ ...paymentForm, monto: event.target.value })}
                        placeholder="0.00"
                        disabled={isSavingPayment}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Metodo</Label>
                      <Select
                        value={paymentForm.metodo}
                        onValueChange={(value) => setPaymentForm({ ...paymentForm, metodo: value as PaymentMethod })}
                        disabled={isSavingPayment}
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
                      disabled={isSavingPayment}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSavingPayment || !hasOpenCashForSelectedDate}>
                    <ReceiptText className="mr-2 h-4 w-4" />
                    {isSavingPayment ? "Registrando..." : "Registrar en caja"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="corte" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Detalle de corte</CardTitle>
                      <CardDescription>
                        {selectedClosureForDetail
                          ? `${selectedClosureLabel} del ${formatDate(selectedClosureForDetail.fecha)}`
                          : hasOpenCashForAnotherDate
                            ? `Hay una caja abierta pendiente del ${formatDate(openCashClosure?.fecha ?? dateFilter)}`
                            : "Sin caja abierta para la fecha seleccionada."}
                      </CardDescription>
                    </div>
                    <Badge variant={selectedClosureForDetail?.estado === "abierto" ? "default" : "secondary"}>
                      {selectedClosureForDetail?.estado === "abierto" ? "Abierta" : selectedClosureForDetail ? "Cerrada" : "Sin corte"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Fondo inicial</p>
                      <p className="text-xl font-semibold">{formatCurrency(cashSummary.fondoInicial)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Ingresos</p>
                      <p className="text-xl font-semibold text-emerald-700">{formatCurrency(cashSummary.totalIngresos)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Egresos</p>
                      <p className="text-xl font-semibold text-destructive">{formatCurrency(cashSummary.totalEgresos)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="text-xl font-semibold">{formatCurrency(cashSummary.balanceNeto)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Efectivo esperado</p>
                      <p className="text-xl font-semibold">{formatCurrency(cashSummary.efectivoFinal)}</p>
                    </div>
                  </div>
                  {selectedClosureForDetail && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Efectivo contado</p>
                        <p className="text-lg font-semibold">
                          {selectedClosureForDetail.estado === "cerrado"
                            ? formatCurrency(selectedClosureForDetail.efectivoContado)
                            : "Pendiente"}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Diferencia</p>
                        <p className={`text-lg font-semibold ${
                          selectedClosureForDetail.diferenciaEfectivo < 0
                            ? "text-destructive"
                            : selectedClosureForDetail.diferenciaEfectivo > 0
                              ? "text-emerald-700"
                              : ""
                        }`}>
                          {selectedClosureForDetail.estado === "cerrado"
                            ? formatCurrency(selectedClosureForDetail.diferenciaEfectivo)
                            : "Pendiente"}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Tipo de cierre</p>
                        <p className="text-lg font-semibold">
                          {selectedClosureForDetail.estado === "abierto"
                            ? "Abierto"
                            : selectedClosureForDetail.tipoCierre === "automatico"
                              ? "Automatico"
                              : "Manual"}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Movimientos</p>
                        <p className="text-lg font-semibold">{activeDisplayedCashMovements.length}</p>
                      </div>
                      {selectedClosureForDetail.observaciones && (
                        <div className="rounded-lg border bg-background p-3 md:col-span-2 xl:col-span-4">
                          <p className="text-xs text-muted-foreground">Observaciones de cierre</p>
                          <p className="text-sm">{selectedClosureForDetail.observaciones}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Turnos del dia</CardTitle>
                      <CardDescription>Aperturas y cierres registrados para la fecha seleccionada.</CardDescription>
                    </div>
                    {canOpenSelectedDate && (
                      <Button type="button" variant="outline" onClick={() => setIsOpenCashDialogOpen(true)}>
                        <Power className="mr-2 h-4 w-4" />
                        {openCashButtonLabel}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {closuresForDate.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <p className="font-medium">No hay turnos para este dia</p>
                      <p className="mt-1 text-sm text-muted-foreground">Abre caja para iniciar el primer turno.</p>
                    </div>
                  ) : (
                    closuresForDate.map((closure, index) => {
                      const isCurrentOpenClosure = closure.estado === "abierto" && closure.id === openCashClosure?.id;
                      const isSelectedClosure = selectedClosureForDetail?.id === closure.id;
                      const closureIncome = isCurrentOpenClosure ? openCashSummary.totalIngresos : closure.totales.total;
                      const closureCashExpected = isCurrentOpenClosure ? openCashSummary.efectivoFinal : closure.efectivoEsperado;
                      const closureDifference = isCurrentOpenClosure ? 0 : closure.diferenciaEfectivo;

                      return (
                        <div
                          key={closure.id}
                          className={`grid gap-3 rounded-lg border p-4 lg:grid-cols-[1fr_auto] lg:items-center ${
                            isSelectedClosure ? "border-primary bg-primary/5" : ""
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={closure.estado === "abierto" ? "default" : "secondary"}>
                                {closure.estado === "abierto"
                                  ? "Abierto"
                                  : closure.tipoCierre === "automatico"
                                    ? "Cerrado auto"
                                    : "Cerrado manual"}
                              </Badge>
                              <p className="font-semibold">Turno {closuresForDate.length - index}</p>
                              <p className="text-sm text-muted-foreground">
                                Inicio {formatDate(closure.inicio)}
                                {closure.fin ? ` - cierre ${formatDate(closure.fin)}` : ""}
                              </p>
                            </div>
                            {closure.observaciones && (
                              <p className="text-sm text-muted-foreground">{closure.observaciones}</p>
                            )}
                          </div>
                          <div className="grid gap-3 text-sm sm:grid-cols-4 lg:min-w-[520px]">
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Ingresos</p>
                              <p className="font-semibold">{formatCurrency(closureIncome)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Efectivo esperado</p>
                              <p className="font-semibold">{formatCurrency(closureCashExpected)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-muted-foreground">Diferencia</p>
                              <p className={`font-semibold ${closureDifference < 0 ? "text-destructive" : closureDifference > 0 ? "text-emerald-700" : ""}`}>
                                {formatCurrency(closureDifference)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant={isSelectedClosure ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedClosureId(closure.id)}
                            >
                              <ReceiptText className="mr-2 h-4 w-4" />
                              Ver detalle
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Desglose por metodo</CardTitle>
                  <CardDescription>Ingresos, egresos y neto separados por forma de pago.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cashSummary.desgloseMetodos.map((methodSummary) => {
                    const Icon = paymentMethodIcon[methodSummary.metodo];

                    return (
                      <div key={methodSummary.metodo} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{paymentMethodLabel[methodSummary.metodo]}</p>
                            <p className="text-sm text-muted-foreground">
                              {activeDisplayedCashMovements.filter((movement) => movement.metodo === methodSummary.metodo && !isOpeningCashMovement(movement)).length} movimientos
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-emerald-700">+ {formatCurrency(methodSummary.ingresos)}</p>
                        <p className="text-sm text-destructive">- {formatCurrency(methodSummary.egresos)}</p>
                        <p className="text-right font-semibold">{formatCurrency(methodSummary.neto)}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Movimientos de caja</CardTitle>
                      <CardDescription>Apertura, cobros, ingresos manuales y egresos del dia.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => setIsCashMovementDialogOpen(true)} disabled={!hasOpenCashForSelectedDate}>
                      <ReceiptText className="mr-2 h-4 w-4" />
                      Nuevo movimiento
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Concepto</TableHead>
                          <TableHead>Metodo</TableHead>
                          <TableHead>Referencia</TableHead>
                          <TableHead>Nota</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cashMovementsLoading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                              Cargando movimientos de caja...
                            </TableCell>
                          </TableRow>
                        ) : displayedCashMovements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                              No hay movimientos de caja para esta fecha.
                            </TableCell>
                          </TableRow>
                        ) : (
                          displayedCashMovements.map((movement) => (
                            <TableRow key={movement.id}>
                              <TableCell>{formatDate(movement.fecha)}</TableCell>
                              <TableCell>
                                <Badge variant={movement.tipo === "ingreso" ? "default" : "destructive"}>
                                  {isOpeningCashMovement(movement) ? "Apertura" : cashMovementLabel[movement.tipo]}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">{movement.concepto}</TableCell>
                              <TableCell>{paymentMethodLabel[movement.metodo]}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{movement.referenciaTipo}</Badge>
                              </TableCell>
                              <TableCell className="max-w-[240px] truncate text-muted-foreground">{movement.nota || "-"}</TableCell>
                              <TableCell className={`text-right font-semibold ${movement.tipo === "egreso" ? "text-destructive" : "text-emerald-700"}`}>
                                {movement.tipo === "egreso" ? "-" : "+"}
                                {formatCurrency(movement.monto)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Acciones de caja</CardTitle>
                <CardDescription>
                  {openCashClosure ? `Cierre del corte ${formatDate(openCashClosure.fecha)}` : "Abre caja para empezar el turno."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Button
                    type="button"
                    variant={openCashClosure ? "secondary" : "default"}
                    onClick={() => {
                      if (canOpenSelectedDate) {
                        setIsOpenCashDialogOpen(true);
                        return;
                      }
                    }}
                    disabled={Boolean(openCashClosure)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {openCashButtonLabel}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsCashMovementDialogOpen(true)} disabled={!hasOpenCashForSelectedDate}>
                    <ReceiptText className="mr-2 h-4 w-4" />
                    Movimiento de caja
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleAutoCloseCashRegister} disabled={!openCashClosure || isAutoClosingCash || isClosingCash}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {isAutoClosingCash ? "Cerrando..." : "Cerrar automatico"}
                  </Button>
                </div>

                <form onSubmit={handleCloseCashRegister} className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">Efectivo esperado</p>
                    <p className="text-3xl font-bold">{formatCurrency(cashSummaryForClosing.efectivoFinal)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ingresos del corte: {formatCurrency(cashSummaryForClosing.totalIngresos)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Efectivo contado</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={cashCloseForm.efectivoContado}
                      onChange={(event) => setCashCloseForm({ ...cashCloseForm, efectivoContado: event.target.value })}
                      disabled={isClosingCash || !openCashClosure}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Observaciones</Label>
                    <Textarea
                      rows={4}
                      placeholder="Diferencias, referencias bancarias o notas del cierre"
                      value={cashCloseForm.observaciones}
                      onChange={(event) => setCashCloseForm({ ...cashCloseForm, observaciones: event.target.value })}
                      disabled={isClosingCash || !openCashClosure}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isClosingCash || !openCashClosure}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {isClosingCash ? "Cerrando..." : "Cerrar corte manual"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Flujo separado</p>
              <p className="text-sm text-muted-foreground">
                Caja solo registra dinero real: cobros, ingresos, egresos, aperturas y cierres de turno.
              </p>
            </div>
          </div>
          <Button variant="secondary">
            <WalletCards className="mr-2 h-4 w-4" />
            Pendientes de cobro
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nuevo cobro</DialogTitle>
            <DialogDescription>
              {hasOpenCashForSelectedDate
                ? `El cobro entrara al turno abierto del ${formatDate(dateFilter)}.`
                : openCashClosure
                  ? `La caja abierta es del ${formatDate(openCashClosure.fecha)}. Cambia a esa fecha para cobrar.`
                  : "Abre caja antes de registrar cobros."}
            </DialogDescription>
          </DialogHeader>
          <form id="payment-dialog-form" onSubmit={handleAddPayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Paciente</Label>
              <Input
                value={paymentForm.pacienteNombre}
                onChange={(event) => setPaymentForm({ ...paymentForm, pacienteNombre: event.target.value })}
                placeholder="Nombre del paciente"
                disabled={isSavingPayment}
              />
            </div>
            <div className="space-y-2">
              <Label>Concepto</Label>
              <Input
                value={paymentForm.concepto}
                onChange={(event) => setPaymentForm({ ...paymentForm, concepto: event.target.value })}
                placeholder="Tratamiento, abono o producto"
                disabled={isSavingPayment}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.monto}
                  onChange={(event) => setPaymentForm({ ...paymentForm, monto: event.target.value })}
                  placeholder="0.00"
                  disabled={isSavingPayment}
                />
              </div>
              <div className="space-y-2">
                <Label>Metodo</Label>
                <Select
                  value={paymentForm.metodo}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, metodo: value as PaymentMethod })}
                  disabled={isSavingPayment}
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
                disabled={isSavingPayment}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={isSavingPayment}>
              Cancelar
            </Button>
            <Button type="submit" form="payment-dialog-form" disabled={isSavingPayment || !hasOpenCashForSelectedDate}>
              {isSavingPayment ? "Registrando..." : "Registrar cobro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpenCashDialogOpen} onOpenChange={setIsOpenCashDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Abrir caja</DialogTitle>
            <DialogDescription>
              {hasAnyClosureForDate
                ? `Abrir nuevo turno para el ${formatDate(dateFilter)}.`
                : `Registra el fondo inicial para el ${formatDate(dateFilter)}.`}
            </DialogDescription>
          </DialogHeader>
          <form id="open-cash-form" onSubmit={handleOpenCashRegister} className="space-y-4">
            <div className="space-y-2">
              <Label>Fondo inicial</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={openCashForm.fondoInicial}
                onChange={(event) => setOpenCashForm({ ...openCashForm, fondoInicial: event.target.value })}
                placeholder="0.00"
                disabled={isOpeningCash}
              />
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                rows={3}
                value={openCashForm.observaciones}
                onChange={(event) => setOpenCashForm({ ...openCashForm, observaciones: event.target.value })}
                placeholder="Caja inicial, responsable o notas del turno"
                disabled={isOpeningCash}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpenCashDialogOpen(false)} disabled={isOpeningCash}>
              Cancelar
            </Button>
            <Button type="submit" form="open-cash-form" disabled={isOpeningCash || Boolean(openCashClosure)}>
              {isOpeningCash ? "Abriendo..." : openCashButtonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCashMovementDialogOpen} onOpenChange={setIsCashMovementDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Movimiento de caja</DialogTitle>
            <DialogDescription>
              {hasOpenCashForSelectedDate
                ? "Registra ingresos o egresos manuales del turno."
                : openCashClosure
                  ? `La caja abierta es del ${formatDate(openCashClosure.fecha)}. Cambia a esa fecha para registrar movimientos.`
                  : "Abre caja antes de registrar movimientos."}
            </DialogDescription>
          </DialogHeader>
          <form id="cash-movement-form" onSubmit={handleRegisterCashMovement} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={cashMovementForm.tipo}
                  onValueChange={(value) => setCashMovementForm({ ...cashMovementForm, tipo: value as CashMovementType })}
                  disabled={isSavingCashMovement}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Metodo</Label>
                <Select
                  value={cashMovementForm.metodo}
                  onValueChange={(value) => setCashMovementForm({ ...cashMovementForm, metodo: value as PaymentMethod })}
                  disabled={isSavingCashMovement}
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
              <Label>Concepto</Label>
              <Input
                value={cashMovementForm.concepto}
                onChange={(event) => setCashMovementForm({ ...cashMovementForm, concepto: event.target.value })}
                placeholder="Compra, retiro, ajuste, ingreso extra..."
                disabled={isSavingCashMovement}
              />
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={cashMovementForm.monto}
                onChange={(event) => setCashMovementForm({ ...cashMovementForm, monto: event.target.value })}
                placeholder="0.00"
                disabled={isSavingCashMovement}
              />
            </div>
            <div className="space-y-2">
              <Label>Nota</Label>
              <Textarea
                rows={3}
                value={cashMovementForm.nota}
                onChange={(event) => setCashMovementForm({ ...cashMovementForm, nota: event.target.value })}
                placeholder="Detalle del movimiento"
                disabled={isSavingCashMovement}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCashMovementDialogOpen(false)} disabled={isSavingCashMovement}>
              Cancelar
            </Button>
            <Button type="submit" form="cash-movement-form" disabled={isSavingCashMovement || !hasOpenCashForSelectedDate}>
              {isSavingCashMovement ? "Registrando..." : "Registrar movimiento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default CajaPage;
