import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, FolderOpen } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
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
import { collectionsApi, type Collection } from '@/app/services/api';
import { toast } from 'sonner';
import { useTranslation } from '@/app/i18n';

export function CollectionManager() {
  const { t } = useTranslation();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const loadCollections = async () => {
    try {
      const data = await collectionsApi.getAll();
      setCollections(data);
    } catch (error) {
      console.error('Error loading collections:', error);
      toast.error(t.collectionManager.loadError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error(t.collectionManager.createError);
      return;
    }

    try {
      await collectionsApi.create(newName.trim(), newDescription.trim() || undefined);
      toast.success(t.collectionManager.created);
      setShowAddDialog(false);
      setNewName('');
      setNewDescription('');
      loadCollections();
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error(t.collectionManager.createError);
    }
  };

  const handleEdit = async () => {
    if (!selectedCollection || !newName.trim()) {
      toast.error(t.collectionManager.createError);
      return;
    }

    try {
      await collectionsApi.update(selectedCollection.id, {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      toast.success(t.collectionManager.created);
      setShowEditDialog(false);
      setSelectedCollection(null);
      setNewName('');
      setNewDescription('');
      loadCollections();
    } catch (error) {
      console.error('Error updating collection:', error);
      toast.error(t.collectionManager.createError);
    }
  };

  const handleDelete = async () => {
    if (!selectedCollection) return;

    try {
      await collectionsApi.delete(selectedCollection.id);
      toast.success(t.collectionManager.deleted);
      setShowDeleteDialog(false);
      setSelectedCollection(null);
      loadCollections();
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error(t.collectionManager.deleteError);
    }
  };

  const openEditDialog = (collection: Collection) => {
    setSelectedCollection(collection);
    setNewName(collection.name);
    setNewDescription(collection.description || '');
    setShowEditDialog(true);
  };

  const openDeleteDialog = (collection: Collection) => {
    setSelectedCollection(collection);
    setShowDeleteDialog(true);
  };

  if (isLoading) {
    return <div className="text-center py-8">{t.loading}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t.collectionManager.title}</h2>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t.collectionManager.newCollection}
        </Button>
      </div>

      {collections.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t.collectionManager.noCollections}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {collections.map((collection) => (
            <Card key={collection.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{collection.name}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(collection)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(collection)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {collection.description && (
                  <p className="text-sm text-muted-foreground mb-2">{collection.description}</p>
                )}
                <p className="text-sm">
                  <strong>{collection.recipeCount}</strong> {t.categoryManager.recipesCount.replace('{count}', '').trim()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.collectionManager.newCollection}</DialogTitle>
            <DialogDescription>
              {t.collectionManager.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.collectionManager.placeholder}</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t.collectionManager.placeholder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleAdd}>{t.collectionManager.create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.edit}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t.collectionManager.placeholder}</Label>
              <Input
                id="edit-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleEdit}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.collectionManager.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.collectionManager.confirmDeleteDescription.replace('{name}', selectedCollection?.name || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
