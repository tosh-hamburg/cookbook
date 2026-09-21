import { Calendar, Check, Minus, Plus, ShoppingCart } from 'lucide-react';
import type { Ingredient } from '@/app/types/recipe';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useTranslation } from '@/app/i18n';

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 12;

interface IngredientsCardProps {
  ingredients: Ingredient[]; // bereits auf die Portionszahl umgerechnet
  servings: number;
  onServingsChange: (servings: number) => void;
  checked: Record<number, boolean>;
  onToggleChecked: (index: number) => void;
  onShoppingList: () => void;
  onPlan: () => void;
}

/** Rechte Spalte des Rezeptdetails: Portionsstepper, abhakbare Zutaten, Aktionen. */
export function IngredientsCard({
  ingredients,
  servings,
  onServingsChange,
  checked,
  onToggleChecked,
  onShoppingList,
  onPlan,
}: IngredientsCardProps) {
  const { t } = useTranslation();
  const d = t.kitchen.detail;
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <aside className="rounded-[20px] bg-white p-[22px] shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[26px] font-normal leading-none">{t.recipeDetail.ingredients}</h3>
        <div className="flex items-center gap-[2px] rounded-full border border-line p-[3px]">
          <StepperButton
            label="−"
            disabled={servings <= MIN_SERVINGS}
            onClick={() => onServingsChange(Math.max(MIN_SERVINGS, servings - 1))}
          >
            <Minus className="size-[15px]" strokeWidth={2.4} />
          </StepperButton>
          <span className="min-w-[44px] text-center font-mono text-[15px] font-bold tabular-nums">{servings}</span>
          <StepperButton
            label="+"
            disabled={servings >= MAX_SERVINGS}
            onClick={() => onServingsChange(Math.min(MAX_SERVINGS, servings + 1))}
          >
            <Plus className="size-[15px]" strokeWidth={2.4} />
          </StepperButton>
        </div>
      </div>
      <p className="mt-[6px] text-[13px] leading-[1.5] text-[oklch(0.58_0.03_55)]">{d.servingsHint}</p>

      <ul className="mt-[14px] flex flex-col">
        {ingredients.map((ingredient, index) => {
          const done = !!checked[index];
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => onToggleChecked(index)}
                aria-pressed={done}
                className="grid w-full grid-cols-[22px_1fr_auto] items-center gap-[11px] border-b border-line-soft px-[2px] py-[9px] text-left"
              >
                <span
                  className={cn(
                    'grid size-5 place-items-center rounded-[6px] border-[1.5px] transition-colors',
                    done ? 'border-tomato bg-tomato' : 'border-[oklch(0.8_0.02_80)] bg-transparent',
                  )}
                >
                  <Check className={cn('size-[13px] text-white', done ? 'opacity-100' : 'opacity-0')} strokeWidth={3} />
                </span>
                <span
                  className={cn('text-[15px] leading-[1.4]', done ? 'text-[oklch(0.66_0.02_50)] line-through' : 'text-ink')}
                >
                  {ingredient.name}
                </span>
                <span
                  className={cn(
                    'font-mono text-[13.5px] font-medium tabular-nums',
                    done ? 'text-[oklch(0.66_0.02_50)] line-through' : 'text-ink',
                  )}
                >
                  {ingredient.amount}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-col gap-[9px]">
        <Button variant="inkOutline" size="pill-md" className="w-full text-[14.5px]" onClick={onShoppingList}>
          <ShoppingCart strokeWidth={2} />
          {d.toShoppingList}
        </Button>
        <Button variant="ink" size="pill-md" className="w-full text-[14.5px]" onClick={onPlan}>
          <Calendar strokeWidth={2} />
          {d.planOnDay}
        </Button>
        <p className="text-center text-[13px] leading-[1.5] text-[oklch(0.6_0.03_55)]">
          {d.checkedCount.split('{count}')[0]}
          <b className="font-mono font-medium tabular-nums">{checkedCount}</b>
          {d.checkedCount.split('{count}')[1]}
        </p>
      </div>
    </aside>
  );
}

interface StepperButtonProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function StepperButton({ label, disabled, onClick, children }: StepperButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-[30px] place-items-center rounded-full text-ink-2 transition-colors hover:bg-[oklch(0.94_0.02_80)] disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
