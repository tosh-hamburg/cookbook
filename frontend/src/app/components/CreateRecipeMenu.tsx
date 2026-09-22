import { ChevronDown, Download, PenLine, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { cn } from '@/app/components/ui/utils';
import { useTranslation } from '@/app/i18n';

interface CreateRecipeMenuProps {
  onCreateNew: () => void;
  onImport: () => void;
  className?: string;
}

/**
 * Primäraktion „Rezept anlegen“ als Split-Button: Klick auf den Text legt
 * direkt ein Rezept an, der Pfeil öffnet die Alternativen (selbst schreiben,
 * aus URL importieren).
 */
export function CreateRecipeMenu({ onCreateNew, onImport, className }: CreateRecipeMenuProps) {
  const { t } = useTranslation();
  const nav = t.kitchen.nav;

  return (
    <div
      className={cn(
        'inline-flex h-[42px] items-stretch overflow-hidden rounded-full bg-ink text-[14.5px] font-semibold text-white',
        className,
      )}
    >
      <button
        type="button"
        onClick={onCreateNew}
        className="flex items-center gap-[9px] pl-[6px] pr-4 transition-colors hover:bg-ink-hover focus-visible:bg-ink-hover focus-visible:outline-none"
      >
        <span className="grid size-[30px] place-items-center rounded-full bg-tomato">
          <Plus className="size-4 text-white" strokeWidth={2.4} />
        </span>
        {nav.createRecipe}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={nav.createMenu}
            title={nav.createMenu}
            className="grid w-[34px] place-items-center border-l border-white/15 transition-colors hover:bg-ink-hover focus-visible:bg-ink-hover focus-visible:outline-none data-[state=open]:bg-ink-hover"
          >
            <ChevronDown className="size-4 transition-transform [button[data-state=open]_&]:rotate-180" strokeWidth={2.4} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 rounded-2xl border-line p-2">
          <DropdownMenuItem onClick={onCreateNew}>
            <PenLine className="size-4" />
            {nav.createManually}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onImport}>
            <Download className="size-4" />
            {nav.importFromUrl}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
