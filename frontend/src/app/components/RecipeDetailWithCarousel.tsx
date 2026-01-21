import { Clock, Flame, Pencil, Trash2, ExternalLink, Users, Minus, Plus, ShoppingCart, FolderPlus, X } from 'lucide-react';
import Slider from 'react-slick';
import { toast } from 'sonner';
import type { Recipe, Ingredient } from '@/app/types/recipe';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
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
import { useState, useMemo, useEffect } from 'react';
import { collectionsApi, type Collection } from '@/app/services/api';
import { useTranslation } from '@/app/i18n';

interface RecipeDetailProps {
  recipe: Recipe;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin?: boolean;
  onRecipeUpdate?: (recipe: Recipe) => void;
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

export function RecipeDetailWithCarousel({ recipe, onClose, onEdit, onDelete, isAdmin, onRecipeUpdate }: RecipeDetailProps) {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentServings, setCurrentServings] = useState(recipe.servings || 4);
  const [availableCollections, setAvailableCollections] = useState<Collection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [showCollectionMenu, setShowCollectionMenu] = useState(false);
  
  // Load collections for admin users
  useEffect(() => {
    if (isAdmin) {
      collectionsApi.getAll().then(setAvailableCollections).catch(console.error);
    }
  }, [isAdmin]);
  
  // Get collections this recipe is NOT in
  const collectionsToAdd = availableCollections.filter(
    col => !recipe.collections?.some(rc => rc.id === col.id)
  );
  
  // Add recipe to a collection
  const addToCollection = async (collectionId: string) => {
    setIsLoadingCollections(true);
    try {
      await collectionsApi.addRecipe(collectionId, recipe.id);
      const collection = availableCollections.find(c => c.id === collectionId);
      toast.success(t.collections.addedToCollection);
      // Update recipe with new collection
      if (onRecipeUpdate) {
        onRecipeUpdate({
          ...recipe,
          collections: [...(recipe.collections || []), { id: collectionId, name: collection?.name || '' }]
        });
      }
    } catch (error) {
      toast.error(t.collections.updateError);
      console.error(error);
    } finally {
      setIsLoadingCollections(false);
    }
  };
  
  // Remove recipe from a collection
  const removeFromCollection = async (collectionId: string) => {
    setIsLoadingCollections(true);
    try {
      await collectionsApi.removeRecipe(collectionId, recipe.id);
      toast.success(t.collections.removedFromCollection);
      // Update recipe without this collection
      if (onRecipeUpdate) {
        onRecipeUpdate({
          ...recipe,
          collections: recipe.collections?.filter(c => c.id !== collectionId) || []
        });
      }
    } catch (error) {
      toast.error(t.collections.updateError);
      console.error(error);
    } finally {
      setIsLoadingCollections(false);
    }
  };
  
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

  const sliderSettings = {
    dots: true,
    infinite: displayImages.length > 1,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: displayImages.length > 1,
    adaptiveHeight: true,
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

${recipe.title} (${currentServings} ${currentServings === 1 ? t.recipeDetail.serving : t.recipeDetail.servings}):
${ingredientsList}`;
    
    try {
      // Copy prompt to clipboard
      await navigator.clipboard.writeText(prompt);
      toast.success(t.recipeDetail.promptCopied, {
        description: t.recipeDetail.promptCopiedDescription,
      });
      
      // Open Gemini in new tab
      window.open('https://gemini.google.com/app', '_blank');
    } catch (err) {
      // Fallback: Show prompt in alert if clipboard fails
      toast.error(t.recipeDetail.copyError, {
        description: t.recipeDetail.copyErrorDescription,
      });
      console.error('Clipboard error:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={onClose}>
          ← {t.recipeDetail.back}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            {t.recipeDetail.edit}
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t.recipeDetail.delete}
          </Button>
        </div>
      </div>

      {/* Bildkarussell */}
      <div className="mb-6 rounded-lg overflow-hidden">
        <Slider {...sliderSettings}>
          {displayImages.map((image, index) => (
            <div key={index} className="h-96">
              <img
                src={image}
                alt={`${recipe.title} - Bild ${index + 1}`}
                className="w-full h-96 object-cover"
              />
            </div>
          ))}
        </Slider>
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

      {/* Kategorien */}
      {recipe.categories && recipe.categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {recipe.categories.map((category) => (
            <Badge key={category} variant="outline">
              {category}
            </Badge>
          ))}
        </div>
      )}

      {/* Sammlungen */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {recipe.collections && recipe.collections.length > 0 && (
          <>
            {recipe.collections.map((collection) => (
              <Badge key={collection.id} variant="secondary" className="gap-1">
                📁 {collection.name}
                {isAdmin && (
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => removeFromCollection(collection.id)}
                  />
                )}
              </Badge>
            ))}
          </>
        )}
        
        {/* Admin: Add to Collection */}
        {isAdmin && collectionsToAdd.length > 0 && (
          <div className="relative">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={isLoadingCollections}
              onClick={() => setShowCollectionMenu(!showCollectionMenu)}
            >
              <FolderPlus className="h-4 w-4 mr-1" />
              Zur Sammlung
            </Button>
            {showCollectionMenu && (
              <div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-lg p-1 z-50 min-w-[180px]">
                {collectionsToAdd.map((collection) => (
                  <button 
                    key={collection.id}
                    className="w-full text-left px-3 py-2 text-sm rounded hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      addToCollection(collection.id);
                      setShowCollectionMenu(false);
                    }}
                  >
                    📁 {collection.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
