import { useState, useEffect } from 'react';
import { Calendar, Coffee, Sun, Moon, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import type { Recipe } from '@/app/types/recipe';
import type { MealType } from '@/app/types/mealplan';
import { getCurrentWeekStart, getNextWeekStart, formatDateShort, formatWeekRange } from '@/app/types/mealplan';
import { mealPlansApi, type MealPlanData } from '@/app/services/api';
import { useTranslation } from '@/app/i18n';

// Get the default week start (next Monday, consistent with WeeklyPlanner)
function getDefaultWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilNextMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
}

interface AddToWeekPlannerDialogProps {
  recipe: Recipe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
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

// Get week number (ISO 8601)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function AddToWeekPlannerDialog({ recipe, open, onOpenChange, onSuccess }: AddToWeekPlannerDialogProps) {
  const { t } = useTranslation();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getDefaultWeekStart());
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mealPlanData, setMealPlanData] = useState<MealPlanData | null>(null);

  const mealTypeLabels: Record<MealType, string> = {
    breakfast: t.planner.breakfast,
    lunch: t.planner.lunch,
    dinner: t.planner.dinner,
  };

  // Calculate week end date
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(currentWeekStart.getDate() + 6);

  // Generate days for the week
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);
    return {
      index: i,
      date,
      dayName: t.planner.dayNames[i],
    };
  });

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];

  // Load meal plan data for current week
  useEffect(() => {
    if (!open) return;
    
    const loadMealPlan = async () => {
      setIsLoading(true);
      try {
        const data = await mealPlansApi.getByWeek(currentWeekStart);
        setMealPlanData(data);
      } catch (error) {
        console.error('Error loading meal plan:', error);
        setMealPlanData(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadMealPlan();
  }, [currentWeekStart, open]);

  // Check if a slot is occupied
  const isSlotOccupied = (dayIndex: number, mealType: MealType): boolean => {
    if (!mealPlanData) return false;
    return mealPlanData.meals.some(
      meal => meal.dayIndex === dayIndex && meal.mealType === mealType && meal.recipe !== null
    );
  };

  // Get recipe title for occupied slot
  const getSlotRecipeTitle = (dayIndex: number, mealType: MealType): string | null => {
    if (!mealPlanData) return null;
    const meal = mealPlanData.meals.find(
      meal => meal.dayIndex === dayIndex && meal.mealType === mealType && meal.recipe !== null
    );
    return meal?.recipe?.title || null;
  };

  // Navigate weeks
  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
    setSelectedDayIndex(null);
    setSelectedMealType(null);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
    setSelectedDayIndex(null);
    setSelectedMealType(null);
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getCurrentWeekStart());
    setSelectedDayIndex(null);
    setSelectedMealType(null);
  };

  const goToNextUpcomingWeek = () => {
    setCurrentWeekStart(getNextWeekStart());
    setSelectedDayIndex(null);
    setSelectedMealType(null);
  };

  // Check if currently viewing current or next week
  const isCurrentWeek = currentWeekStart.getTime() === getCurrentWeekStart().getTime();
  const isNextWeek = currentWeekStart.getTime() === getNextWeekStart().getTime();

  // Handle slot selection
  const handleSlotClick = (dayIndex: number, mealType: MealType) => {
    // Don't allow selecting occupied slots
    if (isSlotOccupied(dayIndex, mealType)) {
      return;
    }
    setSelectedDayIndex(dayIndex);
    setSelectedMealType(mealType);
  };

  // Add recipe to selected slot
  const handleAddToSlot = async () => {
    if (selectedDayIndex === null || selectedMealType === null) {
      toast.error(t.planner.selectSlotFirst || 'Bitte wählen Sie einen Slot aus');
      return;
    }

    setIsAdding(true);
    try {
      await mealPlansApi.updateSlot(
        currentWeekStart,
        selectedDayIndex,
        selectedMealType,
        recipe.id,
        recipe.servings || 2
      );
      
      toast.success(t.planner.recipeAdded || 'Rezept zum Wochenplaner hinzugefügt', {
        description: `${recipe.title} - ${days[selectedDayIndex].dayName}, ${mealTypeLabels[selectedMealType]}`,
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error adding recipe to meal plan:', error);
      toast.error(t.planner.saveError || 'Fehler beim Hinzufügen des Rezepts');
    } finally {
      setIsAdding(false);
    }
  };

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedDayIndex(null);
      setSelectedMealType(null);
      setCurrentWeekStart(getDefaultWeekStart());
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[85vw] !max-w-[1600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t.planner.addToWeekPlanner || 'Zum Wochenplaner hinzufügen'}
          </DialogTitle>
          <DialogDescription>
            {t.planner.selectSlotDescription || 'Wählen Sie einen Tag und eine Mahlzeit aus, um das Rezept hinzuzufügen.'}
          </DialogDescription>
        </DialogHeader>

        {/* Recipe info */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          {recipe.images && recipe.images.length > 0 && (
            <img
              src={recipe.images[0]}
              alt={recipe.title}
              className="w-16 h-16 object-cover rounded"
            />
          )}
          <div className="flex-1">
            <h4 className="font-medium">{recipe.title}</h4>
            <p className="text-sm text-muted-foreground">
              {recipe.servings} {recipe.servings === 1 ? t.recipeDetail.serving : t.recipeDetail.servings}
            </p>
          </div>
        </div>

        {/* Week Navigation */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center">
              <div className="font-semibold">
                {formatWeekRange(currentWeekStart, weekEnd)}
              </div>
              <div className="text-sm text-muted-foreground">
                {t.planner.calendarWeek} {getWeekNumber(currentWeekStart)}
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant={isCurrentWeek ? "default" : "outline"} 
                size="sm" 
                onClick={goToCurrentWeek}
                disabled={isCurrentWeek}
              >
                {t.planner.thisWeek}
              </Button>
              <Button 
                variant={isNextWeek ? "default" : "outline"} 
                size="sm" 
                onClick={goToNextUpcomingWeek}
                disabled={isNextWeek}
              >
                {t.planner.nextWeek}
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">{t.planner.planLoading}</span>
          </div>
        )}

        {/* Week Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
            {days.map((day) => (
              <div key={day.index} className="space-y-2">
                <div className="text-center">
                  <div className="font-medium text-sm">{day.dayName}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateShort(day.date, t.planner.dayNamesShort)}
                  </div>
                </div>
                
                {mealTypes.map((mealType) => {
                  const isSelected = selectedDayIndex === day.index && selectedMealType === mealType;
                  const isOccupied = isSlotOccupied(day.index, mealType);
                  const occupiedRecipeTitle = isOccupied ? getSlotRecipeTitle(day.index, mealType) : null;
                  
                  return (
                    <button
                      key={mealType}
                      onClick={() => handleSlotClick(day.index, mealType)}
                      disabled={isOccupied}
                      title={isOccupied && occupiedRecipeTitle ? occupiedRecipeTitle : undefined}
                      className={`w-full p-2 rounded-lg border-2 transition-all ${
                        isOccupied
                          ? 'border-muted bg-muted/50 cursor-not-allowed opacity-60'
                          : isSelected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-xs">
                        {getMealIcon(mealType)}
                        <span className={isOccupied ? 'line-through' : ''}>{mealTypeLabels[mealType]}</span>
                        {isSelected && <Check className="h-3 w-3 text-primary" />}
                      </div>
                      {isOccupied && occupiedRecipeTitle && (
                        <div className="text-[10px] text-muted-foreground mt-1 truncate">
                          {occupiedRecipeTitle}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Selected slot info */}
        {selectedDayIndex !== null && selectedMealType !== null && (
          <div className="p-3 bg-primary/10 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {days[selectedDayIndex].dayName} - {mealTypeLabels[selectedMealType]}
                </Badge>
              </div>
              <Button onClick={handleAddToSlot} disabled={isAdding}>
                {isAdding ? (
                  <>{t.planner.adding || 'Hinzufügen...'}</>
                ) : (
                  <>{t.planner.addRecipe || 'Rezept hinzufügen'}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
