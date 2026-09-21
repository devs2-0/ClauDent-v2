import { addDuration, parseLocalDate, type Duration } from "@/shared/utils/duration";
import type { Patient } from "../types/patient.types";
import { safeLocalDate } from "@/shared/utils/firestoreData";

export const latestProcedureDate = (entries: { fecha?: unknown; pacienteNiegaProcedimientos?: boolean }[], today: Date): string | undefined =>
  entries.filter((entry) => !entry.pacienteNiegaProcedimientos)
    .map((entry) => safeLocalDate(entry.fecha))
    .filter((date) => { const parsed = parseLocalDate(date); return parsed && parsed <= today; })
    .sort().pop();

export const isBirthdayToday = (birthDate: string, today: Date): boolean => {
  const birth = parseLocalDate(birthDate);
  return Boolean(birth && birth <= today && birth.getMonth() === today.getMonth() && birth.getDate() === today.getDate());
};

export const patientReviewDue = (patient: Patient, duration: Duration, today: Date, procedureDate?: string, appointmentDate?: string, consultationDate?: string) => {
  const dates = [
    { value: patient.fechaRegistro, source: "registro del paciente" },
    { value: procedureDate, source: "último procedimiento registrado" },
    { value: appointmentDate, source: "última cita atendida" },
    { value: consultationDate, source: "última consulta odontológica capturada" },
  ].map((item) => ({ ...item, date: parseLocalDate(item.value) }))
    .filter((item) => item.date && item.date <= today)
    .sort((a, b) => b.date!.getTime() - a.date!.getTime());
  const latest = dates[0];
  if (!latest?.date) return null;
  const due = addDuration(latest.date, duration);
  return due <= today ? { due, source: latest.source, referenceDate: latest.value! } : null;
};
