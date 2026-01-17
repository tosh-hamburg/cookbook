import { categoriesApi } from '@/app/services/api';

let cachedCategories: string[] = ['Vorspeise', 'Hauptgericht', 'Dessert', 'Snack', 'Getränk'];

export const getCategories = (): string[] => {
  return cachedCategories;
};

export const loadCategories = async (): Promise<string[]> => {
  try {
    cachedCategories = await categoriesApi.getAll();
    return cachedCategories;
  } catch (error) {
    console.error('Fehler beim Laden der Kategorien:', error);
    return cachedCategories;
  }
};

export const saveCategories = (categories: string[]): void => {
  // Diese Funktion wird nicht mehr benötigt, da die API die Daten speichert
  cachedCategories = categories;
};

export const addCategory = async (category: string): Promise<void> => {
  try {
    await categoriesApi.create(category);
    if (!cachedCategories.includes(category)) {
      cachedCategories.push(category);
    }
  } catch (error) {
    console.error('Fehler beim Hinzufügen der Kategorie:', error);
    throw error;
  }
};

export const deleteCategory = async (category: string): Promise<void> => {
  try {
    await categoriesApi.delete(category);
    cachedCategories = cachedCategories.filter(c => c !== category);
  } catch (error) {
    console.error('Fehler beim Löschen der Kategorie:', error);
    throw error;
  }
};
