import { categoryKey, categoryOptions, titleCaseCategory } from './categories';

export interface ServiceCategory { id: string; name: string; legacyKeys: string[] }
export const legacyCategories = (values: string[]): ServiceCategory[] =>
  [...categoryOptions(values)].map(([key, name]) => ({ id: `legacy:${key}`, name, legacyKeys: [key] }));

export const resolveServiceCategory = (service: { categoria: string; categoriaId?: string | null }, categories: ServiceCategory[]) =>
  service.categoriaId
    ? categories.find((category) => category.id === service.categoriaId)
    : categories.find((category) => category.legacyKeys.includes(categoryKey(service.categoria)));

export const saveCategory = (categories: ServiceCategory[], name: string, id: string): ServiceCategory[] => {
  const normalized = titleCaseCategory(name);
  if (!normalized) throw new Error('Escribe el nombre de la categoría.');
  if (categories.some((category) => category.id !== id && categoryKey(category.name) === categoryKey(normalized))) {
    throw new Error('Ya existe una categoría con ese nombre.');
  }
  const existing = categories.find((category) => category.id === id);
  return [...categories.filter((category) => category.id !== id), { id, name: normalized, legacyKeys: existing?.legacyKeys ?? [] }];
};
