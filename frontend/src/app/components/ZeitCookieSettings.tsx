import { useEffect, useState } from 'react';
import { Loader2, Save, Trash2, CheckCircle2, CircleX, Newspaper } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { toast } from 'sonner';
import { zeitCookieApi, type ZeitCookieStatus } from '@/app/services/api';
import { useTranslation } from '@/app/i18n';

export function ZeitCookieSettings() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ZeitCookieStatus | null>(null);
  const [cookieInput, setCookieInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await zeitCookieApi.getStatus();
        if (!cancelled) setStatus(s);
      } catch (err) {
        console.error('Error loading Zeit cookie status:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (!cookieInput.trim()) return;
    setIsSaving(true);
    try {
      const updated = await zeitCookieApi.save(cookieInput);
      setStatus(updated);
      setCookieInput('');
      toast.success(t.zeitCookie.saved);
    } catch (err: any) {
      toast.error(err?.message || t.zeitCookie.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      const updated = await zeitCookieApi.clear();
      setStatus(updated);
      toast.success(t.zeitCookie.cleared);
    } catch (err: any) {
      toast.error(err?.message || t.zeitCookie.clearError);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Newspaper className="h-6 w-6 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg">{t.zeitCookie.title}</CardTitle>
            <CardDescription>{t.zeitCookie.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {status?.isSet ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  {t.zeitCookie.connected}
                  {status.setAt && (
                    <span className="text-muted-foreground">
                      {' '}
                      ({new Date(status.setAt).toLocaleString()})
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CircleX className="h-4 w-4" />
                <AlertDescription>{t.zeitCookie.notConnected}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="zeitCookie">{t.zeitCookie.inputLabel}</Label>
              <Textarea
                id="zeitCookie"
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                rows={4}
                placeholder="zeit_sso_201501=eyJh...; zeit_sso_piano_201501=eyJh...; zeit_sso_session_201501=eyJh..."
                className="font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground whitespace-pre-line">
                {t.zeitCookie.inputHint}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={isSaving || !cookieInput.trim()} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t.save}
              </Button>
              {status?.isSet && (
                <Button variant="outline" onClick={handleClear} disabled={isClearing} className="gap-2">
                  {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {t.zeitCookie.clearButton}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
