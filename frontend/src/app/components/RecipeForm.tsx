import { useState, useEffect, useRef } from 'react';
import { Plus, X, Upload, Image as ImageIcon } from 'lucide-react';
import type { Recipe, Ingredient } from '@/app/types/recipe';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { getCategories, loadCategories } from '@/app/utils/categories';
import { toast } from 'sonner';
import { useTranslation } from '@/app/i18n';

interface RecipeFormProps {
  recipe?: Recipe;
  userId: string;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
}

export function RecipeForm({ recipe, userId, onSave, onCancel }: RecipeFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(recipe?.title || '');
  const [images, setImages] = useState<string[]>(recipe?.images || []);
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    recipe?.ingredients || [{ name: '', amount: '' }]
  );
  const [instructions, setInstructions] = useState(recipe?.instructions || '');
  const [prepTime, setPrepTime] = useState(recipe?.prepTime?.toString() || '0');
  const [restTime, setRestTime] = useState(recipe?.restTime?.toString() || '0');
  const [cookTime, setCookTime] = useState(recipe?.cookTime?.toString() || '0');
  const [caloriesPerUnit, setCaloriesPerUnit] = useState(recipe?.caloriesPerUnit?.toString() || '0');
  const [weightUnit, setWeightUnit] = useState(recipe?.weightUnit || '100g');
  const [servings, setServings] = useState(recipe?.servings?.toString() || '4');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(recipe?.categories || []);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        await loadCategories();
        setAvailableCategories(getCategories());
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const totalTime = parseInt(prepTime || '0') + parseInt(restTime || '0') + parseInt(cookTime || '0');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t.recipeForm.fileTooLarge.replace('{name}', file.name));
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImages((prev) => [...prev, base64]);
      };
      reader.onerror = () => {
        toast.error(t.recipeForm.fileLoadError.replace('{name}', file.name));
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '' }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    updated[index][field] = value;
    setIngredients(updated);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newRecipe: Recipe = {
      id: recipe?.id || crypto.randomUUID(),
      title,
      images,
      ingredients: ingredients.filter(ing => ing.name.trim() !== ''),
      instructions,
      prepTime: parseInt(prepTime) || 0,
      restTime: parseInt(restTime) || 0,
      cookTime: parseInt(cookTime) || 0,
      totalTime,
      servings: parseInt(servings) || 4,
      caloriesPerUnit: parseInt(caloriesPerUnit) || 0,
      weightUnit,
      categories: selectedCategories,
      userId: recipe?.userId || userId,
      createdAt: recipe?.createdAt || new Date().toISOString(),
      sourceUrl: recipe?.sourceUrl,
    };

    onSave(newRecipe);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1>{recipe ? t.recipeForm.editRecipe : t.recipeForm.newRecipe}</h1>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button type="submit">
            {t.save}
          </Button>
        </div>
      </div>

      {/* Titel */}
      <Card>
        <CardHeader>
          <CardTitle>{t.recipeForm.basicInfo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">{t.recipeForm.title}*</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.recipeForm.titlePlaceholder}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Bilder */}
      <Card>
        <CardHeader>
          <CardTitle>{t.recipeForm.images}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((img, index) => (
                <div key={index} className="relative group">
                  <img
                    src={img}
                    alt={`${t.recipeDetail.image} ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {t.recipeForm.uploadImages}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kategorien */}
      <Card>
        <CardHeader>
          <CardTitle>{t.recipeForm.categories}</CardTitle>
        </CardHeader>
        <CardContent>
          {availableCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.recipeForm.noCategories}
            </p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {availableCategories.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category}`}
                    checked={selectedCategories.includes(category)}
                    onCheckedChange={() => toggleCategory(category)}
                  />
                  <Label
                    htmlFor={`category-${category}`}
                    className="cursor-pointer"
                  >
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zeitangaben */}
      <Card>
        <CardHeader>
          <CardTitle>{t.recipeForm.timeInfo}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="prepTime">{t.recipeForm.prepTime}</Label>
              <Input
                id="prepTime"
                type="number"
                min="0"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="restTime">{t.recipeForm.restTime}</Label>
              <Input
                id="restTime"
                type="number"
                min="0"
                value={restTime}
                onChange={(e) => setRestTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cookTime">{t.recipeForm.cookTime}</Label>
              <Input
                id="cookTime"
                type="number"
                min="0"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium">
              {t.recipeForm.totalTime}: <span className="text-lg">{totalTime} {t.recipeForm.minutes}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Kalorien */}
      <Card>
        <CardHeader>
          <CardTitle>{t.recipeForm.nutritionInfo}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="calories">{t.recipeForm.calories}</Label>
              <Input
                id="calories"
                type="number"
                min="0"
                value={caloriesPerUnit}
                onChange={(e) => setCaloriesPerUnit(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="weightUnit">{t.recipeForm.weightUnit}</Label>
              <Input
                id="weightUnit"
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value)}
                placeholder={t.recipeForm.weightUnitPlaceholder}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zutaten */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t.recipeForm.ingredients}</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="servings" className="text-sm font-normal">
                {t.recipeForm.ingredientFor}
              </Label>
              <Input
                id="servings"
                type="number"
                min="1"
                max="99"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="w-16 text-center"
              />
              <span className="text-sm text-muted-foreground">
                {parseInt(servings) === 1 ? t.recipeDetail.serving : t.recipeDetail.servings}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ingredients.map((ingredient, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={ingredient.name}
                onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                placeholder={t.recipeForm.ingredient}
                className="flex-1"
              />
              <Input
                value={ingredient.amount}
                onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                placeholder={t.recipeForm.amount}
                className="w-32"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => removeIngredient(index)}
                disabled={ingredients.length === 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" onClick={addIngredient} variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {t.recipeForm.addIngredient}
          </Button>
        </CardContent>
      </Card>

      {/* Anleitung */}
      <Card>
        <CardHeader>
          <CardTitle>{t.recipeForm.instructions}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={t.recipeForm.instructionsPlaceholder}
            rows={10}
            required
          />
        </CardContent>
      </Card>
    </form>
  );
}
