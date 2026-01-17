import { Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { CategoryManager } from '@/app/components/CategoryManager';
import { UserManager } from '@/app/components/UserManager';
import { Button } from '@/app/components/ui/button';
import type { User } from '@/app/types/user';

interface AdminPanelProps {
  currentUser: User;
  onClose: () => void;
}

export function AdminPanel({ currentUser, onClose }: AdminPanelProps) {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8" />
          <div>
            <h1>Verwaltung</h1>
            <p className="text-sm text-muted-foreground">
              Systemeinstellungen und Benutzerverwaltung
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={onClose}>
          Zurück zu Rezepten
        </Button>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="categories">Kategorien</TabsTrigger>
          <TabsTrigger value="users">Benutzer</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-6">
          <CategoryManager />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UserManager currentUser={currentUser} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
