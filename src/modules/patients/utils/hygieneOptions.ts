export const HYGIENE_OPTIONS = [
  'Hilo dental',
  'Enjuague bucal',
  'Cepillos interdentales',
  'Limpiador de lengua',
  'Irrigador',
  'No usa auxiliares',
  'Otros',
] as const;

export const readLegacyHygieneOptions = (value = '') => {
  const parts = value.split(',').map((item) => item.trim()).filter(Boolean);
  const known = parts.filter((item) => HYGIENE_OPTIONS.some((option) => option === item));
  const other = parts.filter((item) => !HYGIENE_OPTIONS.some((option) => option === item)).join(', ');
  return { options: [...known, ...(other ? ['Otros'] : [])], other };
};

