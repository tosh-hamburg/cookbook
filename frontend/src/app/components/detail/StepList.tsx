import { formatStepNumber, type RecipeStep } from '@/app/utils/steps';
import { useTranslation } from '@/app/i18n';

interface StepListProps {
  steps: RecipeStep[];
}

/** „Zubereitung" im Rezeptdetail: nummerierte Schritte mit optionaler Teilzeit. */
export function StepList({ steps }: StepListProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mt-[34px] flex items-center gap-[14px]">
        <h3 className="font-display text-[30px] font-normal leading-none">{t.recipeDetail.instructions}</h3>
        <div className="h-px flex-1 bg-line" />
      </div>

      {steps.length === 0 ? (
        <p className="mt-5 text-[15.5px] text-ink-2">{t.kitchen.detail.noSteps}</p>
      ) : (
        <ol className="mt-5 flex flex-col gap-[18px]">
          {steps.map((step) => (
            <li
              key={step.index}
              className="grid grid-cols-[64px_1fr] gap-5 border-b border-dashed border-line pb-[18px] max-[700px]:grid-cols-[44px_1fr] max-[700px]:gap-3"
            >
              <div className="font-display text-[40px] font-normal leading-none text-[oklch(0.78_0.06_45)]">
                {formatStepNumber(step.index)}
              </div>
              <div>
                {(step.title || step.minutes !== null) && (
                  <div className="flex items-baseline gap-3">
                    {step.title && <div className="text-base font-semibold leading-[1.2]">{step.title}</div>}
                    {step.minutes !== null && (
                      <div className="font-mono text-[12.5px] font-medium text-tomato">
                        {step.minutes} {t.kitchen.library.minutes}
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-2 whitespace-pre-line text-[15.5px] leading-[1.65] text-[oklch(0.4_0.03_45)] [text-wrap:pretty]">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
