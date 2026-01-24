import { useState, useEffect, useCallback } from 'react';
import { LogIn, AlertCircle, Loader2, Shield } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Separator } from '@/app/components/ui/separator';
import { authApi } from '@/app/services/api';
import type { User } from '@/app/types/user';
import { useTranslation } from '@/app/i18n';

// Google Client ID from environment
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

interface LoginProps {
  onLogin: (user: User) => void;
}

export function Login({ onLogin }: LoginProps) {
  const { t, language } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<string | null>(null);

  // Initialize Google Sign-In
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-button'),
          { 
            theme: 'outline', 
            size: 'large', 
            width: '100%',
            text: 'signin_with',
            locale: language
          }
        );
      }
    };

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleGoogleResponse = useCallback(async (response: { credential: string }) => {
    setError('');
    setIsLoading(true);
    
    try {
      const result = await authApi.googleLogin(response.credential);
      
      if (result.requires2FA) {
        setRequires2FA(true);
        setPendingGoogleCredential(response.credential);
      } else if (result.user) {
        onLogin(result.user);
      }
    } catch (err) {
      console.error('Google login error:', err);
      // Show backend error message or fallback
      const errorMessage = err instanceof Error ? err.message : t.login.googleError;
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [onLogin, t.login.googleError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await authApi.login(
        username, 
        password, 
        requires2FA ? twoFactorCode : undefined
      );
      
      if (result.requires2FA && !requires2FA) {
        setRequires2FA(true);
      } else if (result.user) {
        onLogin(result.user);
      } else {
        setError(t.login.invalidCredentials);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || t.login.connectionError);
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let result;
      
      if (pendingGoogleCredential) {
        // Google login with 2FA
        result = await authApi.googleLogin(pendingGoogleCredential, twoFactorCode);
      } else {
        // Regular login with 2FA
        result = await authApi.login(username, password, twoFactorCode);
      }
      
      if (result.user) {
        onLogin(result.user);
      } else {
        setError(t.login.invalidCode);
      }
    } catch (err: any) {
      console.error('2FA error:', err);
      setError(err.message || t.login.invalidCode);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelTwoFactor = () => {
    setRequires2FA(false);
    setTwoFactorCode('');
    setPendingGoogleCredential(null);
    setError('');
  };

  // 2FA verification screen
  if (requires2FA) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1920&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="fixed inset-0 bg-black/50" style={{ zIndex: -1 }} />
        
        <Card className="w-full max-w-md backdrop-blur-sm bg-card/95 shadow-2xl border-0">
          <CardHeader className="space-y-1 text-center">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">{t.login.twoFactorTitle}</CardTitle>
            <CardDescription>
              {t.login.twoFactorDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handle2FASubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="twoFactorCode">{t.login.twoFactorCode}</Label>
                <Input
                  id="twoFactorCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  autoComplete="one-time-code"
                  disabled={isLoading}
                  className="text-center text-2xl tracking-widest"
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isLoading || twoFactorCode.length !== 6}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                {isLoading ? t.login.verifying : t.login.verify}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={cancelTwoFactor}>
                {t.login.backToLogin}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        backgroundImage: 'url("https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1920&q=80")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/50" style={{ zIndex: -1 }} />
      
      <Card className="w-full max-w-md backdrop-blur-sm bg-card/95 shadow-2xl border-0">
        <CardHeader className="space-y-1 text-center">
          <div className="text-5xl mb-2">📖</div>
          <CardTitle className="text-3xl font-bold">{t.login.title}</CardTitle>
          <CardDescription>
            {t.login.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Google Sign-In Button */}
          {GOOGLE_CLIENT_ID && (
            <>
              <div id="google-signin-button" className="w-full flex justify-center mb-4" />
              
              <div className="relative my-4">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  {t.or}
                </span>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t.login.username}</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                autoComplete="username"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.login.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4 mr-2" />
              )}
              {isLoading ? t.login.loggingIn : t.login.loginButton}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// TypeScript declaration for Google Sign-In
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement | null, config: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}
