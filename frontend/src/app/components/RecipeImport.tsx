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
  DialogTrigger,
} from '@/app/components/ui/dialog';
import { importRecipeFromUrl } from '@/app/utils/recipeImport';
import type { Recipe } from '@/app/types/recipe';
import { toast } from 'sonner';

interface RecipeImportProps {
  onImport: (recipe: Recipe) => void;
}

export function RecipeImport({ onImport }: RecipeImportProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!url.trim()) {
      toast.error('Bitte geben Sie eine URL ein');
      return;
    }

    setLoading(true);
    try {
      const recipe = await importRecipeFromUrl(url);
      onImport(recipe);
      toast.success('Rezept erfolgreich importiert!');
      setOpen(false);
      setUrl('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Importieren des Rezepts';
      toast.error(errorMessage);
      console.error('Import error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Rezept importieren
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rezept importieren</DialogTitle>
          <DialogDescription>
            Geben Sie die URL eines Rezepts ein (z.B. von Chefkoch.de), um es zu importieren.
            Das Rezept wird automatisch von der Website extrahiert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="url">Rezept-URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.chefkoch.de/rezepte/..."
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleImport();
                }
              }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleImport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importiere...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Importieren
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
