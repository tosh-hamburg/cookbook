import type { Recipe, Ingredient } from './recipe';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface MealSlot {
  mealType: MealType;
  recipe: Recipe | null;
  servings: number;
}

export interface DayPlan {
  date: Date;
  meals: {
    breakfast: MealSlot;
    lunch: MealSlot;
    dinner: MealSlot;
  };
}

export interface WeekPlan {
  weekStart: Date; // Monday
  weekEnd: Date; // Sunday
  days: DayPlan[];
}

// Helper type for aggregated ingredients
export interface AggregatedIngredient {
  name: string;
  totalAmount: string;
  sources: Array<{
    recipeTitle: string;
    servings: number;
    originalAmount: string;
  }>;
}

// Meal type labels in German
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
};

// Day names in German
export const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

// Helper function to get the start of the next week (Monday)
export function getNextWeekStart(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days until next Monday
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  
  return nextMonday;
}

// Helper function to get the current week's Monday
export function getCurrentWeekStart(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days since Monday
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);
  
  return monday;
}

// Create an empty week plan
export function createEmptyWeekPlan(weekStart: Date): WeekPlan {
  const days: DayPlan[] = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    
    days.push({
      date,
      meals: {
        breakfast: { mealType: 'breakfast', recipe: null, servings: 2 },
        lunch: { mealType: 'lunch', recipe: null, servings: 2 },
        dinner: { mealType: 'dinner', recipe: null, servings: 2 },
      },
    });
  }
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  return {
    weekStart,
    weekEnd,
    days,
  };
}

// Format date for display (e.g., "Mo 15.01.")
export function formatDateShort(date: Date): string {
  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const day = dayNames[date.getDay()];
  return `${day} ${date.getDate()}.${date.getMonth() + 1}.`;
}

// Format week range for display
export function formatWeekRange(weekStart: Date, weekEnd: Date): string {
  const formatDate = (d: Date) => 
    `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
}
