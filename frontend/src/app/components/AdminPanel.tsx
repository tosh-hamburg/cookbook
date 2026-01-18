import { useState, useEffect } from 'react';
import { Settings, Save, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { CategoryManager } from '@/app/components/CategoryManager';
import { CollectionManager } from '@/app/components/CollectionManager';
import { UserManager } from '@/app/components/UserManager';
import { TwoFactorSetup } from '@/app/components/TwoFactorSetup';
import { ChangePassword } from '@/app/components/ChangePassword';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { toast } from 'sonner';
import { settingsApi } from '@/app/services/api';
import type { User } from '@/app/types/user';

interface AdminPanelProps {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (user: User) => void;
  onSettingsUpdate?: () => void;
}

const DEFAULT_GEMINI_PROMPT = 'Füge bitte folgende Zutaten zu meiner Einkaufsliste in Google Keep hinzu (erstelle die Liste "Einkaufsliste" falls sie nicht existiert):';

export function AdminPanel({ currentUser, onClose, onUserUpdate, onSettingsUpdate }: AdminPanelProps) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(currentUser.twoFactorEnabled || false);
  const [geminiPrompt, setGeminiPrompt] = useState(DEFAULT_GEMINI_PROMPT);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const isAdmin = currentUser.role === 'admin';

  // Load settings on mount
  useEffect(() => {
    if (isAdmin) {
      loadSettings();
    }
  }, [isAdmin]);

  const loadSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const settings = await settingsApi.getGeminiPrompt();
      if (settings.geminiPrompt) {
        setGeminiPrompt(settings.geminiPrompt);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const saveGeminiPrompt = async () => {
    setIsSavingSettings(true);
    try {
      await settingsApi.updateGeminiPrompt(geminiPrompt);
      toast.success('Gemini-Prompt gespeichert');
      onSettingsUpdate?.();
    } catch (error) {
      console.error('Error saving Gemini prompt:', error);
      toast.error('Fehler beim Speichern des Prompts');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTwoFactorChange = (enabled: boolean) => {
    setTwoFactorEnabled(enabled);
    if (onUserUpdate) {
      onUserUpdate({ ...currentUser, twoFactorEnabled: enabled });
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8" />
          <div>
            <h1>Verwaltung</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Systemeinstellungen und Benutzerverwaltung' : 'Profileinstellungen'}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={onClose}>
          Zurück zu Rezepten
        </Button>
      </div>

      <Tabs defaultValue={isAdmin ? "categories" : "security"} className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-5' : 'grid-cols-1'}`}>
          {isAdmin && (
            <>
              <TabsTrigger value="categories">Kategorien</TabsTrigger>
              <TabsTrigger value="collections">Sammlungen</TabsTrigger>
              <TabsTrigger value="users">Benutzer</TabsTrigger>
              <TabsTrigger value="settings">Einstellungen</TabsTrigger>
            </>
          )}
          <TabsTrigger value="security">Sicherheit</TabsTrigger>
        </TabsList>
        
        {isAdmin && (
          <>
            <TabsContent value="categories" className="mt-6">
              <CategoryManager />
            </TabsContent>
            <TabsContent value="collections" className="mt-6">
              <CollectionManager />
            </TabsContent>
            <TabsContent value="users" className="mt-6">
              <UserManager currentUser={currentUser} />
            </TabsContent>
            <TabsContent value="settings" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Gemini-Integration</CardTitle>
                  <CardDescription>
                    Konfigurieren Sie den Einleitungstext, der beim Export von Zutaten an Gemini verwendet wird.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingSettings ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="geminiPrompt">Einleitungstext für Gemini</Label>
                        <Textarea
                          id="geminiPrompt"
                          value={geminiPrompt}
                          onChange={(e) => setGeminiPrompt(e.target.value)}
                          rows={4}
                          placeholder="Füge bitte folgende Zutaten zu meiner Einkaufsliste hinzu..."
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Dieser Text wird vor der Zutatenliste eingefügt, wenn Benutzer die Einkaufsliste an Gemini senden.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={saveGeminiPrompt} 
                          disabled={isSavingSettings}
                          className="gap-2"
                        >
                          {isSavingSettings ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Speichern
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => setGeminiPrompt(DEFAULT_GEMINI_PROMPT)}
                        >
                          Standard wiederherstellen
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
        
        <TabsContent value="security" className="mt-6">
          <div className="space-y-6">
            {/* User Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profil</CardTitle>
                <CardDescription>Ihre Kontoinformationen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-3">
                  {currentUser.avatar && (
                    <img 
                      src={currentUser.avatar} 
                      alt={currentUser.username} 
                      className="w-12 h-12 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium">{currentUser.username}</p>
                    {currentUser.email && (
                      <p className="text-sm text-muted-foreground">{currentUser.email}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Change Password */}
            <ChangePassword hasPassword={currentUser.hasPassword !== false} />

            {/* 2FA Setup */}
            <TwoFactorSetup 
              isEnabled={twoFactorEnabled}
              onStatusChange={handleTwoFactorChange}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
