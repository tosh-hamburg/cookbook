import { Clock, Flame } from 'lucide-react';
import type { Recipe } from '@/app/types/recipe';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const displayImage = recipe.images && recipe.images.length > 0 
    ? recipe.images[0] 
    : 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb29raW5nJTIwaW5ncmVkaWVudHN8ZW58MXx8fHwxNzY4NjIxNTQxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral';

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
      onClick={onClick}
    >
      <div className="relative h-48 w-full overflow-hidden">
        <ImageWithFallback
          src={displayImage}
          alt={recipe.title}
          className="w-full h-full object-cover"
        />
      </div>
      <CardHeader>
        <CardTitle className="line-clamp-2">{recipe.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{recipe.totalTime} Min</span>
          </div>
          <div className="flex items-center gap-1">
            <Flame className="h-4 w-4" />
            <span>{recipe.caloriesPerUnit} kcal/{recipe.weightUnit}</span>
          </div>
        </div>
        <div className="mt-3">
          <Badge variant="secondary">
            {recipe.ingredients.length} Zutaten
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
