export interface Ingredient {
  name: string;
  amount: string;
}

export interface Recipe {
  id: string;
  title: string;
  images: string[];
  ingredients: Ingredient[];
  instructions: string;
  prepTime: number; // in Minuten
  restTime: number; // in Minuten
  cookTime: number; // in Minuten
  totalTime: number; // in Minuten
  caloriesPerUnit: number;
  weightUnit: string; // z.B. "100g"
  categories: string[]; // Kategorien
  userId: string; // Benutzer, der das Rezept erstellt hat
  createdAt: string;
}