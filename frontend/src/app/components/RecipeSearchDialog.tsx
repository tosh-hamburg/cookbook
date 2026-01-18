import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Filter, X, Check, ChevronDown } from 'lucide-react';
import type { Recipe } from '@/app/types/recipe';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { categoriesApi, collectionsApi, type Collection } from '@/app/services/api';

// Number of recipes to show initially and per "load more"
const INITIAL_DISPLAY_COUNT = 20;
const LOAD_MORE_COUNT = 20;

interface RecipeSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipes: Recipe[];
  onSelect: (recipe: Recipe) => void;
  title?: string;
  description?: string;
}

export function RecipeSearchDialog({
  open,
  onOpenChange,
  recipes,
  onSelect,
  title = 'Rezept auswählen',
  description = 'Suchen Sie nach einem Rezept und wählen Sie es aus.',
}: RecipeSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [cats, colls] = await Promise.all([
          categoriesApi.getAll(),
          collectionsApi.getAll()
        ]);
        setCategories(cats);
        setCollections(colls);
      } catch (error) {
        console.error('Error loading filters:', error);
      }
    };
    if (open) {
      loadFilters();
    }
  }, [open]);

  // Reset filters when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSelectedCategory('');
      setSelectedCollection('');
      setDisplayCount(INITIAL_DISPLAY_COUNT);
    }
  }, [open]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  }, [searchQuery, selectedCategory, selectedCollection]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter(recipe => {
      // Text search
      const matchesSearch = !searchQuery || 
        recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recipe.ingredients.some(ing => ing.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Category filter
      const matchesCategory = !selectedCategory || 
        recipe.categories.includes(selectedCategory);
      
      // Collection filter
      const matchesCollection = !selectedCollection ||
        recipe.collections?.some(col => col.id === selectedCollection);
      
      return matchesSearch && matchesCategory && matchesCollection;
    });
  }, [recipes, searchQuery, selectedCategory, selectedCollection]);

  // Only display a limited number of recipes for performance
  const displayedRecipes = useMemo(() => {
    return filteredRecipes.slice(0, displayCount);
  }, [filteredRecipes, displayCount]);

  const hasMoreRecipes = displayedRecipes.length < filteredRecipes.length;

  const loadMore = useCallback(() => {
    setDisplayCount(prev => prev + LOAD_MORE_COUNT);
  }, []);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedCollection('');
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedCollection;

  const handleSelect = (recipe: Recipe) => {
    onSelect(recipe);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rezept suchen..."
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            
            <Select value={selectedCategory || "all"} onValueChange={(val) => setSelectedCategory(val === "all" ? "" : val)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCollection || "all"} onValueChange={(val) => setSelectedCollection(val === "all" ? "" : val)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Sammlung" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Sammlungen</SelectItem>
                {collections.map(col => (
                  <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                <X className="h-4 w-4 mr-1" />
                Zurücksetzen
              </Button>
            )}
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              {selectedCategory && (
                <Badge variant="secondary" className="gap-1">
                  {selectedCategory}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategory('')} />
                </Badge>
              )}
              {selectedCollection && (
                <Badge variant="secondary" className="gap-1">
                  {collections.find(c => c.id === selectedCollection)?.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCollection('')} />
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {filteredRecipes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? (
                <p>Keine Rezepte gefunden für "{searchQuery}"</p>
              ) : (
                <p>Keine Rezepte vorhanden</p>
              )}
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {displayedRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => handleSelect(recipe)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent hover:border-primary transition-colors text-left"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                    {recipe.images && recipe.images.length > 0 ? (
                      <img
                        src={recipe.images[0]}
                        alt={recipe.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        🍽️
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{recipe.title}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{recipe.totalTime} Min</span>
                      <span>•</span>
                      <span>{recipe.servings} Portionen</span>
                    </div>
                    {recipe.categories.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {recipe.categories.slice(0, 2).map(cat => (
                          <Badge key={cat} variant="outline" className="text-xs py-0">
                            {cat}
                          </Badge>
                        ))}
                        {recipe.categories.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{recipe.categories.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Select indicator */}
                  <Check className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100" />
                </button>
              ))}
              
              {/* Load More Button */}
              {hasMoreRecipes && (
                <div className="py-3 text-center">
                  <Button variant="outline" onClick={loadMore} className="w-full">
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Weitere {Math.min(LOAD_MORE_COUNT, filteredRecipes.length - displayedRecipes.length)} Rezepte laden
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="text-sm text-muted-foreground text-center pt-2 border-t">
          {displayedRecipes.length} von {filteredRecipes.length} Rezepten angezeigt
          {filteredRecipes.length < recipes.length && ` (${recipes.length} insgesamt)`}
        </div>
      </DialogContent>
    </Dialog>
  );
}
