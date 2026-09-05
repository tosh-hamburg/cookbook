/** Konto, wie es die Anmelde-Endpunkte zurückgeben. */
export interface ApiUser {
  id: string;
  username: string;
  email?: string | null;
  role: string;
  avatar?: string | null;
  twoFactorEnabled?: boolean;
  createdAt?: string;
}

/** Zutat eines Rezepts, so wie die API sie liefert und erwartet. */
export interface ApiIngredient {
  name: string;
  amount: string;
}

/** Vollständiges Rezept aus `GET /api/recipes/:id`. */
export interface ApiRecipe {
  id: string;
  title: string;
  images: string[];
  ingredients: ApiIngredient[];
  instructions: string;
  prepTime: number;
  restTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  caloriesPerUnit: number;
  weightUnit: string;
  sourceUrl: string | null;
  notes: string | null;
  categories: string[];
  collections: Array<{ id: string; name: string }>;
  userId: string;
  createdAt: string;
}

/** Listeneintrag aus `GET /api/recipes` (paginiert, mit Thumbnail). */
export interface ApiRecipeListItem {
  id: string;
  title: string;
  thumbnail: string | null;
  /** Vom Backend ergänzt; fehlt bei älteren Backend-Ständen. */
  hasImage?: boolean;
  prepTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  categories: string[];
  createdAt: string;
}

export interface ApiRecipeListResponse {
  items: ApiRecipeListItem[];
  total: number;
  limit?: number;
  offset?: number;
  hasMore: boolean;
}

export interface ApiCategory {
  id: string;
  name: string;
}

export interface ApiCollection {
  id: string;
  name: string;
  description: string | null;
  recipeCount?: number;
  createdAt?: string;
}

/** Ergebnis von `POST /api/import` — ein noch nicht gespeichertes Rezept. */
export interface ApiScrapedRecipe {
  title: string;
  images: string[];
  ingredients: ApiIngredient[];
  instructions: string;
  prepTime: number;
  restTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  caloriesPerUnit: number;
  weightUnit: string;
  categories: string[];
  sourceUrl?: string;
}

/** Nutzlast für `POST /api/recipes` und `PUT /api/recipes/:id`. */
export interface RecipeWritePayload {
  title: string;
  images: string[];
  ingredients: ApiIngredient[];
  instructions: string;
  prepTime: number;
  restTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  caloriesPerUnit: number;
  weightUnit: string;
  categories: string[];
  sourceUrl: string | null;
  notes: string | null;
}
