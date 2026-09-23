import { addDays, addHours, addMinutes, addMonths, addWeeks, addYears } from "date-fns";

export const durationUnitLabels = {
  minutes: "Minutos", hours: "Horas", days: "Días", weeks: "Semanas", months: "Meses", years: "Años",
} as const;
export type DurationUnit = keyof typeof durationUnitLabels;
export interface Duration { value: number; unit: DurationUnit }
export const patientDurationUnits = ["days", "weeks", "months", "years"] as const;

export const isValidDuration = (duration: Duration): boolean =>
  Number.isSafeInteger(duration.value) && duration.value > 0 && duration.value <= 3650 &&
  Object.prototype.hasOwnProperty.call(durationUnitLabels, duration.unit);

// Calendar arithmetic keeps months/years accurate at month ends and leap years.
export const addDuration = (date: Date, duration: Duration): Date => {
  const add = { minutes: addMinutes, hours: addHours, days: addDays, weeks: addWeeks, months: addMonths, years: addYears };
  return isValidDuration(duration) ? add[duration.unit](date, duration.value) : new Date(NaN);
};

export const parseLocalDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  const [year, month, day] = value.split("-").map(Number);
  return Number.isFinite(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};
