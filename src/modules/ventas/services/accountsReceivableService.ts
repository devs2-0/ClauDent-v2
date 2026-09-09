import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { addAuditLog } from "@/modules/audit/services/auditService";
import { cleanData, safeDate } from "@/shared/utils/firestoreData";
import { getCurrentUserIdentity } from "@/shared/services/currentUserIdentity";
import type {
  AccountReceivable,
  CreateAccountReceivableInput,
  RegisterInstallmentInput,
} from "../types/accountsReceivable.types";

import type { PaymentMethod } from "../types/cash.types";

const COLLECTION = "cuentasPorCobrar";
const PAYMENTS_COLLECTION = "pagos";
const CASH_CLOSURES_COLLECTION = "cortesCaja";
const CASH_MOVEMENTS_COLLECTION = "cajaMovimientos";
const paymentMethods: PaymentMethod[] = ["efectivo", "tarjeta", "transferencia"];

const toFirestoreDate = (date: string) => new Date(`${date}T00:00:00`);

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const ensurePaymentMethod = (method?: PaymentMethod | null): PaymentMethod => {
  const value = method || "efectivo";
  if (!paymentMethods.includes(value)) {
    throw new Error("Metodo de pago invalido.");
  }
  return value;
};

const getOpenCashClosureForDate = async (date: string) => {
  const snapshot = await getDocs(query(
    collection(db, CASH_CLOSURES_COLLECTION),
    where("estado", "==", "abierto"),
    limit(1),
  ));

  if (snapshot.empty) {
    throw new Error("No hay caja abierta para registrar el abono.");
  }

  const openCash = snapshot.docs[0];
  const openCashDate = safeDate(openCash.data().fecha);
  if (openCashDate && openCashDate !== date) {
    throw new Error(`La caja abierta corresponde al ${openCashDate}.`);
  }

  return openCash;
};

const mapAccount = (id: string, data: any): AccountReceivable => ({
  id,
  pacienteId: data.pacienteId ?? "",
  pacienteNombre: data.pacienteNombre ?? "",
  citaId: data.citaId ?? null,
  tratamientoId: data.tratamientoId ?? null,
  cotizacionId: data.cotizacionId ?? null,
  concepto: data.concepto ?? "",
  total: Number(data.total) || 0,
  totalAbonado: Number(data.totalAbonado) || 0,
  saldoPendiente: Number(data.saldoPendiente) || 0,
  estado: data.estado ?? "pendiente",
  fechaCreacion: safeDate(data.fechaCreacion),
  fechaVencimiento: data.fechaVencimiento ? safeDate(data.fechaVencimiento) : null,
  fechaUltimoAbono: data.fechaUltimoAbono ? safeDate(data.fechaUltimoAbono) : null,
  diasSinAbono: Number(data.diasSinAbono) || 0,
  alertaDiasSinAbono: Number(data.alertaDiasSinAbono) || 15,
  notas: data.notas ?? "",
  ultimoPagoId: data.ultimoPagoId ?? null,
});

export const accountsReceivableService = {
  listenAllAccounts: (onChange: (accounts: AccountReceivable[]) => void) => {
    const accountsQuery = query(collection(db, COLLECTION), orderBy("fechaCreacion", "desc"));
    return onSnapshot(accountsQuery, (snapshot) => {
      onChange(snapshot.docs.map((accountDoc) => mapAccount(accountDoc.id, accountDoc.data())));
    });
  },

  listenPatientAccounts: (patientId: string, onChange: (accounts: AccountReceivable[]) => void, onError?: () => void) => {
    const accountsQuery = query(
      collection(db, COLLECTION),
      where("pacienteId", "==", patientId),
      orderBy("fechaCreacion", "desc"),
    );
    return onSnapshot(accountsQuery, (snapshot) => {
      onChange(snapshot.docs.map((accountDoc) => mapAccount(accountDoc.id, accountDoc.data())));
    }, onError);
  },

  createAccount: async (input: CreateAccountReceivableInput) => {
    const total = roundMoney(Number(input.total) || 0);
    const abonoInicial = roundMoney(Number(input.abonoInicial) || 0);

    if (!input.pacienteId || !input.pacienteNombre.trim() || !input.concepto.trim()) {
      throw new Error("Paciente y concepto son obligatorios.");
    }
    if (total <= 0) {
      throw new Error("El total debe ser mayor a cero.");
    }
    if (abonoInicial < 0 || abonoInicial > total) {
      throw new Error("El abono inicial no puede ser negativo ni mayor al total.");
    }

    const userStamp = await getCurrentUserIdentity();
    const openCash = abonoInicial > 0 ? await getOpenCashClosureForDate(input.fecha) : null;
    const method = ensurePaymentMethod(input.metodo);
    const accountRef = doc(collection(db, COLLECTION));
    const paymentRef = abonoInicial > 0 ? doc(collection(db, PAYMENTS_COLLECTION)) : null;
    const movementRef = abonoInicial > 0 ? doc(collection(db, CASH_MOVEMENTS_COLLECTION)) : null;
    const saldoPendiente = roundMoney(total - abonoInicial);
    const estado = saldoPendiente <= 0 ? "pagada" : "pendiente";

    await runTransaction(db, async (transaction) => {
      transaction.set(accountRef, cleanData({
        pacienteId: input.pacienteId,
        pacienteNombre: input.pacienteNombre.trim(),
        citaId: input.citaId ?? null,
        tratamientoId: input.tratamientoId ?? null,
        cotizacionId: input.cotizacionId ?? null,
        concepto: input.concepto.trim(),
        total,
        totalAbonado: abonoInicial,
        saldoPendiente,
        estado,
        fechaCreacion: toFirestoreDate(input.fecha),
        fechaVencimiento: input.fechaVencimiento ? toFirestoreDate(input.fechaVencimiento) : null,
        fechaUltimoAbono: abonoInicial > 0 ? toFirestoreDate(input.fecha) : null,
        diasSinAbono: 0,
        alertaDiasSinAbono: Number(input.alertaDiasSinAbono) || 15,
        notas: input.notas ?? "",
        ultimoPagoId: paymentRef?.id ?? null,
        createdAt: serverTimestamp(),
        createdBy: userStamp.usuarioId,
        createdByName: userStamp.usuarioNombre,
        createdByEmail: userStamp.usuarioEmail,
        updatedAt: serverTimestamp(),
        updatedBy: userStamp.usuarioId,
        updatedByName: userStamp.usuarioNombre,
        updatedByEmail: userStamp.usuarioEmail,
      }));

      if (abonoInicial > 0 && openCash && paymentRef && movementRef) {
        const concepto = `Abono inicial: ${input.concepto.trim()}`;
        transaction.set(paymentRef, cleanData({
          corteId: openCash.id,
          cuentaPorCobrarId: accountRef.id,
          pacienteId: input.pacienteId,
          pacienteNombre: input.pacienteNombre.trim(),
          citaId: input.citaId ?? null,
          cotizacionId: input.cotizacionId ?? null,
          tratamientoId: input.tratamientoId ?? null,
          ventaId: paymentRef.id,
          fecha: toFirestoreDate(input.fecha),
          metodo: method,
          monto: abonoInicial,
          concepto,
          origen: "abono",
          tipoIngreso: "abono",
          estado: "activo",
          notas: input.notasAbono ?? "Abono inicial",
          ...userStamp,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }));

        transaction.set(movementRef, cleanData({
          corteId: openCash.id,
          fecha: toFirestoreDate(input.fecha),
          tipo: "ingreso",
          metodo: method,
          concepto,
          monto: abonoInicial,
          referenciaTipo: "pago",
          referenciaId: paymentRef.id,
          cuentaPorCobrarId: accountRef.id,
          citaId: input.citaId ?? null,
          tratamientoId: input.tratamientoId ?? null,
          ventaId: paymentRef.id,
          tipoIngreso: "abono",
          nota: input.notasAbono ?? "Abono inicial",
          categoriaGasto: null,
          estado: "activo",
          ...userStamp,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }));
      }
    });

    await addAuditLog("CREATE", "cuentas_por_cobrar", `Cuenta creada: ${input.pacienteNombre} - ${input.concepto}`);
    return { cuentaPorCobrarId: accountRef.id, pagoId: paymentRef?.id ?? null };
  },

  registerInstallment: async (input: RegisterInstallmentInput) => {
    const amount = roundMoney(Number(input.monto) || 0);
    if (!input.cuentaPorCobrarId) {
      throw new Error("La cuenta por cobrar es obligatoria.");
    }
    if (amount <= 0) {
      throw new Error("El abono debe ser mayor a cero.");
    }

    const userStamp = await getCurrentUserIdentity();
    const openCash = await getOpenCashClosureForDate(input.fecha);
    const method = ensurePaymentMethod(input.metodo);
    const accountRef = doc(db, COLLECTION, input.cuentaPorCobrarId);
    const paymentRef = doc(collection(db, PAYMENTS_COLLECTION));
    const movementRef = doc(collection(db, CASH_MOVEMENTS_COLLECTION));

    await runTransaction(db, async (transaction) => {
      const accountSnap = await transaction.get(accountRef);
      if (!accountSnap.exists()) {
        throw new Error("La cuenta por cobrar no existe.");
      }

      const account = mapAccount(accountSnap.id, accountSnap.data());
      if (account.estado === "pagada" || account.estado === "cancelada") {
        throw new Error("La cuenta no acepta nuevos abonos.");
      }
      if (amount > account.saldoPendiente) {
        throw new Error("El abono no puede exceder el saldo pendiente.");
      }

      const nextTotalAbonado = roundMoney(account.totalAbonado + amount);
      const nextSaldo = Math.max(0, roundMoney(account.total - nextTotalAbonado));
      const nextState = nextSaldo <= 0 ? "pagada" : "pendiente";
      const concepto = `Abono: ${account.concepto}`;

      transaction.set(paymentRef, cleanData({
        corteId: openCash.id,
        cuentaPorCobrarId: account.id,
        pacienteId: account.pacienteId,
        pacienteNombre: account.pacienteNombre,
        citaId: account.citaId ?? null,
        cotizacionId: account.cotizacionId ?? null,
        tratamientoId: account.tratamientoId ?? null,
        ventaId: paymentRef.id,
        fecha: toFirestoreDate(input.fecha),
        metodo: method,
        monto: amount,
        concepto,
        origen: "abono",
        tipoIngreso: "abono",
        estado: "activo",
        notas: input.notas ?? "",
        ...userStamp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      transaction.set(movementRef, cleanData({
        corteId: openCash.id,
        fecha: toFirestoreDate(input.fecha),
        tipo: "ingreso",
        metodo: method,
        concepto,
        monto: amount,
        referenciaTipo: "pago",
        referenciaId: paymentRef.id,
        cuentaPorCobrarId: account.id,
        citaId: account.citaId ?? null,
        tratamientoId: account.tratamientoId ?? null,
        ventaId: paymentRef.id,
        tipoIngreso: "abono",
        nota: input.notas ?? "",
        categoriaGasto: null,
        estado: "activo",
        ...userStamp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      transaction.update(accountRef, cleanData({
        totalAbonado: nextTotalAbonado,
        saldoPendiente: nextSaldo,
        estado: nextState,
        fechaUltimoAbono: toFirestoreDate(input.fecha),
        ultimoPagoId: paymentRef.id,
        diasSinAbono: 0,
        updatedAt: serverTimestamp(),
        updatedBy: userStamp.usuarioId,
        updatedByName: userStamp.usuarioNombre,
        updatedByEmail: userStamp.usuarioEmail,
      }));
    });

    await addAuditLog("CREATE", "cuentas_por_cobrar", `Abono registrado: ${input.cuentaPorCobrarId}`);
    return { cuentaPorCobrarId: input.cuentaPorCobrarId, pagoId: paymentRef.id };
  },
};
