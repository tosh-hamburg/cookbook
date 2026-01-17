import type { User } from '@/app/types/user';
import { authApi, getToken, getCurrentUserFromStorage, setCurrentUserInStorage, removeToken, usersApi } from '@/app/services/api';

// Initialisiert die Auth - prüft ob Token noch gültig ist
export const initializeAuth = async (): Promise<User | null> => {
  const token = getToken();
  if (!token) {
    return null;
  }

  try {
    const user = await authApi.getCurrentUser();
    setCurrentUserInStorage(user);
    return user;
  } catch {
    // Token ungültig oder abgelaufen
    removeToken();
    return null;
  }
};

export const getUsers = async (): Promise<User[]> => {
  try {
    return await usersApi.getAll();
  } catch (error) {
    console.error('Fehler beim Laden der Benutzer:', error);
    return [];
  }
};

export const saveUser = async (user: Omit<User, 'id' | 'createdAt'> & { id?: string }): Promise<User> => {
  try {
    if (user.id) {
      // Update existing user
      return await usersApi.update(user.id, {
        username: user.username,
        password: user.password,
        role: user.role
      });
    } else {
      // Create new user
      return await usersApi.create(user.username, user.password, user.role);
    }
  } catch (error) {
    console.error('Fehler beim Speichern des Benutzers:', error);
    throw error;
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  try {
    await usersApi.delete(userId);
  } catch (error) {
    console.error('Fehler beim Löschen des Benutzers:', error);
    throw error;
  }
};

export const login = async (username: string, password: string): Promise<User | null> => {
  try {
    const result = await authApi.login(username, password);
    return result.user;
  } catch (error) {
    console.error('Fehler bei der Anmeldung:', error);
    return null;
  }
};

export const logout = (): void => {
  authApi.logout();
};

export const getCurrentUser = (): User | null => {
  return getCurrentUserFromStorage();
};

export const isAdmin = (user: User | null): boolean => {
  return user?.role === 'admin';
};
