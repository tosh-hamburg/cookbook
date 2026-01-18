import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Users,
  Minus,
  ShoppingCart,
  Calendar,
  ArrowLeft,
  Coffee,
  Sun,
  Moon,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Recipe } from '@/app/types/recipe';
import type { WeekPlan, MealType, AggregatedIngredient } from '@/app/types/mealplan';
import {
  createEmptyWeekPlan,
  getNextWeekStart,
  getCurrentWeekStart,
  formatDateShort,
  formatWeekRange,
  MEAL_TYPE_LABELS,
  DAY_NAMES,
} from '@/app/types/mealplan';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { RecipeSearchDialog } from '@/app/components/RecipeSearchDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { mealPlansApi, type MealPlanData } from '@/app/services/api';

interface WeeklyPlannerProps {
  recipes: Recipe[];
  onClose: () => void;
}

// Get icon for meal type
function getMealIcon(mealType: MealType) {
  switch (mealType) {
    case 'breakfast':
      return <Coffee className="h-4 w-4" />;
    case 'lunch':
      return <Sun className="h-4 w-4" />;
    case 'dinner':
      return <Moon className="h-4 w-4" />;
  }
}

// Parse amount string to extract numeric value and unit
function parseAmount(amount: string): { value: number; unit: string } {
  if (!amount) return { value: 0, unit: '' };
  
  // Handle fractions
  const fractionMatch = amount.match(/(\d+)?\s*(\d+)\/(\d+)\s*(.*)/);
  if (fractionMatch) {
    const whole = fractionMatch[1] ? parseInt(fractionMatch[1]) : 0;
    const num = parseInt(fractionMatch[2]);
    const denom = parseInt(fractionMatch[3]);
    const unit = fractionMatch[4]?.trim() || '';
    return { value: whole + (num / denom), unit };
  }
  
  // Handle decimals and whole numbers
  const numberMatch = amount.match(/^([\d.,]+)\s*(.*)/);
  if (numberMatch) {
    const value = parseFloat(numberMatch[1].replace(',', '.'));
    const unit = numberMatch[2]?.trim() || '';
    return { value, unit };
  }
  
  // No number found, treat entire string as unit/description
  return { value: 0, unit: amount };
}

// Format number nicely (avoid ugly decimals)
function formatNumber(num: number): string {
  if (num === 0) return '';
  if (Math.abs(num - Math.round(num)) < 0.01) return String(Math.round(num));
  
  // Common fractions
  const remainder = num % 1;
  const whole = Math.floor(num);
  
  if (Math.abs(remainder - 0.5) < 0.05) return whole ? `${whole}½` : '½';
  if (Math.abs(remainder - 0.25) < 0.05) return whole ? `${whole}¼` : '¼';
  if (Math.abs(remainder - 0.75) < 0.05) return whole ? `${whole}¾` : '¾';
  if (Math.abs(remainder - 0.333) < 0.03) return whole ? `${whole}⅓` : '⅓';
  if (Math.abs(remainder - 0.666) < 0.03) return whole ? `${whole}⅔` : '⅔';
  
  return num.toFixed(1).replace('.', ',').replace(/,0$/, '');
}

// Aggregate ingredients from all meals
function aggregateIngredients(weekPlan: WeekPlan): AggregatedIngredient[] {
  const ingredientMap = new Map<string, {
    amounts: Array<{ value: number; unit: string }>;
    sources: Array<{ recipeTitle: string; servings: number; originalAmount: string }>;
  }>();
  
  // Collect all ingredients
  for (const day of weekPlan.days) {
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      const meal = day.meals[mealType];
      if (!meal.recipe) continue;
      
      const scaleFactor = meal.servings / (meal.recipe.servings || 1);
      
      for (const ing of meal.recipe.ingredients) {
        const normalizedName = ing.name.toLowerCase().trim();
        const parsed = parseAmount(ing.amount);
        const scaledValue = parsed.value * scaleFactor;
        
        if (!ingredientMap.has(normalizedName)) {
          ingredientMap.set(normalizedName, { amounts: [], sources: [] });
        }
        
        const entry = ingredientMap.get(normalizedName)!;
        entry.amounts.push({ value: scaledValue, unit: parsed.unit });
        entry.sources.push({
          recipeTitle: meal.recipe.title,
          servings: meal.servings,
          originalAmount: ing.amount,
        });
      }
    }
  }
  
  // Combine amounts with same unit
  const result: AggregatedIngredient[] = [];
  
  for (const [name, data] of ingredientMap) {
    // Group by unit
    const unitGroups = new Map<string, number>();
    for (const { value, unit } of data.amounts) {
      const normalizedUnit = unit.toLowerCase();
      unitGroups.set(normalizedUnit, (unitGroups.get(normalizedUnit) || 0) + value);
    }
    
    // Format total amount
    let totalAmount = '';
    const unitEntries = Array.from(unitGroups.entries());
    
    if (unitEntries.length === 1) {
      const [unit, value] = unitEntries[0];
      totalAmount = value > 0 ? `${formatNumber(value)} ${unit}`.trim() : unit;
    } else {
      // Multiple units - show separately
      totalAmount = unitEntries
        .map(([unit, value]) => value > 0 ? `${formatNumber(value)} ${unit}`.trim() : unit)
        .join(' + ');
    }
    
    // Capitalize first letter of name
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
    
    result.push({
      name: displayName,
      totalAmount,
      sources: data.sources,
    });
  }
  
  // Sort alphabetically
  result.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  
  return result;
}

// Convert backend MealPlanData to WeekPlan
function mealPlanDataToWeekPlan(data: MealPlanData, weekStart: Date, recipes: Recipe[]): WeekPlan {
  const weekPlan = createEmptyWeekPlan(weekStart);
  
  for (const mealSlot of data.meals) {
    const { dayIndex, mealType, servings, recipe: slotRecipe } = mealSlot;
    
    if (slotRecipe && dayIndex >= 0 && dayIndex < 7) {
      // Find full recipe from recipes list (for complete data)
      const fullRecipe = recipes.find(r => r.id === slotRecipe.id);
      
      // Use full recipe if available, otherwise use the partial data from API
      const recipeToUse: Recipe = fullRecipe || {
        id: slotRecipe.id,
        title: slotRecipe.title,
        images: slotRecipe.images,
        ingredients: slotRecipe.ingredients,
        instructions: '',
        prepTime: 0,
        restTime: 0,
        cookTime: 0,
        totalTime: slotRecipe.totalTime,
        servings: slotRecipe.servings,
        caloriesPerUnit: 0,
        weightUnit: '',
        categories: slotRecipe.categories,
        createdAt: '',
      };
      
      weekPlan.days[dayIndex].meals[mealType as MealType] = {
        mealType: mealType as MealType,
        recipe: recipeToUse,
        servings,
      };
    }
  }
  
  return weekPlan;
}

export function WeeklyPlanner({ recipes, onClose }: WeeklyPlannerProps) {
  // Start with next week
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getNextWeekStart());
  const [weekPlan, setWeekPlan] = useState<WeekPlan>(() => createEmptyWeekPlan(getNextWeekStart()));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Recipe selection dialog state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);
  
  // Load meal plan when week changes
  useEffect(() => {
    const loadMealPlan = async () => {
      setIsLoading(true);
      try {
        const data = await mealPlansApi.getByWeek(currentWeekStart);
        const plan = mealPlanDataToWeekPlan(data, currentWeekStart, recipes);
        setWeekPlan(plan);
      } catch (error) {
        console.error('Error loading meal plan:', error);
        // On error, start with empty plan
        setWeekPlan(createEmptyWeekPlan(currentWeekStart));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadMealPlan();
  }, [currentWeekStart, recipes]);
  
  // Save slot to backend
  const saveSlot = useCallback(async (
    dayIndex: number, 
    mealType: MealType, 
    recipeId: string | null, 
    servings: number
  ) => {
    setIsSaving(true);
    try {
      await mealPlansApi.updateSlot(currentWeekStart, dayIndex, mealType, recipeId, servings);
    } catch (error) {
      console.error('Error saving meal slot:', error);
      toast.error('Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  }, [currentWeekStart]);
  
  // Navigate to previous week
  const goToPreviousWeek = useCallback(() => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  }, [currentWeekStart]);
  
  // Navigate to next week
  const goToNextWeek = useCallback(() => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  }, [currentWeekStart]);
  
  // Go to current week
  const goToCurrentWeek = useCallback(() => {
    const start = getCurrentWeekStart();
    setCurrentWeekStart(start);
  }, []);
  
  // Go to next upcoming week
  const goToNextUpcomingWeek = useCallback(() => {
    const start = getNextWeekStart();
    setCurrentWeekStart(start);
  }, []);
  
  // Check if currently viewing current week
  const isCurrentWeek = useMemo(() => {
    const current = getCurrentWeekStart();
    return currentWeekStart.getTime() === current.getTime();
  }, [currentWeekStart]);
  
  // Check if currently viewing next upcoming week
  const isNextUpcomingWeek = useMemo(() => {
    const next = getNextWeekStart();
    return currentWeekStart.getTime() === next.getTime();
  }, [currentWeekStart]);
  
  // Open recipe search for a specific slot
  const openRecipeSearch = (dayIndex: number, mealType: MealType) => {
    setSelectedDayIndex(dayIndex);
    setSelectedMealType(mealType);
    setIsSearchOpen(true);
  };
  
  // Select a recipe for the current slot
  const handleRecipeSelect = async (recipe: Recipe) => {
    if (selectedDayIndex === null || selectedMealType === null) return;
    
    const servings = recipe.servings || 2;
    
    // Update local state immediately
    setWeekPlan(prev => {
      const newDays = [...prev.days];
      newDays[selectedDayIndex] = {
        ...newDays[selectedDayIndex],
        meals: {
          ...newDays[selectedDayIndex].meals,
          [selectedMealType]: {
            mealType: selectedMealType,
            recipe,
            servings,
          },
        },
      };
      return { ...prev, days: newDays };
    });
    
    // Save to backend
    await saveSlot(selectedDayIndex, selectedMealType, recipe.id, servings);
  };
  
  // Remove recipe from a slot
  const removeRecipe = async (dayIndex: number, mealType: MealType) => {
    // Update local state immediately
    setWeekPlan(prev => {
      const newDays = [...prev.days];
      newDays[dayIndex] = {
        ...newDays[dayIndex],
        meals: {
          ...newDays[dayIndex].meals,
          [mealType]: {
            mealType,
            recipe: null,
            servings: 2,
          },
        },
      };
      return { ...prev, days: newDays };
    });
    
    // Save to backend
    await saveSlot(dayIndex, mealType, null, 2);
  };
  
  // Update servings for a slot
  const updateServings = async (dayIndex: number, mealType: MealType, delta: number) => {
    const meal = weekPlan.days[dayIndex].meals[mealType];
    if (!meal.recipe) return;
    
    const newServings = Math.max(1, Math.min(99, meal.servings + delta));
    
    // Update local state immediately
    setWeekPlan(prev => {
      const newDays = [...prev.days];
      newDays[dayIndex] = {
        ...newDays[dayIndex],
        meals: {
          ...newDays[dayIndex].meals,
          [mealType]: {
            ...newDays[dayIndex].meals[mealType],
            servings: newServings,
          },
        },
      };
      return { ...prev, days: newDays };
    });
    
    // Save to backend
    await saveSlot(dayIndex, mealType, meal.recipe.id, newServings);
  };
  
  // Calculate aggregated ingredients
  const aggregatedIngredients = useMemo(() => aggregateIngredients(weekPlan), [weekPlan]);
  
  // Count total meals planned
  const totalMealsPlanned = useMemo(() => {
    let count = 0;
    for (const day of weekPlan.days) {
      if (day.meals.breakfast.recipe) count++;
      if (day.meals.lunch.recipe) count++;
      if (day.meals.dinner.recipe) count++;
    }
    return count;
  }, [weekPlan]);
  
  // Send ingredients to Gemini
  const sendToGemini = async () => {
    if (aggregatedIngredients.length === 0) {
      toast.error('Keine Zutaten vorhanden', {
        description: 'Fügen Sie zuerst Rezepte zum Wochenplan hinzu.',
      });
      return;
    }
    
    // Format ingredients list
    const ingredientsList = aggregatedIngredients
      .map(ing => ing.totalAmount ? `${ing.totalAmount} ${ing.name}` : ing.name)
      .join('\n');
    
    // Create prompt
    const weekRange = formatWeekRange(weekPlan.weekStart, weekPlan.weekEnd);
    const prompt = `Füge bitte folgende Zutaten zu meiner Einkaufsliste in Google Keep hinzu (erstelle die Liste "Einkaufsliste" falls sie nicht existiert):

Wochenplan ${weekRange} (${totalMealsPlanned} Mahlzeiten):

${ingredientsList}

Hinweis: Die Mengen wurden bereits für alle geplanten Mahlzeiten zusammengerechnet.`;
    
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success('Prompt in Zwischenablage kopiert!', {
        description: 'Füge ihn in Gemini ein und sende ab.',
      });
      window.open('https://gemini.google.com/app', '_blank');
    } catch (err) {
      toast.error('Konnte nicht in Zwischenablage kopieren');
      console.error('Clipboard error:', err);
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Wochenplaner
              {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </h1>
            <p className="text-muted-foreground">
              Planen Sie Ihre Mahlzeiten für die Woche
            </p>
          </div>
        </div>
        
        {/* Gemini Button */}
        {totalMealsPlanned > 0 && (
          <Button onClick={sendToGemini} className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Einkaufsliste erstellen ({aggregatedIngredients.length} Zutaten)
          </Button>
        )}
      </div>
      
      {/* Week Navigation */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Week info */}
            <div className="text-center">
              <div className="text-lg font-semibold">
                {formatWeekRange(weekPlan.weekStart, weekPlan.weekEnd)}
              </div>
              <div className="text-sm text-muted-foreground">
                KW {getWeekNumber(weekPlan.weekStart)}
              </div>
            </div>
            
            {/* Navigation buttons grouped together */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={goToPreviousWeek} disabled={isLoading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant={isCurrentWeek ? "default" : "outline"} 
                size="sm" 
                onClick={goToCurrentWeek} 
                disabled={isLoading || isCurrentWeek}
              >
                Diese Woche
              </Button>
              <Button 
                variant={isNextUpcomingWeek ? "default" : "outline"} 
                size="sm" 
                onClick={goToNextUpcomingWeek} 
                disabled={isLoading || isNextUpcomingWeek}
              >
                Kommende Woche
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextWeek} disabled={isLoading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Loading State */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Wochenplan wird geladen...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Week Grid */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
            {weekPlan.days.map((day, dayIndex) => (
              <Card key={dayIndex} className="overflow-hidden">
                <CardHeader className="py-3 px-4 bg-muted/50">
                  <CardTitle className="text-sm font-medium">
                    <div>{DAY_NAMES[dayIndex]}</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      {formatDateShort(day.date)}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-2">
                  {(['breakfast', 'lunch', 'dinner'] as MealType[]).map((mealType) => {
                    const meal = day.meals[mealType];
                    
                    return (
                      <div
                        key={mealType}
                        className={`rounded-lg border p-2 transition-colors ${
                          meal.recipe ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-dashed'
                        }`}
                      >
                        {/* Meal Type Header */}
                        <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
                          {getMealIcon(mealType)}
                          <span>{MEAL_TYPE_LABELS[mealType]}</span>
                        </div>
                        
                        {meal.recipe ? (
                          /* Recipe Selected */
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <h4 className="text-xs font-medium truncate cursor-default flex-1">
                                      {meal.recipe.title}
                                    </h4>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{meal.recipe.title}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                onClick={() => removeRecipe(dayIndex, mealType)}
                                disabled={isSaving}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            {/* Servings Control */}
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => updateServings(dayIndex, mealType, -1)}
                                  disabled={meal.servings <= 1 || isSaving}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <div className="flex items-center gap-0.5 min-w-[40px] justify-center">
                                  <Users className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs font-medium">{meal.servings}</span>
                                </div>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => updateServings(dayIndex, mealType, 1)}
                                  disabled={meal.servings >= 99 || isSaving}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Empty Slot */
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-12 text-xs text-muted-foreground"
                            onClick={() => openRecipeSearch(dayIndex, mealType)}
                            disabled={isSaving}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Rezept
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Aggregated Ingredients Summary */}
          {aggregatedIngredients.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Zusammengefasste Zutaten
                  </CardTitle>
                  <Badge variant="secondary">{aggregatedIngredients.length} Zutaten</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {aggregatedIngredients.map((ing, index) => (
                    <TooltipProvider key={index}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50 cursor-default">
                            <span className="text-sm truncate">{ing.name}</span>
                            <Badge variant="outline" className="ml-2 flex-shrink-0">
                              {ing.totalAmount || '–'}
                            </Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="text-xs">
                            <p className="font-medium mb-1">Verwendet in:</p>
                            {ing.sources.map((src, i) => (
                              <p key={i}>
                                • {src.recipeTitle} ({src.servings}P): {src.originalAmount}
                              </p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t flex justify-end">
                  <Button onClick={sendToGemini} className="gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    An Gemini senden
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Empty State */}
          {totalMealsPlanned === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Noch keine Mahlzeiten geplant</h3>
                <p className="text-muted-foreground mb-4">
                  Klicken Sie auf einen Tag und fügen Sie Rezepte zu Ihrem Wochenplan hinzu.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
      
      {/* Recipe Search Dialog */}
      <RecipeSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        recipes={recipes}
        onSelect={handleRecipeSelect}
        title="Rezept für Mahlzeit auswählen"
        description={
          selectedDayIndex !== null && selectedMealType !== null
            ? `${DAY_NAMES[selectedDayIndex]} - ${MEAL_TYPE_LABELS[selectedMealType]}`
            : 'Wählen Sie ein Rezept aus'
        }
      />
    </div>
  );
}

// Helper function to get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
