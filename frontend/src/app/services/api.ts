import type { Recipe } from '@/app/types/recipe';
import type { User } from '@/app/types/user';

// Use relative URL - Vite proxy handles forwarding to backend
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Token management
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'current_user';

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getCurrentUserFromStorage = (): User | null => {
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const setCurrentUserInStorage = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// API helper
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

// Auth API response types
export interface LoginResponse {
  token?: string;
  user?: User;
  requires2FA?: boolean;
  userId?: string;
  message?: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
}

// Auth API
export const authApi = {
  login: async (username: string, password: string, twoFactorCode?: string): Promise<LoginResponse> => {
    const result = await fetchApi<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, twoFactorCode }),
    });
    if (result.token && result.user) {
      setToken(result.token);
      setCurrentUserInStorage(result.user);
    }
    return result;
  },

  googleLogin: async (credential: string, twoFactorCode?: string): Promise<LoginResponse> => {
    const result = await fetchApi<LoginResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential, twoFactorCode }),
    });
    if (result.token && result.user) {
      setToken(result.token);
      setCurrentUserInStorage(result.user);
    }
    return result;
  },

  logout: (): void => {
    removeToken();
  },

  getCurrentUser: async (): Promise<User> => {
    return fetchApi<User>('/auth/me');
  },

  register: async (username: string, password: string, role: string = 'user'): Promise<User> => {
    return fetchApi<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    });
  },

  // 2FA endpoints
  setup2FA: async (): Promise<TwoFactorSetupResponse> => {
    return fetchApi<TwoFactorSetupResponse>('/auth/2fa/setup', {
      method: 'POST',
    });
  },

  verify2FA: async (code: string): Promise<{ success: boolean; message: string }> => {
    return fetchApi<{ success: boolean; message: string }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  disable2FA: async (code?: string, password?: string): Promise<{ success: boolean; message: string }> => {
    return fetchApi<{ success: boolean; message: string }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code, password }),
    });
  },

  get2FAStatus: async (): Promise<{ enabled: boolean }> => {
    return fetchApi<{ enabled: boolean }>('/auth/2fa/status');
  },

  // Password management
  changePassword: async (currentPassword: string | null, newPassword: string): Promise<{ success: boolean; message: string }> => {
    return fetchApi<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};

// Recipes API
export interface RecipeFilters {
  category?: string;
  collection?: string;
  search?: string;
}

export const recipesApi = {
  getAll: async (filters?: RecipeFilters): Promise<Recipe[]> => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.collection) params.append('collection', filters.collection);
    if (filters?.search) params.append('search', filters.search);
    // Request full recipe data for web app
    params.append('full', 'true');
    const queryString = params.toString();
    return fetchApi<Recipe[]>(`/recipes?${queryString}`);
  },

  getById: async (id: string): Promise<Recipe> => {
    return fetchApi<Recipe>(`/recipes/${id}`);
  },

  create: async (recipe: Omit<Recipe, 'id' | 'createdAt'>): Promise<Recipe> => {
    return fetchApi<Recipe>('/recipes', {
      method: 'POST',
      body: JSON.stringify(recipe),
    });
  },

  update: async (id: string, recipe: Partial<Recipe>): Promise<Recipe> => {
    return fetchApi<Recipe>(`/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(recipe),
    });
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<{ message: string }>(`/recipes/${id}`, {
      method: 'DELETE',
    });
  },
};

// Categories API
export const categoriesApi = {
  getAll: async (): Promise<string[]> => {
    return fetchApi<string[]>('/categories');
  },

  create: async (name: string): Promise<{ id: string; name: string }> => {
    return fetchApi<{ id: string; name: string }>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  delete: async (name: string): Promise<void> => {
    await fetchApi<{ message: string }>(`/categories/name/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  },
};

// Collections API
export interface Collection {
  id: string;
  name: string;
  description: string | null;
  recipeCount: number;
  recipes?: Array<{ id: string; title: string; images: string[] }>;
  createdAt: string;
}

export const collectionsApi = {
  getAll: async (): Promise<Collection[]> => {
    return fetchApi<Collection[]>('/collections');
  },

  getById: async (id: string): Promise<Collection> => {
    return fetchApi<Collection>(`/collections/${id}`);
  },

  create: async (name: string, description?: string): Promise<Collection> => {
    return fetchApi<Collection>('/collections', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  },

  update: async (id: string, data: { name?: string; description?: string }): Promise<Collection> => {
    return fetchApi<Collection>(`/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<{ message: string }>(`/collections/${id}`, {
      method: 'DELETE',
    });
  },

  addRecipe: async (collectionId: string, recipeId: string): Promise<void> => {
    await fetchApi<{ message: string }>(`/collections/${collectionId}/recipes/${recipeId}`, {
      method: 'POST',
    });
  },

  removeRecipe: async (collectionId: string, recipeId: string): Promise<void> => {
    await fetchApi<{ message: string }>(`/collections/${collectionId}/recipes/${recipeId}`, {
      method: 'DELETE',
    });
  },
};

// Users API (admin only)
export const usersApi = {
  getAll: async (): Promise<User[]> => {
    return fetchApi<User[]>('/users');
  },

  create: async (username: string, password: string, role: string = 'user'): Promise<User> => {
    return fetchApi<User>('/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    });
  },

  update: async (id: string, data: { username?: string; password?: string; role?: string }): Promise<User> => {
    return fetchApi<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    await fetchApi<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};

// Health check
export const healthCheck = async (): Promise<{ status: string; timestamp: string }> => {
  return fetchApi<{ status: string; timestamp: string }>('/health');
};

// Meal Plans API (Wochenplaner)
export interface MealSlotData {
  dayIndex: number;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  servings: number;
  recipe: {
    id: string;
    title: string;
    images: string[];
    ingredients: Array<{ name: string; amount: string }>;
    servings: number;
    totalTime: number;
    categories: string[];
  } | null;
}

export interface MealPlanData {
  id: string | null;
  weekStart: string;
  meals: MealSlotData[];
}

export interface MealSlotUpdate {
  dayIndex: number;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  recipeId: string | null;
  servings: number;
}

export const mealPlansApi = {
  // Get meal plan for a specific week
  getByWeek: async (weekStart: Date): Promise<MealPlanData> => {
    const dateStr = weekStart.toISOString().split('T')[0];
    return fetchApi<MealPlanData>(`/mealplans/${dateStr}`);
  },

  // Save entire meal plan for a week
  saveWeek: async (weekStart: Date, meals: MealSlotUpdate[]): Promise<MealPlanData> => {
    const dateStr = weekStart.toISOString().split('T')[0];
    return fetchApi<MealPlanData>(`/mealplans/${dateStr}`, {
      method: 'PUT',
      body: JSON.stringify({ meals }),
    });
  },

  // Update a single meal slot
  updateSlot: async (
    weekStart: Date,
    dayIndex: number,
    mealType: 'breakfast' | 'lunch' | 'dinner',
    recipeId: string | null,
    servings: number
  ): Promise<MealPlanData> => {
    const dateStr = weekStart.toISOString().split('T')[0];
    return fetchApi<MealPlanData>(`/mealplans/${dateStr}/slot`, {
      method: 'PATCH',
      body: JSON.stringify({ dayIndex, mealType, recipeId, servings }),
    });
  },

  // Delete meal plan for a week
  deleteWeek: async (weekStart: Date): Promise<void> => {
    const dateStr = weekStart.toISOString().split('T')[0];
    await fetchApi<{ message: string }>(`/mealplans/${dateStr}`, {
      method: 'DELETE',
    });
  },
};

// Import API - for importing recipes from external URLs
export interface ImportedRecipeData {
  title: string;
  images: string[];
  ingredients: Array<{ name: string; amount: string }>;
  instructions: string;
  prepTime: number;
  restTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  caloriesPerUnit: number;
  weightUnit: string;
  categories: string[];
  sourceUrl: string;
}

export const importApi = {
  fromUrl: async (url: string): Promise<ImportedRecipeData> => {
    return fetchApi<ImportedRecipeData>('/import', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },
};
