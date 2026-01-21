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
import { useTranslation } from '@/app/i18n';

interface UserManagerProps {
  currentUser: User;
}

export function UserManager({ currentUser }: UserManagerProps) {
  const { t } = useTranslation();
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
        toast.error(t.userManager.loadError);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, [t]);

  const handleCreateUser = async () => {
    const trimmedUsername = newUsername.trim();
    const trimmedPassword = newPassword.trim();

    if (!trimmedUsername || !trimmedPassword) {
      toast.error(t.userManager.validationError);
      return;
    }

    if (users.some(u => u.username === trimmedUsername)) {
      toast.error(t.userManager.validationError);
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
      toast.success(t.userManager.created);
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(t.userManager.createError);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (userToDelete) {
      if (userToDelete.id === currentUser.id) {
        toast.error(t.userManager.validationError);
        setUserToDelete(null);
        return;
      }

      setIsDeleting(true);
      try {
        await deleteUser(userToDelete.id);
        const loadedUsers = await getUsers();
        setUsers(loadedUsers);
        setUserToDelete(null);
        toast.success(t.userManager.deleted);
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error(t.userManager.deleteError);
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
            <CardTitle>{t.userManager.title}</CardTitle>
          </div>
          <CardDescription>
            {t.userManager.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-medium">{t.userManager.createUser}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-username">{t.userManager.username}</Label>
                <Input
                  id="new-username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="username"
                  disabled={isCreating}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">{t.userManager.password}</Label>
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
                <Label htmlFor="new-role">{t.userManager.role}</Label>
                <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)} disabled={isCreating}>
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">{t.userManager.user}</SelectItem>
                    <SelectItem value="admin">{t.userManager.admin}</SelectItem>
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
              {isCreating ? t.loading : t.userManager.createUser}
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">{t.userManager.title}</h3>
            <div className="border rounded-lg">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.userManager.username}</TableHead>
                      <TableHead>{t.userManager.role}</TableHead>
                      <TableHead></TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.username}
                          {user.id === currentUser.id && (
                            <Badge variant="outline" className="ml-2">{t.userManager.you}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' ? (
                              <><Shield className="h-3 w-3 mr-1" />{t.userManager.admin}</>
                            ) : (
                              <><UserIcon className="h-3 w-3 mr-1" />{t.userManager.user}</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
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
            <AlertDialogTitle>{t.userManager.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.userManager.confirmDeleteDescription.replace('{name}', userToDelete?.username || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.loading}</>
              ) : (
                t.delete
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
