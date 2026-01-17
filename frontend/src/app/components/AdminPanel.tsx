import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { CategoryManager } from '@/app/components/CategoryManager';
import { CollectionManager } from '@/app/components/CollectionManager';
import { UserManager } from '@/app/components/UserManager';
import { TwoFactorSetup } from '@/app/components/TwoFactorSetup';
import { ChangePassword } from '@/app/components/ChangePassword';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import type { User } from '@/app/types/user';

interface AdminPanelProps {
  currentUser: User;
  onClose: () => void;
  onUserUpdate?: (user: User) => void;
}

export function AdminPanel({ currentUser, onClose, onUserUpdate }: AdminPanelProps) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(currentUser.twoFactorEnabled || false);
  const isAdmin = currentUser.role === 'admin';

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
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-1'}`}>
          {isAdmin && (
            <>
              <TabsTrigger value="categories">Kategorien</TabsTrigger>
              <TabsTrigger value="collections">Sammlungen</TabsTrigger>
              <TabsTrigger value="users">Benutzer</TabsTrigger>
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
