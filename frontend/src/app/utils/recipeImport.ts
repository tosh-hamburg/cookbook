import type { Recipe } from '@/app/types/recipe';
import { importApi } from '@/app/services/api';

// Import recipe from URL via backend API
export const importRecipeFromUrl = async (url: string): Promise<Recipe> => {
  const data = await importApi.fromUrl(url);
  
  // Convert imported data to Recipe format
  return {
    id: crypto.randomUUID(), // Temporary ID, will be replaced on save
    title: data.title,
    images: data.images,
    ingredients: data.ingredients,
    instructions: data.instructions,
    prepTime: data.prepTime,
    restTime: data.restTime,
    cookTime: data.cookTime,
    totalTime: data.totalTime,
    servings: data.servings,
    caloriesPerUnit: data.caloriesPerUnit,
    weightUnit: data.weightUnit,
    categories: data.categories,
    createdAt: new Date().toISOString(),
    sourceUrl: data.sourceUrl,
  };
};
