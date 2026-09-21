import type { Collection } from '@/app/services/api';
import { cn } from '@/app/components/ui/utils';
import { useTranslation } from '@/app/i18n';

interface CollectionPillsProps {
  collections: Collection[];
  selected: Set<string>;
  onToggle: (collectionId: string) => void;
  onClear: () => void;
}

const pillBase =
  'inline-flex h-[34px] items-center rounded-full border px-[15px] text-[13.5px] font-semibold transition-[background-color,border-color] duration-[140ms] hover:border-tomato';

/** Sammlungs-Pills mit Mehrfachauswahl (OR-Logik); „Alles" leert die Auswahl. */
export function CollectionPills({ collections, selected, onToggle, onClear }: CollectionPillsProps) {
  const { t } = useTranslation();
  const noneSelected = selected.size === 0;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={onClear}
        aria-pressed={noneSelected}
        className={cn(
          pillBase,
          noneSelected ? 'border-ink bg-ink text-white hover:border-ink' : 'border-line bg-transparent text-ink-2',
        )}
      >
        {t.kitchen.library.all}
      </button>
      {collections.map((collection) => {
        const active = selected.has(collection.id);
        return (
          <button
            key={collection.id}
            type="button"
            onClick={() => onToggle(collection.id)}
            aria-pressed={active}
            className={cn(
              pillBase,
              active ? 'border-ink bg-ink text-white hover:border-ink' : 'border-line bg-transparent text-ink-2',
            )}
          >
            {collection.name}
          </button>
        );
      })}
    </div>
  );
}
