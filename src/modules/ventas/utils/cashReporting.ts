import type { InventoryMovement } from "@/modules/inventario/types/inventory.types";
import type { CashClosure, CashClosureTotals, CashCutSummary, CashExpenseCategory, CashMovement, Payment, PaymentMethod } from "../types/cash.types";
import type { FinancialReportExportData } from "../services/financialReportExport";
import { isDateInRange, uniqueById } from "./cashFilters";
import { roundCurrency } from "./discounts";
const paymentMethods: PaymentMethod[] = ["efectivo", "tarjeta", "transferencia"];
const cashExpenseCategoryLabel: Record<CashExpenseCategory, string> = {
  suministros: "Suministros",
  servicios: "Servicios",
  renta: "Renta",
  nomina: "Nomina",
  mantenimiento: "Mantenimiento",
  otros: "Otros",
};

export const getExpenseCategoryLabel = (category?: CashExpenseCategory | null) => {
  return category ? cashExpenseCategoryLabel[category] ?? "Otros" : "Sin categoria";
};


const emptyTotals: CashClosureTotals = {
  efectivo: 0,
  tarjeta: 0,
  transferencia: 0,
  total: 0,
};

export const createEmptyCashSummary = (): CashCutSummary => ({
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

export const isOpeningCashMovement = (movement: Pick<CashMovement, "concepto" | "referenciaTipo">) => {
  return movement.referenciaTipo === "apertura" || (movement.referenciaTipo === "manual" && /^apertura\s*(?:\/\s*fondo de caja|(?:de\s+)?caja)/i.test(movement.concepto));
};


export const buildCashSummary = (movements: CashMovement[]): CashCutSummary => {
  const summary = createEmptyCashSummary();
  let ingresosEfectivo = 0;
  let egresosEfectivo = 0;

  uniqueById(movements)
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

  summary.totalIngresos = roundCurrency(summary.totalIngresos);
  summary.totalEgresos = roundCurrency(summary.totalEgresos);
  summary.fondoInicial = roundCurrency(summary.fondoInicial);
  for (const method of paymentMethods) summary.totales[method] = roundCurrency(summary.totales[method]);
  summary.totales.total = summary.totalIngresos;
  summary.desgloseMetodos = summary.desgloseMetodos.map(row => ({ ...row, ingresos: roundCurrency(row.ingresos), egresos: roundCurrency(row.egresos), neto: roundCurrency(row.neto) }));
  summary.balanceNeto = roundCurrency(summary.totalIngresos - summary.totalEgresos);
  summary.efectivoFinal = roundCurrency(summary.fondoInicial + ingresosEfectivo - egresosEfectivo);
  return summary;
};

const getInventoryMovementCost = (movement: InventoryMovement) => {
  const storedCost = Number(movement.costoTotal) || 0;
  if (movement.costoTotal != null && Number.isFinite(Number(movement.costoTotal))) return storedCost;
  return Math.abs(Number(movement.cantidad) || 0) * (Number(movement.costoUnitario) || 0);
};

const getInventoryMovementIncome = (movement: InventoryMovement) => {
  const storedIncome = Number(movement.ingresoTotal) || 0;
  if (movement.ingresoTotal != null && Number.isFinite(Number(movement.ingresoTotal))) return storedIncome;
  return Math.abs(Number(movement.cantidad) || 0) * (Number(movement.precioUnitarioVenta) || 0);
};

export const buildFinancialReportSnapshot = (
  cashMovements: CashMovement[],
  inventoryMovements: InventoryMovement[],
  startDate: string,
  endDate: string,
  payments: Payment[] = [],
) => {
  const paymentById = new Map(payments.map(payment => [payment.id, payment]));
  const periodCashMovements = uniqueById(cashMovements).filter((movement) => {
    return movement.estado === "activo" && !isOpeningCashMovement(movement) && isDateInRange(movement.fecha, startDate, endDate);
  });
  const periodInventorySales = uniqueById(inventoryMovements).filter((movement) => {
    return movement.tipo === "venta" && isDateInRange(movement.fecha, startDate, endDate)
      && !(movement.referenciaTipo === "pago" && movement.referenciaId && paymentById.get(movement.referenciaId)?.estado === "cancelado");
  });

  const ingresos = periodCashMovements
    .filter((movement) => movement.tipo === "ingreso")
    .reduce((total, movement) => roundCurrency(total + (Number(movement.monto) || 0)), 0);
  const gastosOperativos = periodCashMovements
    .filter((movement) => movement.tipo === "egreso")
    .reduce((total, movement) => roundCurrency(total + (Number(movement.monto) || 0)), 0);
  const costoMercaderia = periodInventorySales.reduce((total, movement) => roundCurrency(total + getInventoryMovementCost(movement)), 0);
  const utilidadBruta = roundCurrency(ingresos - costoMercaderia);
  const utilidadNeta = roundCurrency(utilidadBruta - gastosOperativos);
  const margenNeto = ingresos > 0 ? (utilidadNeta / ingresos) * 100 : 0;

  const expenseCategoryMap = new Map<CashExpenseCategory | "sin_categoria", { movimientos: number; total: number }>();
  periodCashMovements
    .filter((movement) => movement.tipo === "egreso")
    .forEach((movement) => {
      const category = movement.categoriaGasto ?? "sin_categoria";
      const current = expenseCategoryMap.get(category) ?? { movimientos: 0, total: 0 };
      current.movimientos += 1;
      current.total = roundCurrency(current.total + (Number(movement.monto) || 0));
      expenseCategoryMap.set(category, current);
    });

  const productSalesMap = new Map<string, FinancialReportExportData["ventasPorProducto"][number]>();
  periodInventorySales.forEach((movement) => {
    const productName = movement.productoNombre || "Producto sin nombre";
    const productId = movement.productoId || productName;
    const current = productSalesMap.get(productId) ?? {
      productoId: productId,
      producto: productName,
      unidades: 0,
      ingreso: 0,
      costo: 0,
      utilidad: 0,
    };
    current.unidades += Math.abs(Number(movement.cantidad) || 0);
    const payment = movement.referenciaTipo === "pago" && movement.referenciaId ? paymentById.get(movement.referenciaId) : undefined;
    const subtotal = payment ? (Number(payment.subtotalServicios) || 0) + (Number(payment.subtotalProductos) || 0) : 0;
    const discountFactor = subtotal > 0 ? Math.max(0, 1 - (Number(payment?.descuento) || 0) / subtotal) : 1;
    current.ingreso = roundCurrency(current.ingreso + getInventoryMovementIncome(movement) * discountFactor);
    current.costo = roundCurrency(current.costo + getInventoryMovementCost(movement));
    current.utilidad = roundCurrency(current.ingreso - current.costo);
    productSalesMap.set(productId, current);
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


// Closed cuts keep the audited amounts saved at closing, even if their movement history is incomplete.
export const buildClosureSummary = (closure: CashClosure, movements: CashMovement[]): CashCutSummary => {
  const summary = buildCashSummary(movements);
  if (closure.estado === "abierto") return summary;
  return { ...summary, totales: closure.totales, totalIngresos: closure.totales.total,
    totalEgresos: closure.totalEgresos, balanceNeto: closure.balanceNeto,
    fondoInicial: closure.fondoInicial, efectivoFinal: closure.efectivoEsperado };
};
