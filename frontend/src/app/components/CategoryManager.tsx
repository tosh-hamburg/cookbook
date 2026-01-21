import { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Loader2 } from 'lucide-react';
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
import { loadCategories, addCategory, deleteCategory, getCategories } from '@/app/utils/categories';
import { toast } from 'sonner';
import { useTranslation } from '@/app/i18n';

export function CategoryManager() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const loadedCategories = await loadCategories();
        setCategories(loadedCategories);
      } catch (error) {
        console.error('Error loading categories:', error);
        toast.error(t.categoryManager.loadError);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCategories();
  }, [t]);

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      toast.error(t.categoryManager.createError);
      return;
    }
    if (categories.includes(trimmed)) {
      toast.error(t.categoryManager.createError);
      return;
    }

    setIsAdding(true);
    try {
      await addCategory(trimmed);
      setCategories(getCategories());
      setNewCategory('');
      toast.success(t.categoryManager.created);
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error(t.categoryManager.createError);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (categoryToDelete) {
      setIsDeleting(true);
      try {
        await deleteCategory(categoryToDelete);
        setCategories(getCategories());
        setCategoryToDelete(null);
        toast.success(t.categoryManager.deleted);
      } catch (error) {
        console.error('Error deleting category:', error);
        toast.error(t.categoryManager.deleteError);
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
            <Tag className="h-5 w-5" />
            <CardTitle>{t.categoryManager.title}</CardTitle>
          </div>
          <CardDescription>
            {t.categoryManager.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder={t.categoryManager.placeholder}
              disabled={isAdding}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
            />
            <Button onClick={handleAddCategory} disabled={isAdding}>
              {isAdding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {t.categoryManager.add}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t.categoryManager.title}:</p>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loading}
              </div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.categoryManager.noCategories}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Badge key={category} variant="secondary" className="text-sm px-3 py-1.5">
                    {category}
                    <button
                      onClick={() => setCategoryToDelete(category)}
                      className="ml-2 hover:text-destructive"
                      aria-label={`${t.delete} ${category}`}
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
            <AlertDialogTitle>{t.categoryManager.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.categoryManager.confirmDeleteDescription.replace('{name}', categoryToDelete || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCategory} 
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
