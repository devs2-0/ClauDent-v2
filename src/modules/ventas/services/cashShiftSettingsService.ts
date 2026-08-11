import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addAuditLog } from "@/modules/audit/services/auditService";
import { getCurrentUserIdentity } from "@/shared/services/currentUserIdentity";
import { cleanData } from "@/shared/utils/firestoreData";
import type { CashShiftDefinition, CashShiftSettings } from "../types/cash.types";

const CASH_SETTINGS_COLLECTION = "configuracionCaja";
const CASH_SHIFT_SETTINGS_DOC = "turnos";

export const defaultCashShiftSettings: CashShiftSettings = {
  modo: "programado",
  permitirMultiplesCortesPorDia: true,
  permitirCierreAutomatico: true,
  fondoInicialRequerido: false,
  fondoInicialSugerido: 0,
  toleranciaDiferencia: 20,
  cierreObligatorio: false,
  turnos: [
    { id: "matutino-sur-mx", nombre: "Matutino", horaInicio: "08:00", horaFin: "14:00", activo: true },
    { id: "vespertino-sur-mx", nombre: "Vespertino", horaInicio: "16:00", horaFin: "20:00", activo: true },
  ],
};

const normalizeShift = (shift: Partial<CashShiftDefinition>, index: number): CashShiftDefinition => ({
  id: shift.id?.trim() || `turno-${index + 1}`,
  nombre: shift.nombre?.trim() || `Turno ${index + 1}`,
  horaInicio: shift.horaInicio || "08:00",
  horaFin: shift.horaFin || "14:00",
  activo: shift.activo !== false,
});

const mapSettings = (data: any): CashShiftSettings => ({
  ...defaultCashShiftSettings,
  ...data,
  modo: data?.modo === "programado" ? "programado" : "manual",
  permitirMultiplesCortesPorDia: data?.permitirMultiplesCortesPorDia !== false,
  permitirCierreAutomatico: data?.permitirCierreAutomatico !== false,
  fondoInicialRequerido: data?.fondoInicialRequerido === true,
  fondoInicialSugerido: Number(data?.fondoInicialSugerido) || 0,
  toleranciaDiferencia: Number(data?.toleranciaDiferencia ?? defaultCashShiftSettings.toleranciaDiferencia) || 0,
  cierreObligatorio: data?.cierreObligatorio === true,
  turnos: Array.isArray(data?.turnos) && data.turnos.length
    ? data.turnos.map(normalizeShift)
    : defaultCashShiftSettings.turnos,
  updatedAt: data?.updatedAt ?? null,
  updatedBy: data?.updatedBy ?? null,
  updatedByName: data?.updatedByName ?? data?.updatedByEmail ?? "",
  updatedByEmail: data?.updatedByEmail ?? "",
});

export const cashShiftSettingsService = {
  listenSettings: (onChange: (settings: CashShiftSettings) => void) => {
    const settingsRef = doc(db, CASH_SETTINGS_COLLECTION, CASH_SHIFT_SETTINGS_DOC);
    return onSnapshot(settingsRef, (snapshot) => {
      onChange(snapshot.exists() ? mapSettings(snapshot.data()) : defaultCashShiftSettings);
    });
  },

  updateSettings: async (settings: CashShiftSettings) => {
    const user = await getCurrentUserIdentity();
    const settingsRef = doc(db, CASH_SETTINGS_COLLECTION, CASH_SHIFT_SETTINGS_DOC);

    await setDoc(settingsRef, cleanData({
      ...settings,
      turnos: settings.turnos.map(normalizeShift),
      updatedAt: serverTimestamp(),
      updatedBy: user.usuarioId,
      updatedByName: user.usuarioNombre,
      updatedByEmail: user.usuarioEmail,
    }), { merge: true });

    await addAuditLog("UPDATE", "caja", "Configuracion de turnos de caja actualizada");
  },
};
