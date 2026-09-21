import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  Landmark,
  Lock,
  PackageCheck,
  Plus,
  Power,
  ReceiptText,
  Search,
  Settings,
  Trash2,
  TrendingDown,
  TrendingUp,
  Unlock,
} from "lucide-react";
import { CashDialogContent as DialogContent } from "../components/CashDialogContent";
import { CashDateRangeFilter } from "../components/CashDateRangeFilter";
import { CashPagination } from "../components/CashPagination";
import { today, startOfCurrentMonth, getPreviousRange, isDateInRange, calculateVariation, formatVariation, normalizeCashSearch, uniqueById } from "../utils/cashFilters";
import { buildCashSummary, buildClosureSummary, buildFinancialReportSnapshot, getExpenseCategoryLabel, isOpeningCashMovement } from "../utils/cashReporting";
import { toast } from "sonner";
import { useCan } from "@/auth";
import { DataPagination } from "@/shared/components/DataPagination";
import { SectionHelp } from "@/shared/components/SectionHelp";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
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
import { cn, formatCurrency, formatDate } from "@/shared/utils/utils";
import { usePagination } from "@/shared/hooks/usePagination";
import { useInventory } from "@/modules/inventario";
import { useCashRegister } from "../hooks/useCashRegister";
import { accountsReceivableService } from "../services/accountsReceivableService";
import { defaultCashShiftSettings } from "../services/cashShiftSettingsService";
import {
  exportCashCutCsv,
  exportCashCutPdf,
  exportFinancialReportCsv,
  exportFinancialReportPdf,
  type CashCutExportData,
  type FinancialReportExportData,
} from "../services/financialReportExport";
import type { CashMovement, CashMovementType, CashShiftDefinition, CashShiftSettings, Payment, PaymentMethod } from "../types/cash.types";
import type { AccountReceivable } from "../types/accountsReceivable.types";

const createShiftId = () => `turno-${Date.now()}`;

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

const getPaymentOriginLabel = (origin: Payment["origen"]) => {
  if (origin === "cotizacion") return "Cotizacion";
  if (origin === "abono") return "Abono";
  return "Venta directa";
};

const buildPaymentDetailItems = (payment: Payment) => {
  const services = (payment.servicios ?? []).map((item) => ({
    id: item.servicioId ?? item.nombre,
    nombre: item.nombre || "Tratamiento",
    descripcion: "Tratamiento",
    cantidad: Number(item.cantidad) || 0,
    precioUnitario: Number(item.precioUnitario) || 0,
  }));
  const products = (payment.productos ?? []).map((item) => ({
    id: item.productoId,
    nombre: item.nombre || "Producto",
    descripcion: "Producto",
    cantidad: Number(item.cantidad) || 0,
    precioUnitario: Number(item.precioUnitario) || 0,
  }));
  const items = [...services, ...products].filter((item) => item.cantidad > 0);

  if (items.length > 0) return items;

  return [{
    id: payment.id,
    nombre: payment.concepto || "Pago registrado",
    descripcion: getPaymentOriginLabel(payment.origen),
    cantidad: 1,
    precioUnitario: Number(payment.totalVenta || payment.monto) || 0,
  }];
};

const getUserDisplayName = (name?: string, email?: string) => name || email || "Admin";

const cashConceptOrder = ["Ventas directas", "Tratamientos / cotizaciones", "Abonos", "Ajustes historicos", "Otros ingresos"];

const getIncomeConceptLabel = (
  movement: CashMovement,
  paymentById: Map<string, { origen?: string }>,
) => {
  if (movement.referenciaTipo === "manual") return "Ajustes historicos";
  if (movement.referenciaTipo === "cotizacion" || movement.referenciaTipo === "tratamiento") return "Tratamientos / cotizaciones";

  const paymentOrigin = movement.referenciaId ? paymentById.get(movement.referenciaId)?.origen : null;
  if (paymentOrigin === "cotizacion") return "Tratamientos / cotizaciones";
  if (paymentOrigin === "abono") return "Abonos";
  if (paymentOrigin === "venta_directa") return "Ventas directas";

  return movement.referenciaTipo === "pago" ? "Ventas directas" : "Otros ingresos";
};

const sortByCashConceptOrder = <T extends { concepto?: string; categoria?: string; total: number }>(rows: T[]) => {
  return [...rows].sort((a, b) => {
    const aLabel = a.concepto ?? a.categoria ?? "";
    const bLabel = b.concepto ?? b.categoria ?? "";
    const aIndex = cashConceptOrder.indexOf(aLabel);
    const bIndex = cashConceptOrder.indexOf(bLabel);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? cashConceptOrder.length : aIndex) - (bIndex === -1 ? cashConceptOrder.length : bIndex);
    }
    return b.total - a.total;
  });
};

const CajaPage: React.FC = () => {
  const {
    payments,
    paymentsLoading,
    cashClosures: rawCashClosures,
    cashClosuresLoading,
    paymentsUnavailable,
    cashSummaryUnavailable,
    cashMovements,
    cashMovementsLoading,
    cashShiftSettings,
    cashShiftSettingsLoading,
    openCashRegister,
    cancelPayment,
    closeCashRegister,
    autoCloseCashRegister,
    updateCashShiftSettings,
  } = useCashRegister();
  const cashClosures = useMemo(() => uniqueById(rawCashClosures), [rawCashClosures]);
  const { can } = useCan();
  const canManageCashSettings = can("settings.update");
  const canCancelSales = can("sales.cancel");
  const canCloseCash = can("sales.cashShift.close");
  const {
    movements: inventoryMovements,
    movementsLoading: inventoryMovementsLoading,
    movementsUnavailable: inventoryMovementsUnavailable,
  } = useInventory();

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "todos">("todos");
  const [paymentRange, setPaymentRange] = useState(() => ({ start: today(), end: today() }));
  const [paymentStatus, setPaymentStatus] = useState("todos");
  const [pendingSearch, setPendingSearch] = useState("");
  const [cutSearch, setCutSearch] = useState("");
  const [cutStatus, setCutStatus] = useState("todos");
  const [cashCutStartDate, setCashCutStartDate] = useState(() => startOfCurrentMonth());
  const [cashCutEndDate, setCashCutEndDate] = useState(() => today());
  const [currentSystemDate, setCurrentSystemDate] = useState(() => today());
  const dateFilter = currentSystemDate;
  const [reportStartDate, setReportStartDate] = useState(() => startOfCurrentMonth());
  const [reportEndDate, setReportEndDate] = useState(() => today());
  const [activeTab, setActiveTab] = useState("pagos");
  const [selectedClosureId, setSelectedClosureId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [paymentCancellationReason, setPaymentCancellationReason] = useState("");

  const [isOpeningCash, setIsOpeningCash] = useState(false);
  const [isClosingCash, setIsClosingCash] = useState(false);
  const [isAutoClosingCash, setIsAutoClosingCash] = useState(false);
  const [isCancellingPayment, setIsCancellingPayment] = useState(false);
  const [isSavingShiftSettings, setIsSavingShiftSettings] = useState(false);
  const [hasUnsavedShiftSettingsChanges, setHasUnsavedShiftSettingsChanges] = useState(false);
  const midnightAutoCloseAttemptRef = useRef<string | null>(null);

  const [isOpenCashDialogOpen, setIsOpenCashDialogOpen] = useState(false);
  const [isCashCutDetailOpen, setIsCashCutDetailOpen] = useState(false);
  const [isPaymentDetailOpen, setIsPaymentDetailOpen] = useState(false);
  const [isCancelPaymentConfirmOpen, setIsCancelPaymentConfirmOpen] = useState(false);
  const [isShiftSettingsConfirmOpen, setIsShiftSettingsConfirmOpen] = useState(false);

  const [cashCloseForm, setCashCloseForm] = useState({
    efectivoContado: "",
    observaciones: "",
  });

  const [openCashForm, setOpenCashForm] = useState({
    fondoInicial: "",
    turnoId: "",
    observaciones: "",
  });

  const [shiftSettingsForm, setShiftSettingsForm] = useState<CashShiftSettings>(cashShiftSettings);
  const [accountsReceivable, setAccountsReceivable] = useState<AccountReceivable[]>([]);
  const [accountsReceivableLoading, setAccountsReceivableLoading] = useState(true);
  const [accountsReceivableUnavailable, setAccountsReceivableUnavailable] = useState(false);

  useEffect(() => {
    if (hasUnsavedShiftSettingsChanges) return;
    setShiftSettingsForm(cashShiftSettings);
  }, [cashShiftSettings, hasUnsavedShiftSettingsChanges]);

  useEffect(() => {
    setAccountsReceivableLoading(true);
    return accountsReceivableService.listenAllAccounts((nextAccounts) => {
      setAccountsReceivable(nextAccounts);
      setAccountsReceivableLoading(false);
      setAccountsReceivableUnavailable(false);
    }, () => { setAccountsReceivable([]); setAccountsReceivableLoading(false); setAccountsReceivableUnavailable(true); });
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentSystemDate(today());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const filteredPayments = useMemo(() => {
    const term = normalizeCashSearch(search);

    return payments.filter((payment) => {
      const matchesText =
        !term ||
        normalizeCashSearch(payment.pacienteNombre).includes(term) ||
        normalizeCashSearch(payment.concepto).includes(term) ||
        payment.id.toLowerCase().includes(term);
      const matchesMethod = methodFilter === "todos" || payment.metodo === methodFilter;
      const matchesDate = isDateInRange(payment.fecha, paymentRange.start, paymentRange.end);

      return matchesText && matchesMethod && matchesDate && (paymentStatus === "todos" || payment.estado === paymentStatus);
    });
  }, [payments, search, methodFilter, paymentRange, paymentStatus]);

  const selectedPayment = useMemo(
    () => selectedPaymentId ? payments.find((payment) => payment.id === selectedPaymentId) ?? null : null,
    [payments, selectedPaymentId],
  );
  const selectedPaymentItems = useMemo(
    () => selectedPayment ? buildPaymentDetailItems(selectedPayment) : [],
    [selectedPayment],
  );
  const selectedPaymentSubtotal = useMemo(
    () => selectedPaymentItems.reduce((total, item) => total + item.cantidad * item.precioUnitario, 0),
    [selectedPaymentItems],
  );
  const selectedPaymentCashCutIsOpen = Boolean(
    selectedPayment?.corteId && cashClosures.find((closure) => closure.id === selectedPayment.corteId)?.estado === "abierto",
  );

  const pendingAccounts = useMemo(() => {
    const term = normalizeCashSearch(pendingSearch);
    return accountsReceivable
      .filter((account) => account.saldoPendiente > 0 && account.estado !== "cancelada")
      .filter((account) => {
        if (!term) return true;
        return normalizeCashSearch([
          account.pacienteNombre,
          account.concepto,
          account.estado,
          account.id,
        ].join(" ")).includes(term);
      });
  }, [accountsReceivable, pendingSearch]);

  const totalPendingBalance = useMemo(
    () => pendingAccounts.reduce((total, account) => total + account.saldoPendiente, 0),
    [pendingAccounts],
  );

  const openCashClosure = useMemo(
    () => cashClosures.find((closure) => closure.estado === "abierto"),
    [cashClosures],
  );

  useEffect(() => {
    if (!openCashClosure || !canCloseCash || !cashShiftSettings.permitirCierreAutomatico || cashShiftSettingsLoading) return;
    if (openCashClosure.fecha >= currentSystemDate) return;
    if (midnightAutoCloseAttemptRef.current === openCashClosure.id) return;

    midnightAutoCloseAttemptRef.current = openCashClosure.id;
    autoCloseCashRegister(`Cierre automatico por cambio de dia. La caja del ${openCashClosure.fecha} no se cerro antes de medianoche.`)
      .then(() => {
        toast.success(`Caja del ${formatDate(openCashClosure.fecha)} cerrada automaticamente por medianoche`);
      })
      .catch((error: any) => {
        midnightAutoCloseAttemptRef.current = null;
        toast.error(error.message || "No se pudo cerrar automaticamente la caja vencida");
      });
  }, [autoCloseCashRegister, canCloseCash, cashShiftSettings.permitirCierreAutomatico, cashShiftSettingsLoading, currentSystemDate, openCashClosure]);

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
  const isSelectedDateToday = dateFilter === currentSystemDate;
  const canOpenSelectedDate = !cashClosuresLoading && !cashSummaryUnavailable && !cashShiftSettingsLoading && can("sales.cashShift.open") && isSelectedDateToday && !openCashClosure && (cashShiftSettings.permitirMultiplesCortesPorDia || !hasAnyClosureForDate);
  const openCashButtonLabel = openCashClosure ? "Caja abierta" : "Abrir caja";
  const activeConfiguredShifts = useMemo(
    () => cashShiftSettings.turnos.filter((shift) => shift.activo),
    [cashShiftSettings.turnos],
  );
  const selectedOpeningShift = activeConfiguredShifts.find((shift) => shift.id === openCashForm.turnoId) ?? null;

  const selectedClosureForDetail = useMemo(
    () => cashClosures.find(closure => closure.id === selectedClosureId) ?? null,
    [cashClosures, selectedClosureId],
  );
  const selectedClosureMovements = useMemo(
    () => selectedClosureForDetail ? cashMovements.filter(movement => movement.corteId === selectedClosureForDetail.id) : [],
    [cashMovements, selectedClosureForDetail],
  );

  const normalizedCashCutStartDate = cashCutStartDate;
  const normalizedCashCutEndDate = cashCutEndDate;
  const cashCutClosuresInRange = useMemo(
    () => cashClosures.filter((closure) => {
      const folio = `CC-${String(cashClosures.length - cashClosures.findIndex(item => item.id === closure.id)).padStart(4, "0")}`;
      return isDateInRange(closure.fecha, normalizedCashCutStartDate, normalizedCashCutEndDate)
        && (cutStatus === "todos" || closure.estado === cutStatus)
        && normalizeCashSearch([folio, closure.id, closure.turnoNombre, closure.responsableNombre, closure.usuarioAperturaNombre, closure.usuarioAperturaEmail, closure.observaciones].join(" ")).includes(normalizeCashSearch(cutSearch));
    }),
    [cashClosures, normalizedCashCutEndDate, normalizedCashCutStartDate, cutSearch, cutStatus],
  );
  const selectedCashCutClosure = useMemo(
    () => selectedClosureId
      ? cashClosures.find((closure) => closure.id === selectedClosureId) ?? null
      : null,
    [cashClosures, selectedClosureId],
  );
  const selectedCashCutMovements = useMemo(() => {
    if (!selectedCashCutClosure) return [];
    return cashMovements.filter((movement) => movement.corteId === selectedCashCutClosure.id);
  }, [cashMovements, selectedCashCutClosure]);
  const selectedCashCutSummary = useMemo(
    () => selectedCashCutClosure ? buildClosureSummary(selectedCashCutClosure, selectedCashCutMovements) : buildCashSummary([]),
    [selectedCashCutClosure, selectedCashCutMovements],
  );

  const displayedCashMovements = useMemo(() => {
    return selectedClosureMovements;
  }, [selectedClosureMovements]);

  const activeDisplayedCashMovements = useMemo(
    () => displayedCashMovements.filter((movement) => movement.estado === "activo"),
    [displayedCashMovements],
  );

  const openCashSummary = useMemo(() => buildCashSummary(openCashMovements), [openCashMovements]);
  const cashSummary = useMemo(() => selectedClosureForDetail ? buildClosureSummary(selectedClosureForDetail, displayedCashMovements) : buildCashSummary(displayedCashMovements), [selectedClosureForDetail, displayedCashMovements]);
  const dailyCashSummary = useMemo(() => buildCashSummary(selectedDateCashMovements), [selectedDateCashMovements]);
  const paymentById = useMemo(
    () => new Map(payments.map((payment) => [payment.id, payment])),
    [payments],
  );
  const cutIncomeByConcept = useMemo(() => {
    const conceptMap = new Map<string, { concepto: string; movimientos: number; total: number }>();

    activeDisplayedCashMovements
      .filter((movement) => movement.tipo === "ingreso" && !isOpeningCashMovement(movement))
      .forEach((movement) => {
        const concept = getIncomeConceptLabel(movement, paymentById);
        const current = conceptMap.get(concept) ?? { concepto: concept, movimientos: 0, total: 0 };
        current.movimientos += 1;
        current.total += Number(movement.monto) || 0;
        conceptMap.set(concept, current);
      });

    return sortByCashConceptOrder(Array.from(conceptMap.values()));
  }, [activeDisplayedCashMovements, paymentById]);
  const cutExpensesByCategory = useMemo(() => {
    const categoryMap = new Map<string, { categoria: string; movimientos: number; total: number }>();

    activeDisplayedCashMovements
      .filter((movement) => movement.tipo === "egreso")
      .forEach((movement) => {
        const category = getExpenseCategoryLabel(movement.categoriaGasto);
        const current = categoryMap.get(category) ?? { categoria: category, movimientos: 0, total: 0 };
        current.movimientos += 1;
        current.total += Number(movement.monto) || 0;
        categoryMap.set(category, current);
      });

    return Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);
  }, [activeDisplayedCashMovements]);
  const cashSummaryForClosing = openCashSummary;
  const reportLoading = cashMovementsLoading || inventoryMovementsLoading || paymentsLoading;
  const reportUnavailable = cashSummaryUnavailable || paymentsUnavailable || inventoryMovementsUnavailable;
  const normalizedReportStartDate = reportStartDate;
  const normalizedReportEndDate = reportEndDate;
  const previousReportRange = useMemo(
    () => getPreviousRange(normalizedReportStartDate, normalizedReportEndDate),
    [normalizedReportEndDate, normalizedReportStartDate],
  );
  const financialReport = useMemo(
    () => buildFinancialReportSnapshot(cashMovements, inventoryMovements, normalizedReportStartDate, normalizedReportEndDate, payments),
    [payments, cashMovements, inventoryMovements, normalizedReportEndDate, normalizedReportStartDate],
  );
  const previousFinancialReport = useMemo(
    () => buildFinancialReportSnapshot(cashMovements, inventoryMovements, previousReportRange.start, previousReportRange.end, payments),
    [payments, cashMovements, inventoryMovements, previousReportRange.end, previousReportRange.start],
  );
  const financialReportExportData = useMemo<FinancialReportExportData>(() => ({
    fechaInicio: normalizedReportStartDate,
    fechaFin: normalizedReportEndDate,
    ingresos: financialReport.ingresos,
    gastosOperativos: financialReport.gastosOperativos,
    costoMercaderia: financialReport.costoMercaderia,
    utilidadBruta: financialReport.utilidadBruta,
    utilidadNeta: financialReport.utilidadNeta,
    margenNeto: financialReport.margenNeto,
    ingresosPeriodoAnterior: previousFinancialReport.ingresos,
    utilidadPeriodoAnterior: previousFinancialReport.utilidadNeta,
    variacionIngresos: calculateVariation(financialReport.ingresos, previousFinancialReport.ingresos),
    variacionUtilidad: calculateVariation(financialReport.utilidadNeta, previousFinancialReport.utilidadNeta),
    gastosPorCategoria: financialReport.gastosPorCategoria,
    ventasPorProducto: financialReport.ventasPorProducto,
    movimientos: financialReport.periodCashMovements.map((movement) => ({
      fecha: movement.fecha,
      tipo: isOpeningCashMovement(movement) ? "apertura" : movement.tipo,
      concepto: movement.concepto,
      metodo: paymentMethodLabel[movement.metodo],
      categoria: movement.tipo === "egreso" ? getExpenseCategoryLabel(movement.categoriaGasto) : "-",
      monto: movement.tipo === "egreso" ? -Math.abs(Number(movement.monto) || 0) : Number(movement.monto) || 0,
      usuario: getUserDisplayName(movement.usuarioNombre, movement.usuarioEmail),
    })),
  }), [
    financialReport.costoMercaderia,
    financialReport.gastosOperativos,
    financialReport.gastosPorCategoria,
    financialReport.ingresos,
    financialReport.margenNeto,
    financialReport.periodCashMovements,
    financialReport.utilidadBruta,
    financialReport.utilidadNeta,
    financialReport.ventasPorProducto,
    normalizedReportEndDate,
    normalizedReportStartDate,
    previousFinancialReport.ingresos,
    previousFinancialReport.utilidadNeta,
  ]);
  const paymentsPagination = usePagination(filteredPayments, {
    initialPageSize: 10, resetKeys: [search, methodFilter, paymentRange.start, paymentRange.end, paymentStatus],
  });
  const pendingAccountsPagination = usePagination(pendingAccounts, {
    initialPageSize: 10, resetKeys: [pendingSearch],
  });
  const cutsPagination = usePagination(cashCutClosuresInRange, { initialPageSize: 10, resetKeys: [cashCutStartDate, cashCutEndDate, cutSearch, cutStatus] });
  const cutDetailsPagination = usePagination(selectedCashCutMovements, { initialPageSize: 10, resetKeys: [selectedClosureId, isCashCutDetailOpen] });
  const paymentDetailsPagination = usePagination(selectedPaymentItems, { initialPageSize: 10, resetKeys: [selectedPaymentId, isPaymentDetailOpen] });
  const expensesPagination = usePagination(financialReport.gastosPorCategoria, { initialPageSize: 10, resetKeys: [reportStartDate, reportEndDate] });
  const reportProductSalesPagination = usePagination(financialReport.ventasPorProducto, {
    initialPageSize: 10, resetKeys: [normalizedReportStartDate, normalizedReportEndDate],
  });
  const reportCashMovementsPagination = usePagination(financialReport.periodCashMovements, {
    initialPageSize: 10, resetKeys: [normalizedReportStartDate, normalizedReportEndDate],
  });

  const cashStatus = useMemo(() => {
    if (cashSummaryUnavailable || cashClosuresLoading) return {
      label: cashSummaryUnavailable ? "NO DISPONIBLE" : "CARGANDO",
      title: cashSummaryUnavailable ? "Estado de caja no disponible" : "Consultando caja",
      description: cashSummaryUnavailable ? "No se pudieron cargar los datos de caja. Recarga la página." : "Espera a que termine la consulta.",
      nextAction: cashSummaryUnavailable ? "Recarga la página." : "Espera la consulta.",
      Icon: AlertTriangle, cardClass: "border-border bg-card text-card-foreground", iconClass: "bg-muted text-muted-foreground", badgeClass: "bg-muted text-muted-foreground",
    };
    if (hasOpenCashForSelectedDate) {
      return {
        label: "ABIERTA",
        title: "Caja abierta",
        description: `El corte del ${formatDate(dateFilter)} esta activo y listo para recibir cobros.`,
        nextAction: "Al final del dia cierra manual o automatico.",
        Icon: Unlock,
        cardClass: "border-emerald-500/40 bg-card text-card-foreground",
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
        cardClass: "border-amber-500/50 bg-card text-card-foreground",
        iconClass: "bg-amber-500 text-white",
        badgeClass: "bg-amber-500 text-white hover:bg-amber-500",
      };
    }

    if (lastClosureForDate) {
      return {
        label: "CERRADA",
        title: "Caja cerrada",
        description: `Hay ${closedClosuresForDate.length} corte${closedClosuresForDate.length === 1 ? "" : "s"} cerrado${closedClosuresForDate.length === 1 ? "" : "s"} para el ${formatDate(dateFilter)}.`,
        nextAction: canOpenSelectedDate ? "Puedes abrir caja nuevamente para este dia." : "Consulta el resumen o selecciona el dia actual.",
        Icon: Lock,
        cardClass: "border-border bg-card text-card-foreground",
        iconClass: "bg-slate-700 text-white",
        badgeClass: "bg-slate-700 text-white hover:bg-slate-700",
      };
    }

    return {
      label: "SIN ABRIR",
      title: "Caja sin abrir",
      description: `Todavia no hay corte para el ${formatDate(dateFilter)}.`,
      nextAction: isSelectedDateToday ? "Abre caja para empezar a cobrar." : "Solo se puede abrir caja en el dia actual.",
      Icon: Power,
      cardClass: "border-destructive/40 bg-card text-card-foreground",
      iconClass: "bg-red-600 text-white",
      badgeClass: "bg-red-600 text-white hover:bg-red-600",
    };
  }, [cashSummaryUnavailable, cashClosuresLoading, canOpenSelectedDate, closedClosuresForDate.length, dateFilter, hasOpenCashForAnotherDate, hasOpenCashForSelectedDate, isSelectedDateToday, lastClosureForDate, openCashClosure]);

  const CashStatusIcon = cashStatus.Icon;
  const selectedClosureLabel = selectedClosureForDetail
    ? `CC-${String(cashClosures.length - cashClosures.findIndex(c => c.id === selectedClosureForDetail.id)).padStart(4, "0")}`
    : "Sin corte seleccionado";
  const cashCutExportData = useMemo<CashCutExportData>(() => ({
    titulo: selectedClosureLabel,
    fecha: selectedClosureForDetail?.fecha ?? dateFilter,
    estado: selectedClosureForDetail?.estado ?? "sin corte",
    abiertoPor: selectedClosureForDetail
      ? getUserDisplayName(selectedClosureForDetail.usuarioAperturaNombre ?? selectedClosureForDetail.responsableNombre, selectedClosureForDetail.usuarioAperturaEmail ?? selectedClosureForDetail.responsableEmail)
      : "-",
    cerradoPor: selectedClosureForDetail?.estado === "cerrado"
      ? getUserDisplayName(selectedClosureForDetail.usuarioCierreNombre, selectedClosureForDetail.usuarioCierreEmail)
      : "Pendiente",
    fondoInicial: cashSummary.fondoInicial,
    totalIngresos: cashSummary.totalIngresos,
    totalEgresos: cashSummary.totalEgresos,
    balanceNeto: cashSummary.balanceNeto,
    efectivoEsperado: cashSummary.efectivoFinal,
    efectivoContado: selectedClosureForDetail?.estado === "cerrado" ? selectedClosureForDetail.efectivoContado : null,
    diferenciaEfectivo: selectedClosureForDetail?.estado === "cerrado" ? selectedClosureForDetail.diferenciaEfectivo : null,
    desgloseMetodos: cashSummary.desgloseMetodos.map((method) => ({
      metodo: paymentMethodLabel[method.metodo],
      ingresos: method.ingresos,
      egresos: method.egresos,
      neto: method.neto,
    })),
    ingresosPorConcepto: cutIncomeByConcept,
    gastosPorCategoria: cutExpensesByCategory,
    movimientos: activeDisplayedCashMovements.map((movement) => ({
      fecha: movement.fecha,
      tipo: isOpeningCashMovement(movement) ? "apertura" : movement.tipo,
      concepto: movement.concepto,
      metodo: paymentMethodLabel[movement.metodo],
      categoria: movement.tipo === "egreso" ? getExpenseCategoryLabel(movement.categoriaGasto) : "-",
      monto: movement.tipo === "egreso" ? -Math.abs(Number(movement.monto) || 0) : Number(movement.monto) || 0,
      usuario: getUserDisplayName(movement.usuarioNombre, movement.usuarioEmail),
    })),
  }), [activeDisplayedCashMovements, cashSummary, cutExpensesByCategory, cutIncomeByConcept, dateFilter, selectedClosureForDetail, selectedClosureLabel]);

  const updateShiftSettingsForm = (updates: Partial<CashShiftSettings>) => {
    setHasUnsavedShiftSettingsChanges(true);
    setShiftSettingsForm((current) => ({ ...current, ...updates }));
  };

  const updateShiftRow = (shiftId: string, updates: Partial<CashShiftDefinition>) => {
    setHasUnsavedShiftSettingsChanges(true);
    setShiftSettingsForm((current) => ({
      ...current,
      turnos: current.turnos.map((shift) => (
        shift.id === shiftId ? { ...shift, ...updates } : shift
      )),
    }));
  };

  const addShiftRow = () => {
    setHasUnsavedShiftSettingsChanges(true);
    setShiftSettingsForm((current) => ({
      ...current,
      turnos: [
        ...current.turnos,
        {
          id: createShiftId(),
          nombre: `Turno ${current.turnos.length + 1}`,
          horaInicio: "08:00",
          horaFin: "14:00",
          activo: true,
        },
      ],
    }));
  };

  const restoreDefaultSouthMexicoShifts = () => {
    setHasUnsavedShiftSettingsChanges(true);
    setShiftSettingsForm((current) => ({
      ...current,
      modo: "programado",
      turnos: defaultCashShiftSettings.turnos,
    }));
  };

  const removeShiftRow = (shiftId: string) => {
    setHasUnsavedShiftSettingsChanges(true);
    setShiftSettingsForm((current) => ({
      ...current,
      turnos: current.turnos.filter((shift) => shift.id !== shiftId),
    }));
  };

  const handleRequestSaveShiftSettings = () => {
    if (!hasUnsavedShiftSettingsChanges) return;
    setIsShiftSettingsConfirmOpen(true);
  };

  const handleConfirmSaveShiftSettings = async () => {
    if (shiftSettingsForm.modo === "programado" && shiftSettingsForm.turnos.filter((shift) => shift.activo).length === 0) {
      toast.error("Agrega al menos un turno activo para el modo programado");
      return;
    }

    setIsSavingShiftSettings(true);
    try {
      const nextSettings = {
        ...shiftSettingsForm,
        fondoInicialSugerido: Number(shiftSettingsForm.fondoInicialSugerido) || 0,
        toleranciaDiferencia: Number(shiftSettingsForm.toleranciaDiferencia) || 0,
      };

      await updateCashShiftSettings(nextSettings);
      setShiftSettingsForm(nextSettings);
      setHasUnsavedShiftSettingsChanges(false);
      setIsShiftSettingsConfirmOpen(false);
    } catch (error: any) {
      const isPermissionError =
        error?.code === "permission-denied" ||
        String(error?.message ?? "").toLowerCase().includes("permission");

      toast.error(
        isPermissionError
          ? "No tienes permiso para modificar la configuracion de turnos. Solicita acceso de administrador o el permiso settings.update."
          : error.message || "No se pudo guardar la configuracion de turnos",
      );
    } finally {
      setIsSavingShiftSettings(false);
    }
  };

  const handleRequestCancelSelectedPayment = () => {
    if (!selectedPayment) return;
    if (!canCancelSales) {
      toast.error("No tienes permiso para cancelar ventas.");
      return;
    }
    if (selectedPayment.estado !== "activo") {
      toast.error("Este pago ya no esta activo.");
      return;
    }
    if (!selectedPaymentCashCutIsOpen) {
      toast.error("No se puede cancelar un pago de un corte cerrado.");
      return;
    }

    setIsCancelPaymentConfirmOpen(true);
  };

  const handleCancelSelectedPayment = async () => {
    if (!selectedPayment) return;

    setIsCancellingPayment(true);
    try {
      const reason = paymentCancellationReason.trim() || "Sin motivo especificado";
      await cancelPayment({ id: selectedPayment.id, motivo: reason });
      setIsCancelPaymentConfirmOpen(false);
      setIsPaymentDetailOpen(false);
      setSelectedPaymentId(null);
      setPaymentCancellationReason("");
    } catch (error: any) {
      toast.error(error.message || "No se pudo cancelar el pago");
    } finally {
      setIsCancellingPayment(false);
    }
  };

  const handleDownloadSelectedPaymentTicket = () => {
    if (!selectedPayment) return;

    const ticketLines = [
      "ClauDent",
      "Ticket de venta",
      `Folio: V-${selectedPayment.id.slice(0, 6).toUpperCase()}`,
      `Fecha: ${formatDate(selectedPayment.fecha)}`,
      `Cliente: ${selectedPayment.pacienteNombre || "Publico general"}`,
      `Metodo: ${paymentMethodLabel[selectedPayment.metodo]}`,
      `Estado: ${selectedPayment.estado === "activo" ? "Exitosa" : "Cancelada"}`,
      "",
      "Conceptos:",
      ...selectedPaymentItems.map((item) =>
        `${item.cantidad} x ${item.nombre} @ ${formatCurrency(item.precioUnitario)} = ${formatCurrency(item.cantidad * item.precioUnitario)}`,
      ),
      "",
      `Subtotal: ${formatCurrency(selectedPaymentSubtotal)}`,
      selectedPayment.descuento
        ? `Descuento${selectedPayment.descuentoPorcentaje === undefined ? "" : ` (${selectedPayment.descuentoPorcentaje}%)`}: -${formatCurrency(selectedPayment.descuento)}`
        : "",
      `Total pagado: ${formatCurrency(selectedPayment.monto)}`,
      selectedPayment.saldoPendiente ? `Saldo pendiente: ${formatCurrency(selectedPayment.saldoPendiente)}` : "",
      selectedPayment.notas ? `Observaciones: ${selectedPayment.notas}` : "",
    ].filter(Boolean);

    const blob = new Blob([ticketLines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ticket-${selectedPayment.id.slice(0, 6).toUpperCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenCashRegister = async (event: React.FormEvent) => {
    event.preventDefault();

    if (openCashClosure) {
      toast.error(`Ya hay una caja abierta del ${openCashClosure.fecha}. Cierrala antes de abrir otra.`);
      return;
    }

    if (!canOpenSelectedDate) {
      toast.error(isSelectedDateToday
        ? "Ya existe un corte para esta fecha. Cambia la configuracion si necesitas multiples cortes por dia."
        : "Solo puedes abrir caja para el dia actual.");
      return;
    }

    if (cashShiftSettings.fondoInicialRequerido && !openCashForm.fondoInicial) {
      toast.error("El fondo inicial es obligatorio por configuracion");
      return;
    }

    if (cashShiftSettings.modo === "programado" && !selectedOpeningShift) {
      toast.error("Selecciona un turno para abrir caja");
      return;
    }

    if (!Number.isFinite(Number(openCashForm.fondoInicial)) || Number(openCashForm.fondoInicial) < 0) { toast.error("Escribe un fondo inicial válido, mayor o igual a cero."); return; }
    setIsOpeningCash(true);
    try {
      await openCashRegister({
        fecha: dateFilter || today(),
        fondoInicial: Number(openCashForm.fondoInicial) || 0,
        turnoId: selectedOpeningShift?.id ?? null,
        turnoNombre: selectedOpeningShift?.nombre ?? "",
        horaInicioProgramada: selectedOpeningShift?.horaInicio ?? "",
        horaFinProgramada: selectedOpeningShift?.horaFin ?? "",
        observaciones: openCashForm.observaciones,
      });
      setOpenCashForm({ fondoInicial: "", turnoId: "", observaciones: "" });
      setIsOpenCashDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "No se pudo abrir la caja");
    } finally {
      setIsOpeningCash(false);
    }
  };

  const handleCloseCashRegister = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!openCashClosure) {
      toast.error("No hay una caja abierta para cerrar");
      return;
    }

    if (!canCloseCash) { toast.error("No tienes permiso para cerrar caja."); return; }
    if (!cashCloseForm.efectivoContado || !Number.isFinite(Number(cashCloseForm.efectivoContado)) || Number(cashCloseForm.efectivoContado) < 0) {
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

    if (!canCloseCash) { toast.error("No tienes permiso para cerrar caja."); return; }
    if (!cashShiftSettings.permitirCierreAutomatico) {
      toast.error("El cierre automatico esta desactivado por configuracion");
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

  const handleExportFinancialReportPdf = () => {
    exportFinancialReportPdf(financialReportExportData);
    toast.success("Reporte PDF generado");
  };

  const handleExportFinancialReportCsv = () => {
    exportFinancialReportCsv(financialReportExportData);
    toast.success("Reporte CSV generado");
  };

  const handleExportCashCutPdf = () => {
    exportCashCutPdf(cashCutExportData);
    toast.success("Corte PDF generado");
  };

  const handleExportCashCutCsv = () => {
    exportCashCutCsv(cashCutExportData);
    toast.success("Corte CSV generado");
  };

  return (
    <div className="min-w-0 space-y-6 [&_[role=tabpanel]]:min-w-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Caja</h1>
            <SectionHelp title="Acerca de Caja">
              <p>
                Consulta los cobros reales, abonos y movimientos que afectan el efectivo del consultorio.
              </p>
              <p>
                Desde aquí puedes abrir y cerrar cortes, revisar el efectivo esperado y consultar reportes del periodo seleccionado.
              </p>
              <p>
                El flujo está separado de Ventas: Caja solo audita el dinero real de cobros, abonos, anulaciones, aperturas y cierres.
              </p>
            </SectionHelp>
            <Badge className={cashStatus.badgeClass}>{cashStatus.label}</Badge>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              if (canOpenSelectedDate) {
                setIsOpenCashDialogOpen(true);
                return;
              }
              if (openCashClosure) {

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
        </div>
      </div>

      <p className="text-sm text-muted-foreground">Resumen de hoy: {formatDate(currentSystemDate)}. Las búsquedas de cada pestaña se aplican solo a su listado.</p>
      {cashSummaryUnavailable && <p role="alert" className="text-sm text-destructive">No se pudieron cargar los datos de caja. Los importes no están disponibles; recarga la página.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos de hoy</CardTitle>
            <CircleDollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cashSummaryUnavailable ? "No disponible" : cashMovementsLoading ? "Cargando…" : formatCurrency(dailyCashSummary.totalIngresos)}</div>
            <p className="text-xs text-muted-foreground">Cobros activos; no incluye fondos de apertura</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Efectivo esperado</CardTitle>
            <Banknote className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cashSummaryUnavailable ? "No disponible" : cashMovementsLoading ? "Cargando…" : formatCurrency(openCashSummary.efectivoFinal)}</div>
            <p className="text-xs text-muted-foreground">Fondo + ingresos − egresos en efectivo del corte abierto</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Egresos de hoy</CardTitle>
            <CreditCard className="h-5 w-5 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cashSummaryUnavailable ? "No disponible" : cashMovementsLoading ? "Cargando…" : formatCurrency(dailyCashSummary.totalEgresos)}</div>
            <p className="text-xs text-muted-foreground">Egresos activos de hoy; excluye cancelados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cortes del dia</CardTitle>
            <ReceiptText className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cashSummaryUnavailable ? "No disponible" : cashClosuresLoading ? "Cargando…" : closuresForDate.length}</div>
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
                  <p className="text-xs uppercase text-muted-foreground">Fecha de operación</p>
                  <p className="font-medium">{formatDate(dateFilter)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Caja abierta</p>
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

                  setSelectedClosureId(openCashClosure.id);
                  setActiveTab("corte");
                }}
              >
                Ver arqueo
              </Button>
            )}
            {openCashClosure && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleAutoCloseCashRegister}
                disabled={!canCloseCash || cashMovementsLoading || cashSummaryUnavailable || isAutoClosingCash || isClosingCash || !cashShiftSettings.permitirCierreAutomatico}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {isAutoClosingCash ? "Cerrando..." : "Cerrar automatico"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
          <TabsTrigger value="corte">Corte</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
          {canManageCashSettings && <TabsTrigger value="configuracion">Configuracion</TabsTrigger>}
        </TabsList>

        <TabsContent value="pagos" className="space-y-4">
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between">
                  <div>
                    <CardTitle>Pagos reales</CardTitle>
                    <CardDescription>
                      Busca cobros por fecha, paciente, concepto, folio, método y estado. Esta búsqueda no modifica el resumen de hoy.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
                      <SelectTrigger className="sm:w-44" aria-label="Método de pago">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los métodos</SelectItem>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger className="sm:w-44" aria-label="Estado del pago"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="todos">Todos los estados</SelectItem><SelectItem value="activo">Exitosos</SelectItem><SelectItem value="cancelado">Cancelados</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <CashDateRangeFilter value={paymentRange} onApply={setPaymentRange} />
                <p className="text-sm text-muted-foreground">{filteredPayments.length} pagos · Cobros activos del filtro: {paymentsUnavailable ? "No disponible" : paymentsLoading ? "Cargando…" : formatCurrency(filteredPayments.filter(p => p.estado === "activo").reduce((sum, p) => sum + p.monto, 0))}</p>
                {(search || methodFilter !== "todos" || paymentStatus !== "todos") && <div className="flex flex-wrap items-center gap-2 text-sm"><span>Filtros: {search ? `“${search}” · ` : ""}{methodFilter === "todos" ? "Todos los métodos" : paymentMethodLabel[methodFilter]} · {paymentStatus === "todos" ? "Todos los estados" : paymentStatus === "activo" ? "Exitosos" : "Cancelados"}</span><Button variant="ghost" size="sm" onClick={() => { setSearch(""); setMethodFilter("todos"); setPaymentStatus("todos"); }}>Limpiar búsqueda</Button></div>}
                {paymentsUnavailable && <p role="alert" className="text-destructive">No se pudieron cargar los pagos. Recarga la página.</p>}
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Folio</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Metodo</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsUnavailable ? (<TableRow><TableCell colSpan={9} className="py-10 text-center text-destructive">Pagos no disponibles.</TableCell></TableRow>) : paymentsLoading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                            Cargando pagos...
                          </TableCell>
                        </TableRow>
                      ) : filteredPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                            No hay pagos registrados para este filtro.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paymentsPagination.paginatedItems.map((payment) => {
                          const Icon = paymentMethodIcon[payment.metodo];

                          return (
                            <TableRow key={payment.id}>
                              <TableCell className="font-mono text-xs">#{payment.id.slice(0, 6)}</TableCell>
                              <TableCell className="font-medium">{payment.pacienteNombre}</TableCell>
                              <TableCell>{payment.concepto}</TableCell>
                              <TableCell>{formatDate(payment.fecha)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="gap-1">
                                  <Icon className="h-3.5 w-3.5" />
                                  {paymentMethodLabel[payment.metodo]}
                                </Badge>
                              </TableCell>
                              <TableCell>{getPaymentOriginLabel(payment.origen)}</TableCell>
                              <TableCell>
                                <Badge variant={payment.estado === "activo" ? "default" : "secondary"}>
                                  {payment.estado === "activo" ? "Exitosa" : "Cancelada"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(payment.monto)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedPaymentId(payment.id);
                                    setPaymentCancellationReason("");
                                    setIsPaymentDetailOpen(true);
                                  }}
                                  aria-label="Ver detalle de venta"
                                >
                                  <Eye className="h-4 w-4 text-primary" />
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
              {!paymentsLoading && filteredPayments.length > 0 && (
                <DataPagination
                  itemLabel="pagos"
                  page={paymentsPagination.page}
                  pageSize={paymentsPagination.pageSize}
                  totalItems={paymentsPagination.totalItems}
                  startIndex={paymentsPagination.startIndex}
                  endIndex={paymentsPagination.endIndex}
                  canPreviousPage={paymentsPagination.canPreviousPage}
                  canNextPage={paymentsPagination.canNextPage}
                  onPageSizeChange={paymentsPagination.setPageSize}
                  onPreviousPage={paymentsPagination.previousPage}
                  onNextPage={paymentsPagination.nextPage}
                />
              )}
            </Card>

            <Card className="border-sky-200 bg-sky-50">
              <CardContent className="p-4 text-sm text-sky-900">
                Los cobros nuevos se registran desde Ventas. Los abonos a saldos se registran en Pagos del expediente del paciente.
                Esta vista solo audita pagos ya registrados para el corte de caja.
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pendientes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between">
                <div>
                  <CardTitle>Cuentas pendientes</CardTitle>
                  <CardDescription>
                    Saldos vivos por paciente. Cada abono aparece en pagos y en el corte de caja del dia en que se registro.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Badge variant={totalPendingBalance > 0 ? "secondary" : "outline"} className="w-fit">
                    Saldo del listado: {accountsReceivableUnavailable ? "No disponible" : accountsReceivableLoading ? "Cargando…" : formatCurrency(totalPendingBalance)}
                  </Badge>
                  <div className="relative sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={pendingSearch}
                      onChange={(event) => setPendingSearch(event.target.value)}
                      placeholder="Buscar pendiente..."
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Saldos pendientes de todas las fechas. {pendingSearch && `Búsqueda aplicada: “${pendingSearch}”.`}</p>
              {pendingSearch && <Button variant="ghost" className="w-fit" size="sm" onClick={() => setPendingSearch("")}>Limpiar búsqueda</Button>}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Creacion</TableHead>
                      <TableHead>Ultimo abono</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Abonado</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountsReceivableUnavailable ? (<TableRow><TableCell colSpan={7} className="py-10 text-center text-destructive">No se pudieron cargar las cuentas pendientes. Recarga la página.</TableCell></TableRow>) : accountsReceivableLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          Cargando pendientes...
                        </TableCell>
                      </TableRow>
                    ) : pendingAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          No hay cuentas pendientes para este filtro.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingAccountsPagination.paginatedItems.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium">{account.pacienteNombre}</TableCell>
                          <TableCell>{account.concepto}</TableCell>
                          <TableCell>{formatDate(account.fechaCreacion)}</TableCell>
                          <TableCell>{account.fechaUltimoAbono ? formatDate(account.fechaUltimoAbono) : "Sin abonos"}</TableCell>
                          <TableCell>
                            <Badge variant={account.estado === "vencida" ? "destructive" : "secondary"}>
                              {account.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(account.totalAbonado)}</TableCell>
                          <TableCell className="text-right font-semibold text-amber-700">
                            {formatCurrency(account.saldoPendiente)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            {!accountsReceivableLoading && pendingAccounts.length > 0 && (
              <DataPagination
                itemLabel="pendientes"
                page={pendingAccountsPagination.page}
                pageSize={pendingAccountsPagination.pageSize}
                totalItems={pendingAccountsPagination.totalItems}
                startIndex={pendingAccountsPagination.startIndex}
                endIndex={pendingAccountsPagination.endIndex}
                canPreviousPage={pendingAccountsPagination.canPreviousPage}
                canNextPage={pendingAccountsPagination.canNextPage}
                onPageSizeChange={pendingAccountsPagination.setPageSize}
                onPreviousPage={pendingAccountsPagination.previousPage}
                onNextPage={pendingAccountsPagination.nextPage}
              />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="corte" className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5 text-primary" />
                    Corte de caja
                  </CardTitle>
                  <CardDescription>
                    Busca cortes por día o por rango de fechas. Selecciona un corte para consultar o descargar su detalle.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canOpenSelectedDate && (
                    <Button type="button" onClick={() => setIsOpenCashDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nuevo
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (selectedCashCutClosure) {
                        setIsCashCutDetailOpen(true);
                      }
                    }}
                    disabled={!selectedCashCutClosure}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Ver detalle
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExportCashCutCsv}
                    disabled={!selectedCashCutClosure || cashMovementsLoading || cashSummaryUnavailable}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExportCashCutPdf}
                    disabled={!selectedCashCutClosure || cashMovementsLoading || cashSummaryUnavailable}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CashDateRangeFilter value={{ start: cashCutStartDate, end: cashCutEndDate }} onApply={range => { setCashCutStartDate(range.start); setCashCutEndDate(range.end); setSelectedClosureId(null); }} />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Input className="sm:max-w-sm" aria-label="Buscar corte" placeholder="Folio, responsable, turno u observación..." value={cutSearch} onChange={event => { setCutSearch(event.target.value); setSelectedClosureId(null); }} />
                <Select value={cutStatus} onValueChange={value => { setCutStatus(value); setSelectedClosureId(null); }}>
                  <SelectTrigger className="sm:w-48" aria-label="Estado del corte"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="todos">Todos los estados</SelectItem><SelectItem value="abierto">Abiertos</SelectItem><SelectItem value="cerrado">Cerrados</SelectItem></SelectContent>
                </Select>
                {(cutSearch || cutStatus !== "todos") && <Button variant="ghost" onClick={() => { setCutSearch(""); setCutStatus("todos"); setSelectedClosureId(null); }}>Limpiar búsqueda</Button>}
              </div>
              <p className="text-sm text-muted-foreground">{cashCutClosuresInRange.length} cortes encontrados{cutSearch ? ` · “${cutSearch}”` : ""} · {cutStatus === "todos" ? "Todos los estados" : cutStatus === "abierto" ? "Abiertos" : "Cerrados"}. Se busca por el día de apertura; cada corte aparece una vez.</p>
              {selectedCashCutClosure && <p className="text-sm font-medium">Corte seleccionado: {formatDate(selectedCashCutClosure.fecha)} · {selectedCashCutClosure.turnoNombre || selectedCashCutClosure.id}. El detalle y las descargas corresponden a este corte.</p>}
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Folio</TableHead>
                      <TableHead>Fecha inicio</TableHead>
                      <TableHead>Fecha final</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">Egresos</TableHead>
                      <TableHead className="text-right">Caja inicial</TableHead>
                      <TableHead className="text-right">Efectivo esperado</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Observacion</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashSummaryUnavailable ? (<TableRow><TableCell colSpan={11} className="py-10 text-center text-destructive">No se pudieron cargar los cortes.</TableCell></TableRow>) : cashClosuresLoading ? (<TableRow><TableCell colSpan={11} className="py-10 text-center">Cargando cortes...</TableCell></TableRow>) : cashCutClosuresInRange.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                          No hay cortes registrados en este periodo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cutsPagination.paginatedItems.map((closure) => {
                        const closureMovements = cashMovements.filter((movement) => movement.corteId === closure.id);
                        const closureSummary = buildClosureSummary(closure, closureMovements);
                        const isSelected = selectedClosureId === closure.id;
                        const folio = `CC-${String(cashClosures.length - cashClosures.findIndex((item) => item.id === closure.id)).padStart(4, "0")}`;

                        return (
                          <TableRow
                            key={closure.id}
                            className={cn("cursor-pointer", isSelected && "bg-primary/10")}
                            onClick={() => {
                              setSelectedClosureId(closure.id);

                            }}
                          >
                            <TableCell>
                              <span className={cn("block h-4 w-4 rounded border", isSelected && "border-primary bg-primary")} />
                            </TableCell>
                            <TableCell className="font-semibold">{folio}</TableCell>
                            <TableCell>{formatDate(closure.inicio || closure.fecha)}</TableCell>
                            <TableCell>{closure.estado === "abierto" ? "Caja abierta" : closure.fin ? formatDate(closure.fin) : "-"}</TableCell>
                            <TableCell className="text-right font-semibold text-emerald-700">{formatCurrency(closureSummary.totalIngresos)}</TableCell>
                            <TableCell className="text-right font-semibold text-destructive">{formatCurrency(closureSummary.totalEgresos)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(closureSummary.fondoInicial)}</TableCell>
                            <TableCell className="text-right font-semibold text-primary">{formatCurrency(closureSummary.efectivoFinal)}</TableCell>
                            <TableCell>{getUserDisplayName(closure.usuarioAperturaNombre ?? closure.responsableNombre, closure.usuarioAperturaEmail ?? closure.responsableEmail)}</TableCell>
                            <TableCell className="max-w-[260px] truncate text-muted-foreground">{closure.observaciones || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Ver detalle del corte"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedClosureId(closure.id);

                                  setIsCashCutDetailOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
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
            <CashPagination pagination={cutsPagination} itemLabel="cortes" />
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Acciones de caja</CardTitle>
                <CardDescription>
                  {openCashClosure ? `Cierre del corte ${formatDate(openCashClosure.fecha)}` : "Abre caja para empezar a cobrar."}
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
                    disabled={!canOpenSelectedDate || Boolean(openCashClosure)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {openCashButtonLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAutoCloseCashRegister}
                    disabled={!canCloseCash || cashMovementsLoading || cashSummaryUnavailable || !openCashClosure || isAutoClosingCash || isClosingCash || !cashShiftSettings.permitirCierreAutomatico}
                  >
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
                      min="0"
                      placeholder="0.00"
                      value={cashCloseForm.efectivoContado}
                      onChange={(event) => setCashCloseForm({ ...cashCloseForm, efectivoContado: event.target.value })}
                      disabled={!canCloseCash || cashMovementsLoading || cashSummaryUnavailable || isClosingCash || !openCashClosure}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Observaciones</Label>
                    <Textarea
                      rows={4}
                      placeholder="Diferencias, referencias bancarias o notas del cierre"
                      value={cashCloseForm.observaciones}
                      onChange={(event) => setCashCloseForm({ ...cashCloseForm, observaciones: event.target.value })}
                      disabled={!canCloseCash || cashMovementsLoading || cashSummaryUnavailable || isClosingCash || !openCashClosure}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={!canCloseCash || cashMovementsLoading || cashSummaryUnavailable || isClosingCash || !openCashClosure}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {isClosingCash ? "Cerrando..." : "Cerrar corte manual"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reportes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Reporte financiero
                  </CardTitle>
                  <CardDescription>
                    Genera un reporte con los movimientos del rango elegido. Puedes consultar un solo día o un periodo completo.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <CashDateRangeFilter report value={{ start: reportStartDate, end: reportEndDate }} onApply={range => { setReportStartDate(range.start); setReportEndDate(range.end); }} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleExportFinancialReportCsv} disabled={reportLoading || reportUnavailable}><FileSpreadsheet className="mr-2 h-4 w-4" />Descargar CSV</Button>
                <Button type="button" onClick={handleExportFinancialReportPdf} disabled={reportLoading || reportUnavailable}><Download className="mr-2 h-4 w-4" />Descargar PDF</Button>
              </div>
              <p className="text-sm text-muted-foreground">Comparación: {formatDate(previousReportRange.start)} a {formatDate(previousReportRange.end)}. Mismo número de días, inmediatamente anteriores.</p>
              <p className="text-sm text-muted-foreground">Los ingresos son cobros recibidos, incluidos abonos. El flujo neto es ingresos menos egresos. El resultado estimado además descuenta el costo de productos vendidos en estas fechas; puede incluir ventas aún no cobradas y no representa utilidad contable. Las cancelaciones y los fondos de apertura se excluyen.</p>
            </CardContent>
          </Card>

          {reportUnavailable ? <p role="alert" className="rounded-md border p-6 text-destructive">Reporte no disponible: no se pudieron cargar todos los cobros, egresos o movimientos de inventario. Recarga la página.</p> : reportLoading ? <p role="status" className="p-6">Cargando datos del reporte...</p> : <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos</CardTitle>
                <CircleDollarSign className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(financialReport.ingresos)}</div>
                <p className="text-xs text-muted-foreground">{financialReport.periodCashMovements.filter(m => m.tipo === "ingreso").length} ingresos activos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gastos</CardTitle>
                <TrendingDown className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(financialReport.gastosOperativos)}</div>
                <p className="text-xs text-muted-foreground">Egresos operativos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Costo vendido</CardTitle>
                <PackageCheck className="h-5 w-5 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(financialReport.costoMercaderia)}</div>
                <p className="text-xs text-muted-foreground">{financialReport.periodInventorySales.length} salidas por venta</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Flujo neto</CardTitle>
                <TrendingUp className="h-5 w-5 text-sky-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(financialReport.ingresos - financialReport.gastosOperativos)}</div>
                <p className="text-xs text-muted-foreground">Cobros − egresos del periodo</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resultado estimado</CardTitle>
                <ReceiptText className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(financialReport.utilidadNeta)}</div>
                <p className="text-xs text-muted-foreground">{financialReport.ingresos > 0 ? `Resultado / cobros: ${financialReport.margenNeto.toFixed(1)}%` : "Sin cobros para calcular porcentaje"}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Comparativa</CardTitle>
                <CardDescription>Mismos días de duración. Un aumento en ingresos no implica por sí solo mayor rentabilidad.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Ingresos vs anterior</p>
                  <p className="text-2xl font-bold">{formatVariation(financialReportExportData.variacionIngresos)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Actual: {formatCurrency(financialReport.ingresos)} · Anterior: {formatCurrency(previousFinancialReport.ingresos)}
                    <span className="block">Diferencia: {formatCurrency(financialReport.ingresos - previousFinancialReport.ingresos)}</span>
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Resultado estimado vs anterior</p>
                  <p className="text-2xl font-bold">{formatVariation(financialReportExportData.variacionUtilidad)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Actual: {formatCurrency(financialReport.utilidadNeta)} · Anterior: {formatCurrency(previousFinancialReport.utilidadNeta)}
                    <span className="block">Diferencia: {formatCurrency(financialReport.utilidadNeta - previousFinancialReport.utilidadNeta)}</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gastos por categoría</CardTitle>
                <CardDescription>Egresos activos agrupados por categoría, de mayor a menor. El porcentaje indica su parte del gasto total.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {financialReport.gastosPorCategoria.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No hay gastos registrados en este periodo.
                  </div>
                ) : (
                  expensesPagination.paginatedItems.map((row) => (
                    <div key={row.categoria} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div>
                        <p className="font-medium">{row.categoria}</p>
                        <p className="text-xs text-muted-foreground">{row.movimientos} egresos</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {financialReport.gastosOperativos > 0 ? `${((row.total / financialReport.gastosOperativos) * 100).toFixed(1)}%` : "0%"}
                      </p>
                      <p className="font-semibold text-destructive">{formatCurrency(row.total)}</p>
                    </div>
                  ))
                )}
              </CardContent>
              <CashPagination pagination={expensesPagination} itemLabel="categorías" />
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Ventas por producto</CardTitle>
              <CardDescription>Ventas activas de productos en el periodo. Importe con descuento proporcional; puede incluir saldo aún no cobrado. Los productos se agrupan por su identificador.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Unidades</TableHead>
                      <TableHead className="text-right">Importe vendido</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Utilidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryMovementsLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          Cargando ventas de inventario...
                        </TableCell>
                      </TableRow>
                    ) : financialReport.ventasPorProducto.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          No hay ventas de productos en este periodo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportProductSalesPagination.paginatedItems.map((row) => (
                        <TableRow key={row.productoId}>
                          <TableCell className="font-medium">{row.producto}</TableCell>
                          <TableCell className="text-right">{row.unidades}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.ingreso)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.costo)}</TableCell>
                          <TableCell className={`text-right font-semibold ${row.utilidad < 0 ? "text-destructive" : "text-emerald-700"}`}>
                            {formatCurrency(row.utilidad)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            {!inventoryMovementsLoading && financialReport.ventasPorProducto.length > 0 && (
              <DataPagination
                itemLabel="productos"
                page={reportProductSalesPagination.page}
                pageSize={reportProductSalesPagination.pageSize}
                totalItems={reportProductSalesPagination.totalItems}
                startIndex={reportProductSalesPagination.startIndex}
                endIndex={reportProductSalesPagination.endIndex}
                canPreviousPage={reportProductSalesPagination.canPreviousPage}
                canNextPage={reportProductSalesPagination.canNextPage}
                onPageSizeChange={reportProductSalesPagination.setPageSize}
                onPreviousPage={reportProductSalesPagination.previousPage}
                onNextPage={reportProductSalesPagination.nextPage}
              />
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Movimientos del periodo</CardTitle>
              <CardDescription>Cobros, abonos y egresos activos del rango. El paginador limita la vista; las descargas incluyen todos los movimientos.</CardDescription>
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
                      <TableHead>Categoria</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashMovementsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          Cargando movimientos...
                        </TableCell>
                      </TableRow>
                    ) : financialReport.periodCashMovements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          No hay movimientos de caja en este periodo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportCashMovementsPagination.paginatedItems.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>{formatDate(movement.fecha)}</TableCell>
                          <TableCell>
                            <Badge variant={movement.tipo === "ingreso" ? "default" : "destructive"}>
                              {cashMovementLabel[movement.tipo]}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{movement.concepto}</TableCell>
                          <TableCell>{paymentMethodLabel[movement.metodo]}</TableCell>
                          <TableCell>{movement.tipo === "egreso" ? getExpenseCategoryLabel(movement.categoriaGasto) : "-"}</TableCell>
                          <TableCell>{getUserDisplayName(movement.usuarioNombre, movement.usuarioEmail)}</TableCell>
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
            {!cashMovementsLoading && financialReport.periodCashMovements.length > 0 && (
              <DataPagination
                itemLabel="movimientos"
                page={reportCashMovementsPagination.page}
                pageSize={reportCashMovementsPagination.pageSize}
                totalItems={reportCashMovementsPagination.totalItems}
                startIndex={reportCashMovementsPagination.startIndex}
                endIndex={reportCashMovementsPagination.endIndex}
                canPreviousPage={reportCashMovementsPagination.canPreviousPage}
                canNextPage={reportCashMovementsPagination.canNextPage}
                onPageSizeChange={reportCashMovementsPagination.setPageSize}
                onPreviousPage={reportCashMovementsPagination.previousPage}
                onNextPage={reportCashMovementsPagination.nextPage}
              />
            )}
          </Card>
                  </> }
        </TabsContent>

        {canManageCashSettings && (
          <TabsContent value="configuracion" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        Configuracion de turnos
                      </CardTitle>
                      <SectionHelp title="Acerca de Configuración de turnos">
                        <p>
                          Define cómo se abre la caja, las reglas de cierre y los turnos disponibles para recepción.
                        </p>
                      </SectionHelp>
                    </div>
                  </div>
                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    <Button
                      type="button"
                      onClick={handleRequestSaveShiftSettings}
                      disabled={isSavingShiftSettings || !hasUnsavedShiftSettingsChanges}
                    >
                      {isSavingShiftSettings ? "Guardando..." : "Guardar configuracion"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {hasUnsavedShiftSettingsChanges ? "Hay cambios sin guardar." : "Configuracion guardada."}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">Turnos establecidos para operacion diaria</p>
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                          {shiftSettingsForm.modo === "programado" ? "Por horario activo" : "Modo manual"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Sugerido para clinicas del sur de Mexico: Matutino 08:00-14:00 y Vespertino 16:00-20:00.
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" onClick={restoreDefaultSouthMexicoShifts} disabled={isSavingShiftSettings}>
                    Restaurar sugeridos
                  </Button>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="relative">
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-lg border bg-background p-4 pr-12 text-left transition-colors",
                        shiftSettingsForm.modo === "manual" && "border-primary bg-primary/5 ring-1 ring-primary/30",
                      )}
                      onClick={() => updateShiftSettingsForm({ modo: "manual" })}
                      disabled={isSavingShiftSettings}
                    >
                      <div className="flex items-center gap-2">
                        <Unlock className="h-4 w-4 text-primary" />
                        <p className="font-semibold">Manual</p>
                        {shiftSettingsForm.modo === "manual" && <Badge>Activo</Badge>}
                      </div>
                    </button>
                    <div className="absolute right-3 top-3">
                      <SectionHelp title="Modo Manual">
                        <p>
                          Permite abrir caja sin escoger horario. Es útil para guardias, días especiales o clínicas con una sola recepción.
                        </p>
                      </SectionHelp>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-lg border bg-background p-4 pr-12 text-left transition-colors",
                        shiftSettingsForm.modo === "programado" && "border-primary bg-primary/5 ring-1 ring-primary/30",
                      )}
                      onClick={() => updateShiftSettingsForm({ modo: "programado" })}
                      disabled={isSavingShiftSettings}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <p className="font-semibold">Por horario</p>
                        {shiftSettingsForm.modo === "programado" && <Badge>Activo</Badge>}
                      </div>
                    </button>
                    <div className="absolute right-3 top-3">
                      <SectionHelp title="Modo Por horario">
                        <p>
                          Obliga a seleccionar Matutino, Vespertino u otro turno. Sirve para comparar ingresos y diferencias por responsable u horario.
                        </p>
                      </SectionHelp>
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-500/40 bg-card p-4 text-card-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <p className="font-semibold">Cierre a medianoche</p>
                      </div>
                      <SectionHelp title="Cierre a medianoche">
                        <p>
                          Si una caja permanece abierta al cambiar de día, el sistema la cierra automáticamente como corte vencido, sin importar el turno seleccionado.
                        </p>
                      </SectionHelp>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Modo de turno</Label>
                    <Select
                      value={shiftSettingsForm.modo}
                      onValueChange={(value) => updateShiftSettingsForm({ modo: value as CashShiftSettings["modo"] })}
                      disabled={isSavingShiftSettings}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="programado">Por horario</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {shiftSettingsForm.modo === "manual"
                        ? "Al abrir caja no se pedira turno; los cortes quedan como Manual."
                        : "Al abrir caja sera obligatorio seleccionar uno de los turnos activos."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Fondo inicial sugerido</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={shiftSettingsForm.fondoInicialSugerido}
                      onChange={(event) => updateShiftSettingsForm({ fondoInicialSugerido: Number(event.target.value) || 0 })}
                      disabled={isSavingShiftSettings}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tolerancia de diferencia</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={shiftSettingsForm.toleranciaDiferencia}
                      onChange={(event) => updateShiftSettingsForm({ toleranciaDiferencia: Number(event.target.value) || 0 })}
                      disabled={isSavingShiftSettings}
                    />
                    <p className="text-xs text-muted-foreground">Referencia administrativa para diferencias de efectivo.</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Multiples cortes por dia</p>
                      <p className="text-xs text-muted-foreground">Permite abrir otro corte en la misma fecha.</p>
                    </div>
                    <Switch
                      checked={shiftSettingsForm.permitirMultiplesCortesPorDia}
                      onCheckedChange={(checked) => updateShiftSettingsForm({ permitirMultiplesCortesPorDia: checked })}
                      disabled={isSavingShiftSettings}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Cierre automatico</p>
                      <p className="text-xs text-muted-foreground">Habilita el boton de cierre automatico.</p>
                    </div>
                    <Switch
                      checked={shiftSettingsForm.permitirCierreAutomatico}
                      onCheckedChange={(checked) => updateShiftSettingsForm({ permitirCierreAutomatico: checked })}
                      disabled={isSavingShiftSettings}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Fondo inicial requerido</p>
                      <p className="text-xs text-muted-foreground">Obliga a capturar fondo al abrir caja.</p>
                    </div>
                    <Switch
                      checked={shiftSettingsForm.fondoInicialRequerido}
                      onCheckedChange={(checked) => updateShiftSettingsForm({ fondoInicialRequerido: checked })}
                      disabled={isSavingShiftSettings}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Cierre obligatorio</p>
                      <p className="text-xs text-muted-foreground">Marca la politica para cierre al final del turno.</p>
                    </div>
                    <Switch
                      checked={shiftSettingsForm.cierreObligatorio}
                      onCheckedChange={(checked) => updateShiftSettingsForm({ cierreObligatorio: checked })}
                      disabled={isSavingShiftSettings}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>Turnos configurados</CardTitle>
                      <Badge variant="secondary">
                        {shiftSettingsForm.turnos.filter((shift) => shift.activo).length} activos
                      </Badge>
                    </div>
                    <CardDescription>Estos turnos aparecen al abrir caja cuando el modo por horario esta activo.</CardDescription>
                  </div>
                  <Button type="button" variant="outline" onClick={addShiftRow} disabled={isSavingShiftSettings}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar turno
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {shiftSettingsForm.turnos.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No hay turnos configurados.
                  </div>
                ) : (
                  shiftSettingsForm.turnos.map((shift) => (
                    <div key={shift.id} className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[1fr_150px_150px_auto_auto] lg:items-end">
                      <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input
                          value={shift.nombre}
                          onChange={(event) => updateShiftRow(shift.id, { nombre: event.target.value })}
                          disabled={isSavingShiftSettings}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Inicio</Label>
                        <Input
                          type="time"
                          value={shift.horaInicio}
                          onChange={(event) => updateShiftRow(shift.id, { horaInicio: event.target.value })}
                          disabled={isSavingShiftSettings}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fin</Label>
                        <Input
                          type="time"
                          value={shift.horaFin}
                          onChange={(event) => updateShiftRow(shift.id, { horaFin: event.target.value })}
                          disabled={isSavingShiftSettings}
                        />
                      </div>
                      <div className="flex h-10 items-center gap-2">
                        <Switch
                          checked={shift.activo}
                          onCheckedChange={(checked) => updateShiftRow(shift.id, { activo: checked })}
                          disabled={isSavingShiftSettings}
                        />
                        <span className="text-sm">{shift.activo ? "Activo" : "Inactivo"}</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => removeShiftRow(shift.id)}
                        disabled={isSavingShiftSettings || shiftSettingsForm.turnos.length <= 1}
                        aria-label={`Eliminar ${shift.nombre}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

      </Tabs>

      <Dialog open={isCashCutDetailOpen} onOpenChange={setIsCashCutDetailOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <ReceiptText className="h-5 w-5" />
              Detalle del corte {selectedCashCutClosure ? `CC-${String(cashClosures.length - cashClosures.findIndex((item) => item.id === selectedCashCutClosure.id)).padStart(4, "0")}` : ""}
            </DialogTitle>
            <DialogDescription>
              {selectedCashCutClosure
                ? `${formatDate(selectedCashCutClosure.fecha)} | ${selectedCashCutClosure.estado === "abierto" ? "Caja abierta" : "Caja cerrada"}`
                : "Selecciona un corte para ver el detalle."}
            </DialogDescription>
          </DialogHeader>

          {selectedCashCutClosure && (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Fecha inicio</p>
                  <p className="mt-1 font-semibold">{formatDate(selectedCashCutClosure.inicio || selectedCashCutClosure.fecha)}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Fecha final</p>
                  <p className="mt-1 font-semibold">
                    {selectedCashCutClosure.estado === "abierto" ? "Caja abierta" : selectedCashCutClosure.fin ? formatDate(selectedCashCutClosure.fin) : "-"}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Usuario</p>
                  <p className="mt-1 font-semibold">
                    {getUserDisplayName(
                      selectedCashCutClosure.usuarioAperturaNombre ?? selectedCashCutClosure.responsableNombre,
                      selectedCashCutClosure.usuarioAperturaEmail ?? selectedCashCutClosure.responsableEmail,
                    )}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Tipo de cierre</p>
                  <p className="mt-1 font-semibold">
                    {selectedCashCutClosure.estado === "abierto"
                      ? "Abierto"
                      : selectedCashCutClosure.tipoCierre === "automatico"
                        ? "Automatico"
                        : "Manual"}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Total ingresos</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">{formatCurrency(selectedCashCutSummary.totalIngresos)}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Total egresos</p>
                  <p className="mt-1 text-2xl font-bold text-destructive">{formatCurrency(selectedCashCutSummary.totalEgresos)}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Caja inicial</p>
                  <p className="mt-1 text-2xl font-bold">{formatCurrency(selectedCashCutSummary.fondoInicial)}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Efectivo esperado</p>
                  <p className="mt-1 text-2xl font-bold text-primary">{formatCurrency(selectedCashCutSummary.efectivoFinal)}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-4"><p className="text-sm text-muted-foreground">Efectivo contado</p><p className="font-semibold">{selectedCashCutClosure.estado === "cerrado" ? formatCurrency(selectedCashCutClosure.efectivoContado) : "Pendiente de cierre"}</p></div>
                <div className="rounded-md border p-4"><p className="text-sm text-muted-foreground">Diferencia contra lo esperado</p><p className="font-semibold">{selectedCashCutClosure.estado === "cerrado" ? formatCurrency(selectedCashCutClosure.diferenciaEfectivo) : "Pendiente de cierre"}</p></div>
              </div>
              {selectedCashCutClosure.estado === "cerrado" && !cashMovementsLoading && (
                Math.abs(buildCashSummary(selectedCashCutMovements).totalIngresos - selectedCashCutClosure.totales.total) > 0.01 ||
                Math.abs(buildCashSummary(selectedCashCutMovements).totalEgresos - selectedCashCutClosure.totalEgresos) > 0.01 ||
                Math.abs(buildCashSummary(selectedCashCutMovements).fondoInicial - selectedCashCutClosure.fondoInicial) > 0.01
              ) && <p role="status" className="rounded-md border border-amber-300 p-3 text-sm text-amber-800">El historial disponible no coincide con los totales guardados al cerrar. Los importes del resumen conservan el cierre original; el desglose corresponde a los movimientos disponibles.</p>}
              <div className="grid gap-4 md:grid-cols-3">
                {selectedCashCutSummary.desgloseMetodos.map((methodSummary) => {
                  const Icon = paymentMethodIcon[methodSummary.metodo];
                  return (
                    <div key={methodSummary.metodo} className="rounded-md border p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="font-semibold uppercase">{paymentMethodLabel[methodSummary.metodo]}</p>
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ingresos</span>
                          <span className="font-semibold text-emerald-700">+{formatCurrency(methodSummary.ingresos)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Egresos</span>
                          <span className="font-semibold text-destructive">-{formatCurrency(methodSummary.egresos)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-muted-foreground">Neto</span>
                          <span className="font-semibold text-primary">{formatCurrency(methodSummary.neto)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-md border bg-muted/20 p-4">
                <p className="text-xs uppercase text-muted-foreground">Observacion</p>
                <p className="mt-1 text-sm font-medium">{selectedCashCutClosure.observaciones || "Sin observaciones"}</p>
              </div>

              <div className="overflow-auto rounded-md border">
                <div className="border-b bg-muted/30 px-4 py-3">
                  <p className="font-semibold">Movimientos ({selectedCashCutMovements.length}) · Los cancelados no suman al corte</p>
                </div>
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Metodo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCashCutMovements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          No hay movimientos registrados en este corte.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cutDetailsPagination.paginatedItems.map((movement, index) => (
                        <TableRow key={movement.id}>
                          <TableCell className="font-medium">MOV-{String(cutDetailsPagination.startIndex + index + 1).padStart(4, "0")}</TableCell>
                          <TableCell>{formatDate(movement.fecha)}</TableCell>
                          <TableCell>
                            <p className="font-medium">{movement.concepto}</p>
                            {movement.nota && <p className="text-xs text-muted-foreground">{movement.nota}</p>}
                          </TableCell>
                          <TableCell>{getUserDisplayName(movement.usuarioNombre, movement.usuarioEmail)}</TableCell>
                          <TableCell>{paymentMethodLabel[movement.metodo]}</TableCell>
                          <TableCell>
                            <Badge variant={movement.tipo === "ingreso" ? "default" : "destructive"}>
                              {movement.estado === "cancelado" ? "Cancelado · excluido" : isOpeningCashMovement(movement) ? "Apertura" : cashMovementLabel[movement.tipo]}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn("text-right font-semibold", movement.tipo === "egreso" ? "text-destructive" : "text-emerald-700")}>
                            {movement.tipo === "egreso" ? "-" : "+"}
                            {formatCurrency(movement.monto)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <CashPagination pagination={cutDetailsPagination} itemLabel="movimientos" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCashCutDetailOpen(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPaymentDetailOpen}
        onOpenChange={(open) => {
          setIsPaymentDetailOpen(open);
          if (!open) {
            setPaymentCancellationReason("");
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                <ReceiptText className="h-6 w-6" />
              </span>
              <span>
                Detalle de venta
                <span className="block text-xs font-medium uppercase text-muted-foreground">Sistema de gestion de caja</span>
              </span>
            </DialogTitle>
            <DialogDescription>Importes y conceptos del pago seleccionado. Los saldos reflejan el momento del cobro.</DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">ID de venta</p>
                  <p className="text-2xl font-bold text-primary">V-{selectedPayment.id.slice(0, 6).toUpperCase()}</p>
                  <p className="mt-4 text-xs uppercase text-muted-foreground">Cliente</p>
                  <p className="text-lg font-semibold">{selectedPayment.pacienteNombre || "Publico general"}</p>
                </div>
                <div className="space-y-4 text-left md:text-right">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Fecha del pago</p>
                    <p className="font-semibold">{formatDate(selectedPayment.fecha)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Metodo de pago</p>
                    <p className="font-semibold">{paymentMethodLabel[selectedPayment.metodo]}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border bg-muted/30 p-4 text-center">
                  <p className="text-xs uppercase text-muted-foreground">Articulos</p>
                  <p className="mt-2 text-3xl font-bold">{selectedPaymentItems.length}</p>
                </div>
                <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-center">
                  <p className="text-xs uppercase text-emerald-700">Estado</p>
                  <p className="mt-2 text-xl font-bold text-emerald-700">
                    {selectedPayment.estado === "activo" ? "Exitosa" : "Cancelada"}
                  </p>
                </div>
                <div className="rounded-md border border-primary/30 bg-primary/10 p-4 text-center">
                  <p className="text-xs uppercase text-primary">Monto de este pago</p>
                  <p className="mt-2 text-3xl font-bold text-primary">{formatCurrency(selectedPayment.monto)}</p>
                </div>
              </div>

              <div className="rounded-md border">
                <div className="border-b px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Lista de productos y tratamientos</p>
                </div>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripcion</TableHead>
                        <TableHead className="text-right">Cant</TableHead>
                        <TableHead className="text-right">Precio unit.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentDetailsPagination.paginatedItems.map((item) => (
                        <TableRow key={`${item.id}-${item.nombre}`}>
                          <TableCell>
                            <p className="font-semibold">{item.nombre}</p>
                            <p className="text-xs text-muted-foreground">{item.descripcion}</p>
                          </TableCell>
                          <TableCell className="text-right">{item.cantidad}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.precioUnitario)}</TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {formatCurrency(item.cantidad * item.precioUnitario)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <CashPagination pagination={paymentDetailsPagination} itemLabel="conceptos" />
                <div className="flex flex-col gap-2 border-t px-4 py-4 text-sm sm:items-end">
                  {selectedPayment.descuento ? (
                    <>
                      <div className="flex w-full gap-3 sm:min-w-[240px] sm:w-auto justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatCurrency(selectedPaymentSubtotal)}</span>
                      </div>
                      <div className="flex w-full gap-3 sm:min-w-[240px] sm:w-auto justify-between">
                        <span className="text-muted-foreground">
                          Descuento{selectedPayment.descuentoPorcentaje === undefined ? "" : ` (${selectedPayment.descuentoPorcentaje}%)`}
                        </span>
                        <span>-{formatCurrency(selectedPayment.descuento)}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex w-full gap-3 sm:min-w-[240px] sm:w-auto justify-between text-lg font-bold">
                    <span>Total pagado</span>
                    <span className="text-primary">{formatCurrency(selectedPayment.monto)}</span>
                  </div>
                  {selectedPayment.saldoPendiente ? (
                    <div className="flex w-full gap-3 sm:min-w-[240px] sm:w-auto justify-between font-semibold text-amber-700">
                      <span>Saldo al registrar el pago</span>
                      <span>{formatCurrency(selectedPayment.saldoPendiente)}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {selectedPayment.notas && (
                <div className="rounded-md border bg-muted/20 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Observaciones</p>
                  <p className="mt-1 text-sm font-medium">{selectedPayment.notas}</p>
                </div>
              )}

              {selectedPayment.estado === "activo" && canCancelSales && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="font-semibold text-destructive">Cancelacion por correccion</p>
                        <p className="text-sm text-muted-foreground">
                          Usala solo si hubo confusion o error de captura. No borra la venta: la marca como cancelada,
                          cancela el movimiento de caja y devuelve inventario si habia productos descontados.
                        </p>
                        {!selectedPaymentCashCutIsOpen && (
                          <p className="mt-2 text-sm font-medium text-destructive">
                            Este pago pertenece a un corte cerrado, por eso no se puede cancelar desde caja.
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Motivo de cancelacion</Label>
                        <Textarea
                          value={paymentCancellationReason}
                          onChange={(event) => setPaymentCancellationReason(event.target.value)}
                          placeholder="Ej. Se capturo el paciente equivocado / monto incorrecto / venta duplicada"
                          rows={3}
                          maxLength={300}
                          disabled={isCancellingPayment || !selectedPaymentCashCutIsOpen}
                        />
                        <p className="text-xs text-muted-foreground">
                          Opcional. Si lo dejas vacio se guardara como sin motivo especificado.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="outline" onClick={handleDownloadSelectedPaymentTicket}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar ticket
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {canCancelSales && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleRequestCancelSelectedPayment}
                      disabled={
                        selectedPayment.estado !== "activo"
                        || !selectedPaymentCashCutIsOpen
                        || isCancellingPayment
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isCancellingPayment ? "Cancelando..." : "Confirmar cancelacion"}
                    </Button>
                  )}
                  <Button type="button" onClick={() => setIsPaymentDetailOpen(false)}>
                    Cerrar detalle
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isCancelPaymentConfirmOpen} onOpenChange={setIsCancelPaymentConfirmOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto border-destructive/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar cancelacion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion marcara la venta como cancelada, anulara el movimiento de caja y devolvera inventario si la venta desconto productos. No se puede usar en cortes cerrados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedPayment && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Venta</span>
                <span className="font-semibold">V-{selectedPayment.id.slice(0, 6).toUpperCase()}</span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-muted-foreground">Monto</span>
                <span className="font-semibold">{formatCurrency(selectedPayment.monto)}</span>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancellingPayment}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleCancelSelectedPayment();
              }}
              disabled={isCancellingPayment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancellingPayment ? "Cancelando..." : "Si, cancelar venta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isShiftSettingsConfirmOpen} onOpenChange={setIsShiftSettingsConfirmOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirmar configuracion de turnos</DialogTitle>
            <DialogDescription>
              Estos cambios modifican como se abre y se cierra caja para los siguientes cortes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Modo de turno</p>
              <p className="font-semibold">
                {shiftSettingsForm.modo === "manual" ? "Manual" : "Por horario"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {shiftSettingsForm.modo === "manual"
                  ? "Recepcion podra abrir caja sin seleccionar turno. Los cortes nuevos quedaran como Manual."
                  : "Recepcion tendra que seleccionar un turno activo al abrir caja."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Fondo sugerido</p>
                <p className="font-semibold">{formatCurrency(Number(shiftSettingsForm.fondoInicialSugerido) || 0)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Tolerancia</p>
                <p className="font-semibold">{formatCurrency(Number(shiftSettingsForm.toleranciaDiferencia) || 0)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Multiples cortes</p>
                <p className="font-semibold">{shiftSettingsForm.permitirMultiplesCortesPorDia ? "Permitidos" : "No permitidos"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Cierre automatico</p>
                <p className="font-semibold">{shiftSettingsForm.permitirCierreAutomatico ? "Habilitado" : "Deshabilitado"}</p>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <p className="font-semibold">Turnos activos</p>
              <div className="mt-2 space-y-2">
                {shiftSettingsForm.turnos.filter((shift) => shift.activo).length === 0 ? (
                  <p className="text-sm text-destructive">No hay turnos activos.</p>
                ) : (
                  shiftSettingsForm.turnos
                    .filter((shift) => shift.activo)
                    .map((shift) => (
                      <div key={shift.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">{shift.nombre}</span>
                        <span className="text-muted-foreground">{shift.horaInicio} - {shift.horaFin}</span>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/40 bg-card p-3 text-sm text-muted-foreground">
              El cierre por cambio de dia sigue activo: cualquier caja abierta de un dia anterior se cerrara automaticamente.
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsShiftSettingsConfirmOpen(false)} disabled={isSavingShiftSettings}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmSaveShiftSettings} disabled={isSavingShiftSettings}>
              {isSavingShiftSettings ? "Guardando..." : "Confirmar y guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isOpenCashDialogOpen}
        onOpenChange={(open) => {
          if (open && !canOpenSelectedDate) {
            toast.error(isSelectedDateToday
              ? "Ya existe un corte para esta fecha. Cambia la configuracion si necesitas multiples cortes por dia."
              : "Solo puedes abrir caja para el dia actual.");
            return;
          }
          setIsOpenCashDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Abrir caja</DialogTitle>
            <DialogDescription>
              {hasAnyClosureForDate
                ? `Abrir caja nuevamente para el ${formatDate(dateFilter)}.`
                : `Registra el fondo inicial para el ${formatDate(dateFilter)}.`}
            </DialogDescription>
          </DialogHeader>
          <form id="open-cash-form" onSubmit={handleOpenCashRegister} className="space-y-4">
            {cashShiftSettings.modo === "programado" && (
              <div className="space-y-2">
                <Label>Turno</Label>
                <Select
                  value={openCashForm.turnoId}
                  onValueChange={(value) => setOpenCashForm({ ...openCashForm, turnoId: value })}
                  disabled={isOpeningCash || activeConfiguredShifts.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={activeConfiguredShifts.length ? "Seleccionar turno" : "No hay turnos activos"} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeConfiguredShifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shift.nombre} ({shift.horaInicio} - {shift.horaFin})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Fondo inicial</Label>
                {cashShiftSettings.fondoInicialSugerido > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenCashForm({ ...openCashForm, fondoInicial: String(cashShiftSettings.fondoInicialSugerido) })}
                    disabled={isOpeningCash}
                  >
                    Usar {formatCurrency(cashShiftSettings.fondoInicialSugerido)}
                  </Button>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={openCashForm.fondoInicial}
                onChange={(event) => setOpenCashForm({ ...openCashForm, fondoInicial: event.target.value })}
                placeholder={cashShiftSettings.fondoInicialSugerido > 0 ? String(cashShiftSettings.fondoInicialSugerido) : "0.00"}
                disabled={isOpeningCash}
              />
              {cashShiftSettings.fondoInicialRequerido && (
                <p className="text-xs text-muted-foreground">El fondo inicial es obligatorio por configuracion.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                rows={3}
                value={openCashForm.observaciones}
                onChange={(event) => setOpenCashForm({ ...openCashForm, observaciones: event.target.value })}
                placeholder="Caja inicial, responsable o notas de apertura"
                disabled={isOpeningCash}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpenCashDialogOpen(false)} disabled={isOpeningCash}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="open-cash-form"
              disabled={
                isOpeningCash ||
                Boolean(openCashClosure) ||
                (cashShiftSettings.modo === "programado" && activeConfiguredShifts.length === 0)
              }
            >
              {isOpeningCash ? "Abriendo..." : openCashButtonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default CajaPage;
