import { Languages, LogOut, Menu, Plus, Search, Settings, Smartphone } from 'lucide-react';
import type { User } from '@/app/types/user';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { useTranslation } from '@/app/i18n';

export type NavTarget = 'recipes' | 'planner' | 'shopping';

interface AppHeaderProps {
  user: User;
  active: NavTarget | null;
  query: string;
  onQueryChange: (query: string) => void;
  onNavigate: (target: NavTarget) => void;
  onCreateNew: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

/** Kopfzeile (Handoff: Header 78 px, Wortmarke + Nav + Suche + Primäraktion). */
export function AppHeader({
  user,
  active,
  query,
  onQueryChange,
  onNavigate,
  onCreateNew,
  onOpenAdmin,
  onLogout,
}: AppHeaderProps) {
  const { t, language, setLanguage } = useTranslation();
  const nav = t.kitchen.nav;
  const isAdmin = user.role === 'admin';

  const navItems: Array<{ target: NavTarget; label: string }> = [
    { target: 'recipes', label: nav.recipes },
    { target: 'planner', label: nav.planner },
    { target: 'shopping', label: nav.shoppingList },
  ];

  const openAppDownload = () => window.open('/api/app/download', '_blank', 'noopener,noreferrer');

  return (
    <header className="relative z-10 flex h-[78px] items-center gap-9 border-b border-line px-10 max-[900px]:gap-4 max-[900px]:px-4">
      <button
        type="button"
        onClick={() => onNavigate('recipes')}
        className="flex items-baseline gap-[2px]"
        title={nav.recipes}
      >
        <span className="font-display text-[30px] font-normal leading-none tracking-[-0.01em]">{nav.wordmark}</span>
        <span className="ml-1 inline-block size-[7px] rounded-full bg-tomato" />
      </button>

      <nav className="flex gap-[26px] text-[15px] font-medium max-[900px]:hidden" aria-label="Hauptnavigation">
        {navItems.map((item) => (
          <button
            key={item.target}
            type="button"
            onClick={() => onNavigate(item.target)}
            className={cn(
              'pb-[6px] leading-none transition-colors',
              active === item.target
                ? 'border-b-2 border-tomato text-ink'
                : 'border-b-2 border-transparent text-ink-3 hover:text-ink',
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <span className="flex-1" />

      <div className="relative w-[280px] max-[900px]:w-full max-[900px]:max-w-[220px]">
        <Search
          className="pointer-events-none absolute left-[14px] top-1/2 size-[17px] -translate-y-1/2 text-[oklch(0.6_0.04_50)]"
          strokeWidth={2}
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={nav.searchPlaceholder}
          aria-label={t.search}
          className="h-[42px] w-full rounded-full border border-line bg-white pl-10 pr-4 text-[15px] leading-none text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-tomato"
        />
      </div>

      <Button variant="ink" size="pill" className="pl-[6px] pr-[18px] max-[900px]:hidden" onClick={onCreateNew}>
        <span className="grid size-[30px] place-items-center rounded-full bg-tomato">
          <Plus className="size-4 text-white" strokeWidth={2.4} />
        </span>
        {nav.createRecipe}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="grid size-[42px] place-items-center rounded-full border border-line bg-white text-[15px] font-semibold uppercase text-ink transition-colors hover:border-tomato"
            title={`${t.app.loggedInAs}: ${user.username}`}
            aria-label={nav.account}
          >
            <span className="max-[900px]:hidden">{user.username.slice(0, 1)}</span>
            <Menu className="size-5 min-[901px]:hidden" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 rounded-2xl border-line p-2">
          <DropdownMenuLabel className="text-ink-4">
            {user.username} · {isAdmin ? t.app.admin : t.app.user}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="min-[901px]:hidden">
            {navItems.map((item) => (
              <DropdownMenuItem key={item.target} onClick={() => onNavigate(item.target)}>
                {item.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={onCreateNew}>
              <Plus className="size-4" />
              {nav.createRecipe}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </div>
          <DropdownMenuItem onClick={openAppDownload}>
            <Smartphone className="size-4" />
            {t.app.downloadApp}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-2 text-ink-4">
            <Languages className="size-4" />
            {t.app.language}
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setLanguage('de')} className={language === 'de' ? 'bg-accent' : ''}>
            🇩🇪 Deutsch
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLanguage('en')} className={language === 'en' ? 'bg-accent' : ''}>
            🇬🇧 English
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenAdmin}>
                <Settings className="size-4" />
                {t.app.administration}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout}>
            <LogOut className="size-4" />
            {t.app.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
