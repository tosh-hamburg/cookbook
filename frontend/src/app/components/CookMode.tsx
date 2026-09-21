import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sun, X } from 'lucide-react';
import type { Recipe } from '@/app/types/recipe';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useWakeLock } from '@/app/hooks/useWakeLock';
import { formatCountdown, useCountdown } from '@/app/hooks/useCountdown';
import { playChime, primeChime } from '@/app/utils/chime';
import { scaleAmount } from '@/app/utils/amounts';
import { formatStepNumber, parseSteps } from '@/app/utils/steps';
import { useTranslation } from '@/app/i18n';

interface CookModeProps {
  recipe: Recipe;
  servings: number;
  onExit: () => void;
  /** Letzter Schritt → „Fertig": Kochzähler +1 */
  onFinish: (recipe: Recipe, servings: number) => void;
}

const DEFAULT_TIMER_MINUTES = 5;

/** Kochmodus (Handoff 3b): ein Schritt pro Ansicht, dunkel, aus zwei Metern lesbar. */
export function CookMode({ recipe, servings, onExit, onFinish }: CookModeProps) {
  const { t } = useTranslation();
  const c = t.kitchen.cook;
  const steps = useMemo(() => parseSteps(recipe.instructions), [recipe.instructions]);
  const [stepIndex, setStepIndex] = useState(0);
  const [isRinging, setIsRinging] = useState(false);
  const wakeLockActive = useWakeLock();

  const step = steps[stepIndex];
  const totalSteps = Math.max(steps.length, 1);
  const isLast = stepIndex >= steps.length - 1;
  const timerSeconds = (step?.minutes ?? DEFAULT_TIMER_MINUTES) * 60;

  const timer = useCountdown(timerSeconds, () => {
    playChime();
    setIsRinging(true);
  });
  const { reset: resetTimer } = timer;

  useEffect(() => {
    resetTimer(timerSeconds);
    setIsRinging(false);
  }, [stepIndex, timerSeconds, resetTimer]);

  const scaleFactor = servings / (recipe.servings || 1);
  const ingredients = useMemo(
    () => recipe.ingredients.map((ing) => ({ name: ing.name, amount: scaleAmount(ing.amount, scaleFactor) })),
    [recipe.ingredients, scaleFactor],
  );

  const goPrev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => {
    if (isLast) {
      onFinish(recipe, servings);
      return;
    }
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  }, [isLast, onFinish, recipe, servings, steps.length]);

  const { toggle: toggleCountdown } = timer;
  const toggleTimer = useCallback(() => {
    primeChime();
    setIsRinging(false);
    toggleCountdown();
  }, [toggleCountdown]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          goPrev();
          break;
        case ' ':
          event.preventDefault();
          toggleTimer();
          break;
        case 'Escape':
          event.preventDefault();
          onExit();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, toggleTimer, onExit]);

  const progress = Math.round(((stepIndex + 1) / totalSteps) * 100);

  return (
    <div className="fixed inset-0 z-50 flex bg-cook-bg text-cook-fg max-[900px]:flex-col max-[900px]:overflow-y-auto">
      {/* Linke Spalte: Titel, Schritt-Rail, Zutaten */}
      <aside className="flex w-[300px] flex-none flex-col bg-cook-bg-deep px-[22px] py-7 max-[900px]:w-full max-[900px]:py-5">
        <div className="font-display text-2xl font-normal leading-[1.15] text-white [text-wrap:pretty]">{recipe.title}</div>
        <div className="mt-2 text-[13px] font-medium text-[oklch(0.72_0.04_80)]">
          {servings} {c.servings} · {steps.length} {c.steps}
        </div>

        <div className="mt-6 flex flex-col gap-1 max-[900px]:flex-row max-[900px]:flex-wrap">
          {steps.map((s, index) => {
            const done = index < stepIndex;
            const active = index === stepIndex;
            return (
              <button
                key={index}
                type="button"
                onClick={() => setStepIndex(index)}
                className={cn(
                  'grid grid-cols-[22px_1fr] items-center gap-3 rounded-xl px-3 py-[11px] text-left transition-colors hover:bg-[oklch(0.26_0.04_45)]',
                  active ? 'bg-[oklch(0.36_0.05_45)] text-white' : done ? 'text-[oklch(0.72_0.05_90)]' : 'text-[oklch(0.6_0.03_60)]',
                )}
              >
                <span
                  className="size-[9px] justify-self-center rounded-full"
                  style={{
                    background: done ? 'var(--gold)' : active ? 'var(--tomato)' : 'oklch(0.42 0.03 50)',
                  }}
                />
                <span className="text-sm font-semibold leading-[1.3]">
                  {s.title ?? `${c.stepOf.split(' ')[0]} ${formatStepNumber(index)}`}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-auto border-t border-cook-line pt-5 max-[900px]:mt-5">
          <div className="text-[10.5px] font-bold uppercase tracking-[.12em] text-[oklch(0.68_0.04_80)]">
            {c.ingredientsForThisRun}
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {ingredients.map((ing, index) => (
              <li
                key={index}
                className="flex items-baseline justify-between gap-3 text-sm leading-[1.3] text-[oklch(0.86_0.02_80)]"
              >
                <span>{ing.name}</span>
                <span className="font-mono text-[13px] font-medium text-gold tabular-nums">{ing.amount}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Rechte Spalte: Fortschritt, Schritt, Timer, Navigation */}
      <main className="flex min-w-0 flex-1 flex-col px-11 pb-[30px] pt-[34px] max-[900px]:px-5 max-[900px]:pt-5">
        <div className="flex items-center gap-4">
          <div className="text-xs font-bold uppercase tracking-[.16em] text-gold">
            {c.stepOf
              .replace('{current}', formatStepNumber(stepIndex))
              .replace('{total}', String(formatStepNumber(totalSteps - 1)))}
          </div>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-cook-line">
            <div className="h-full bg-gold transition-[width] duration-200 ease-out" style={{ width: `${progress}%` }} />
          </div>
          {wakeLockActive && (
            <div className="inline-flex items-center gap-2 text-[13px] font-medium text-[oklch(0.74_0.03_80)] max-[700px]:hidden">
              <Sun className="size-[15px]" strokeWidth={2} />
              {c.screenStaysOn}
            </div>
          )}
          <button
            type="button"
            onClick={onExit}
            title={c.exit}
            aria-label={c.exit}
            className="grid size-9 place-items-center rounded-full border border-[oklch(0.44_0.04_50)] text-[oklch(0.8_0.03_80)] transition-colors hover:border-gold hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-center py-7">
          {step ? (
            <>
              {step.title && <div className="font-display text-[30px] font-normal leading-none text-gold">{step.title}</div>}
              <p className="mt-5 max-w-[780px] whitespace-pre-line text-[34px] font-medium leading-[1.4] text-white [text-wrap:pretty] max-[900px]:text-[24px]">
                {step.text}
              </p>
            </>
          ) : (
            <p className="text-[24px] text-[oklch(0.8_0.03_80)]">{t.kitchen.detail.noSteps}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <div
            className={cn(
              'flex items-center gap-4 rounded-[18px] bg-cook-bg-deep px-[22px] py-4 transition-shadow',
              isRinging && 'animate-pulse shadow-[0_0_0_3px_var(--gold)]',
            )}
          >
            <div className="font-mono text-[44px] font-bold leading-none tracking-[-0.04em] text-white tabular-nums">
              {formatCountdown(timer.remainingSeconds)}
            </div>
            <div className="flex flex-col gap-[6px]">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={toggleTimer}
                  className="inline-flex h-8 items-center gap-[7px] rounded-full bg-gold px-[13px] text-[12.5px] font-bold text-gold-ink transition-colors hover:bg-[oklch(0.86_0.12_90)]"
                >
                  {timer.isRunning ? c.pauseTimer : c.startTimer}
                </button>
                {(timer.remainingSeconds !== timerSeconds || timer.isFinished) && (
                  <button
                    type="button"
                    onClick={() => {
                      resetTimer(timerSeconds);
                      setIsRinging(false);
                    }}
                    className="inline-flex h-8 items-center rounded-full border border-[oklch(0.44_0.04_50)] px-3 text-[12.5px] font-semibold text-[oklch(0.8_0.03_80)] hover:border-gold"
                  >
                    {c.resetTimer}
                  </button>
                )}
              </div>
              <span className="text-[11.5px] font-medium text-[oklch(0.7_0.04_80)]">
                {isRinging ? c.timerDone : c.ringsInBackground}
              </span>
            </div>
          </div>

          <span className="flex-1" />

          <span className="text-[11.5px] text-[oklch(0.55_0.03_60)] max-[1100px]:hidden">{c.keyboardHint}</span>

          <Button variant="cookOutline" size="pill-xl" onClick={goPrev} disabled={stepIndex === 0}>
            <ArrowLeft strokeWidth={2.2} />
            {c.back}
          </Button>
          <Button
            variant="tomato"
            size="pill-xl"
            className="px-8 text-[17px] shadow-next"
            onClick={goNext}
            disabled={steps.length === 0}
          >
            {isLast ? c.done : c.next}
            {isLast ? <Check strokeWidth={2.4} /> : <ArrowRight strokeWidth={2.2} />}
          </Button>
        </div>
      </main>
    </div>
  );
}
