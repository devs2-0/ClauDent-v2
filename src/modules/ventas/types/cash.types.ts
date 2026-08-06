import type { Quotation } from "@/modules/quotations";

export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia";
export type PaymentOrigin = "cotizacion" | "venta_directa" | "abono";
export type PaymentStatus = "activo" | "cancelado";
export type PaymentIncomeType = "venta_productos" | "tratamiento" | "venta_mixta" | "abono" | "manual";
export type CashMovementType = "ingreso" | "egreso";
export type CashReferenceType = "apertura" | "pago" | "cotizacion" | "tratamiento" | "manual";
export type CashClosureStatus = "abierto" | "cerrado";
export type CashClosureMode = "manual" | "automatico";
export type CashExpenseCategory = "suministros" | "servicios" | "renta" | "nomina" | "mantenimiento" | "otros";
export type CashShiftMode = "manual" | "programado";

export interface CashUserStamp {
  usuarioId?: string | null;
  usuarioNombre?: string;
  usuarioEmail?: string;
}

export interface Payment extends CashUserStamp {
  id: string;
  corteId?: string | null;
  pacienteId?: string | null;
  pacienteNombre: string;
  citaId?: string | null;
  cotizacionId?: string | null;
  tratamientoId?: string | null;
  ventaId?: string | null;
  fecha: string;
  metodo: PaymentMethod;
  monto: number;
  concepto: string;
  origen: PaymentOrigin;
  tipoIngreso?: PaymentIncomeType;
  estado: PaymentStatus;
  notas?: string;
  costoProductos?: number;
}

export interface CashClosureTotals {
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  total: number;
}

export interface CashMethodBreakdown {
  metodo: PaymentMethod;
  ingresos: number;
  egresos: number;
  neto: number;
}

export interface CashCutSummary {
  totales: CashClosureTotals;
  totalIngresos: number;
  totalEgresos: number;
  balanceNeto: number;
  fondoInicial: number;
  efectivoFinal: number;
  desgloseMetodos: CashMethodBreakdown[];
}

export interface CashClosure {
  id: string;
  fecha: string;
  inicio: string;
  fin?: string | null;
  fondoInicial: number;
  totales: CashClosureTotals;
  totalEgresos: number;
  balanceNeto: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferenciaEfectivo: number;
  observaciones?: string;
  estado: CashClosureStatus;
  tipoCierre?: CashClosureMode | null;
  turnoId?: string | null;
  turnoNombre?: string;
  horaInicioProgramada?: string;
  horaFinProgramada?: string;
  responsableId?: string | null;
  responsableNombre?: string;
  responsableEmail?: string;
  usuarioAperturaId?: string | null;
  usuarioAperturaNombre?: string;
  usuarioAperturaEmail?: string;
  usuarioCierreId?: string | null;
  usuarioCierreNombre?: string;
  usuarioCierreEmail?: string;
}

export interface CashMovement extends CashUserStamp {
  id: string;
  corteId?: string | null;
  fecha: string;
  tipo: CashMovementType;
  metodo: PaymentMethod;
  concepto: string;
  monto: number;
  referenciaTipo: CashReferenceType;
  referenciaId?: string | null;
  citaId?: string | null;
  tratamientoId?: string | null;
  ventaId?: string | null;
  tipoIngreso?: PaymentIncomeType;
  nota?: string;
  categoriaGasto?: CashExpenseCategory | null;
  comprobanteUrl?: string;
  costoProductos?: number;
  estado: PaymentStatus;
}

export type CreatePaymentInput = Omit<Payment, "id" | "estado"> & {
  estado?: PaymentStatus;
};

export interface OpenCashRegisterInput {
  fecha: string;
  fondoInicial: number;
  observaciones?: string;
  turnoId?: string | null;
  turnoNombre?: string;
  horaInicioProgramada?: string;
  horaFinProgramada?: string;
}

export interface CloseCashRegisterInput {
  fecha: string;
  totales: CashClosureTotals;
  efectivoContado?: number;
  observaciones?: string;
  tipoCierre?: CashClosureMode;
}

export interface CreateCashMovementInput {
  fecha: string;
  tipo: CashMovementType;
  metodo: PaymentMethod;
  concepto: string;
  monto: number;
  citaId?: string | null;
  tratamientoId?: string | null;
  ventaId?: string | null;
  tipoIngreso?: PaymentIncomeType;
  nota?: string;
  categoriaGasto?: CashExpenseCategory | null;
  comprobanteUrl?: string;
  referenciaTipo?: CashReferenceType;
  referenciaId?: string | null;
}

export interface CheckoutInventoryItem {
  productoId: string;
  cantidad: number;
  motivo?: string;
}

export interface DirectSaleServiceItem {
  servicioId?: string | null;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface DirectSaleProductItem {
  productoId: string;
  nombre?: string;
  cantidad: number;
  precioUnitario: number;
}

export interface RegisterDirectSaleInput {
  fecha: string;
  pacienteId?: string | null;
  pacienteNombre: string;
  citaId?: string | null;
  metodo: PaymentMethod;
  servicios?: DirectSaleServiceItem[];
  productos?: DirectSaleProductItem[];
  descuento?: number;
  notas?: string;
}

export interface FinalizeQuotationCheckoutInput {
  quotation: Quotation;
  pacienteNombre: string;
  citaId?: string | null;
  metodo: PaymentMethod;
  fechaPago?: string;
  notas?: string;
  productosVendidos?: CheckoutInventoryItem[];
  materialesClinicos?: CheckoutInventoryItem[];
}

export interface CashShiftDefinition {
  id: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}

export interface CashShiftSettings {
  modo: CashShiftMode;
  permitirMultiplesCortesPorDia: boolean;
  permitirCierreAutomatico: boolean;
  fondoInicialRequerido: boolean;
  fondoInicialSugerido: number;
  toleranciaDiferencia: number;
  cierreObligatorio: boolean;
  turnos: CashShiftDefinition[];
  updatedAt?: any;
  updatedBy?: string | null;
  updatedByName?: string;
  updatedByEmail?: string;
}
