import {
  addDoc,
  collection,
  doc,
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
import type {
  CashClosure,
  CashClosureTotals,
  CashCutSummary,
  CashMovement,
  CashReferenceType,
  CloseCashRegisterInput,
  CreateCashMovementInput,
  CreatePaymentInput,
  FinalizeQuotationCheckoutInput,
  OpenCashRegisterInput,
  Payment,
  PaymentMethod,
  RegisterDirectSaleInput,
} from "../types/cash.types";

const PAYMENTS_COLLECTION = "pagos";
const CASH_CLOSURES_COLLECTION = "cortesCaja";
const CASH_MOVEMENTS_COLLECTION = "cajaMovimientos";
const TREATMENTS_COLLECTION = "tratamientos";

const paymentMethods: PaymentMethod[] = ["efectivo", "tarjeta", "transferencia"];

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
  pacienteId: data.pacienteId ?? null,
  pacienteNombre: data.pacienteNombre ?? "",
  cotizacionId: data.cotizacionId ?? null,
  fecha: safeDate(data.fecha),
  metodo: normalizePaymentMethod(data.metodo),
  monto: Number(data.monto) || 0,
  concepto: data.concepto ?? "",
  origen: data.origen ?? "venta_directa",
  estado: data.estado ?? "activo",
  notas: data.notas ?? "",
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
  nota: data.nota ?? "",
  estado: data.estado ?? "activo",
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
  referenciaTipo,
  referenciaId,
  nota,
}: CreateCashMovementInput & { corteId: string | null; referenciaTipo: CashReferenceType }) => cleanData({
  corteId,
  fecha: toFirestoreDate(fecha),
  tipo,
  metodo,
  concepto,
  monto: Number(monto) || 0,
  referenciaTipo,
  referenciaId: referenciaId ?? null,
  nota: nota ?? "",
  estado: "activo",
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
  listenPayments: (onChange: (payments: Payment[]) => void) => {
    const paymentsQuery = query(collection(db, PAYMENTS_COLLECTION), orderBy("fecha", "desc"));
    return onSnapshot(paymentsQuery, (snapshot) => {
      onChange(snapshot.docs.map((paymentDoc) => mapPayment(paymentDoc.id, paymentDoc.data())));
    });
  },

  listenCashClosures: (onChange: (closures: CashClosure[]) => void) => {
    const closuresQuery = query(collection(db, CASH_CLOSURES_COLLECTION), orderBy("fecha", "desc"));
    return onSnapshot(closuresQuery, (snapshot) => {
      onChange(snapshot.docs.map((closureDoc) => mapCashClosure(closureDoc.id, closureDoc.data())));
    });
  },

  listenCashMovements: (onChange: (movements: CashMovement[]) => void) => {
    const movementsQuery = query(collection(db, CASH_MOVEMENTS_COLLECTION), orderBy("fecha", "desc"));
    return onSnapshot(movementsQuery, (snapshot) => {
      onChange(snapshot.docs.map((movementDoc) => mapCashMovement(movementDoc.id, movementDoc.data())));
    });
  },

  openCashRegister: async (input: OpenCashRegisterInput) => {
    const existingOpenCash = await getOpenCashClosureSnapshot();
    if (existingOpenCash) {
      throw new Error("Ya existe una caja abierta. Cierra el corte actual antes de abrir otra.");
    }

    const batch = writeBatch(db);
    const closureRef = doc(collection(db, CASH_CLOSURES_COLLECTION));
    const movementRef = doc(collection(db, CASH_MOVEMENTS_COLLECTION));
    const fondoInicial = Number(input.fondoInicial) || 0;

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
      nota: input.observaciones || "Fondo inicial",
    }));

    await batch.commit();
    await addAuditLog("CREATE", "caja", `Caja abierta: ${input.fecha}`);
    return closureRef.id;
  },

  createCashMovement: async (input: CreateCashMovementInput) => {
    const amount = Number(input.monto) || 0;
    if (amount <= 0) {
      throw new Error("El monto del movimiento debe ser mayor a cero.");
    }

    const openCash = await requireOpenCashClosureSnapshot();
    ensureDateMatchesOpenCash(openCash, input.fecha);

    if (input.tipo === "egreso" && input.metodo === "efectivo") {
      const movements = await getActiveMovementsForClosure(openCash.id);
      const summary = calculateCashCutSummary(movements);
      if (amount > summary.efectivoFinal) {
        throw new Error(`Fondos insuficientes. La caja tiene ${summary.efectivoFinal.toFixed(2)} disponibles en efectivo.`);
      }
    }

    const movementRef = await addDoc(collection(db, CASH_MOVEMENTS_COLLECTION), createCashMovementPayload({
      ...input,
      corteId: openCash.id,
      referenciaTipo: input.referenciaTipo ?? "manual",
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
    const paymentAmount = Number(payment.monto) || 0;

    batch.set(paymentRef, cleanData({
      ...payment,
      fecha: toFirestoreDate(payment.fecha),
      monto: paymentAmount,
      estado: payment.estado ?? "activo",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    batch.set(movementRef, createCashMovementPayload({
      corteId: openCash.id,
      fecha: payment.fecha,
      tipo: "ingreso",
      metodo: payment.metodo,
      concepto: payment.concepto,
      monto: paymentAmount,
      referenciaTipo: payment.origen === "cotizacion" ? "cotizacion" : "pago",
      referenciaId: paymentRef.id,
      nota: payment.notas ?? "",
    }));

    await batch.commit();
    await addAuditLog("CREATE", "caja", `Pago registrado: ${payment.concepto}`);
    return paymentRef.id;
  },

  registerDirectSale: async (input: RegisterDirectSaleInput) => {
    const openCash = await requireOpenCashClosureSnapshot();
    ensureDateMatchesOpenCash(openCash, input.fecha);

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

    if (total <= 0) {
      throw new Error("El total de la venta debe ser mayor a cero.");
    }

    const concepto = buildDirectSaleConcept({ ...input, servicios, productos });

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
        });
      }

      const paymentRef = doc(collection(db, PAYMENTS_COLLECTION));
      const cashMovementRef = doc(collection(db, CASH_MOVEMENTS_COLLECTION));
      const treatmentRef = servicios.length > 0 ? doc(collection(db, TREATMENTS_COLLECTION)) : null;
      const patientHistoryRef =
        servicios.length > 0 && input.pacienteId
          ? doc(collection(db, "pacientes", input.pacienteId, "historial"))
          : null;
      const fecha = toFirestoreDate(input.fecha);

      transaction.set(paymentRef, cleanData({
        pacienteId: input.pacienteId ?? null,
        pacienteNombre,
        cotizacionId: null,
        fecha,
        metodo: input.metodo,
        monto: total,
        concepto,
        origen: "venta_directa",
        estado: "activo",
        notas: input.notas ?? "",
        subtotalServicios,
        subtotalProductos,
        descuento,
        servicios,
        productos,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      transaction.set(cashMovementRef, cleanData({
        corteId: openCash.id,
        fecha,
        tipo: "ingreso",
        metodo: input.metodo,
        concepto,
        monto: total,
        referenciaTipo: "pago",
        referenciaId: paymentRef.id,
        nota: input.notas ?? "Venta directa",
        estado: "activo",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      if (treatmentRef) {
        transaction.set(treatmentRef, cleanData({
          pacienteId: input.pacienteId ?? null,
          pacienteNombre,
          cotizacionId: null,
          pagoId: paymentRef.id,
          fecha,
          items: servicios,
          total: subtotalServicios,
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
          pagoId: paymentRef.id,
        }));
      }

      const inventoryAuditItems: string[] = [];

      inventoryProducts.forEach((product) => {
        const quantity = resolveMovementQuantity("venta", product.request.cantidad);
        const nextStock = product.stock + quantity;

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

  cancelPayment: async (id: string) => {
    const batch = writeBatch(db);
    batch.update(doc(db, PAYMENTS_COLLECTION, id), cleanData({
      estado: "cancelado",
      updatedAt: serverTimestamp(),
    }));

    const movementSnapshot = await getDocs(query(collection(db, CASH_MOVEMENTS_COLLECTION), where("referenciaId", "==", id)));
    movementSnapshot.docs.forEach((movementDoc) => {
      batch.update(movementDoc.ref, cleanData({
        estado: "cancelado",
        updatedAt: serverTimestamp(),
      }));
    });

    await batch.commit();
    await addAuditLog("UPDATE", "caja", `Pago cancelado: ${id}`);
  },

  closeCashRegister: async (input: CloseCashRegisterInput) => {
    const openCash = await requireOpenCashClosureSnapshot();
    const openCashDate = getClosureDate(openCash) || input.fecha;
    const movements = await getActiveMovementsForClosure(openCash.id);
    const summary = calculateCashCutSummary(movements);
    const tipoCierre = input.tipoCierre ?? "manual";
    const efectivoContado = tipoCierre === "automatico" ? summary.efectivoFinal : Number(input.efectivoContado) || 0;
    const diferenciaEfectivo = efectivoContado - summary.efectivoFinal;

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

      transaction.set(paymentRef, cleanData({
        pacienteId: input.quotation.pacienteId,
        pacienteNombre: input.pacienteNombre,
        cotizacionId: input.quotation.id,
        fecha,
        metodo: input.metodo,
        monto: total,
        concepto,
        origen: "cotizacion",
        estado: "activo",
        notas: input.notas ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      transaction.set(cashMovementRef, cleanData({
        corteId: openCash.id,
        fecha,
        tipo: "ingreso",
        metodo: input.metodo,
        concepto,
        monto: total,
        referenciaTipo: "cotizacion",
        referenciaId: paymentRef.id,
        nota: input.notas ?? `Cobro de cotizacion ${input.quotation.id}`,
        estado: "activo",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      transaction.set(treatmentRef, cleanData({
        pacienteId: input.quotation.pacienteId,
        pacienteNombre: input.pacienteNombre,
        cotizacionId: input.quotation.id,
        pagoId: paymentRef.id,
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
        cotizacionId: input.quotation.id,
      }));

      transaction.update(quotationRef, cleanData({
        estado: "activo",
        pagada: true,
        pagoId: paymentRef.id,
        tratamientoId: treatmentRef.id,
        fechaPago: serverTimestamp(),
        metodoPago: input.metodo,
      }));

      const inventoryAuditItems: string[] = [];

      inventoryProducts.forEach((product) => {
        const quantity = resolveMovementQuantity(product.request.tipo, product.request.cantidad);
        const nextStock = product.stock + quantity;

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
