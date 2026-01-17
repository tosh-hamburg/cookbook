export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  password: string; // WARNUNG: Nur für Demo! Niemals in Produktion!
  role: UserRole;
  createdAt: string;
}
