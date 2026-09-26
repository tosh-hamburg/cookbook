import { ArrowRight } from 'lucide-react';
import type { WeekPlan } from '@/app/types/mealplan';
import { cn } from '@/app/components/ui/utils';
import { getWeekNumber } from '@/app/utils/week';
import { useTranslation } from '@/app/i18n';

interface WeekBandProps {
  weekPlan: WeekPlan;
  onOpenPlanner: () => void;
  onCreateShoppingList: () => void;
}

const BAND_MEAL_ORDER = ['dinner', 'lunch', 'breakfast'] as const;

/**
 * Gerichte des Tages fürs Band: Abend zuerst, sonst Mittag, sonst Frühstück.
 * Mehrere Gerichte eines Slots werden verbunden („Lasagne + Tiramisu").
 */
export function dayMealTitle(day: WeekPlan['days'][number]): string | null {
  const slot = BAND_MEAL_ORDER.map((type) => day.meals[type]).find((meal) => meal.dishes.length > 0);
  return slot ? slot.dishes.map((dish) => dish.recipe.title).join(' + ') : null;
}

/** Block D der Bibliothek: dunkles Wochenplan-Band. */
export function WeekBand({ weekPlan, onOpenPlanner, onCreateShoppingList }: WeekBandProps) {
  const { t } = useTranslation();
  const lib = t.kitchen.library;
  const openEvenings = weekPlan.days.filter((day) => day.meals.dinner.dishes.length === 0).length;
  const status =
    openEvenings === 0 ? lib.allEveningsPlanned : lib.eveningsOpen.replace('{count}', String(openEvenings));

  return (
    <section className="mt-[34px] rounded-[22px] bg-ink px-7 py-[26px] text-cook-fg">
      <div className="mb-[18px] flex flex-wrap items-center gap-[14px]">
        <h3
          onClick={onOpenPlanner}
          className="cursor-pointer font-display text-[26px] font-normal leading-none text-white"
        >
          {lib.yourWeek}
        </h3>
        <span className="text-[13.5px] font-medium text-[oklch(0.78_0.03_80)]">
          {t.planner.calendarWeek} {getWeekNumber(weekPlan.weekStart)} · {status}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onCreateShoppingList}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-gold hover:underline"
        >
          {lib.createShoppingList}
          <ArrowRight className="size-4" />
        </button>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="grid min-w-[700px] grid-cols-7 gap-[10px]">
          {weekPlan.days.map((day, index) => {
            const meal = dayMealTitle(day);
            const open = !meal;
            return (
              <button
                key={index}
                type="button"
                onClick={onOpenPlanner}
                className={cn(
                  'min-h-[104px] rounded-[14px] px-[13px] py-3 text-left transition-colors',
                  open
                    ? 'border border-dashed border-[oklch(0.44_0.03_50)] bg-transparent hover:bg-white/5'
                    : 'bg-[oklch(0.32_0.04_45)] hover:bg-[oklch(0.36_0.04_45)]',
                )}
              >
                <div
                  className={cn(
                    'text-[11.5px] font-semibold uppercase tracking-[.1em]',
                    open ? 'text-[oklch(0.7_0.03_60)]' : 'text-gold',
                  )}
                >
                  {t.planner.dayNamesShort[index]}
                </div>
                <div
                  className={cn(
                    'mt-[9px] text-sm font-medium leading-[1.35] [text-wrap:pretty]',
                    open ? 'text-[oklch(0.72_0.03_60)]' : 'text-white',
                  )}
                >
                  {meal ?? lib.stillOpen}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
