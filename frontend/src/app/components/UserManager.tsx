import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Shield, User as UserIcon, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Badge } from '@/app/components/ui/badge';
import { getUsers, saveUser, deleteUser } from '@/app/utils/auth';
import type { User, UserRole } from '@/app/types/user';
import { toast } from 'sonner';

interface UserManagerProps {
  currentUser: User;
}

export function UserManager({ currentUser }: UserManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const loadedUsers = await getUsers();
        setUsers(loadedUsers);
      } catch (error) {
        console.error('Error loading users:', error);
        toast.error('Fehler beim Laden der Benutzer');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    const trimmedUsername = newUsername.trim();
    const trimmedPassword = newPassword.trim();

    if (!trimmedUsername) {
      toast.error('Bitte geben Sie einen Benutzernamen ein');
      return;
    }
    
    if (!trimmedPassword) {
      toast.error('Bitte geben Sie ein Passwort ein');
      return;
    }

    if (users.some(u => u.username === trimmedUsername)) {
      toast.error('Benutzername bereits vergeben');
      return;
    }

    setIsCreating(true);
    try {
      await saveUser({
        username: trimmedUsername,
        password: trimmedPassword,
        role: newRole,
      });
      const loadedUsers = await getUsers();
      setUsers(loadedUsers);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      toast.success('Benutzer erfolgreich erstellt');
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Fehler beim Erstellen des Benutzers');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (userToDelete) {
      if (userToDelete.id === currentUser.id) {
        toast.error('Sie können sich nicht selbst löschen');
        setUserToDelete(null);
        return;
      }

      setIsDeleting(true);
      try {
        await deleteUser(userToDelete.id);
        const loadedUsers = await getUsers();
        setUsers(loadedUsers);
        setUserToDelete(null);
        toast.success('Benutzer gelöscht');
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error('Fehler beim Löschen des Benutzers');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Benutzerverwaltung</CardTitle>
          </div>
          <CardDescription>
            Benutzer erstellen und verwalten
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-medium">Neuen Benutzer erstellen</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-username">Benutzername</Label>
                <Input
                  id="new-username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="benutzername"
                  disabled={isCreating}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Passwort</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isCreating}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Rolle</Label>
                <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)} disabled={isCreating}>
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Benutzer</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleCreateUser} disabled={isCreating}>
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {isCreating ? 'Wird erstellt...' : 'Benutzer erstellen'}
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Vorhandene Benutzer</h3>
            <div className="border rounded-lg">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Benutzername</TableHead>
                      <TableHead>Rolle</TableHead>
                      <TableHead>Erstellt am</TableHead>
                      <TableHead className="w-[100px]">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.username}
                          {user.id === currentUser.id && (
                            <Badge variant="outline" className="ml-2">Sie</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' ? (
                              <><Shield className="h-3 w-3 mr-1" />Administrator</>
                            ) : (
                              <><UserIcon className="h-3 w-3 mr-1" />Benutzer</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString('de-DE')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setUserToDelete(user)}
                            disabled={user.id === currentUser.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Benutzer "{userToDelete?.username}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Wird gelöscht...</>
              ) : (
                'Löschen'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
