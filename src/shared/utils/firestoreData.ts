// Business dates must follow the local calendar, including timestamps near midnight.
export const safeLocalDate = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value
    : typeof value === "object" && "toDate" in value && typeof value.toDate === "function" ? value.toDate() as Date
      : typeof value === "string" ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};

export const safeDate = (timestamp: any): string => {
  if (!timestamp) return new Date().toISOString().split("T")[0];
  if (timestamp.toDate && typeof timestamp.toDate === "function") {
    return timestamp.toDate().toISOString().split("T")[0];
  }
  if (typeof timestamp === "string") return timestamp.split("T")[0];
  if (timestamp instanceof Date) return timestamp.toISOString().split("T")[0];
  return "N/A";
};

export const cleanData = <T extends Record<string, any>>(data: T) => {
  const cleaned: Record<string, any> = {};

  Object.keys(data).forEach((key) => {
    const value = data[key];
    cleaned[key] = value === undefined ? null : value;
  });

  return cleaned;
};
