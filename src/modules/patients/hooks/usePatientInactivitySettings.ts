import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "claudent.patient-inactivity-days";
const CHANGE_EVENT = "claudent:patient-inactivity-days-changed";
export const DEFAULT_PATIENT_INACTIVITY_DAYS = 180;

const normalizeDays = (value: unknown) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return DEFAULT_PATIENT_INACTIVITY_DAYS;
  return Math.min(3650, Math.max(1, Math.round(parsedValue)));
};

const readStoredDays = () => {
  if (typeof window === "undefined") return DEFAULT_PATIENT_INACTIVITY_DAYS;
  return normalizeDays(window.localStorage.getItem(STORAGE_KEY));
};

export const usePatientInactivitySettings = () => {
  const [inactivityDays, setInactivityDays] = useState(readStoredDays);

  useEffect(() => {
    const syncSettings = () => setInactivityDays(readStoredDays());

    window.addEventListener("storage", syncSettings);
    window.addEventListener(CHANGE_EVENT, syncSettings);

    return () => {
      window.removeEventListener("storage", syncSettings);
      window.removeEventListener(CHANGE_EVENT, syncSettings);
    };
  }, []);

  const updateInactivityDays = useCallback((nextValue: number) => {
    const normalizedValue = normalizeDays(nextValue);
    window.localStorage.setItem(STORAGE_KEY, String(normalizedValue));
    setInactivityDays(normalizedValue);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return normalizedValue;
  }, []);

  return { inactivityDays, updateInactivityDays };
};
