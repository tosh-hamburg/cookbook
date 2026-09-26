import { useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import type { MealType, WeekPlan, MealSlot, PlannedDish } from '@/app/types/mealplan';
import type { Recipe } from '@/app/types/recipe';
import { cn } from '@/app/components/ui/utils';
import { collectionColor, NEUTRAL_HUE } from '@/app/utils/collectionColors';
import { primaryCollection } from '@/app/utils/recipeMeta';
import { formatShortDate } from '@/app/utils/week';
import { MEAL_TYPES } from '@/app/utils/shoppingList';
import { MAX_DISHES_PER_SLOT, type DishRef } from '@/app/utils/planSlots';
import { hasDragData, readDragData, setDragData, slotKey, type PlannerDragData } from '@/app/components/planner/dragData';
import { useTranslation } from '@/app/i18n';

interface PlannerGridProps {
  weekPlan: WeekPlan;
  selectedSlot: string | null;
  onSelectSlot: (key: string | null) => void;
  onDrop: (dayIndex: number, mealType: MealType, data: PlannerDragData) => void;
  onRemove: (ref: DishRef) => void;
  onChangeServings: (ref: DishRef, delta: number) => void;
  onViewRecipe: (recipe: Recipe) => void;
  disabled?: boolean;
}

const MAX_SLOT_SERVINGS = 99;

/** Sieben Tage × drei Mahlzeiten (Handoff 3c, linke Seite); je Slot mehrere Gerichte. */
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
            {weekPlan.days.map((day, dayIndex) => {
              const key = slotKey(dayIndex, mealType);
              return (
                <PlannerCell
                  key={dayIndex}
                  dayIndex={dayIndex}
                  mealType={mealType}
                  slot={day.meals[mealType]}
                  selected={selectedSlot === key}
                  onSelect={() => onSelectSlot(selectedSlot === key ? null : key)}
                  onDrop={(data) => onDrop(dayIndex, mealType, data)}
                  onRemove={(index) => onRemove({ dayIndex, mealType, index })}
                  onChangeServings={(index, delta) => onChangeServings({ dayIndex, mealType, index }, delta)}
                  onViewRecipe={onViewRecipe}
                  disabled={disabled}
                />
              );
            })}
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
  onRemove: (index: number) => void;
  onChangeServings: (index: number, delta: number) => void;
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
  const { dishes } = slot;

  const dragHandlers = {
    onDragOver: (event: React.DragEvent) => {
      if (!hasDragData(event) || disabled) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (!isOver) setIsOver(true);
    },
    onDragLeave: (event: React.DragEvent) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setIsOver(false);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setIsOver(false);
      const data = readDragData(event);
      if (data) onDrop(data);
    },
  };

  if (dishes.length === 0) {
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

  const canAddMore = dishes.length < MAX_DISHES_PER_SLOT;

  return (
    <div
      {...dragHandlers}
      className={cn(
        'flex min-h-[118px] flex-col rounded-2xl border-[1.5px] bg-white px-[13px] pb-2 pt-3 shadow-cell transition-[border-color,background-color] duration-[140ms]',
        selected || isOver ? 'border-tomato' : 'border-[oklch(0.92_0.015_80)]',
      )}
    >
      {dishes.map((dish, index) => (
        <DishBlock
          key={`${dish.recipe.id}-${index}`}
          dish={dish}
          isFirst={index === 0}
          onDragStart={(event) => setDragData(event, { kind: 'dish', dayIndex, mealType, recipeId: dish.recipe.id })}
          onRemove={() => onRemove(index)}
          onChangeServings={(delta) => onChangeServings(index, delta)}
          onViewRecipe={onViewRecipe}
          disabled={disabled}
        />
      ))}
      {canAddMore && (
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          aria-pressed={selected}
          className={cn(
            'mt-auto inline-flex items-center gap-1 self-start rounded-full pt-2 font-mono text-[11px] font-medium transition-colors',
            selected || isOver ? 'text-tomato' : 'text-[oklch(0.62_0.03_55)] hover:text-tomato',
          )}
        >
          <Plus className="size-3" strokeWidth={2.4} />
          {isOver ? p.dropHere : p.addDish}
        </button>
      )}
    </div>
  );
}

interface DishBlockProps {
  dish: PlannedDish;
  isFirst: boolean;
  onDragStart: (event: React.DragEvent) => void;
  onRemove: () => void;
  onChangeServings: (delta: number) => void;
  onViewRecipe: (recipe: Recipe) => void;
  disabled?: boolean;
}

function DishBlock({ dish, isFirst, onDragStart, onRemove, onChangeServings, onViewRecipe, disabled }: DishBlockProps) {
  const { t } = useTranslation();
  const p = t.kitchen.plan;
  const { recipe, servings } = dish;
  const collection = primaryCollection(recipe);
  const hue = collectionColor(collection);

  return (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      className={cn(
        'group/dish relative cursor-grab active:cursor-grabbing',
        !isFirst && 'mt-[10px] border-t border-dashed border-line-soft pt-[10px]',
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
        className={cn(
          'block text-left font-display font-normal leading-[1.25] text-ink [text-wrap:pretty] hover:text-tomato',
          isFirst ? 'mt-[9px] text-[17px]' : 'mt-[6px] text-[15px]',
        )}
      >
        {recipe.title}
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs font-medium text-[oklch(0.58_0.03_55)] tabular-nums">
        <span className="whitespace-nowrap">
          {recipe.totalTime} {t.kitchen.library.minutes}
        </span>
        <span className="text-line">·</span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <button
            type="button"
            onClick={() => onChangeServings(-1)}
            disabled={disabled || servings <= 1}
            className="grid size-4 place-items-center rounded-full opacity-0 transition-opacity hover:bg-line-soft group-hover/dish:opacity-100 disabled:opacity-0"
            aria-label="−"
          >
            <Minus className="size-3" />
          </button>
          {servings} {p.servingsShort}
          <button
            type="button"
            onClick={() => onChangeServings(1)}
            disabled={disabled || servings >= MAX_SLOT_SERVINGS}
            className="grid size-4 place-items-center rounded-full opacity-0 transition-opacity hover:bg-line-soft group-hover/dish:opacity-100 disabled:opacity-0"
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
        aria-label={`${p.remove}: ${recipe.title}`}
        className={cn(
          'absolute -right-[5px] grid size-6 place-items-center rounded-full text-ink-4 opacity-0 transition-opacity hover:bg-line-soft hover:text-tomato focus-visible:opacity-100 group-hover/dish:opacity-100',
          isFirst ? '-top-1' : 'top-[6px]',
        )}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
