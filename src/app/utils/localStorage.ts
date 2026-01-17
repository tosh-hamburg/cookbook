import type { Recipe } from '@/app/types/recipe';

const STORAGE_KEY = 'recipes';

export const getRecipes = (): Recipe[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Fehler beim Laden der Rezepte:', error);
    return [];
  }
};

export const saveRecipes = (recipes: Recipe[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  } catch (error) {
    console.error('Fehler beim Speichern der Rezepte:', error);
  }
};

export const addRecipe = (recipe: Recipe): void => {
  const recipes = getRecipes();
  recipes.push(recipe);
  saveRecipes(recipes);
};

export const updateRecipe = (recipe: Recipe): void => {
  const recipes = getRecipes();
  const index = recipes.findIndex(r => r.id === recipe.id);
  if (index !== -1) {
    recipes[index] = recipe;
    saveRecipes(recipes);
  }
};

export const deleteRecipe = (id: string): void => {
  const recipes = getRecipes();
  const filtered = recipes.filter(r => r.id !== id);
  saveRecipes(filtered);
};
