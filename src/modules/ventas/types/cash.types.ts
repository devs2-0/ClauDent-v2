import type { Quotation } from "@/modules/quotations";

export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia";
export type PaymentOrigin = "cotizacion" | "venta_directa" | "abono";
export type PaymentStatus = "activo" | "cancelado";
export type CashMovementType = "ingreso" | "egreso";
export type CashReferenceType = "apertura" | "pago" | "cotizacion" | "tratamiento" | "manual";
export type CashClosureStatus = "abierto" | "cerrado";
export type CashClosureMode = "manual" | "automatico";
export type CashExpenseCategory = "suministros" | "servicios" | "renta" | "nomina" | "mantenimiento" | "otros";

export interface CashUserStamp {
  usuarioId?: string | null;
  usuarioNombre?: string;
  usuarioEmail?: string;
}

export interface Payment extends CashUserStamp {
  id: string;
  pacienteId?: string | null;
  pacienteNombre: string;
  cotizacionId?: string | null;
  fecha: string;
  metodo: PaymentMethod;
  monto: number;
  concepto: string;
  origen: PaymentOrigin;
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
  metodo: PaymentMethod;
  servicios?: DirectSaleServiceItem[];
  productos?: DirectSaleProductItem[];
  descuento?: number;
  notas?: string;
}

export interface FinalizeQuotationCheckoutInput {
  quotation: Quotation;
  pacienteNombre: string;
  metodo: PaymentMethod;
  fechaPago?: string;
  notas?: string;
  productosVendidos?: CheckoutInventoryItem[];
  materialesClinicos?: CheckoutInventoryItem[];
}
