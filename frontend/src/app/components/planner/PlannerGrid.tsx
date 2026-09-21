import { useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import type { MealType, WeekPlan, MealSlot } from '@/app/types/mealplan';
import type { Recipe } from '@/app/types/recipe';
import { cn } from '@/app/components/ui/utils';
import { collectionColor, NEUTRAL_HUE } from '@/app/utils/collectionColors';
import { primaryCollection } from '@/app/utils/recipeMeta';
import { formatShortDate } from '@/app/utils/week';
import { MEAL_TYPES } from '@/app/utils/shoppingList';
import { hasDragData, readDragData, setDragData, slotKey, type PlannerDragData } from '@/app/components/planner/dragData';
import { useTranslation } from '@/app/i18n';

interface PlannerGridProps {
  weekPlan: WeekPlan;
  selectedSlot: string | null;
  onSelectSlot: (key: string | null) => void;
  onDrop: (dayIndex: number, mealType: MealType, data: PlannerDragData) => void;
  onRemove: (dayIndex: number, mealType: MealType) => void;
  onChangeServings: (dayIndex: number, mealType: MealType, delta: number) => void;
  onViewRecipe: (recipe: Recipe) => void;
  disabled?: boolean;
}

const MAX_SLOT_SERVINGS = 99;

/** Sieben Tage × drei Mahlzeiten (Handoff 3c, linke Seite). */
export function PlannerGrid({
  weekPlan,
  selectedSlot,
  onSelectSlot,
  onDrop,
  onRemove,
  onChangeServings,
  onViewRecipe,
  disabled,
}: PlannerGridProps) {
  const { t } = useTranslation();
  const p = t.kitchen.plan;
  const mealLabels: Record<MealType, string> = { breakfast: p.breakfast, lunch: p.lunch, dinner: p.dinner };

  return (
    <div className="min-w-[860px]">
      <div className="grid grid-cols-[96px_repeat(7,minmax(0,1fr))] gap-[10px]">
        <div />
        {weekPlan.days.map((day, index) => (
          <div key={index} className="pb-[6px] text-center">
            <div className="text-xs font-semibold uppercase tracking-[.12em] text-ink-4">
              {t.planner.dayNamesShort[index]}
            </div>
            <div className="mt-[6px] font-mono text-[13px] font-medium text-ink-2 tabular-nums">
              {formatShortDate(day.date)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-col gap-[10px]">
        {MEAL_TYPES.map((mealType) => (
          <div key={mealType} className="grid grid-cols-[96px_repeat(7,minmax(0,1fr))] gap-[10px]">
            <div className="flex items-center text-[13px] font-semibold leading-[1.2] text-ink-2">
              {mealLabels[mealType]}
            </div>
            {weekPlan.days.map((day, dayIndex) => (
              <PlannerCell
                key={dayIndex}
                dayIndex={dayIndex}
                mealType={mealType}
                slot={day.meals[mealType]}
                selected={selectedSlot === slotKey(dayIndex, mealType)}
                onSelect={() => onSelectSlot(selectedSlot === slotKey(dayIndex, mealType) ? null : slotKey(dayIndex, mealType))}
                onDrop={(data) => onDrop(dayIndex, mealType, data)}
                onRemove={() => onRemove(dayIndex, mealType)}
                onChangeServings={(delta) => onChangeServings(dayIndex, mealType, delta)}
                onViewRecipe={onViewRecipe}
                disabled={disabled}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface PlannerCellProps {
  dayIndex: number;
  mealType: MealType;
  slot: MealSlot;
  selected: boolean;
  onSelect: () => void;
  onDrop: (data: PlannerDragData) => void;
  onRemove: () => void;
  onChangeServings: (delta: number) => void;
  onViewRecipe: (recipe: Recipe) => void;
  disabled?: boolean;
}

function PlannerCell({
  dayIndex,
  mealType,
  slot,
  selected,
  onSelect,
  onDrop,
  onRemove,
  onChangeServings,
  onViewRecipe,
  disabled,
}: PlannerCellProps) {
  const { t } = useTranslation();
  const p = t.kitchen.plan;
  const [isOver, setIsOver] = useState(false);
  const recipe = slot.recipe;
  const collection = recipe ? primaryCollection(recipe) : null;
  const hue = recipe ? collectionColor(collection) : NEUTRAL_HUE;

  const dragHandlers = {
    onDragOver: (event: React.DragEvent) => {
      if (!hasDragData(event) || disabled) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (!isOver) setIsOver(true);
    },
    onDragLeave: () => setIsOver(false),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setIsOver(false);
      const data = readDragData(event);
      if (data) onDrop(data);
    },
  };

  if (!recipe) {
    return (
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-pressed={selected}
        {...dragHandlers}
        className={cn(
          'min-h-[118px] rounded-2xl border-[1.5px] border-dashed px-[13px] py-3 text-left transition-[transform,background-color,border-color] duration-[140ms] hover:-translate-y-[2px]',
          selected || isOver
            ? 'border-tomato bg-[oklch(0.94_0.045_85)]'
            : 'border-[oklch(0.85_0.02_80)] bg-transparent hover:border-tomato',
        )}
      >
        <div className="flex items-center gap-[7px]">
          <span className="size-2 rounded-full" style={{ background: NEUTRAL_HUE }} />
          <span className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: NEUTRAL_HUE }}>
            {isOver ? p.dropHere : '—'}
          </span>
        </div>
        <div className="mt-[9px] text-sm font-medium leading-[1.3] text-[oklch(0.58_0.03_55)]">{p.free}</div>
        <div className="mt-2 font-mono text-xs font-medium text-[oklch(0.58_0.03_55)]">{p.chooseRecipe}</div>
      </button>
    );
  }

  return (
    <div
      draggable={!disabled}
      onDragStart={(event) => setDragData(event, { kind: 'slot', dayIndex, mealType })}
      {...dragHandlers}
      className={cn(
        'group relative min-h-[118px] cursor-grab rounded-2xl border-[1.5px] bg-white px-[13px] py-3 shadow-cell transition-[transform,border-color] duration-[140ms] hover:-translate-y-[2px] active:cursor-grabbing',
        isOver ? 'border-tomato' : 'border-[oklch(0.92_0.015_80)]',
      )}
    >
      <div className="flex items-center gap-[7px] pr-5">
        <span className="size-2 shrink-0 rounded-full" style={{ background: hue }} />
        <span className="truncate text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: hue }}>
          {collection ?? recipe.categories[0] ?? '·'}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onViewRecipe(recipe)}
        className="mt-[9px] block text-left font-display text-[17px] font-normal leading-[1.25] text-ink [text-wrap:pretty] hover:text-tomato"
      >
        {recipe.title}
      </button>
      <div className="mt-2 flex items-center gap-2 font-mono text-xs font-medium text-[oklch(0.58_0.03_55)] tabular-nums">
        <span>
          {recipe.totalTime} {t.kitchen.library.minutes}
        </span>
        <span className="text-line">·</span>
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeServings(-1)}
            disabled={disabled || slot.servings <= 1}
            className="grid size-4 place-items-center rounded-full opacity-0 transition-opacity hover:bg-line-soft group-hover:opacity-100 disabled:opacity-0"
            aria-label="−"
          >
            <Minus className="size-3" />
          </button>
          {slot.servings} {p.servingsShort}
          <button
            type="button"
            onClick={() => onChangeServings(1)}
            disabled={disabled || slot.servings >= MAX_SLOT_SERVINGS}
            className="grid size-4 place-items-center rounded-full opacity-0 transition-opacity hover:bg-line-soft group-hover:opacity-100 disabled:opacity-0"
            aria-label="+"
          >
            <Plus className="size-3" />
          </button>
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        title={p.remove}
        aria-label={p.remove}
        className="absolute right-2 top-2 grid size-6 place-items-center rounded-full text-ink-4 opacity-0 transition-opacity hover:bg-line-soft hover:text-tomato group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
