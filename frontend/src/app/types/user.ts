export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  email?: string;
  password?: string; // Optional für Google OAuth Users
  role: UserRole;
  avatar?: string;
  twoFactorEnabled?: boolean;
  hasPassword?: boolean; // Ob Benutzer ein Passwort hat (Google-only users haben keins)
  createdAt: string;
}
