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
  servings: number; // Anzahl Portionen
  caloriesPerUnit: number;
  weightUnit: string; // z.B. "100g"
  categories: string[]; // Kategorien
  userId?: string; // Benutzer, der das Rezept erstellt hat
  createdAt: string;
  sourceUrl?: string; // URL der Quelle, wenn importiert
}