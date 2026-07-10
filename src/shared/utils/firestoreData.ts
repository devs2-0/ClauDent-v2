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
