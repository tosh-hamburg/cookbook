import { useState, useEffect } from 'react';
import { Plus, Trash2, Tag } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
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
import { getCategories, addCategory, deleteCategory } from '@/app/utils/categories';
import { toast } from 'sonner';

export function CategoryManager() {
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  useEffect(() => {
    setCategories(getCategories());
  }, []);

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      toast.error('Bitte geben Sie einen Kategorienamen ein');
      return;
    }
    if (categories.includes(trimmed)) {
      toast.error('Diese Kategorie existiert bereits');
      return;
    }
    addCategory(trimmed);
    setCategories(getCategories());
    setNewCategory('');
    toast.success('Kategorie hinzugefügt');
  };

  const handleDeleteCategory = () => {
    if (categoryToDelete) {
      deleteCategory(categoryToDelete);
      setCategories(getCategories());
      setCategoryToDelete(null);
      toast.success('Kategorie gelöscht');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            <CardTitle>Kategorien verwalten</CardTitle>
          </div>
          <CardDescription>
            Erstellen und verwalten Sie Kategorien für Ihre Rezepte
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Neue Kategorie"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
            />
            <Button onClick={handleAddCategory}>
              <Plus className="h-4 w-4 mr-2" />
              Hinzufügen
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Vorhandene Kategorien:</p>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Kategorien vorhanden</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Badge key={category} variant="secondary" className="text-sm px-3 py-1.5">
                    {category}
                    <button
                      onClick={() => setCategoryToDelete(category)}
                      className="ml-2 hover:text-destructive"
                      aria-label={`${category} löschen`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Kategorie "{categoryToDelete}" wirklich löschen? Diese Kategorie wird aus allen Rezepten entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
