import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addAuditLog } from "@/modules/audit/services/auditService";
import {
  INVENTORY_MOVEMENTS_COLLECTION,
  INVENTORY_PRODUCTS_COLLECTION,
  resolveMovementQuantity,
} from "@/modules/inventario/services/inventoryService";
import { cleanData, safeDate } from "@/shared/utils/firestoreData";
import { getCurrentUserIdentity, type CurrentUserIdentity } from "@/shared/services/currentUserIdentity";
import type {
  CashClosure,
  CashClosureTotals,
  CashCutSummary,
  CashMovement,
  CashReferenceType,
  CancelPaymentInput,
  CloseCashRegisterInput,
  CreateCashMovementInput,
  CreatePaymentInput,
  FinalizeQuotationCheckoutInput,
  OpenCashRegisterInput,
  Payment,
  PaymentMethod,
  RegisterDirectSaleInput,
  RegisterDirectSaleWithReceivableResult,
} from "../types/cash.types";

const PAYMENTS_COLLECTION = "pagos";
const CASH_CLOSURES_COLLECTION = "cortesCaja";
const CASH_MOVEMENTS_COLLECTION = "cajaMovimientos";
const TREATMENTS_COLLECTION = "tratamientos";
const ACCOUNTS_RECEIVABLE_COLLECTION = "cuentasPorCobrar";

const paymentMethods: PaymentMethod[] = ["efectivo", "tarjeta", "transferencia"];

const ensurePaymentMethod = (method: PaymentMethod) => {
  if (!paymentMethods.includes(method)) {
    throw new Error("Metodo de pago invalido.");
  }
  return method;
};

const emptyTotals = (): CashClosureTotals => ({
  efectivo: 0,
  tarjeta: 0,
  transferencia: 0,
  total: 0,
});

const toFirestoreDate = (date: string) => new Date(`${date}T00:00:00`);

const todayLikeString = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().split("T")[0];
};

const formatInventoryProductName = (name: string, brand?: string) => {
  const cleanName = name.trim();
  const cleanBrand = brand?.trim();
  return cleanBrand ? `${cleanName} (${cleanBrand})` : cleanName;
};

const formatSignedQuantity = (quantity: number) => {
  return quantity > 0 ? `+${quantity}` : String(quantity);
};

const compactAuditItems = (items: string[]) => {
  if (items.length <= 4) return items.join("; ");
  return `${items.slice(0, 4).join("; ")}; +${items.length - 4} mas`;
};

const isReversibleInventoryMovement = (data: any) => {
  return ["venta", "uso_clinico"].includes(data.tipo) && Number(data.cantidad) < 0;
};

const safeOptionalDate = (timestamp: any): string | null => {
  if (!timestamp) return null;
  return safeDate(timestamp);
};

const normalizePaymentMethod = (method: any): PaymentMethod => {
  return paymentMethods.includes(method) ? method : "efectivo";
};

const normalizeMovementType = (type: any): CashMovement["tipo"] => {
  if (type === "gasto") return "egreso";
  return type === "egreso" ? "egreso" : "ingreso";
};

const isOpeningMovement = (movement: Pick<CashMovement, "concepto" | "referenciaTipo">) => {
  return movement.referenciaTipo === "apertura" || movement.concepto.toLowerCase().includes("apertura");
};

const mapPayment = (id: string, data: any): Payment => ({
  id,
  corteId: data.corteId ?? null,
  pacienteId: data.pacienteId ?? null,
  pacienteNombre: data.pacienteNombre ?? "",
  citaId: data.citaId ?? null,
  cotizacionId: data.cotizacionId ?? null,
  tratamientoId: data.tratamientoId ?? null,
  ventaId: data.ventaId ?? id,
  cuentaPorCobrarId: data.cuentaPorCobrarId ?? null,
  fecha: safeDate(data.fecha),
  metodo: normalizePaymentMethod(data.metodo),
  monto: Number(data.monto) || 0,
  concepto: data.concepto ?? "",
  origen: data.origen ?? "venta_directa",
  tipoIngreso: data.tipoIngreso ?? null,
  estado: data.estado ?? "activo",
  notas: data.notas ?? "",
  costoProductos: Number(data.costoProductos) || 0,
  totalVenta: Number(data.totalVenta) || 0,
  saldoPendiente: Number(data.saldoPendiente) || 0,
  estadoPago: data.estadoPago ?? undefined,
  subtotalServicios: Number(data.subtotalServicios) || 0,
  subtotalProductos: Number(data.subtotalProductos) || 0,
  descuento: Number(data.descuento) || 0,
  servicios: Array.isArray(data.servicios) ? data.servicios : [],
  productos: Array.isArray(data.productos) ? data.productos : [],
  motivoCancelacion: data.motivoCancelacion ?? "",
  canceladoAt: safeOptionalDate(data.canceladoAt),
  usuarioId: data.usuarioId ?? null,
  usuarioNombre: data.usuarioNombre ?? data.usuarioEmail ?? "Sistema",
  usuarioEmail: data.usuarioEmail ?? "",
});

const mapCashClosure = (id: string, data: any): CashClosure => {
  const totals = {
    efectivo: Number(data.totales?.efectivo) || 0,
    tarjeta: Number(data.totales?.tarjeta) || 0,
    transferencia: Number(data.totales?.transferencia) || 0,
    total: Number(data.totales?.total) || 0,
  };

  if (!totals.total) {
    totals.total = totals.efectivo + totals.tarjeta + totals.transferencia;
  }

  return {
    id,
    fecha: safeDate(data.fecha ?? data.inicio),
    inicio: safeDate(data.inicio ?? data.fecha),
    fin: safeOptionalDate(data.fin),
    fondoInicial: Number(data.fondoInicial ?? data.montoInicial) || 0,
    totales: totals,
    totalEgresos: Number(data.totalEgresos) || 0,
    balanceNeto: Number(data.balanceNeto ?? totals.total) || 0,
    efectivoEsperado: Number(data.efectivoEsperado) || 0,
    efectivoContado: Number(data.efectivoContado) || 0,
    diferenciaEfectivo: Number(data.diferenciaEfectivo) || 0,
    observaciones: data.observaciones ?? "",
    estado: data.estado ?? data.status ?? "cerrado",
    tipoCierre: data.tipoCierre ?? null,
    turnoId: data.turnoId ?? null,
    turnoNombre: data.turnoNombre ?? "",
    horaInicioProgramada: data.horaInicioProgramada ?? "",
    horaFinProgramada: data.horaFinProgramada ?? "",
    responsableId: data.responsableId ?? data.usuarioAperturaId ?? null,
    responsableNombre: data.responsableNombre ?? data.usuarioAperturaNombre ?? data.usuarioAperturaEmail ?? "Sistema",
    responsableEmail: data.responsableEmail ?? data.usuarioAperturaEmail ?? "",
    usuarioAperturaId: data.usuarioAperturaId ?? data.responsableId ?? null,
    usuarioAperturaNombre: data.usuarioAperturaNombre ?? data.responsableNombre ?? data.usuarioAperturaEmail ?? "Sistema",
    usuarioAperturaEmail: data.usuarioAperturaEmail ?? data.responsableEmail ?? "",
    usuarioCierreId: data.usuarioCierreId ?? null,
    usuarioCierreNombre: data.usuarioCierreNombre ?? data.usuarioCierreEmail ?? "",
    usuarioCierreEmail: data.usuarioCierreEmail ?? "",
  };
};

const mapCashMovement = (id: string, data: any): CashMovement => ({
  id,
  corteId: data.corteId ?? null,
  fecha: safeDate(data.fecha),
  tipo: normalizeMovementType(data.tipo),
  metodo: normalizePaymentMethod(data.metodo),
  concepto: data.concepto ?? "",
  monto: Number(data.monto) || 0,
  referenciaTipo: data.referenciaTipo ?? "manual",
  referenciaId: data.referenciaId ?? null,
  citaId: data.citaId ?? null,
  tratamientoId: data.tratamientoId ?? null,
  ventaId: data.ventaId ?? data.referenciaId ?? null,
  tipoIngreso: data.tipoIngreso ?? null,
  nota: data.nota ?? "",
  categoriaGasto: data.categoriaGasto ?? null,
  comprobanteUrl: data.comprobanteUrl ?? "",
  costoProductos: Number(data.costoProductos) || 0,
  estado: data.estado ?? "activo",
  motivoCancelacion: data.motivoCancelacion ?? "",
  canceladoAt: safeOptionalDate(data.canceladoAt),
  usuarioId: data.usuarioId ?? null,
  usuarioNombre: data.usuarioNombre ?? data.usuarioEmail ?? "Sistema",
  usuarioEmail: data.usuarioEmail ?? "",
});

const calculateCashCutSummary = (movements: CashMovement[]): CashCutSummary => {
  const totals = emptyTotals();
  const breakdownByMethod = new Map(
    paymentMethods.map((method) => [method, { metodo: method, ingresos: 0, egresos: 0, neto: 0 }]),
  );
  let totalIngresos = 0;
  let totalEgresos = 0;
  let fondoInicial = 0;
  let ingresosEfectivo = 0;
  let egresosEfectivo = 0;

  movements
    .filter((movement) => movement.estado === "activo")
    .forEach((movement) => {
      const amount = Number(movement.monto) || 0;

      if (isOpeningMovement(movement)) {
        if (movement.tipo === "ingreso") {
          fondoInicial += amount;
        }
        return;
      }

      const methodTotals = breakdownByMethod.get(movement.metodo);
      if (!methodTotals) return;

      if (movement.tipo === "ingreso") {
        totalIngresos += amount;
        totals[movement.metodo] += amount;
        totals.total += amount;
        methodTotals.ingresos += amount;
        methodTotals.neto += amount;
        if (movement.metodo === "efectivo") ingresosEfectivo += amount;
      } else {
        totalEgresos += amount;
        methodTotals.egresos += amount;
        methodTotals.neto -= amount;
        if (movement.metodo === "efectivo") egresosEfectivo += amount;
      }
    });

  return {
    totales: totals,
    totalIngresos,
    totalEgresos,
    balanceNeto: totalIngresos - totalEgresos,
    fondoInicial,
    efectivoFinal: fondoInicial + ingresosEfectivo - egresosEfectivo,
    desgloseMetodos: Array.from(breakdownByMethod.values()),
  };
};

const getOpenCashClosureSnapshot = async () => {
  const byEstado = await getDocs(query(collection(db, CASH_CLOSURES_COLLECTION), where("estado", "==", "abierto"), limit(1)));
  if (!byEstado.empty) return byEstado.docs[0];

  const byStatus = await getDocs(query(collection(db, CASH_CLOSURES_COLLECTION), where("status", "==", "abierto"), limit(1)));
  if (!byStatus.empty) return byStatus.docs[0];

  return null;
};

const getClosureDate = (closureSnapshot: Awaited<ReturnType<typeof getOpenCashClosureSnapshot>>) => {
  if (!closureSnapshot) return "";
  return mapCashClosure(closureSnapshot.id, closureSnapshot.data()).fecha;
};

const ensureDateMatchesOpenCash = (openCash: Awaited<ReturnType<typeof getOpenCashClosureSnapshot>>, movementDate: string) => {
  const openCashDate = getClosureDate(openCash);
  if (openCashDate && movementDate !== openCashDate) {
    throw new Error(`La caja abierta corresponde al ${openCashDate}. Cierra ese corte antes de registrar movimientos del ${movementDate}.`);
  }
};

const requireOpenCashClosureSnapshot = async () => {
  const openCash = await getOpenCashClosureSnapshot();
  if (!openCash) {
    throw new Error("La caja esta cerrada. Abre caja antes de registrar cobros o movimientos.");
  }
  return openCash;
};

const getActiveMovementsForClosure = async (closureId: string) => {
  const movementSnapshot = await getDocs(query(collection(db, CASH_MOVEMENTS_COLLECTION), where("corteId", "==", closureId)));
  return movementSnapshot.docs.map((movementDoc) => mapCashMovement(movementDoc.id, movementDoc.data()));
};

const createCashMovementPayload = ({
  corteId,
  fecha,
  tipo,
  metodo,
  concepto,
  monto,
  userStamp,
  referenciaTipo,
  referenciaId,
  citaId,
  tratamientoId,
  ventaId,
  tipoIngreso,
  nota,
  categoriaGasto,
  comprobanteUrl,
}: CreateCashMovementInput & { corteId: string | null; referenciaTipo: CashReferenceType; userStamp: CurrentUserIdentity }) => cleanData({
  corteId,
  fecha: toFirestoreDate(fecha),
  tipo,
  metodo,
  concepto,
  monto: Number(monto) || 0,
  referenciaTipo,
  referenciaId: referenciaId ?? null,
  citaId: citaId ?? null,
  tratamientoId: tratamientoId ?? null,
  ventaId: ventaId ?? referenciaId ?? null,
  tipoIngreso: tipoIngreso ?? null,
  nota: nota ?? "",
  categoriaGasto: tipo === "egreso" ? categoriaGasto ?? "otros" : null,
  comprobanteUrl: comprobanteUrl?.trim() ?? "",
  estado: "activo",
  ...userStamp,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const calculateDirectSaleSubtotal = (items: Array<{ cantidad: number; precioUnitario: number }>) => {
  return items.reduce((total, item) => total + (Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0), 0);
};

const buildDirectSaleConcept = (input: RegisterDirectSaleInput) => {
  const serviceNames = (input.servicios ?? []).map((item) => item.nombre).filter(Boolean);
  const productNames = (input.productos ?? []).map((item) => item.nombre).filter(Boolean);
  const names = [...serviceNames, ...productNames];

  if (names.length === 0) return "Venta directa";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} y ${names.length - 3} mas`;
};

export const cashService = {
  listenPatientPayments: (patientId: string, onChange: (payments: Payment[]) => void, onError: () => void) => {
    return onSnapshot(query(collection(db, PAYMENTS_COLLECTION), where("pacienteId", "==", patientId)), (snapshot) => {
      onChange(snapshot.docs.map((paymentDoc) => mapPayment(paymentDoc.id, paymentDoc.data())));
    }, onError);
  },
  listenPayments: (onChange: (payments: Payment[]) => void, onError?: () => void) => {
    const paymentsQuery = query(collection(db, PAYMENTS_COLLECTION), orderBy("fecha", "desc"));
    return onSnapshot(paymentsQuery, (snapshot) => {
      onChange(snapshot.docs.map((paymentDoc) => mapPayment(paymentDoc.id, paymentDoc.data())));
    }, onError);
  },

  listenCashClosures: (onChange: (closures: CashClosure[]) => void, onError?: () => void) => {
    const closuresQuery = query(collection(db, CASH_CLOSURES_COLLECTION), orderBy("fecha", "desc"));
    return onSnapshot(closuresQuery, (snapshot) => {
      onChange(snapshot.docs.map((closureDoc) => mapCashClosure(closureDoc.id, closureDoc.data())));
    }, onError);
  },

  listenCashMovements: (onChange: (movements: CashMovement[]) => void, onError?: () => void) => {
    const movementsQuery = query(collection(db, CASH_MOVEMENTS_COLLECTION), orderBy("fecha", "desc"));
    return onSnapshot(movementsQuery, (snapshot) => {
      onChange(snapshot.docs.map((movementDoc) => mapCashMovement(movementDoc.id, movementDoc.data())));
    }, onError);
  },

  openCashRegister: async (input: OpenCashRegisterInput) => {
    const currentDate = todayLikeString();
    if (input.fecha !== currentDate) {
      throw new Error("Solo se puede abrir caja para el dia actual.");
    }

    const existingOpenCash = await getOpenCashClosureSnapshot();
    if (existingOpenCash) {
      throw new Error("Ya existe una caja abierta. Cierra el corte actual antes de abrir otra.");
    }

    const batch = writeBatch(db);
    const closureRef = doc(collection(db, CASH_CLOSURES_COLLECTION));
    const movementRef = doc(collection(db, CASH_MOVEMENTS_COLLECTION));
    const fondoInicial = Number(input.fondoInicial) || 0;
    if (fondoInicial < 0) {
      throw new Error("El fondo inicial no puede ser negativo.");
    }
    const openingUser = await getCurrentUserIdentity();

    batch.set(closureRef, cleanData({
      fecha: toFirestoreDate(input.fecha),
      inicio: toFirestoreDate(input.fecha),
      fin: null,
      fondoInicial,
      totales: emptyTotals(),
      totalEgresos: 0,
      balanceNeto: 0,
      efectivoEsperado: fondoInicial,
      efectivoContado: 0,
      diferenciaEfectivo: 0,
      observaciones: input.observaciones ?? "",
      estado: "abierto",
      status: "abierto",
      turnoId: input.turnoId ?? null,
      turnoNombre: input.turnoNombre ?? "",
      horaInicioProgramada: input.horaInicioProgramada ?? "",
      horaFinProgramada: input.horaFinProgramada ?? "",
      responsableId: openingUser.usuarioId,
      responsableNombre: openingUser.usuarioNombre,
      responsableEmail: openingUser.usuarioEmail,
      usuarioAperturaId: openingUser.usuarioId,
      usuarioAperturaNombre: openingUser.usuarioNombre,
      usuarioAperturaEmail: openingUser.usuarioEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    batch.set(movementRef, createCashMovementPayload({
      corteId: closureRef.id,
      fecha: input.fecha,
      tipo: "ingreso",
      metodo: "efectivo",
      concepto: "Apertura / Fondo de Caja",
      monto: fondoInicial,
      referenciaTipo: "apertura",
      referenciaId: closureRef.id,
      userStamp: openingUser,
      nota: input.observaciones || "Fondo inicial",
    }));

    await batch.commit();
    await addAuditLog("CREATE", "caja", `Caja abierta: ${input.fecha}`);
    return closureRef.id;
  },

  createCashMovement: async (input: CreateCashMovementInput) => {
    const amount = Number(input.monto) || 0;
    const method = ensurePaymentMethod(input.metodo);
    if (amount <= 0) {
      throw new Error("El monto del movimiento debe ser mayor a cero.");
    }

    const openCash = await requireOpenCashClosureSnapshot();
    ensureDateMatchesOpenCash(openCash, input.fecha);

    if (input.tipo === "egreso" && method === "efectivo") {
      const movements = await getActiveMovementsForClosure(openCash.id);
      const summary = calculateCashCutSummary(movements);
      if (amount > summary.efectivoFinal) {
        throw new Error(`Fondos insuficientes. La caja tiene ${summary.efectivoFinal.toFixed(2)} disponibles en efectivo.`);
      }
    }

    const movementUser = await getCurrentUserIdentity();
    const movementRef = await addDoc(collection(db, CASH_MOVEMENTS_COLLECTION), createCashMovementPayload({
      ...input,
      metodo: method,
      corteId: openCash.id,
      referenciaTipo: input.referenciaTipo ?? "manual",
      userStamp: movementUser,
    }));

    await addAuditLog("CREATE", "caja", `Movimiento de caja: ${input.concepto}`);
    return movementRef.id;
  },

  createPayment: async (payment: CreatePaymentInput) => {
    const openCash = await requireOpenCashClosureSnapshot();
    ensureDateMatchesOpenCash(openCash, payment.fecha);

    const batch = writeBatch(db);
    const paymentRef = doc(collection(db, PAYMENTS_COLLECTION));
    const movementRef = doc(collection(db, CASH_MOVEMENTS_COLLECTION));
    const method = ensurePaymentMethod(payment.metodo);
    const paymentAmount = Number(payment.monto) || 0;
    if (paymentAmount <= 0) {
      throw new Error("El monto del pago debe ser mayor a cero.");
    }
    const paymentUser = await getCurrentUserIdentity();

    batch.set(paymentRef, cleanData({
      ...payment,
      corteId: openCash.id,
      fecha: toFirestoreDate(payment.fecha),
      metodo: method,
      monto: paymentAmount,
      estado: payment.estado ?? "activo",
      citaId: payment.citaId ?? null,
      tratamientoId: payment.tratamientoId ?? null,
      ventaId: payment.ventaId ?? paymentRef.id,
      tipoIngreso: payment.tipoIngreso ?? (payment.origen === "abono" ? "abono" : "manual"),
      ...paymentUser,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    batch.set(movementRef, createCashMovementPayload({
      corteId: openCash.id,
      fecha: payment.fecha,
      tipo: "ingreso",
      metodo: method,
      concepto: payment.concepto,
      monto: paymentAmount,
      referenciaTipo: payment.origen === "cotizacion" ? "cotizacion" : "pago",
      referenciaId: paymentRef.id,
      citaId: payment.citaId ?? null,
      tratamientoId: payment.tratamientoId ?? null,
      ventaId: payment.ventaId ?? paymentRef.id,
      tipoIngreso: payment.tipoIngreso ?? (payment.origen === "abono" ? "abono" : "manual"),
      userStamp: paymentUser,
      nota: payment.notas ?? "",
    }));

    await batch.commit();
    await addAuditLog("CREATE", "caja", `Pago registrado: ${payment.concepto}`);
    return paymentRef.id;
  },

  registerDirectSale: async (input: RegisterDirectSaleInput) => {
    const openCash = await requireOpenCashClosureSnapshot();
    ensureDateMatchesOpenCash(openCash, input.fecha);
    const method = ensurePaymentMethod(input.metodo);

    const servicios = (input.servicios ?? []).filter((item) => Number(item.cantidad) > 0);
    const productos = (input.productos ?? []).filter((item) => Number(item.cantidad) > 0);

    if (servicios.length === 0 && productos.length === 0) {
      throw new Error("Agrega al menos un tratamiento o producto a la venta.");
    }

    const pacienteNombre = input.pacienteNombre.trim() || (servicios.length === 0 ? "Venta mostrador" : "");
    if (!pacienteNombre) {
      throw new Error("Selecciona un paciente para registrar tratamientos.");
    }

    const subtotalServicios = calculateDirectSaleSubtotal(servicios);
    const subtotalProductos = calculateDirectSaleSubtotal(productos);
    const descuento = Math.max(0, Number(input.descuento) || 0);
    const total = subtotalServicios + subtotalProductos - descuento;
    const montoPagado = input.montoPagado === undefined
      ? total
      : Math.round((Number(input.montoPagado) || 0) * 100) / 100;
    const saldoPendiente = Math.max(0, Math.round((total - montoPagado) * 100) / 100);

    if (total <= 0) {
      throw new Error("El total de la venta debe ser mayor a cero.");
    }
    if (montoPagado <= 0 || montoPagado > total) {
      throw new Error("El monto pagado debe ser mayor a cero y no puede exceder el total.");
    }
    if (saldoPendiente > 0) {
      throw new Error("Las ventas con saldo pendiente deben registrarse con el flujo de abonos.");
    }

    const concepto = buildDirectSaleConcept({ ...input, servicios, productos });
    const movementUser = await getCurrentUserIdentity();

    const saleResult = await runTransaction(db, async (transaction) => {
      const inventoryProducts = [];

      for (const item of productos) {
        const productRef = doc(db, INVENTORY_PRODUCTS_COLLECTION, item.productoId);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) throw new Error("No se encontro un producto de inventario.");

        const data = productSnap.data();
        inventoryProducts.push({
          request: item,
          ref: productRef,
          id: productSnap.id,
          nombre: formatInventoryProductName(data.nombre ?? item.nombre ?? "", data.marca ?? ""),
          stock: Number(data.stock) || 0,
          costoUnitario: Number(data.costoUnitario) || 0,
          precioVenta: data.precioVenta === null || data.precioVenta === undefined ? 0 : Number(data.precioVenta) || 0,
        });
      }

      const costoProductos = inventoryProducts.reduce((totalCost, product) => {
        return totalCost + Math.abs(Number(product.request.cantidad) || 0) * product.costoUnitario;
      }, 0);

      const paymentRef = doc(collection(db, PAYMENTS_COLLECTION));
      const cashMovementRef = doc(collection(db, CASH_MOVEMENTS_COLLECTION));
      const treatmentRef = servicios.length > 0 ? doc(collection(db, TREATMENTS_COLLECTION)) : null;
      const patientHistoryRef =
        servicios.length > 0 && input.pacienteId
          ? doc(collection(db, "pacientes", input.pacienteId, "historial"))
          : null;
      const fecha = toFirestoreDate(input.fecha);

      transaction.set(paymentRef, cleanData({
        corteId: openCash.id,
        pacienteId: input.pacienteId ?? null,
        pacienteNombre,
        citaId: input.citaId ?? null,
        cotizacionId: null,
        tratamientoId: treatmentRef?.id ?? null,
        ventaId: paymentRef.id,
        fecha,
        metodo: method,
        monto: montoPagado,
        concepto,
        origen: "venta_directa",
        tipoIngreso: servicios.length > 0 && productos.length > 0 ? "venta_mixta" : servicios.length > 0 ? "tratamiento" : "venta_productos",
        estado: "activo",
        notas: input.notas ?? "",
        totalVenta: total,
        saldoPendiente,
        estadoPago: saldoPendiente > 0 ? "parcial" : "pagado",
        subtotalServicios,
        subtotalProductos,
        descuento,
        costoProductos,
        servicios,
        productos,
        ...movementUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      transaction.set(cashMovementRef, cleanData({
        corteId: openCash.id,
        fecha,
        tipo: "ingreso",
        metodo: method,
        concepto,
        monto: montoPagado,
        referenciaTipo: "pago",
        referenciaId: paymentRef.id,
        citaId: input.citaId ?? null,
        tratamientoId: treatmentRef?.id ?? null,
        ventaId: paymentRef.id,
        tipoIngreso: servicios.length > 0 && productos.length > 0 ? "venta_mixta" : servicios.length > 0 ? "tratamiento" : "venta_productos",
        nota: input.notas ?? "Venta directa",
        costoProductos,
        estado: "activo",
        ...movementUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      if (treatmentRef) {
        transaction.set(treatmentRef, cleanData({
          pacienteId: input.pacienteId ?? null,
          pacienteNombre,
          citaId: input.citaId ?? null,
          cotizacionId: null,
          pagoId: paymentRef.id,
          ventaId: paymentRef.id,
          fecha,
          items: servicios,
          total: subtotalServicios,
          montoPagado,
          saldoPendiente,
          estadoPago: saldoPendiente > 0 ? "parcial" : "pagado",
          notas: input.notas ?? "",
          createdAt: serverTimestamp(),
        }));
      }

      if (patientHistoryRef) {
        transaction.set(patientHistoryRef, cleanData({
          fecha,
          servicios: servicios
            .filter((item) => item.servicioId)
            .map((item) => ({ servicioId: item.servicioId, cantidad: item.cantidad })),
          notas: input.notas || `Venta directa: ${servicios.map((item) => item.nombre).join(", ")}`,
          total: subtotalServicios,
          montoPagado,
          saldoPendiente,
          estadoPago: saldoPendiente > 0 ? "parcial" : "pagado",
          pagoId: paymentRef.id,
          citaId: input.citaId ?? null,
          tratamientoId: treatmentRef?.id ?? null,
          ventaId: paymentRef.id,
        }));
      }

      const inventoryAuditItems: string[] = [];

      inventoryProducts.forEach((product) => {
        const quantity = resolveMovementQuantity("venta", product.request.cantidad);
        const nextStock = product.stock + quantity;
        const absoluteQuantity = Math.abs(quantity);
        const precioUnitarioVenta = Number(product.request.precioUnitario) || product.precioVenta || 0;
        const costoTotal = absoluteQuantity * product.costoUnitario;
        const ingresoTotal = absoluteQuantity * precioUnitarioVenta;

        if (nextStock < 0) {
          throw new Error(`No hay stock suficiente para ${product.nombre}.`);
        }

        const movementRef = doc(collection(db, INVENTORY_MOVEMENTS_COLLECTION));
        transaction.update(product.ref, {
          stock: nextStock,
          updatedAt: serverTimestamp(),
        });
        transaction.set(movementRef, cleanData({
          productoId: product.id,
          productoNombre: product.nombre,
          fecha,
          tipo: "venta",
          cantidad: quantity,
          stockAnterior: product.stock,
          stockNuevo: nextStock,
          motivo: `Venta directa: ${product.nombre}`,
          referenciaTipo: "pago",
          referenciaId: paymentRef.id,
          costoUnitario: product.costoUnitario,
          costoTotal,
          precioUnitarioVenta,
          ingresoTotal,
          ...movementUser,
          createdAt: serverTimestamp(),
        }));

        inventoryAuditItems.push(`${product.nombre} ${formatSignedQuantity(quantity)} (${product.stock} -> ${nextStock})`);
      });

      return {
        paymentId: paymentRef.id,
        inventoryAuditDetail: inventoryAuditItems.length
          ? `Venta directa | ${compactAuditItems(inventoryAuditItems)}`
          : "",
      };
    });

    await addAuditLog("CREATE", "ventas", `Venta directa: ${concepto}`);
    if (saleResult.inventoryAuditDetail) {
      await addAuditLog("UPDATE", "inventario", saleResult.inventoryAuditDetail);
    }
    return saleResult.paymentId;
  },

  registerDirectSaleWithReceivable: async (input: RegisterDirectSaleInput): Promise<RegisterDirectSaleWithReceivableResult> => {
    const openCash = await requireOpenCashClosureSnapshot();
    ensureDateMatchesOpenCash(openCash, input.fecha);
    const method = ensurePaymentMethod(input.metodo);

    const servicios = (input.servicios ?? []).filter((item) => Number(item.cantidad) > 0);
    const productos = (input.productos ?? []).filter((item) => Number(item.cantidad) > 0);
    const subtotalServicios = calculateDirectSaleSubtotal(servicios);
    const subtotalProductos = calculateDirectSaleSubtotal(productos);
    const descuento = Math.max(0, Number(input.descuento) || 0);
    const total = Math.round((subtotalServicios + subtotalProductos - descuento) * 100) / 100;
    const montoPagado = Math.round((Number(input.montoPagado) || 0) * 100) / 100;
    const saldoPendiente = Math.max(0, Math.round((total - montoPagado) * 100) / 100);

    if (!input.pacienteId || !input.pacienteNombre.trim()) {
      throw new Error("Selecciona un paciente para registrar abonos.");
    }
    if (servicios.length === 0) {
      throw new Error("Los abonos requieren al menos un tratamiento.");
    }
    if (total <= 0) {
      throw new Error("El total de la venta debe ser mayor a cero.");
    }
    if (montoPagado <= 0 || montoPagado >= total) {
      throw new Error("El abono debe ser mayor a cero y menor al total.");
    }
    if (subtotalProductos > 0 && montoPagado < Math.min(subtotalProductos, total)) {
      throw new Error("El abono debe cubrir al menos los productos vendidos.");
    }

    const concepto = buildDirectSaleConcept({ ...input, servicios, productos });
    const movementUser = await getCurrentUserIdentity();

    const saleResult = await runTransaction(db, async (transaction) => {
      const inventoryProducts = [];

      for (const item of productos) {
        const productRef = doc(db, INVENTORY_PRODUCTS_COLLECTION, item.productoId);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) throw new Error("No se encontro un producto de inventario.");

        const data = productSnap.data();
        inventoryProducts.push({
          request: item,
          ref: productRef,
          id: productSnap.id,
          nombre: formatInventoryProductName(data.nombre ?? item.nombre ?? "", data.marca ?? ""),
          stock: Number(data.stock) || 0,
          costoUnitario: Number(data.costoUnitario) || 0,
          precioVenta: data.precioVenta === null || data.precioVenta === undefined ? 0 : Number(data.precioVenta) || 0,
        });
      }

      const paymentRef = doc(collection(db, PAYMENTS_COLLECTION));
      const cashMovementRef = doc(collection(db, CASH_MOVEMENTS_COLLECTION));
      const treatmentRef = doc(collection(db, TREATMENTS_COLLECTION));
      const patientHistoryRef = doc(collection(db, "pacientes", input.pacienteId!, "historial"));
      const accountRef = doc(collection(db, ACCOUNTS_RECEIVABLE_COLLECTION));
      const fecha = toFirestoreDate(input.fecha);
      const paymentConcept = `Abono inicial: ${concepto}`;

      transaction.set(accountRef, cleanData({
        pacienteId: input.pacienteId,
        pacienteNombre: input.pacienteNombre.trim(),
        citaId: input.citaId ?? null,
        tratamientoId: treatmentRef.id,
        cotizacionId: null,
        concepto: `Saldo pendiente: ${servicios.map((item) => item.nombre).join(", ")}`,
        total,
        totalAbonado: montoPagado,
        saldoPendiente,
        estado: "pendiente",
        fechaCreacion: fecha,
        fechaVencimiento: null,
        fechaUltimoAbono: fecha,
        diasSinAbono: 0,
        alertaDiasSinAbono: 15,
        notas: input.notas ?? "",
        ultimoPagoId: paymentRef.id,
        createdAt: serverTimestamp(),
        createdBy: movementUser.usuarioId,
        createdByName: movementUser.usuarioNombre,
        createdByEmail: movementUser.usuarioEmail,
        updatedAt: serverTimestamp(),
        updatedBy: movementUser.usuarioId,
        updatedByName: movementUser.usuarioNombre,
        updatedByEmail: movementUser.usuarioEmail,
      }));

      transaction.set(paymentRef, cleanData({
        corteId: openCash.id,
        cuentaPorCobrarId: accountRef.id,
        pacienteId: input.pacienteId,
        pacienteNombre: input.pacienteNombre.trim(),
        citaId: input.citaId ?? null,
        cotizacionId: null,
        tratamientoId: treatmentRef.id,
        ventaId: paymentRef.id,
        fecha,
        metodo: method,
        monto: montoPagado,
        concepto: paymentConcept,
        origen: "abono",
        tipoIngreso: "abono",
        estado: "activo",
        notas: input.notas ?? `Saldo pendiente: ${saldoPendiente.toFixed(2)}`,
        totalVenta: total,
        saldoPendiente,
        estadoPago: "parcial",
        subtotalServicios,
        subtotalProductos,
        descuento,
        servicios,
        productos,
        ...movementUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      transaction.set(cashMovementRef, cleanData({
        corteId: openCash.id,
        fecha,
        tipo: "ingreso",
        metodo: method,
        concepto: paymentConcept,
        monto: montoPagado,
        referenciaTipo: "pago",
        referenciaId: paymentRef.id,
        cuentaPorCobrarId: accountRef.id,
        citaId: input.citaId ?? null,
        tratamientoId: treatmentRef.id,
        ventaId: paymentRef.id,
        tipoIngreso: "abono",
        nota: input.notas ?? "",
        categoriaGasto: null,
        estado: "activo",
        ...movementUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      transaction.set(treatmentRef, cleanData({
        pacienteId: input.pacienteId,
        pacienteNombre: input.pacienteNombre.trim(),
        citaId: input.citaId ?? null,
        cotizacionId: null,
        pagoId: paymentRef.id,
        cuentaPorCobrarId: accountRef.id,
        ventaId: paymentRef.id,
        fecha,
        items: servicios,
        total: subtotalServicios,
        montoPagado,
        saldoPendiente,
        estadoPago: "parcial",
        notas: input.notas ?? "",
        ...movementUser,
        createdAt: serverTimestamp(),
      }));

      transaction.set(patientHistoryRef, cleanData({
        fecha,
        servicios: servicios
          .filter((item) => item.servicioId)
          .map((item) => ({ servicioId: item.servicioId, cantidad: item.cantidad })),
        notas: input.notas || `Venta con abono: ${servicios.map((item) => item.nombre).join(", ")}`,
        total: subtotalServicios,
        montoPagado,
        saldoPendiente,
        estadoPago: "parcial",
        pagoId: paymentRef.id,
        cuentaPorCobrarId: accountRef.id,
        citaId: input.citaId ?? null,
        tratamientoId: treatmentRef.id,
        ventaId: paymentRef.id,
      }));

      const inventoryAuditItems: string[] = [];

      inventoryProducts.forEach((product) => {
        const quantity = resolveMovementQuantity("venta", product.request.cantidad);
        const nextStock = product.stock + quantity;
        const absoluteQuantity = Math.abs(quantity);
        const precioUnitarioVenta = Number(product.request.precioUnitario) || product.precioVenta || 0;

        if (nextStock < 0) {
          throw new Error(`No hay stock suficiente para ${product.nombre}.`);
        }

        const movementRef = doc(collection(db, INVENTORY_MOVEMENTS_COLLECTION));
        transaction.update(product.ref, {
          stock: nextStock,
          updatedAt: serverTimestamp(),
        });
        transaction.set(movementRef, cleanData({
          productoId: product.id,
          productoNombre: product.nombre,
          fecha,
          tipo: "venta",
          cantidad: quantity,
          stockAnterior: product.stock,
          stockNuevo: nextStock,
          motivo: `Venta con abono: ${concepto}`,
          referenciaTipo: "pago",
          referenciaId: paymentRef.id,
          costoUnitario: product.costoUnitario,
          costoTotal: absoluteQuantity * product.costoUnitario,
          precioUnitarioVenta,
          ingresoTotal: absoluteQuantity * precioUnitarioVenta,
          ...movementUser,
          createdAt: serverTimestamp(),
        }));

        inventoryAuditItems.push(`${product.nombre} ${formatSignedQuantity(quantity)} (${product.stock} -> ${nextStock})`);
      });

      return {
        pagoId: paymentRef.id,
        cuentaPorCobrarId: accountRef.id,
        tratamientoId: treatmentRef.id,
        saldoPendiente,
        inventoryAuditDetail: inventoryAuditItems.length
          ? `Venta con abono | ${compactAuditItems(inventoryAuditItems)}`
          : "",
      };
    });

    await addAuditLog("CREATE", "ventas", `Venta con abono: ${input.pacienteNombre} - ${concepto}`);
    await addAuditLog("CREATE", "cuentas_por_cobrar", `Saldo pendiente creado: ${input.pacienteNombre} - ${saldoPendiente.toFixed(2)}`);
    if (saleResult.inventoryAuditDetail) {
      await addAuditLog("UPDATE", "inventario", saleResult.inventoryAuditDetail);
    }
    return {
      pagoId: saleResult.pagoId,
      cuentaPorCobrarId: saleResult.cuentaPorCobrarId,
      tratamientoId: saleResult.tratamientoId,
      saldoPendiente: saleResult.saldoPendiente,
    };
  },

  cancelPayment: async ({ id, motivo }: CancelPaymentInput) => {
    const cancelReason = motivo.trim() || "Sin motivo especificado";
    if (cancelReason.length > 300) {
      throw new Error("El motivo de cancelacion no puede exceder 300 caracteres.");
    }

    const cancelUser = await getCurrentUserIdentity();
    const paymentRef = doc(db, PAYMENTS_COLLECTION, id);
    const paymentBeforeSnap = await getDoc(paymentRef);
    if (!paymentBeforeSnap.exists()) {
      throw new Error("El pago no existe.");
    }
    const paymentBefore = mapPayment(paymentBeforeSnap.id, paymentBeforeSnap.data());
    const movementSnapshot = await getDocs(query(
      collection(db, CASH_MOVEMENTS_COLLECTION),
      where("referenciaId", "==", id),
      limit(10),
    ));
    const inventoryByPaymentSnapshot = await getDocs(query(
      collection(db, INVENTORY_MOVEMENTS_COLLECTION),
      where("referenciaId", "==", id),
      limit(50),
    ));
    const inventoryByTreatmentSnapshot = paymentBefore.tratamientoId
      ? await getDocs(query(
        collection(db, INVENTORY_MOVEMENTS_COLLECTION),
        where("referenciaId", "==", paymentBefore.tratamientoId),
        limit(50),
      ))
      : null;
    const inventoryMovementDocs = [
      ...inventoryByPaymentSnapshot.docs,
      ...(inventoryByTreatmentSnapshot?.docs ?? []),
    ].filter((movementDoc, index, allDocs) => {
      const data = movementDoc.data();
      return isReversibleInventoryMovement(data)
        && allDocs.findIndex((candidate) => candidate.id === movementDoc.id) === index;
    });

    await runTransaction(db, async (transaction) => {
      const paymentSnap = await transaction.get(paymentRef);
      if (!paymentSnap.exists()) {
        throw new Error("El pago no existe.");
      }

      const payment = mapPayment(paymentSnap.id, paymentSnap.data());
      if (payment.estado === "cancelado") {
        throw new Error("Este pago ya fue cancelado.");
      }
      if (!payment.corteId) {
        throw new Error("El pago no tiene corte de caja vinculado.");
      }

      const cashCutRef = doc(db, CASH_CLOSURES_COLLECTION, payment.corteId);
      const cashCutSnap = await transaction.get(cashCutRef);
      if (!cashCutSnap.exists() || cashCutSnap.data().estado !== "abierto") {
        throw new Error("No se puede cancelar un pago de un corte cerrado.");
      }

      let receivableUpdate: {
        ref: ReturnType<typeof doc>;
        totalAbonado: number;
        saldoPendiente: number;
        estado: "pendiente" | "pagada";
      } | null = null;
      if (payment.cuentaPorCobrarId) {
        const accountRef = doc(db, ACCOUNTS_RECEIVABLE_COLLECTION, payment.cuentaPorCobrarId);
        const accountSnap = await transaction.get(accountRef);
        if (!accountSnap.exists()) {
          throw new Error("La cuenta por cobrar vinculada no existe.");
        }

        const account = accountSnap.data();
        if (account.ultimoPagoId !== payment.id) {
          throw new Error("Solo se puede cancelar el ultimo abono de una cuenta por cobrar.");
        }

        const total = Math.round((Number(account.total) || 0) * 100) / 100;
        const currentPaid = Math.round((Number(account.totalAbonado) || 0) * 100) / 100;
        const nextPaid = Math.max(0, Math.round((currentPaid - payment.monto) * 100) / 100);
        const nextBalance = Math.max(0, Math.round((total - nextPaid) * 100) / 100);

        receivableUpdate = {
          ref: accountRef,
          totalAbonado: nextPaid,
          saldoPendiente: nextBalance,
          estado: nextBalance <= 0 ? "pagada" : "pendiente",
        };
      }

      const cashMovementUpdates = [];
      for (const movementDoc of movementSnapshot.docs) {
        const movementSnap = await transaction.get(movementDoc.ref);
        if (movementSnap.exists() && movementSnap.data().estado !== "cancelado") {
          cashMovementUpdates.push(movementDoc.ref);
        }
      }

      const inventoryReversals = [];
      for (const movementDoc of inventoryMovementDocs) {
        const movementSnap = await transaction.get(movementDoc.ref);
        if (!movementSnap.exists()) continue;

        const originalMovement = movementSnap.data();
        if (!isReversibleInventoryMovement(originalMovement)) continue;

        const productRef = doc(db, INVENTORY_PRODUCTS_COLLECTION, originalMovement.productoId);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) {
          throw new Error("No se encontro un producto para revertir inventario.");
        }
        inventoryReversals.push({
          originalMovement,
          productRef,
          productData: productSnap.data(),
        });
      }

      transaction.update(paymentRef, cleanData({
        estado: "cancelado",
        motivoCancelacion: cancelReason,
        canceladoAt: serverTimestamp(),
        usuarioCancelacionId: cancelUser.usuarioId,
        usuarioCancelacionNombre: cancelUser.usuarioNombre,
        usuarioCancelacionEmail: cancelUser.usuarioEmail,
        updatedAt: serverTimestamp(),
      }));

      cashMovementUpdates.forEach((movementRef) => {
        transaction.update(movementRef, cleanData({
          estado: "cancelado",
          motivoCancelacion: cancelReason,
          canceladoAt: serverTimestamp(),
          usuarioCancelacionId: cancelUser.usuarioId,
          usuarioCancelacionNombre: cancelUser.usuarioNombre,
          usuarioCancelacionEmail: cancelUser.usuarioEmail,
          updatedAt: serverTimestamp(),
        }));
      });

      inventoryReversals.forEach(({ originalMovement, productRef, productData }) => {
        const currentStock = Number(productData.stock) || 0;
        const returnedQuantity = Math.abs(Number(originalMovement.cantidad) || 0);
        const nextStock = currentStock + returnedQuantity;
        const reversalRef = doc(collection(db, INVENTORY_MOVEMENTS_COLLECTION));

        transaction.update(productRef, {
          stock: nextStock,
          updatedAt: serverTimestamp(),
        });
        transaction.set(reversalRef, cleanData({
          productoId: originalMovement.productoId,
          productoNombre: originalMovement.productoNombre ?? productData.nombre ?? "Producto",
          fecha: new Date(),
          tipo: "devolucion",
          cantidad: returnedQuantity,
          stockAnterior: currentStock,
          stockNuevo: nextStock,
          motivo: `Cancelacion de venta/pago ${id}: ${cancelReason}`,
          referenciaTipo: "pago",
          referenciaId: id,
          citaId: originalMovement.citaId ?? null,
          lote: originalMovement.lote ?? "",
          fechaVencimiento: originalMovement.fechaVencimiento ?? null,
          proveedor: originalMovement.proveedor ?? "",
          documentoCompra: originalMovement.documentoCompra ?? "",
          costoUnitario: Number(originalMovement.costoUnitario) || 0,
          costoTotal: returnedQuantity * (Number(originalMovement.costoUnitario) || 0),
          precioUnitarioVenta: 0,
          ingresoTotal: 0,
          ...cancelUser,
          createdAt: serverTimestamp(),
        }));
      });

      if (receivableUpdate) {
        transaction.update(receivableUpdate.ref, cleanData({
          totalAbonado: receivableUpdate.totalAbonado,
          saldoPendiente: receivableUpdate.saldoPendiente,
          estado: receivableUpdate.estado,
          ultimoPagoId: null,
          diasSinAbono: 0,
          updatedAt: serverTimestamp(),
          updatedBy: cancelUser.usuarioId,
          updatedByName: cancelUser.usuarioNombre,
          updatedByEmail: cancelUser.usuarioEmail,
        }));
      }
    });

    await addAuditLog("UPDATE", "caja", `Pago cancelado: ${id} | Motivo: ${cancelReason}`);
    if (inventoryMovementDocs.length > 0) {
      await addAuditLog("UPDATE", "inventario", `Reversa por cancelacion: ${inventoryMovementDocs.length} movimiento(s) | Pago: ${id}`);
    }
  },

  closeCashRegister: async (input: CloseCashRegisterInput) => {
    const openCash = await requireOpenCashClosureSnapshot();
    const openCashDate = getClosureDate(openCash) || input.fecha;
    const movements = await getActiveMovementsForClosure(openCash.id);
    const summary = calculateCashCutSummary(movements);
    const tipoCierre = input.tipoCierre ?? "manual";
    const efectivoContado = tipoCierre === "automatico" ? summary.efectivoFinal : Number(input.efectivoContado) || 0;
    if (efectivoContado < 0) {
      throw new Error("El efectivo contado no puede ser negativo.");
    }
    const diferenciaEfectivo = efectivoContado - summary.efectivoFinal;
    const closingUser = await getCurrentUserIdentity();

    await updateDoc(doc(db, CASH_CLOSURES_COLLECTION, openCash.id), cleanData({
      fecha: toFirestoreDate(openCashDate),
      fin: new Date(),
      fondoInicial: summary.fondoInicial,
      totales: summary.totales,
      totalEgresos: summary.totalEgresos,
      balanceNeto: summary.balanceNeto,
      efectivoEsperado: summary.efectivoFinal,
      efectivoContado,
      diferenciaEfectivo,
      observaciones: input.observaciones ?? "",
      estado: "cerrado",
      status: "cerrado",
      tipoCierre,
      usuarioCierreId: closingUser.usuarioId,
      usuarioCierreNombre: closingUser.usuarioNombre,
      usuarioCierreEmail: closingUser.usuarioEmail,
      updatedAt: serverTimestamp(),
    }));

    await addAuditLog("UPDATE", "caja", `Corte cerrado: ${openCashDate} (${tipoCierre})`);
    return openCash.id;
  },

  autoCloseCashRegister: async (observaciones?: string) => {
    return cashService.closeCashRegister({
      fecha: todayLikeString(),
      totales: emptyTotals(),
      tipoCierre: "automatico",
      observaciones: observaciones ?? "Cierre automatico con efectivo esperado",
    });
  },

  finalizeQuotationCheckout: async (input: FinalizeQuotationCheckoutInput) => {
    const openCash = await requireOpenCashClosureSnapshot();
    const openCashDate = getClosureDate(openCash);
    const paymentDate = input.fechaPago ?? openCashDate;
    ensureDateMatchesOpenCash(openCash, paymentDate);
    const method = ensurePaymentMethod(input.metodo);
    const movementUser = await getCurrentUserIdentity();

    const checkoutResult = await runTransaction(db, async (transaction) => {
      const inventoryRequests = [
        ...(input.productosVendidos ?? []).map((item) => ({ ...item, tipo: "venta" as const })),
        ...(input.materialesClinicos ?? []).map((item) => ({ ...item, tipo: "uso_clinico" as const })),
      ];

      const inventoryProducts = await Promise.all(inventoryRequests.map(async (item) => {
        const productRef = doc(db, INVENTORY_PRODUCTS_COLLECTION, item.productoId);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) throw new Error("No se encontro un producto de inventario.");
        const data = productSnap.data();
        return {
          request: item,
          ref: productRef,
          id: productSnap.id,
          nombre: formatInventoryProductName(data.nombre ?? "", data.marca ?? ""),
          stock: Number(data.stock) || 0,
          costoUnitario: Number(data.costoUnitario) || 0,
          precioVenta: data.precioVenta === null || data.precioVenta === undefined ? 0 : Number(data.precioVenta) || 0,
        };
      }));

      const paymentRef = doc(collection(db, PAYMENTS_COLLECTION));
      const cashMovementRef = doc(collection(db, CASH_MOVEMENTS_COLLECTION));
      const treatmentRef = doc(collection(db, TREATMENTS_COLLECTION));
      const patientHistoryRef = doc(collection(db, "pacientes", input.quotation.pacienteId, "historial"));
      const quotationRef = doc(db, "cotizaciones", input.quotation.id);
      const fecha = toFirestoreDate(paymentDate);
      const concepto = input.quotation.items.map((item) => item.nombre).join(", ");
      const total = Number(input.quotation.total) || 0;
      const costoProductos = inventoryProducts.reduce((totalCost, product) => {
        if (product.request.tipo !== "venta") return totalCost;
        return totalCost + Math.abs(Number(product.request.cantidad) || 0) * product.costoUnitario;
      }, 0);

      transaction.set(paymentRef, cleanData({
        corteId: openCash.id,
        pacienteId: input.quotation.pacienteId,
        pacienteNombre: input.pacienteNombre,
        citaId: input.citaId ?? null,
        cotizacionId: input.quotation.id,
        tratamientoId: treatmentRef.id,
        ventaId: paymentRef.id,
        fecha,
        metodo: method,
        monto: total,
        concepto,
        origen: "cotizacion",
        tipoIngreso: "tratamiento",
        estado: "activo",
        notas: input.notas ?? "",
        costoProductos,
        ...movementUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      transaction.set(cashMovementRef, cleanData({
        corteId: openCash.id,
        fecha,
        tipo: "ingreso",
        metodo: method,
        concepto,
        monto: total,
        referenciaTipo: "cotizacion",
        referenciaId: paymentRef.id,
        citaId: input.citaId ?? null,
        tratamientoId: treatmentRef.id,
        ventaId: paymentRef.id,
        tipoIngreso: "tratamiento",
        nota: input.notas ?? `Cobro de cotizacion ${input.quotation.id}`,
        costoProductos,
        estado: "activo",
        ...movementUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      transaction.set(treatmentRef, cleanData({
        pacienteId: input.quotation.pacienteId,
        pacienteNombre: input.pacienteNombre,
        citaId: input.citaId ?? null,
        cotizacionId: input.quotation.id,
        pagoId: paymentRef.id,
        ventaId: paymentRef.id,
        fecha,
        items: input.quotation.items,
        total,
        notas: input.notas ?? "",
        createdAt: serverTimestamp(),
      }));

      transaction.set(patientHistoryRef, cleanData({
        fecha,
        servicios: input.quotation.items
          .filter((item) => item.servicioId)
          .map((item) => ({ servicioId: item.servicioId, cantidad: item.cantidad })),
        notas: input.notas || `Tratamiento cobrado desde cotizacion ${input.quotation.id}`,
        total,
        pagoId: paymentRef.id,
        citaId: input.citaId ?? null,
        cotizacionId: input.quotation.id,
        tratamientoId: treatmentRef.id,
        ventaId: paymentRef.id,
      }));

      transaction.update(quotationRef, cleanData({
        estado: "activo",
        pagada: true,
        pagoId: paymentRef.id,
        tratamientoId: treatmentRef.id,
        fechaPago: serverTimestamp(),
        metodoPago: method,
      }));

      const inventoryAuditItems: string[] = [];

      inventoryProducts.forEach((product) => {
        const quantity = resolveMovementQuantity(product.request.tipo, product.request.cantidad);
        const nextStock = product.stock + quantity;
        const absoluteQuantity = Math.abs(quantity);
        const precioUnitarioVenta = product.request.tipo === "venta" ? product.precioVenta : 0;
        const costoTotal = absoluteQuantity * product.costoUnitario;
        const ingresoTotal = product.request.tipo === "venta" ? absoluteQuantity * precioUnitarioVenta : 0;

        if (nextStock < 0) {
          throw new Error(`No hay stock suficiente para ${product.nombre}.`);
        }

        const movementRef = doc(collection(db, INVENTORY_MOVEMENTS_COLLECTION));
        transaction.update(product.ref, {
          stock: nextStock,
          updatedAt: serverTimestamp(),
        });
        transaction.set(movementRef, cleanData({
          productoId: product.id,
          productoNombre: product.nombre,
          fecha,
          tipo: product.request.tipo,
          cantidad: quantity,
          stockAnterior: product.stock,
          stockNuevo: nextStock,
          motivo: product.request.motivo ?? `Checkout cotizacion ${input.quotation.id}`,
          referenciaTipo: product.request.tipo === "venta" ? "pago" : "tratamiento",
          referenciaId: product.request.tipo === "venta" ? paymentRef.id : treatmentRef.id,
          costoUnitario: product.costoUnitario,
          costoTotal,
          precioUnitarioVenta,
          ingresoTotal,
          ...movementUser,
          createdAt: serverTimestamp(),
        }));

        const movementLabel = product.request.tipo === "venta" ? "Venta" : "Uso clinico";
        inventoryAuditItems.push(`${movementLabel}: ${product.nombre} ${formatSignedQuantity(quantity)} (${product.stock} -> ${nextStock})`);
      });

      return {
        paymentId: paymentRef.id,
        inventoryAuditDetail: inventoryAuditItems.length
          ? `Cotizacion cobrada ${input.quotation.id} | ${compactAuditItems(inventoryAuditItems)}`
          : "",
      };
    });

    await addAuditLog("CREATE", "caja", `Cotizacion cobrada: ${input.quotation.id}`);
    if (checkoutResult.inventoryAuditDetail) {
      await addAuditLog("UPDATE", "inventario", checkoutResult.inventoryAuditDetail);
    }
    return checkoutResult.paymentId;
  },
};
