import type { Recipe } from '@/app/types/recipe';
import { recipesApi } from '@/app/services/api';

// Diese Datei verwendet jetzt die API statt localStorage
// Die Funktionen sind async, aber für Abwärtskompatibilität
// werden sie weiterhin exportiert

let cachedRecipes: Recipe[] = [];

export const getRecipes = (): Recipe[] => {
  // Gibt gecachte Rezepte zurück (wird von loadRecipes aktualisiert)
  return cachedRecipes;
};

export const loadRecipes = async (): Promise<Recipe[]> => {
  try {
    cachedRecipes = await recipesApi.getAll();
    return cachedRecipes;
  } catch (error) {
    console.error('Fehler beim Laden der Rezepte:', error);
    return cachedRecipes;
  }
};

export const saveRecipes = (recipes: Recipe[]): void => {
  // Diese Funktion wird nicht mehr benötigt, da die API die Daten speichert
  cachedRecipes = recipes;
};

export const addRecipe = async (recipe: Recipe): Promise<Recipe> => {
  try {
    const newRecipe = await recipesApi.create(recipe);
    cachedRecipes.push(newRecipe);
    return newRecipe;
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Rezepts:', error);
    throw error;
  }
};

export const updateRecipe = async (recipe: Recipe): Promise<Recipe> => {
  try {
    const updatedRecipe = await recipesApi.update(recipe.id, recipe);
    const index = cachedRecipes.findIndex(r => r.id === recipe.id);
    if (index !== -1) {
      cachedRecipes[index] = updatedRecipe;
    }
    return updatedRecipe;
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Rezepts:', error);
    throw error;
  }
};

export const deleteRecipe = async (id: string): Promise<void> => {
  try {
    await recipesApi.delete(id);
    cachedRecipes = cachedRecipes.filter(r => r.id !== id);
  } catch (error) {
    console.error('Fehler beim Löschen des Rezepts:', error);
    throw error;
  }
};
