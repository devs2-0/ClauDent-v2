import type { PaymentMethod } from "./cash.types";

export type AccountsReceivableStatus = "pendiente" | "pagada" | "vencida" | "cancelada";

export interface AccountReceivable {
  id: string;
  pacienteId: string;
  pacienteNombre: string;
  citaId?: string | null;
  tratamientoId?: string | null;
  cotizacionId?: string | null;
  concepto: string;
  total: number;
  totalAbonado: number;
  saldoPendiente: number;
  estado: AccountsReceivableStatus;
  fechaCreacion: string;
  fechaVencimiento?: string | null;
  fechaUltimoAbono?: string | null;
  diasSinAbono: number;
  alertaDiasSinAbono: number;
  notas?: string;
  ultimoPagoId?: string | null;
}

export interface CreateAccountReceivableInput {
  pacienteId: string;
  pacienteNombre: string;
  concepto: string;
  total: number;
  fecha: string;
  abonoInicial?: number;
  metodo?: PaymentMethod;
  fechaVencimiento?: string | null;
  alertaDiasSinAbono?: number;
  notas?: string;
  notasAbono?: string;
  citaId?: string | null;
  tratamientoId?: string | null;
  cotizacionId?: string | null;
}

export interface RegisterInstallmentInput {
  cuentaPorCobrarId: string;
  monto: number;
  metodo: PaymentMethod;
  fecha: string;
  notas?: string;
}
