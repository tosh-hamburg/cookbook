import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import type { Recipe } from '@/app/types/recipe';
import { RecipeCard } from '@/app/components/RecipeCard';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { RecipeImport } from '@/app/components/RecipeImport';

interface RecipeListProps {
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
  onCreateNew: () => void;
  onImport: (recipe: Recipe) => void;
}

export function RecipeList({ recipes, onSelectRecipe, onCreateNew, onImport }: RecipeListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecipes = recipes.filter(recipe =>
    recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.ingredients.some(ing => ing.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="mb-4">Meine Rezepte</h1>
        <div className="flex flex-col sm:flex-row gap-4">
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
