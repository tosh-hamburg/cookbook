/**
 * Gemeinsame Typdefinitionen für Security-Tests
 */

export interface ApiResponse {
  error?: string;
  message?: string;
  token?: string;
  requires2FA?: boolean;
  user?: UserData;
  status?: string;
  id?: string;
  [key: string]: unknown;
}

export interface UserData {
  id: string;
  username: string;
  email?: string;
  role: string;
  [key: string]: unknown;
}

export interface LoginResponse extends ApiResponse {
  token?: string;
  requires2FA?: boolean;
  user?: UserData;
}

export interface HealthResponse {
  status: string;
  timestamp?: string;
}

/**
 * Typisierter JSON-Parser
 */
export async function parseJson<T = ApiResponse>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}
