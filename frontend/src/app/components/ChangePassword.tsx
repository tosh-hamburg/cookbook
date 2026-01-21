import { useState } from 'react';
import { Key, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { authApi } from '@/app/services/api';
import { toast } from 'sonner';
import { useTranslation } from '@/app/i18n';

interface ChangePasswordProps {
  hasPassword: boolean;
}

export function ChangePassword({ hasPassword }: ChangePasswordProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError(t.password.minLength);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t.password.mismatch);
      return;
    }

    setIsLoading(true);
    try {
      await authApi.changePassword(
        hasPassword ? currentPassword : null,
        newPassword
      );
      toast.success(t.password.changed);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || t.password.changeError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Key className="h-6 w-6 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg">{t.password.title}</CardTitle>
            <CardDescription>
              {hasPassword 
                ? t.password.changeExisting
                : t.password.setNew}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t.password.currentPassword}</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t.password.newPassword}</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t.password.minLength}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t.password.confirmPassword}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading || !newPassword || !confirmPassword}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {hasPassword ? t.password.changeButton : t.password.setButton}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
