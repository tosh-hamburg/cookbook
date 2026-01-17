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

export function CollectionManager() {
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
      toast.error('Fehler beim Laden der Sammlungen');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }

    try {
      await collectionsApi.create(newName.trim(), newDescription.trim() || undefined);
      toast.success('Sammlung erstellt');
      setShowAddDialog(false);
      setNewName('');
      setNewDescription('');
      loadCollections();
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error('Fehler beim Erstellen der Sammlung');
    }
  };

  const handleEdit = async () => {
    if (!selectedCollection || !newName.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }

    try {
      await collectionsApi.update(selectedCollection.id, {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      toast.success('Sammlung aktualisiert');
      setShowEditDialog(false);
      setSelectedCollection(null);
      setNewName('');
      setNewDescription('');
      loadCollections();
    } catch (error) {
      console.error('Error updating collection:', error);
      toast.error('Fehler beim Aktualisieren der Sammlung');
    }
  };

  const handleDelete = async () => {
    if (!selectedCollection) return;

    try {
      await collectionsApi.delete(selectedCollection.id);
      toast.success('Sammlung gelöscht');
      setShowDeleteDialog(false);
      setSelectedCollection(null);
      loadCollections();
    } catch (error) {
      console.error('Error deleting collection:', error);
      toast.error('Fehler beim Löschen der Sammlung');
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
    return <div className="text-center py-8">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sammlungen verwalten</h2>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Sammlung
        </Button>
      </div>

      {collections.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Keine Sammlungen vorhanden.</p>
            <p className="text-sm">Erstellen Sie Ihre erste Sammlung, um Rezepte zu organisieren.</p>
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
                  <strong>{collection.recipeCount}</strong> Rezept{collection.recipeCount !== 1 ? 'e' : ''}
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
            <DialogTitle>Neue Sammlung erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie eine neue Sammlung, um Rezepte zu organisieren.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z.B. Sommerrezepte"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Textarea
                id="description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Beschreibung der Sammlung..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAdd}>Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sammlung bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Beschreibung (optional)</Label>
              <Textarea
                id="edit-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleEdit}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sammlung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Sammlung "{selectedCollection?.name}" wirklich löschen?
              Die Rezepte bleiben erhalten, werden aber aus dieser Sammlung entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
