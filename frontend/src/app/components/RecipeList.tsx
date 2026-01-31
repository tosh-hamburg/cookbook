import { Plus, Search, Filter, X, FolderOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Recipe } from '@/app/types/recipe';
import { RecipeCard } from '@/app/components/RecipeCard';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { RecipeImport } from '@/app/components/RecipeImport';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { categoriesApi, collectionsApi, type Collection } from '@/app/services/api';
import { useTranslation } from '@/app/i18n';

interface RecipeListProps {
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onCreateNew: () => void;
  onImport: (recipe: Recipe) => void;
}

export function RecipeList({ recipes, onSelectRecipe, onCreateNew, onImport }: RecipeListProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<string[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

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
    loadFilters();
  }, []);

  const filteredRecipes = recipes.filter(recipe => {
    // Text search
    const matchesSearch = !searchQuery || 
      recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.ingredients.some(ing => ing.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Category filter
    const matchesCategory = !selectedCategory || 
      recipe.categories.includes(selectedCategory);
    
    // Collection filter - match if recipe is in ANY of the selected collections (OR logic)
    const matchesCollection = selectedCollections.size === 0 ||
      recipe.collections?.some(col => selectedCollections.has(col.id));
    
    return matchesSearch && matchesCategory && matchesCollection;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedCollections(new Set());
  };

  const toggleCollection = (collectionId: string) => {
    setSelectedCollections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(collectionId)) {
        newSet.delete(collectionId);
      } else {
        newSet.add(collectionId);
      }
      return newSet;
    });
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedCollections.size > 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="mb-4">{t.recipes.myRecipes}</h1>
        
        {/* Search and Actions Row */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.recipes.searchPlaceholder}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <RecipeImport onImport={onImport} />
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              {t.recipes.newRecipe}
            </Button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          
          <Select value={selectedCategory || "all"} onValueChange={(val) => setSelectedCategory(val === "all" ? "" : val)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t.filters.category} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.filters.allCategories}</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              {t.filters.resetFilters}
            </Button>
          )}
        </div>

        {/* Collection Filter Chips */}
        {collections.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <Badge 
              variant={selectedCollections.size === 0 ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/80 transition-colors"
              onClick={() => setSelectedCollections(new Set())}
            >
              {t.filters.allCollections}
            </Badge>
            {collections.map(col => (
              <Badge 
                key={col.id}
                variant={selectedCollections.has(col.id) ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/80 transition-colors"
                onClick={() => toggleCollection(col.id)}
              >
                {col.name}
                {selectedCollections.has(col.id) && (
                  <X className="h-3 w-3 ml-1" />
                )}
              </Badge>
            ))}
          </div>
        )}

        {/* Active Filters Display */}
        {(selectedCategory) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedCategory && (
              <Badge variant="secondary" className="gap-1">
                {t.filters.category}: {selectedCategory}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategory('')} />
              </Badge>
            )}
          </div>
        )}
      </div>

      {filteredRecipes.length === 0 ? (
        <div className="text-center py-16">
          <div className="mb-4 text-muted-foreground">
            {searchQuery ? (
              <p>{t.recipes.noRecipesSearch} "{searchQuery}".</p>
            ) : (
              <p>{t.recipes.noRecipes}</p>
            )}
          </div>
          {!searchQuery && (
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              {t.recipes.createFirst}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => onSelectRecipe(recipe)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
