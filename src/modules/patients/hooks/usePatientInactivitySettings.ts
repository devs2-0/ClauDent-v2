import { useCallback, useEffect, useState } from "react";
import { useCan } from "@/auth";
import { isValidDuration, patientDurationUnits, type Duration } from "@/shared/utils/duration";

const LEGACY_STORAGE_KEY = "claudent.patient-inactivity-days";
const STORAGE_KEY = "claudent.patient-inactivity.v2";
const CHANGE_EVENT = "claudent:patient-inactivity-days-changed";
export const DEFAULT_PATIENT_INACTIVITY_DAYS = 180;
export interface PatientInactivitySettings extends Duration { enabled: boolean }
export const DEFAULT_PATIENT_INACTIVITY: PatientInactivitySettings = { value: 4, unit: "months", enabled: true };

const normalizeDays = (value: unknown) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return DEFAULT_PATIENT_INACTIVITY_DAYS;
  return Math.min(3650, Math.max(1, Math.round(parsedValue)));
};

export const readPatientInactivitySettings = (): PatientInactivitySettings => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored && isValidDuration(stored) && patientDurationUnits.includes(stored.unit)) {
        return { value: stored.value, unit: stored.unit, enabled: stored.enabled !== false };
      }
    }
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && Number.isFinite(Number(legacy)) && Number(legacy) > 0) return { value: normalizeDays(legacy), unit: "days", enabled: true };
  } catch { /* Keep a usable default when browser storage is unavailable. */ }
  return DEFAULT_PATIENT_INACTIVITY;
};

export const usePatientInactivitySettings = () => {
  const { can } = useCan();
  const [settings, setSettings] = useState(readPatientInactivitySettings);

  useEffect(() => {
    const syncSettings = () => setSettings(readPatientInactivitySettings());

    window.addEventListener("storage", syncSettings);
    window.addEventListener(CHANGE_EVENT, syncSettings);

    return () => {
      window.removeEventListener("storage", syncSettings);
      window.removeEventListener(CHANGE_EVENT, syncSettings);
    };
  }, []);

  const updateSettings = useCallback((nextValue: PatientInactivitySettings) => {
    if (!can("settings.update")) throw new Error("No tienes permiso para cambiar la configuración.");
    if (!isValidDuration(nextValue) || !patientDurationUnits.some((unit) => unit === nextValue.unit)) throw new Error("Ingresa un periodo válido.");
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
    setSettings(nextValue);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [can]);

  return { settings, updateSettings };
};
