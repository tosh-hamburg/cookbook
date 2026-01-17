const CATEGORIES_KEY = 'categories';

export const getCategories = (): string[] => {
  try {
    const data = localStorage.getItem(CATEGORIES_KEY);
    return data ? JSON.parse(data) : ['Vorspeise', 'Hauptgericht', 'Dessert', 'Snack', 'Getränk'];
  } catch (error) {
    console.error('Fehler beim Laden der Kategorien:', error);
    return ['Vorspeise', 'Hauptgericht', 'Dessert', 'Snack', 'Getränk'];
  }
};

export const saveCategories = (categories: string[]): void => {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
};

export const addCategory = (category: string): void => {
  const categories = getCategories();
  if (!categories.includes(category)) {
    categories.push(category);
    saveCategories(categories);
  }
};

export const deleteCategory = (category: string): void => {
  const categories = getCategories();
  const filtered = categories.filter(c => c !== category);
  saveCategories(filtered);
};
