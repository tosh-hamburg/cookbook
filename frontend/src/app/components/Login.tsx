import { useState } from 'react';
import { LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { login } from '@/app/utils/auth';
import type { User } from '@/app/types/user';

interface LoginProps {
  onLogin: (user: User) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError('Ungültiger Benutzername oder Passwort');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Verbindungsfehler. Bitte versuchen Sie es später erneut.');
    } finally {
      setIsLoading(false);
    }
  };

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
          <CardTitle className="text-3xl font-bold">Cookbook</CardTitle>
          <CardDescription>
            Geben Sie Ihre Anmeldedaten ein, um auf Cookbook zuzugreifen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Benutzername</Label>
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
              <Label htmlFor="password">Passwort</Label>
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
              {isLoading ? 'Wird angemeldet...' : 'Anmelden'}
            </Button>
          </form>
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Demo-Zugangsdaten:</p>
            <div className="text-sm space-y-1">
              <p>
                <strong>Admin:</strong> admin / admin123
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Die Passwörter werden sicher mit bcrypt gehasht gespeichert.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
