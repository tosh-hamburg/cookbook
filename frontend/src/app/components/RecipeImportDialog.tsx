import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { importRecipeFromUrl } from '@/app/utils/recipeImport';
import type { Recipe } from '@/app/types/recipe';
import { toast } from 'sonner';
import { useTranslation } from '@/app/i18n';

interface RecipeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (recipe: Recipe) => void;
}

/** Import per URL – gesteuerter Dialog, wird aus dem „Rezept anlegen“-Menü geöffnet. */
export function RecipeImportDialog({ open, onOpenChange, onImport }: RecipeImportDialogProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!url.trim()) {
      toast.error(t.recipeImport.enterUrl);
      return;
    }

    setLoading(true);
    try {
      const recipe = await importRecipeFromUrl(url);
      onImport(recipe);
      onOpenChange(false);
      setUrl('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t.recipes.importError;
      toast.error(errorMessage);
      console.error('Import error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.recipeImport.title}</DialogTitle>
          <DialogDescription>{t.recipeImport.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="url">{t.recipeImport.urlLabel}</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t.recipeImport.urlPlaceholder}
              disabled={loading}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleImport();
                }
              }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t.cancel}
          </Button>
          <Button onClick={handleImport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t.recipeImport.importing}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t.recipeImport.importButton}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
