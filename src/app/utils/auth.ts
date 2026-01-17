import type { User } from '@/app/types/user';

const USERS_KEY = 'users';
const CURRENT_USER_KEY = 'currentUser';

// Initial-Admin erstellen, falls noch keine Benutzer existieren
export const initializeAuth = (): void => {
  const users = getUsers();
  if (users.length === 0) {
    const adminUser: User = {
      id: crypto.randomUUID(),
      username: 'admin',
      password: 'admin123', // WARNUNG: Nur für Demo!
      role: 'admin',
      createdAt: new Date().toISOString(),
    };
    saveUser(adminUser);
  }
};

export const getUsers = (): User[] => {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Fehler beim Laden der Benutzer:', error);
    return [];
  }
};

export const saveUser = (user: User): void => {
  const users = getUsers();
  const existingIndex = users.findIndex(u => u.id === user.id);
  if (existingIndex >= 0) {
    users[existingIndex] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const deleteUser = (userId: string): void => {
  const users = getUsers();
  const filtered = users.filter(u => u.id !== userId);
  localStorage.setItem(USERS_KEY, JSON.stringify(filtered));
};

export const login = (username: string, password: string): User | null => {
  const users = getUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return user;
  }
  return null;
};

export const logout = (): void => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
  try {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Fehler beim Laden des aktuellen Benutzers:', error);
    return null;
  }
};

export const isAdmin = (user: User | null): boolean => {
  return user?.role === 'admin';
};
