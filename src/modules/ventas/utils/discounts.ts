export const roundCurrency = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
};

export const normalizeDiscountPercentage = (value: unknown) => {
  const percentage = Number(value);
  if (!Number.isFinite(percentage)) return 0;
  return Math.max(0, percentage);
};

export const calculatePercentageDiscount = (subtotal: unknown, percentage: unknown) => {
  const base = Math.max(0, roundCurrency(subtotal));
  return roundCurrency((base * normalizeDiscountPercentage(percentage)) / 100);
};
