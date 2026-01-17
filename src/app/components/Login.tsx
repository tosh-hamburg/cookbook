import { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = login(username, password);
    if (user) {
      onLogin(user);
    } else {
      setError('Ungültiger Benutzername oder Passwort');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Anmelden</CardTitle>
          <CardDescription>
            Geben Sie Ihre Anmeldedaten ein, um auf die Rezeptverwaltung zuzugreifen
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
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full">
              <LogIn className="h-4 w-4 mr-2" />
              Anmelden
            </Button>
          </form>
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Demo-Zugangsdaten:</p>
            <div className="text-sm space-y-1">
              <p>
                <strong>Admin:</strong> admin / admin123
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ Dies ist eine Demo-Implementierung. Passwörter werden im Klartext gespeichert und sind NICHT sicher!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
