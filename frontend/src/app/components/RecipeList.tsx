import { Plus, Search, Filter, X } from 'lucide-react';
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

interface RecipeListProps {
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onCreateNew: () => void;
  onImport: (recipe: Recipe) => void;
}

export function RecipeList({ recipes, onSelectRecipe, onCreateNew, onImport }: RecipeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');
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
    
    // Collection filter
    const matchesCollection = !selectedCollection ||
      recipe.collections?.some(col => col.id === selectedCollection);
    
    return matchesSearch && matchesCategory && matchesCollection;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedCollection('');
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedCollection;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="mb-4">Meine Rezepte</h1>
        
        {/* Search and Actions Row */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rezepte durchsuchen..."
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <RecipeImport onImport={onImport} />
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Neues Rezept
            </Button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          
          <Select value={selectedCategory || "all"} onValueChange={(val) => setSelectedCategory(val === "all" ? "" : val)}>
            <SelectTrigger className="w-[180px]">
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
            <SelectTrigger className="w-[180px]">
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
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Filter zurücksetzen
            </Button>
          )}
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedCategory && (
              <Badge variant="secondary" className="gap-1">
                Kategorie: {selectedCategory}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategory('')} />
              </Badge>
            )}
            {selectedCollection && (
              <Badge variant="secondary" className="gap-1">
                Sammlung: {collections.find(c => c.id === selectedCollection)?.name}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCollection('')} />
              </Badge>
            )}
          </div>
        )}
      </div>

      {filteredRecipes.length === 0 ? (
        <div className="text-center py-16">
          <div className="mb-4 text-muted-foreground">
            {searchQuery ? (
              <p>Keine Rezepte gefunden, die "{searchQuery}" enthalten.</p>
            ) : (
              <p>Noch keine Rezepte vorhanden. Erstellen Sie Ihr erstes Rezept!</p>
            )}
          </div>
          {!searchQuery && (
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Erstes Rezept erstellen
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
