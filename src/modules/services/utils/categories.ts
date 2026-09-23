export const categoryKey = (value = ""): string => (value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");

export const titleCaseCategory = (value = ""): string => (value ?? "").trim().replace(/\s+/g, " ")
  .toLocaleLowerCase("es").replace(/(^|\s)(\S)/gu, (_, space: string, letter: string) => space + letter.toLocaleUpperCase("es"));

export const categoryOptions = (values: string[]): Map<string, string> => {
  const categories = new Map<string, string>();
  // Prefer the accented spelling when legacy records contain equivalent variants.
  [...values].map((value) => titleCaseCategory(value)).filter(Boolean)
    .sort((a, b) => {
      const accents = (text: string) => (text.normalize("NFD").match(/[\u0300-\u036f]/g) ?? []).length;
      return accents(b) - accents(a) || a.localeCompare(b, "es");
    }).forEach((label) => {
      const key = categoryKey(label);
      if (!categories.has(key)) categories.set(key, label);
    });
  return new Map([...categories].sort(([, a], [, b]) => a.localeCompare(b, "es")));
};

export const normalizeCategory = (value: string, existing: string[]): string =>
  categoryOptions(existing).get(categoryKey(value)) ?? titleCaseCategory(value);
