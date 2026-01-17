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

// Auth API
export const authApi = {
  login: async (username: string, password: string): Promise<{ token: string; user: User }> => {
    const result = await fetchApi<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(result.token);
    setCurrentUserInStorage(result.user);
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
};

// Recipes API
export const recipesApi = {
  getAll: async (): Promise<Recipe[]> => {
    return fetchApi<Recipe[]>('/recipes');
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
