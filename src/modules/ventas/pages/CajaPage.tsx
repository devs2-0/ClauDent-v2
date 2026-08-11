import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  ClipboardCheck,
  CreditCard,
  Download,
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
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/auth";
import { DataPagination } from "@/shared/components/DataPagination";
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
import { useInventory, type InventoryMovement } from "@/modules/inventario";
import { useCashRegister } from "../hooks/useCashRegister";
import { defaultCashShiftSettings } from "../services/cashShiftSettingsService";
import {
  exportCashCutCsv,
  exportCashCutPdf,
  exportFinancialReportCsv,
  exportFinancialReportPdf,
  type CashCutExportData,
  type FinancialReportExportData,
} from "../services/financialReportExport";
import type { CashClosureTotals, CashCutSummary, CashExpenseCategory, CashMovement, CashMovementType, CashShiftDefinition, CashShiftSettings, PaymentMethod } from "../types/cash.types";

const today = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().split("T")[0];
};

const toLocalDateString = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().split("T")[0];
};

const startOfCurrentMonth = () => {
  const now = new Date();
  return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
};

const addDays = (date: string, days: number) => {
  const parsedDate = new Date(`${date}T00:00:00`);
  parsedDate.setDate(parsedDate.getDate() + days);
  return toLocalDateString(parsedDate);
};

const getPreviousRange = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const previousEnd = addDays(startDate, -1);
  const previousStart = addDays(previousEnd, -(days - 1));
  return { start: previousStart, end: previousEnd };
};

const isDateInRange = (date: string, startDate: string, endDate: string) => {
  return date >= startDate && date <= endDate;
};

const calculateVariation = (current: number, previous: number) => {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const formatVariation = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

const createShiftId = () => `turno-${Date.now()}`;

const paymentMethods: PaymentMethod[] = ["efectivo", "tarjeta", "transferencia"];
const cashExpenseCategories: CashExpenseCategory[] = ["suministros", "servicios", "renta", "nomina", "mantenimiento", "otros"];

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

const cashExpenseCategoryLabel: Record<CashExpenseCategory, string> = {
  suministros: "Suministros",
  servicios: "Servicios",
  renta: "Renta",
  nomina: "Nomina",
  mantenimiento: "Mantenimiento",
  otros: "Otros",
};

const getExpenseCategoryLabel = (category?: CashExpenseCategory | null) => {
  return category ? cashExpenseCategoryLabel[category] ?? "Otros" : "Sin categoria";
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

const getUserDisplayName = (name?: string, email?: string) => name || email || "Admin";

const cashConceptOrder = ["Ventas directas", "Tratamientos / cotizaciones", "Abonos", "Ingresos manuales", "Otros ingresos"];

const getIncomeConceptLabel = (
  movement: CashMovement,
  paymentById: Map<string, { origen?: string }>,
) => {
  if (movement.referenciaTipo === "manual") return "Ingresos manuales";
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

const getInventoryMovementCost = (movement: InventoryMovement) => {
  const storedCost = Number(movement.costoTotal) || 0;
  if (storedCost) return storedCost;
  return Math.abs(Number(movement.cantidad) || 0) * (Number(movement.costoUnitario) || 0);
};

const getInventoryMovementIncome = (movement: InventoryMovement) => {
  const storedIncome = Number(movement.ingresoTotal) || 0;
  if (storedIncome) return storedIncome;
  return Math.abs(Number(movement.cantidad) || 0) * (Number(movement.precioUnitarioVenta) || 0);
};

const buildFinancialReportSnapshot = (
  cashMovements: CashMovement[],
  inventoryMovements: InventoryMovement[],
  startDate: string,
  endDate: string,
) => {
  const periodCashMovements = cashMovements.filter((movement) => {
    return movement.estado === "activo" && !isOpeningCashMovement(movement) && isDateInRange(movement.fecha, startDate, endDate);
  });
  const periodInventorySales = inventoryMovements.filter((movement) => {
    return movement.tipo === "venta" && isDateInRange(movement.fecha, startDate, endDate);
  });

  const ingresos = periodCashMovements
    .filter((movement) => movement.tipo === "ingreso")
    .reduce((total, movement) => total + (Number(movement.monto) || 0), 0);
  const gastosOperativos = periodCashMovements
    .filter((movement) => movement.tipo === "egreso")
    .reduce((total, movement) => total + (Number(movement.monto) || 0), 0);
  const costoMercaderia = periodInventorySales.reduce((total, movement) => total + getInventoryMovementCost(movement), 0);
  const utilidadBruta = ingresos - costoMercaderia;
  const utilidadNeta = utilidadBruta - gastosOperativos;
  const margenNeto = ingresos > 0 ? (utilidadNeta / ingresos) * 100 : 0;

  const expenseCategoryMap = new Map<CashExpenseCategory | "sin_categoria", { movimientos: number; total: number }>();
  periodCashMovements
    .filter((movement) => movement.tipo === "egreso")
    .forEach((movement) => {
      const category = movement.categoriaGasto ?? "sin_categoria";
      const current = expenseCategoryMap.get(category) ?? { movimientos: 0, total: 0 };
      current.movimientos += 1;
      current.total += Number(movement.monto) || 0;
      expenseCategoryMap.set(category, current);
    });

  const productSalesMap = new Map<string, FinancialReportExportData["ventasPorProducto"][number]>();
  periodInventorySales.forEach((movement) => {
    const productName = movement.productoNombre || "Producto sin nombre";
    const current = productSalesMap.get(productName) ?? {
      producto: productName,
      unidades: 0,
      ingreso: 0,
      costo: 0,
      utilidad: 0,
    };
    current.unidades += Math.abs(Number(movement.cantidad) || 0);
    current.ingreso += getInventoryMovementIncome(movement);
    current.costo += getInventoryMovementCost(movement);
    current.utilidad = current.ingreso - current.costo;
    productSalesMap.set(productName, current);
  });

  return {
    periodCashMovements,
    periodInventorySales,
    ingresos,
    gastosOperativos,
    costoMercaderia,
    utilidadBruta,
    utilidadNeta,
    margenNeto,
    gastosPorCategoria: Array.from(expenseCategoryMap.entries())
      .map(([category, value]) => ({
        categoria: category === "sin_categoria" ? "Sin categoria" : getExpenseCategoryLabel(category),
        movimientos: value.movimientos,
        total: value.total,
      }))
      .sort((a, b) => b.total - a.total),
    ventasPorProducto: Array.from(productSalesMap.values()).sort((a, b) => b.ingreso - a.ingreso),
  };
};

const CajaPage: React.FC = () => {
  const {
    payments,
    paymentsLoading,
    cashClosures,
    cashMovements,
    cashMovementsLoading,
    cashShiftSettings,
    cashShiftSettingsLoading,
    openCashRegister,
    createCashMovement,
    createPayment,
    closeCashRegister,
    autoCloseCashRegister,
    updateCashShiftSettings,
  } = useCashRegister();
  const { can } = useCan();
  const canManageCashSettings = can("settings.update");
  const {
    movements: inventoryMovements,
    movementsLoading: inventoryMovementsLoading,
  } = useInventory();

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "todos">("todos");
  const [dateFilter, setDateFilter] = useState(() => today());
  const [currentSystemDate, setCurrentSystemDate] = useState(() => today());
  const [reportStartDate, setReportStartDate] = useState(() => startOfCurrentMonth());
  const [reportEndDate, setReportEndDate] = useState(() => today());
  const [activeTab, setActiveTab] = useState("pagos");
  const [selectedClosureId, setSelectedClosureId] = useState<string | null>(null);

  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isOpeningCash, setIsOpeningCash] = useState(false);
  const [isClosingCash, setIsClosingCash] = useState(false);
  const [isAutoClosingCash, setIsAutoClosingCash] = useState(false);
  const [isSavingCashMovement, setIsSavingCashMovement] = useState(false);
  const [isSavingShiftSettings, setIsSavingShiftSettings] = useState(false);
  const [hasUnsavedShiftSettingsChanges, setHasUnsavedShiftSettingsChanges] = useState(false);
  const midnightAutoCloseAttemptRef = useRef<string | null>(null);

  const [isOpenCashDialogOpen, setIsOpenCashDialogOpen] = useState(false);
  const [isCashMovementDialogOpen, setIsCashMovementDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isShiftSettingsConfirmOpen, setIsShiftSettingsConfirmOpen] = useState(false);

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
    turnoId: "",
    observaciones: "",
  });

  const [cashMovementForm, setCashMovementForm] = useState({
    tipo: "egreso" as CashMovementType,
    metodo: "efectivo" as PaymentMethod,
    categoriaGasto: "otros" as CashExpenseCategory,
    comprobanteUrl: "",
    concepto: "",
    monto: "",
    nota: "",
  });

  const [shiftSettingsForm, setShiftSettingsForm] = useState<CashShiftSettings>(cashShiftSettings);

  useEffect(() => {
    if (hasUnsavedShiftSettingsChanges) return;
    setShiftSettingsForm(cashShiftSettings);
  }, [cashShiftSettings, hasUnsavedShiftSettingsChanges]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentSystemDate(today());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

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

  useEffect(() => {
    if (!openCashClosure) return;
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
  }, [autoCloseCashRegister, currentSystemDate, openCashClosure]);

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
  const canOpenSelectedDate = !openCashClosure && (cashShiftSettings.permitirMultiplesCortesPorDia || !hasAnyClosureForDate);
  const openCashButtonLabel = openCashClosure ? "Caja abierta" : "Abrir caja";
  const activeConfiguredShifts = useMemo(
    () => cashShiftSettings.turnos.filter((shift) => shift.activo),
    [cashShiftSettings.turnos],
  );
  const selectedOpeningShift = activeConfiguredShifts.find((shift) => shift.id === openCashForm.turnoId) ?? null;

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
  const cashSummaryForClosing = openCashClosure ? openCashSummary : cashSummary;
  const normalizedReportStartDate = reportStartDate <= reportEndDate ? reportStartDate : reportEndDate;
  const normalizedReportEndDate = reportStartDate <= reportEndDate ? reportEndDate : reportStartDate;
  const previousReportRange = useMemo(
    () => getPreviousRange(normalizedReportStartDate, normalizedReportEndDate),
    [normalizedReportEndDate, normalizedReportStartDate],
  );
  const financialReport = useMemo(
    () => buildFinancialReportSnapshot(cashMovements, inventoryMovements, normalizedReportStartDate, normalizedReportEndDate),
    [cashMovements, inventoryMovements, normalizedReportEndDate, normalizedReportStartDate],
  );
  const previousFinancialReport = useMemo(
    () => buildFinancialReportSnapshot(cashMovements, inventoryMovements, previousReportRange.start, previousReportRange.end),
    [cashMovements, inventoryMovements, previousReportRange.end, previousReportRange.start],
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
    resetKeys: [search, methodFilter, dateFilter],
  });
  const cashMovementsPagination = usePagination(displayedCashMovements, {
    resetKeys: [selectedClosureForDetail?.id, dateFilter],
  });
  const reportProductSalesPagination = usePagination(financialReport.ventasPorProducto, {
    resetKeys: [normalizedReportStartDate, normalizedReportEndDate],
  });
  const reportCashMovementsPagination = usePagination(financialReport.periodCashMovements, {
    resetKeys: [normalizedReportStartDate, normalizedReportEndDate],
  });

  const cashStatus = useMemo(() => {
    if (hasOpenCashForSelectedDate) {
      return {
        label: "ABIERTA",
        title: "Caja abierta",
        description: `El corte del ${formatDate(dateFilter)} esta activo y listo para recibir cobros.`,
        nextAction: "Al final del dia cierra manual o automatico.",
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
        title: "Caja cerrada",
        description: `Hay ${closedClosuresForDate.length} corte${closedClosuresForDate.length === 1 ? "" : "s"} cerrado${closedClosuresForDate.length === 1 ? "" : "s"} para el ${formatDate(dateFilter)}.`,
        nextAction: canOpenSelectedDate ? "Puedes abrir caja nuevamente para este dia." : "Consulta el resumen o selecciona otro dia.",
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
    ? `Corte ${closuresForDate.length - selectedClosureIndex}`
    : "Fecha completa";
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
    movimientos: displayedCashMovements.map((movement) => ({
      fecha: movement.fecha,
      tipo: isOpeningCashMovement(movement) ? "apertura" : movement.tipo,
      concepto: movement.concepto,
      metodo: paymentMethodLabel[movement.metodo],
      categoria: movement.tipo === "egreso" ? getExpenseCategoryLabel(movement.categoriaGasto) : "-",
      monto: movement.tipo === "egreso" ? -Math.abs(Number(movement.monto) || 0) : Number(movement.monto) || 0,
      usuario: getUserDisplayName(movement.usuarioNombre, movement.usuarioEmail),
    })),
  }), [cashSummary, cutExpensesByCategory, cutIncomeByConcept, dateFilter, displayedCashMovements, selectedClosureForDetail, selectedClosureLabel]);

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

  const handleOpenCashRegister = async (event: React.FormEvent) => {
    event.preventDefault();

    if (openCashClosure) {
      toast.error(`Ya hay una caja abierta del ${openCashClosure.fecha}. Cierrala antes de abrir otra.`);
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
        categoriaGasto: cashMovementForm.tipo === "egreso" ? cashMovementForm.categoriaGasto : null,
        comprobanteUrl: cashMovementForm.comprobanteUrl,
        referenciaTipo: "manual",
      });
      setCashMovementForm({
        tipo: "egreso",
        metodo: "efectivo",
        categoriaGasto: "otros",
        comprobanteUrl: "",
        concepto: "",
        monto: "",
        nota: "",
      });
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

  const applyReportPreset = (preset: "hoy" | "semana" | "mes") => {
    const currentDate = today();
    if (preset === "hoy") {
      setReportStartDate(currentDate);
      setReportEndDate(currentDate);
      return;
    }
    if (preset === "semana") {
      setReportStartDate(addDays(currentDate, -6));
      setReportEndDate(currentDate);
      return;
    }
    setReportStartDate(startOfCurrentMonth());
    setReportEndDate(currentDate);
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Caja</h1>
            <Badge className={cashStatus.badgeClass}>{cashStatus.label}</Badge>
          </div>
          <p className="text-muted-foreground">
            Controla cobros reales, cortes y movimientos contables.
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Cortes del dia</CardTitle>
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
              <Button
                type="button"
                variant="secondary"
                onClick={handleAutoCloseCashRegister}
                disabled={isAutoClosingCash || isClosingCash || !cashShiftSettings.permitirCierreAutomatico}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {isAutoClosingCash ? "Cerrando..." : "Cerrar automatico"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={cn("grid h-auto w-full md:w-fit", canManageCashSettings ? "grid-cols-4" : "grid-cols-3")}>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="corte">Corte</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
          {canManageCashSettings && <TabsTrigger value="configuracion">Configuracion</TabsTrigger>}
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
                        paymentsPagination.paginatedItems.map((payment) => {
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExportCashCutCsv}
                        disabled={displayedCashMovements.length === 0}
                      >
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        CSV
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleExportCashCutPdf}
                        disabled={displayedCashMovements.length === 0}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                      <Badge variant={selectedClosureForDetail?.estado === "abierto" ? "default" : "secondary"}>
                        {selectedClosureForDetail?.estado === "abierto" ? "Abierta" : selectedClosureForDetail ? "Cerrada" : "Sin corte"}
                      </Badge>
                    </div>
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
                        <p className="text-xs text-muted-foreground">Turno</p>
                        <p className="text-lg font-semibold">
                          {selectedClosureForDetail.turnoNombre || "Manual"}
                        </p>
                        {selectedClosureForDetail.horaInicioProgramada && selectedClosureForDetail.horaFinProgramada && (
                          <p className="text-xs text-muted-foreground">
                            {selectedClosureForDetail.horaInicioProgramada} - {selectedClosureForDetail.horaFinProgramada}
                          </p>
                        )}
                      </div>
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
                        <p className="text-xs text-muted-foreground">Abrio</p>
                        <p className="text-lg font-semibold">
                          {getUserDisplayName(selectedClosureForDetail.usuarioAperturaNombre ?? selectedClosureForDetail.responsableNombre, selectedClosureForDetail.usuarioAperturaEmail ?? selectedClosureForDetail.responsableEmail)}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <p className="text-xs text-muted-foreground">Cerro</p>
                        <p className="text-lg font-semibold">
                          {selectedClosureForDetail.estado === "cerrado"
                            ? getUserDisplayName(selectedClosureForDetail.usuarioCierreNombre, selectedClosureForDetail.usuarioCierreEmail)
                            : "Pendiente"}
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
                      <CardTitle>Cortes del dia</CardTitle>
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
                      <p className="font-medium">No hay cortes para este dia</p>
                      <p className="mt-1 text-sm text-muted-foreground">Abre caja para iniciar el corte del dia.</p>
                    </div>
                  ) : (
                    closuresForDate.map((closure, index) => {
                      const isCurrentOpenClosure = closure.estado === "abierto" && closure.id === openCashClosure?.id;
                      const isSelectedClosure = selectedClosureForDetail?.id === closure.id;
                      const closureIncome = isCurrentOpenClosure ? openCashSummary.totalIngresos : closure.totales.total;
                      const closureCashExpected = isCurrentOpenClosure ? openCashSummary.efectivoFinal : closure.efectivoEsperado;
                      const closureDifference = isCurrentOpenClosure ? 0 : closure.diferenciaEfectivo;
                      const closureNumber = closuresForDate.length - index;

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
                              <p className="font-semibold">Corte {closureNumber}</p>
                              {closure.turnoNombre && (
                                <Badge variant="outline">
                                  <Clock className="mr-1 h-3 w-3" />
                                  {closure.turnoNombre}
                                </Badge>
                              )}
                              <p className="text-sm text-muted-foreground">
                                Inicio {formatDate(closure.inicio)}
                                {closure.fin ? ` - cierre ${formatDate(closure.fin)}` : ""}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Abre: {getUserDisplayName(closure.usuarioAperturaNombre ?? closure.responsableNombre, closure.usuarioAperturaEmail ?? closure.responsableEmail)}
                              {closure.estado === "cerrado"
                                ? ` | Cierra: ${getUserDisplayName(closure.usuarioCierreNombre, closure.usuarioCierreEmail)}`
                                : ""}
                            </p>
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

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Ingresos por concepto</CardTitle>
                    <CardDescription>Ventas directas, tratamientos, abonos e ingresos manuales del corte.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {cutIncomeByConcept.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        No hay ingresos registrados en este corte.
                      </div>
                    ) : (
                      cutIncomeByConcept.map((row) => (
                        <div key={row.concepto} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                          <div>
                            <p className="font-medium">{row.concepto}</p>
                            <p className="text-xs text-muted-foreground">{row.movimientos} movimientos</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {cashSummary.totalIngresos > 0 ? `${((row.total / cashSummary.totalIngresos) * 100).toFixed(1)}%` : "0%"}
                          </p>
                          <p className="font-semibold text-emerald-700">{formatCurrency(row.total)}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Gastos por categoria</CardTitle>
                    <CardDescription>Total de egresos del corte agrupados por categoria.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {cutExpensesByCategory.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        No hay gastos registrados en este corte.
                      </div>
                    ) : (
                      cutExpensesByCategory.map((row) => (
                        <div key={row.categoria} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                          <div>
                            <p className="font-medium">{row.categoria}</p>
                            <p className="text-xs text-muted-foreground">{row.movimientos} movimientos</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {cashSummary.totalEgresos > 0 ? `${((row.total / cashSummary.totalEgresos) * 100).toFixed(1)}%` : "0%"}
                          </p>
                          <p className="font-semibold text-destructive">{formatCurrency(row.total)}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

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
                          <TableHead>Usuario</TableHead>
                          <TableHead>Nota</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cashMovementsLoading ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                              Cargando movimientos de caja...
                            </TableCell>
                          </TableRow>
                        ) : displayedCashMovements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                              No hay movimientos de caja para esta fecha.
                            </TableCell>
                          </TableRow>
                        ) : (
                          cashMovementsPagination.paginatedItems.map((movement) => (
                            <TableRow key={movement.id}>
                              <TableCell>{formatDate(movement.fecha)}</TableCell>
                              <TableCell>
                                <Badge variant={movement.tipo === "ingreso" ? "default" : "destructive"}>
                                  {isOpeningCashMovement(movement) ? "Apertura" : cashMovementLabel[movement.tipo]}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                <div>{movement.concepto}</div>
                                {movement.tipo === "egreso" && (
                                  <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                                    <span>{getExpenseCategoryLabel(movement.categoriaGasto)}</span>
                                    {movement.comprobanteUrl && <span>Comprobante: {movement.comprobanteUrl}</span>}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{paymentMethodLabel[movement.metodo]}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{movement.referenciaTipo}</Badge>
                              </TableCell>
                              <TableCell>{getUserDisplayName(movement.usuarioNombre, movement.usuarioEmail)}</TableCell>
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
                {!cashMovementsLoading && displayedCashMovements.length > 0 && (
                  <DataPagination
                    itemLabel="movimientos"
                    page={cashMovementsPagination.page}
                    pageSize={cashMovementsPagination.pageSize}
                    totalItems={cashMovementsPagination.totalItems}
                    startIndex={cashMovementsPagination.startIndex}
                    endIndex={cashMovementsPagination.endIndex}
                    canPreviousPage={cashMovementsPagination.canPreviousPage}
                    canNextPage={cashMovementsPagination.canNextPage}
                    onPageSizeChange={cashMovementsPagination.setPageSize}
                    onPreviousPage={cashMovementsPagination.previousPage}
                    onNextPage={cashMovementsPagination.nextPage}
                  />
                )}
              </Card>
            </div>

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
                    disabled={Boolean(openCashClosure)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {openCashButtonLabel}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsCashMovementDialogOpen(true)} disabled={!hasOpenCashForSelectedDate}>
                    <ReceiptText className="mr-2 h-4 w-4" />
                    Movimiento de caja
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAutoCloseCashRegister}
                    disabled={!openCashClosure || isAutoClosingCash || isClosingCash || !cashShiftSettings.permitirCierreAutomatico}
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

        <TabsContent value="reportes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Reporte financiero
                  </CardTitle>
                  <CardDescription>
                    Balance por periodo con ingresos reales, gastos operativos y costo de productos vendidos.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" onClick={() => applyReportPreset("hoy")}>Hoy</Button>
                  <Button type="button" variant="outline" onClick={() => applyReportPreset("semana")}>7 dias</Button>
                  <Button type="button" variant="outline" onClick={() => applyReportPreset("mes")}>Mes</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input
                    type="date"
                    value={reportStartDate}
                    onChange={(event) => setReportStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Input
                    type="date"
                    value={reportEndDate}
                    onChange={(event) => setReportEndDate(event.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" onClick={handleExportFinancialReportCsv}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  CSV
                </Button>
                <Button type="button" onClick={handleExportFinancialReportPdf}>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Comparado contra el periodo anterior: {previousReportRange.start} a {previousReportRange.end}.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos</CardTitle>
                <CircleDollarSign className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(financialReport.ingresos)}</div>
                <p className="text-xs text-muted-foreground">{financialReport.periodCashMovements.length} movimientos</p>
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Utilidad bruta</CardTitle>
                <TrendingUp className="h-5 w-5 text-sky-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(financialReport.utilidadBruta)}</div>
                <p className="text-xs text-muted-foreground">Ingresos - costo vendido</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Utilidad neta</CardTitle>
                <ReceiptText className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(financialReport.utilidadNeta)}</div>
                <p className="text-xs text-muted-foreground">Margen {financialReport.margenNeto.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Comparativa</CardTitle>
                <CardDescription>Actual contra el periodo anterior del mismo tamano.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Ingresos vs anterior</p>
                  <p className="text-2xl font-bold">{formatVariation(financialReportExportData.variacionIngresos)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Antes: {formatCurrency(previousFinancialReport.ingresos)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Utilidad neta vs anterior</p>
                  <p className="text-2xl font-bold">{formatVariation(financialReportExportData.variacionUtilidad)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Antes: {formatCurrency(previousFinancialReport.utilidadNeta)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gastos por categoria</CardTitle>
                <CardDescription>Suministros, servicios y otros egresos del periodo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {financialReport.gastosPorCategoria.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No hay gastos registrados en este periodo.
                  </div>
                ) : (
                  financialReport.gastosPorCategoria.map((row) => (
                    <div key={row.categoria} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div>
                        <p className="font-medium">{row.categoria}</p>
                        <p className="text-xs text-muted-foreground">{row.movimientos} movimientos</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {financialReport.gastosOperativos > 0 ? `${((row.total / financialReport.gastosOperativos) * 100).toFixed(1)}%` : "0%"}
                      </p>
                      <p className="font-semibold text-destructive">{formatCurrency(row.total)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Ventas por producto</CardTitle>
              <CardDescription>Productos descontados de inventario por venta en el periodo seleccionado.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Unidades</TableHead>
                      <TableHead className="text-right">Ingreso</TableHead>
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
                        <TableRow key={row.producto}>
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
              <CardDescription>Base del reporte: cobros, ingresos manuales y gastos operativos.</CardDescription>
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
        </TabsContent>

        {canManageCashSettings && (
          <TabsContent value="configuracion" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      Configuracion de turnos
                    </CardTitle>
                    <CardDescription>
                      Define como se abre caja, que reglas aplican al cierre y que turnos puede seleccionar recepcion.
                    </CardDescription>
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
                  <button
                    type="button"
                    className={cn(
                      "rounded-lg border bg-background p-4 text-left transition-colors",
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
                    <p className="mt-2 text-sm text-muted-foreground">
                      Permite abrir caja sin escoger horario. Sirve para guardias, dias especiales o clinicas con una sola recepcion.
                    </p>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-lg border bg-background p-4 text-left transition-colors",
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
                    <p className="mt-2 text-sm text-muted-foreground">
                      Obliga a seleccionar Matutino, Vespertino u otro turno. Sirve para comparar ingresos y diferencias por responsable o horario.
                    </p>
                  </button>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <p className="font-semibold">Cierre a medianoche</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Independientemente del turno, si una caja queda abierta al cambiar de dia, el sistema la cierra automaticamente como corte vencido.
                    </p>
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

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Flujo separado</p>
              <p className="text-sm text-muted-foreground">
                Caja solo registra dinero real: cobros, ingresos, egresos, aperturas y cierres.
              </p>
            </div>
          </div>
          <Button variant="secondary">
            <WalletCards className="mr-2 h-4 w-4" />
            Pendientes de cobro
          </Button>
        </CardContent>
      </Card>

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

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-muted-foreground">
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

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nuevo cobro</DialogTitle>
            <DialogDescription>
              {hasOpenCashForSelectedDate
                ? `El cobro entrara a la caja abierta del ${formatDate(dateFilter)}.`
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

      <Dialog open={isCashMovementDialogOpen} onOpenChange={setIsCashMovementDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Movimiento de caja</DialogTitle>
            <DialogDescription>
              {hasOpenCashForSelectedDate
                ? "Registra ingresos o egresos manuales de la caja abierta."
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
            {cashMovementForm.tipo === "egreso" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Categoria de gasto</Label>
                  <Select
                    value={cashMovementForm.categoriaGasto}
                    onValueChange={(value) => setCashMovementForm({ ...cashMovementForm, categoriaGasto: value as CashExpenseCategory })}
                    disabled={isSavingCashMovement}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cashExpenseCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {cashExpenseCategoryLabel[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Comprobante opcional</Label>
                  <Input
                    value={cashMovementForm.comprobanteUrl}
                    onChange={(event) => setCashMovementForm({ ...cashMovementForm, comprobanteUrl: event.target.value })}
                    placeholder="URL, folio o referencia"
                    disabled={isSavingCashMovement}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nota</Label>
              <Textarea
                rows={3}
                value={cashMovementForm.nota}
                onChange={(event) => setCashMovementForm({ ...cashMovementForm, nota: event.target.value })}
                placeholder="Detalle opcional del movimiento"
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
