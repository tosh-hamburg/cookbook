import { Clock, Flame, Pencil, Trash2, ChevronLeft, ChevronRight, ExternalLink, Users, Minus, Plus, ShoppingCart, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';
import type { Recipe, Ingredient } from '@/app/types/recipe';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
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
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

interface RecipeDetailProps {
  recipe: Recipe;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

// Helper function to scale ingredient amounts
function scaleIngredientAmount(amount: string, factor: number): string {
  if (!amount || factor === 1) return amount;
  
  // Match numbers (including decimals and fractions like 1/2)
  const result = amount.replace(/(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)/g, (match) => {
    // Handle fractions like "1/2"
    if (match.includes('/')) {
      const [num, denom] = match.split('/').map(s => parseFloat(s.trim().replace(',', '.')));
      const value = (num / denom) * factor;
      // Format nicely
      if (value === Math.floor(value)) {
        return String(value);
      }
      // Check for common fractions
      const remainder = value % 1;
      if (Math.abs(remainder - 0.5) < 0.01) return `${Math.floor(value) || ''}½`.trim();
      if (Math.abs(remainder - 0.25) < 0.01) return `${Math.floor(value) || ''}¼`.trim();
      if (Math.abs(remainder - 0.75) < 0.01) return `${Math.floor(value) || ''}¾`.trim();
      if (Math.abs(remainder - 0.333) < 0.02) return `${Math.floor(value) || ''}⅓`.trim();
      if (Math.abs(remainder - 0.666) < 0.02) return `${Math.floor(value) || ''}⅔`.trim();
      return value.toFixed(1).replace('.', ',');
    }
    
    // Handle regular numbers
    const num = parseFloat(match.replace(',', '.'));
    const scaled = num * factor;
    
    // Format result
    if (scaled === Math.floor(scaled)) {
      return String(scaled);
    }
    // Round to max 1 decimal place
    return scaled.toFixed(1).replace('.', ',').replace(/,0$/, '');
  });
  
  return result;
}

export function RecipeDetail({ recipe, onClose, onEdit, onDelete }: RecipeDetailProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentServings, setCurrentServings] = useState(recipe.servings || 4);
  
  // Calculate the scaling factor
  const scaleFactor = currentServings / (recipe.servings || 4);
  
  // Scale ingredients based on current servings
  const scaledIngredients = useMemo<Ingredient[]>(() => {
    return recipe.ingredients.map(ing => ({
      name: ing.name,
      amount: scaleIngredientAmount(ing.amount, scaleFactor)
    }));
  }, [recipe.ingredients, scaleFactor]);
  
  const decreaseServings = () => {
    if (currentServings > 1) {
      setCurrentServings(currentServings - 1);
    }
  };
  
  const increaseServings = () => {
    if (currentServings < 99) {
      setCurrentServings(currentServings + 1);
    }
  };

  const displayImages = recipe.images && recipe.images.length > 0 
    ? recipe.images 
    : ['https://images.unsplash.com/photo-1506368249639-73a05d6f6488?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb29raW5nJTIwaW5ncmVkaWVudHN8ZW58MXx8fHwxNzY4NjIxNTQxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % displayImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  const handleDelete = () => {
    onDelete();
    setShowDeleteDialog(false);
  };

  // Send ingredients to Google Keep via Gemini
  const sendToGoogleKeep = async () => {
    // Format ingredients as a list
    const ingredientsList = scaledIngredients
      .map(ing => ing.amount ? `${ing.amount} ${ing.name}` : ing.name)
      .join('\n');
    
    // Create Gemini prompt
    const prompt = `Füge bitte folgende Zutaten zu meiner Einkaufsliste in Google Keep hinzu (erstelle die Liste "Einkaufsliste" falls sie nicht existiert):

${recipe.title} (${currentServings} Portionen):
${ingredientsList}`;
    
    try {
      // Copy prompt to clipboard
      await navigator.clipboard.writeText(prompt);
      toast.success('Prompt in Zwischenablage kopiert!', {
        description: 'Füge ihn in Gemini ein und sende ab.',
      });
      
      // Open Gemini in new tab
      window.open('https://gemini.google.com/app', '_blank');
    } catch (err) {
      // Fallback: Show prompt in alert if clipboard fails
      toast.error('Konnte nicht in Zwischenablage kopieren', {
        description: 'Bitte kopiere den Text manuell.',
      });
      console.error('Clipboard error:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={onClose}>
          ← Zurück
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Bearbeiten
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Löschen
          </Button>
        </div>
      </div>

      {/* Bildergalerie */}
      <div className="relative h-96 w-full overflow-hidden rounded-lg mb-6">
        <ImageWithFallback
          src={displayImages[currentImageIndex]}
          alt={`${recipe.title} - Bild ${currentImageIndex + 1}`}
          className="w-full h-full object-cover"
        />
        {displayImages.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2"
              onClick={prevImage}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2"
              onClick={nextImage}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              {currentImageIndex + 1} / {displayImages.length}
            </div>
          </>
        )}
      </div>

      <h1 className="mb-4">{recipe.title}</h1>

      {/* Quell-URL, wenn vorhanden */}
      {recipe.sourceUrl && (
        <div className="mb-4">
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Originalrezept anzeigen
          </a>
        </div>
      )}

      {/* Zeitinformationen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span>Vorbereitung</span>
            </div>
            <p className="font-semibold">{recipe.prepTime} Min</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span>Ruhezeit</span>
            </div>
            <p className="font-semibold">{recipe.restTime} Min</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span>Kochzeit</span>
            </div>
            <p className="font-semibold">{recipe.cookTime} Min</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Flame className="h-4 w-4" />
              <span>Kalorien</span>
            </div>
            <p className="font-semibold">{recipe.caloriesPerUnit} kcal/{recipe.weightUnit}</p>
          </CardContent>
        </Card>
      </div>

      {/* Zutaten */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <CardTitle>Zutaten</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={sendToGoogleKeep}
                className="text-xs"
              >
                <ShoppingCart className="h-3 w-3 mr-1" />
                An Einkaufsliste
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={decreaseServings}
                disabled={currentServings <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 min-w-[100px] justify-center">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{currentServings}</span>
                <span className="text-sm text-muted-foreground">
                  {currentServings === 1 ? 'Portion' : 'Portionen'}
                </span>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={increaseServings}
                disabled={currentServings >= 99}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {currentServings !== recipe.servings && (
            <p className="text-xs text-muted-foreground mt-2">
              Originalrezept für {recipe.servings} {recipe.servings === 1 ? 'Portion' : 'Portionen'}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <ul className="space-y-1">
            {scaledIngredients.map((ingredient, index) => (
              <li key={index} className="flex items-baseline py-1.5 border-b border-dashed border-muted last:border-0">
                <span className="w-24 sm:w-28 flex-shrink-0 font-medium text-right pr-4 text-muted-foreground">
                  {ingredient.amount}
                </span>
                <span className="flex-1">{ingredient.name}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Zubereitung */}
      <Card>
        <CardHeader>
          <CardTitle>Zubereitung</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line">{recipe.instructions}</p>
        </CardContent>
      </Card>

      {/* Lösch-Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rezept löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie das Rezept "{recipe.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
