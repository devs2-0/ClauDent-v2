const normalizeWords = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .match(/[A-Z0-9]+/g) ?? [];

const uniqueCode = (baseCode: string, existingCodes: readonly string[]) => {
  const usedCodes = new Set(existingCodes.map((code) => code.trim().toUpperCase()));
  if (!usedCodes.has(baseCode)) return baseCode;

  let suffix = 2;
  while (usedCodes.has(`${baseCode}-${suffix}`)) suffix += 1;
  return `${baseCode}-${suffix}`;
};

const initials = (words: string[], length: number) => {
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, length);
  return words.slice(0, length).map((word) => word[0]).join("");
};

export const generateServiceCode = (
  category: string,
  name: string,
  price: number,
  existingCodes: readonly string[] = [],
) => {
  const categoryCode = normalizeWords(category).join("").slice(0, 1);
  const nameCode = initials(normalizeWords(name), 2);
  const numericPrice = Number.isFinite(price) ? Math.max(0, Math.round(price)) : 0;
  if (!categoryCode || !nameCode) return "";
  return uniqueCode(`${categoryCode}${nameCode}-${numericPrice}`, existingCodes);
};

const PACKAGE_STOP_WORDS = new Set(["PAQUETE", "PACK", "DE", "DEL", "LA", "EL", "LOS", "LAS"]);

const getValidDateCode = (value: string) => {
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return "";

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return "";
  }

  return `${parts[3]}${parts[2]}`;
};

const getCurrentDateCode = () => {
  const current = new Date();
  return `${String(current.getDate()).padStart(2, "0")}${String(
    current.getMonth() + 1,
  ).padStart(2, "0")}`;
};

export const generatePackageCode = (
  name: string,
  startDate: string,
  endDateOrExistingCodes: string | readonly string[] = "",
  existingCodes: readonly string[] = [],
) => {
  const endDate = typeof endDateOrExistingCodes === "string" ? endDateOrExistingCodes : "";
  const codes = typeof endDateOrExistingCodes === "string"
    ? existingCodes
    : endDateOrExistingCodes;
  const significantWords = normalizeWords(name).filter((word) => !PACKAGE_STOP_WORDS.has(word));
  const nameCode = significantWords.length === 1
    ? significantWords[0].slice(0, 2)
    : significantWords.slice(0, 3).map((word) => word[0]).join("");
  const dateCode = getValidDateCode(startDate) || getValidDateCode(endDate) || getCurrentDateCode();
  if (!nameCode) return "";
  return uniqueCode(`P${nameCode}-${dateCode}`, codes);
};
