export interface CashDateRange { start: string; end: string }

export const toLocalDateString = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().split("T")[0];
};
export const today = () => toLocalDateString(new Date());
export const startOfCurrentMonth = () => {
  const now = new Date();
  return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
};
export const addDays = (date: string, days: number) => {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return toLocalDateString(parsed);
};
export const isValidDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isFinite(parsed.getTime()) && toLocalDateString(parsed) === date;
};
export const getDateRangeError = ({ start, end }: CashDateRange, required = false) => {
  if (required && (!start || !end)) return "Selecciona la fecha inicial y la fecha final.";
  if ((start && !isValidDate(start)) || (end && !isValidDate(end))) return "Escribe fechas válidas.";
  if (start && end && start > end) return "La fecha inicial no puede ser posterior a la fecha final.";
  return "";
};
export const isDateInRange = (date: string, start: string, end: string) =>
  isValidDate(date) && !getDateRangeError({ start, end }) && (!start || date >= start) && (!end || date <= end);

export const getPreviousRange = (start: string, end: string) => {
  if (getDateRangeError({ start, end }, true)) throw new Error("Periodo inválido");
  const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
  const previousEnd = addDays(start, -1);
  return { start: addDays(previousEnd, -(days - 1)), end: previousEnd };
};
export const calculateVariation = (current: number, previous: number): number | null =>
  previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / Math.abs(previous)) * 100;
export const formatVariation = (value: number | null) =>
  value === null ? "Sin base de comparación" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
export const normalizeCashSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const uniqueById = <T extends { id: string }>(items: T[]): T[] => Array.from(new Map(items.map(item => [item.id, item])).values());
