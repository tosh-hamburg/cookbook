import { useState } from 'react';
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { authApi } from '@/app/services/api';
import { toast } from 'sonner';
import { useTranslation } from '@/app/i18n';

interface TwoFactorSetupProps {
  isEnabled: boolean;
  onStatusChange: (enabled: boolean) => void;
}

export function TwoFactorSetup({ isEnabled, onStatusChange }: TwoFactorSetupProps) {
  const { t } = useTranslation();
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const startSetup = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const result = await authApi.setup2FA();
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setShowSetupDialog(true);
    } catch (err: any) {
      toast.error(err.message || t.twoFactor.setupError);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (verificationCode.length !== 6) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      await authApi.verify2FA(verificationCode);
      toast.success(t.twoFactor.enableSuccess);
      onStatusChange(true);
      setShowSetupDialog(false);
      resetState();
    } catch (err: any) {
      setError(err.message || t.login.invalidCode);
    } finally {
      setIsLoading(false);
    }
  };

  const disable2FA = async () => {
    if (disableCode.length !== 6) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      await authApi.disable2FA(disableCode);
      toast.success(t.twoFactor.disableSuccess);
      onStatusChange(false);
      setShowDisableDialog(false);
      resetState();
    } catch (err: any) {
      setError(err.message || t.login.invalidCode);
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setQrCode(null);
    setSecret(null);
    setVerificationCode('');
    setDisableCode('');
    setError('');
  };

  const copySecret = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {isEnabled ? (
              <ShieldCheck className="h-6 w-6 text-green-500" />
            ) : (
              <Shield className="h-6 w-6 text-muted-foreground" />
            )}
            <div>
              <CardTitle className="text-lg">{t.twoFactor.title}</CardTitle>
              <CardDescription>
                {isEnabled 
                  ? t.twoFactor.enabled
                  : t.twoFactor.disabled}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEnabled ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <ShieldCheck className="h-4 w-4" />
                <span>{t.twoFactor.active}</span>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowDisableDialog(true)}
                className="text-destructive hover:text-destructive"
              >
                <ShieldOff className="h-4 w-4 mr-2" />
                {t.twoFactor.disable}
              </Button>
            </div>
          ) : (
            <Button onClick={startSetup} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              {t.twoFactor.enable}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={(open) => { setShowSetupDialog(open); if (!open) resetState(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.twoFactor.setupTitle}</DialogTitle>
            <DialogDescription>
              {t.twoFactor.setupDescription}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {qrCode && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            )}
            
            {secret && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {t.twoFactor.manualCode}
                </Label>
                <div className="flex gap-2">
                  <Input 
                    value={secret} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={copySecret}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="verificationCode">{t.twoFactor.enterCode}</Label>
              <Input
                id="verificationCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-xl tracking-widest"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
              {t.cancel}
            </Button>
            <Button 
              onClick={verifyAndEnable} 
              disabled={isLoading || verificationCode.length !== 6}
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.twoFactor.enable}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={(open) => { setShowDisableDialog(open); if (!open) resetState(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.twoFactor.disableTitle}</DialogTitle>
            <DialogDescription>
              {t.twoFactor.disableDescription}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disableCode">{t.twoFactor.code}</Label>
              <Input
                id="disableCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-xl tracking-widest"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              {t.cancel}
            </Button>
            <Button 
              variant="destructive"
              onClick={disable2FA} 
              disabled={isLoading || disableCode.length !== 6}
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.twoFactor.disable}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
