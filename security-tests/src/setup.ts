import { CONFIG } from './config';

// API Response Typ
interface ApiJsonResponse {
  error?: string;
  message?: string;
  token?: string;
  requires2FA?: boolean;
  user?: { id: string; username: string; role: string; [key: string]: any };
  status?: string;
  id?: string;
  [key: string]: any;
}

// Erweiterte Response mit typisiertem json()
interface TypedResponse extends Response {
  json(): Promise<ApiJsonResponse>;
}

// Typen für globale Funktionen
declare global {
  function fetchApi(endpoint: string, options?: RequestInit): Promise<TypedResponse>;
  var testTokens: {
    user?: string;
    admin?: string;
  };
}

// Globaler Token-Speicher
global.testTokens = {};

// Global setup
beforeAll(() => {
  console.log('\n' + '='.repeat(60));
  console.log('🔐 COOKBOOK SECURITY TESTS');
  console.log('='.repeat(60));
  console.log(`📍 Ziel: ${CONFIG.API_URL}`);
  console.log(`👤 Test-User: ${CONFIG.TEST_USER.username}`);
  console.log(`👑 Admin-User: ${CONFIG.ADMIN_USER.username}`);
  if (CONFIG.DRY_RUN) {
    console.log('🔒 DRY-RUN-Modus: Keine Daten werden modifiziert');
  }
  console.log('='.repeat(60) + '\n');
});

afterAll(() => {
  console.log('\n' + '='.repeat(60));
  console.log('🏁 Tests abgeschlossen');
  console.log('='.repeat(60) + '\n');
});

/**
 * Utility für API-Requests
 */
global.fetchApi = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<TypedResponse> => {
  const url = `${CONFIG.API_URL}${endpoint}`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return response as TypedResponse;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Helper: Login und Token holen
 */
export async function getToken(type: 'user' | 'admin'): Promise<string | null> {
  // Cached Token verwenden
  if (type === 'user' && global.testTokens.user) {
    return global.testTokens.user;
  }
  if (type === 'admin' && global.testTokens.admin) {
    return global.testTokens.admin;
  }

  const credentials = type === 'admin' ? CONFIG.ADMIN_USER : CONFIG.TEST_USER;
  
  try {
    const res = await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password
      })
    });
    
    if (!res.ok) {
      console.warn(`⚠️ Login für ${type} fehlgeschlagen (Status: ${res.status})`);
      return null;
    }
    
    const data = await res.json() as { 
      token?: string; 
      requires2FA?: boolean; 
      user?: unknown 
    };
    
    if (data.requires2FA) {
      console.warn(`⚠️ ${type} erfordert 2FA - Tests teilweise übersprungen`);
      return null;
    }
    
    if (data.token) {
      if (type === 'user') {
        global.testTokens.user = data.token;
      } else {
        global.testTokens.admin = data.token;
      }
      return data.token;
    }
    
    return null;
  } catch (error) {
    console.warn(`⚠️ Login-Fehler für ${type}:`, error);
    return null;
  }
}

/**
 * Helper: Token-Header erstellen
 */
export function authHeader(token: string): Record<string, string> {
  return { 'Authorization': `Bearer ${token}` };
}
