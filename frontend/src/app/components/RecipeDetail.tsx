import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FolderPlus, Heart, Pencil, Play, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Recipe, Ingredient } from '@/app/types/recipe';
import { Button } from '@/app/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { IngredientsCard, MAX_SERVINGS, MIN_SERVINGS } from '@/app/components/detail/IngredientsCard';
import { StepList } from '@/app/components/detail/StepList';
import { NoteBlock } from '@/app/components/detail/NoteBlock';
import { AddToWeekPlannerDialog } from '@/app/components/AddToWeekPlannerDialog';
import { collectionsApi, recipesApi, type Collection } from '@/app/services/api';
import { collectionColor } from '@/app/utils/collectionColors';
import { scaleAmount } from '@/app/utils/amounts';
import { parseSteps } from '@/app/utils/steps';
import { primaryCollection, sourceHost } from '@/app/utils/recipeMeta';
import { useTranslation } from '@/app/i18n';

interface RecipeDetailProps {
  recipe: Recipe;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCook: (recipe: Recipe, servings: number) => void;
  onToggleFavorite: (recipe: Recipe) => void;
  isAdmin?: boolean;
  onRecipeUpdate?: (recipe: Recipe) => void;
}

function clampServings(value: number): number {
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, value || MIN_SERVINGS));
}

/** Rezeptdetail (Handoff 3a). */
export function RecipeDetail({
  recipe,
  onClose,
  onEdit,
  onDelete,
  onCook,
  onToggleFavorite,
  isAdmin,
  onRecipeUpdate,
}: RecipeDetailProps) {
  const { t } = useTranslation();
  const d = t.kitchen.detail;
  const [servings, setServings] = useState(() => clampServings(recipe.servings));
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [activeImage, setActiveImage] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPlannerDialog, setShowPlannerDialog] = useState(false);
  const [availableCollections, setAvailableCollections] = useState<Collection[]>([]);

  useEffect(() => {
    setServings(clampServings(recipe.servings));
    setChecked({});
    setActiveImage(0);
  }, [recipe.id, recipe.servings]);

  useEffect(() => {
    if (isAdmin) {
      collectionsApi.getAll().then(setAvailableCollections).catch(console.error);
    }
  }, [isAdmin]);

  const scaleFactor = servings / (recipe.servings || MIN_SERVINGS);
  const scaledIngredients = useMemo<Ingredient[]>(
    () => recipe.ingredients.map((ing) => ({ name: ing.name, amount: scaleAmount(ing.amount, scaleFactor) })),
    [recipe.ingredients, scaleFactor],
  );
  const steps = useMemo(() => parseSteps(recipe.instructions), [recipe.instructions]);

  const collection = primaryCollection(recipe);
  const hue = collectionColor(collection);
  const host = sourceHost(recipe.sourceUrl);
  const images = recipe.images ?? [];
  const heroImage = images[activeImage] ?? images[0];
  const activeTime = recipe.prepTime + recipe.cookTime;
  const collectionsToAdd = availableCollections.filter(
    (col) => !recipe.collections?.some((rc) => rc.id === col.id),
  );

  const saveNote = async (notes: string) => {
    try {
      const updated = await recipesApi.update(recipe.id, { ...recipe, notes: notes || null });
      onRecipeUpdate?.(updated);
      toast.success(d.noteSaved);
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error(d.noteSaveError);
    }
  };

  const addToCollection = async (collectionId: string) => {
    try {
      await collectionsApi.addRecipe(collectionId, recipe.id);
      const added = availableCollections.find((c) => c.id === collectionId);
      onRecipeUpdate?.({
        ...recipe,
        collections: [...(recipe.collections || []), { id: collectionId, name: added?.name || '' }],
      });
      toast.success(t.collections.addedToCollection);
    } catch (error) {
      console.error(error);
      toast.error(t.collections.updateError);
    }
  };

  const removeFromCollection = async (collectionId: string) => {
    try {
      await collectionsApi.removeRecipe(collectionId, recipe.id);
      onRecipeUpdate?.({ ...recipe, collections: recipe.collections?.filter((c) => c.id !== collectionId) || [] });
      toast.success(t.collections.removedFromCollection);
    } catch (error) {
      console.error(error);
      toast.error(t.collections.updateError);
    }
  };

  // Send ingredients to Google Keep via Gemini (clipboard prompt)
  const sendToShoppingList = async () => {
    const list = scaledIngredients.map((ing) => (ing.amount ? `${ing.amount} ${ing.name}` : ing.name)).join('\n');
    const servingsLabel = servings === 1 ? t.recipeDetail.serving : t.recipeDetail.servings;
    const prompt = `Füge bitte folgende Zutaten zu meiner Einkaufsliste in Google Keep hinzu (erstelle die Liste "Einkaufsliste" falls sie nicht existiert):

${recipe.title} (${servings} ${servingsLabel}):
${list}`;

    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(t.recipeDetail.promptCopied, { description: t.recipeDetail.promptCopiedDescription });
      window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Clipboard error:', error);
      toast.error(t.recipeDetail.copyError, { description: t.recipeDetail.copyErrorDescription });
    }
  };

  return (
    <div className="animate-rise">
      {/* Kopfzeile */}
      <div className="flex flex-wrap items-center gap-[22px] max-[900px]:gap-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-[14.5px] font-semibold text-ink-2 transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-[18px]" strokeWidth={2.2} />
          {d.backToCollection}
        </button>
        <span className="flex-1" />
        {host && recipe.sourceUrl && (
          <>
            <span className="text-[13.5px] font-medium text-ink-4 max-[900px]:hidden">
              {d.source}:{' '}
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[12.5px] text-ink-2 hover:text-tomato hover:underline"
              >
                {host}
              </a>
            </span>
            <span className="h-6 w-px bg-line max-[900px]:hidden" />
          </>
        )}
        <Button variant="paper" size="pill-sm" onClick={onEdit}>
          <Pencil strokeWidth={2} />
          {t.recipeDetail.edit}
        </Button>
        <Button
          variant="paper"
          size="pill-sm"
          onClick={() => onToggleFavorite(recipe)}
          aria-pressed={!!recipe.isFavorite}
        >
          <Heart
            strokeWidth={2}
            style={recipe.isFavorite ? { fill: 'var(--tomato)', stroke: 'var(--tomato)' } : { stroke: 'var(--tomato)' }}
          />
          {recipe.isFavorite ? d.saved : d.save}
        </Button>
        <Button
          variant="paper"
          size="icon-round"
          className="size-[38px] text-ink-3 hover:text-tomato"
          onClick={() => setShowDeleteDialog(true)}
          title={t.recipeDetail.delete}
          aria-label={t.recipeDetail.delete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="mt-[34px] grid items-start gap-10 min-[1100px]:grid-cols-[1fr_396px] max-[1100px]:grid-cols-1">
        <div className="min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-[10px]">
            {recipe.collections?.map((col) => (
              <span
                key={col.id}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-white px-[13px] text-[11.5px] font-bold uppercase tracking-[.08em]"
                style={{ color: collectionColor(col.name) }}
              >
                {col.name}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => removeFromCollection(col.id)}
                    className="ml-1 text-ink-4 hover:text-tomato"
                    aria-label={`${col.name} entfernen`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
            {recipe.categories.map((category) => (
              <span
                key={category}
                className="inline-flex h-7 items-center rounded-full border border-line px-[13px] text-[12.5px] font-medium text-[oklch(0.45_0.03_48)]"
              >
                {category}
              </span>
            ))}
            {isAdmin && collectionsToAdd.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line px-[11px] text-[12px] font-medium text-ink-4 hover:border-tomato hover:text-ink"
                  >
                    <FolderPlus className="size-3.5" />
                    {d.addToCollection}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {collectionsToAdd.map((col) => (
                    <DropdownMenuItem key={col.id} onClick={() => addToCollection(col.id)}>
                      <span className="size-2 rounded-full" style={{ background: collectionColor(col.name) }} />
                      {col.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <h1 className="mt-4 font-display text-[46px] font-normal leading-[1.08] tracking-[-0.015em] [text-wrap:balance] max-[700px]:text-[34px]">
            {recipe.title}
          </h1>

          {/* Titelfoto */}
          <div className="relative mt-6 h-[420px] overflow-hidden rounded-3xl bg-photo-fallback shadow-[0_26px_50px_-26px_oklch(0.4_0.05_50_/_.55)] max-[700px]:h-[260px]">
            {heroImage ? (
              <img src={heroImage} alt={recipe.title} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center">
                <UtensilsCrossed className="size-14" style={{ color: hue }} strokeWidth={1.4} />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto" aria-label={d.moreImages}>
              {images.map((image, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${
                    index === activeImage ? 'border-tomato' : 'border-transparent hover:border-line'
                  }`}
                >
                  <img src={image} alt={`${recipe.title} ${index + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Metrik-Karte */}
          <div className="mt-[26px] flex flex-wrap items-center gap-[30px] rounded-[18px] bg-white px-6 py-5 shadow-metric">
            <Metric value={`${recipe.totalTime} ${t.kitchen.library.minutes}`} label={d.total} />
            <Metric value={`${activeTime} ${t.kitchen.library.minutes}`} label={d.activeTime} />
            {recipe.caloriesPerUnit > 0 && <Metric value={String(recipe.caloriesPerUnit)} label={d.kcalPerServing} />}
            <Metric value={`${recipe.cookCount ?? 0}×`} label={d.cooked} />
            <span className="flex-1" />
            <Button variant="tomato" size="pill-md" onClick={() => onCook(recipe, servings)}>
              <Play strokeWidth={2.2} />
              {d.cookMode}
            </Button>
          </div>

          <NoteBlock note={recipe.notes ?? ''} onSave={saveNote} />

          <StepList steps={steps} />
        </div>

        <div className="min-[1100px]:sticky min-[1100px]:top-6">
          <IngredientsCard
            ingredients={scaledIngredients}
            servings={servings}
            onServingsChange={setServings}
            checked={checked}
            onToggleChecked={(index) => setChecked((prev) => ({ ...prev, [index]: !prev[index] }))}
            onShoppingList={sendToShoppingList}
            onPlan={() => setShowPlannerDialog(true)}
          />
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.recipeDetail.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.recipeDetail.deleteConfirmDescription.replace('{title}', recipe.title)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteDialog(false);
                onDelete();
              }}
              className="bg-tomato text-white hover:bg-tomato-str"
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddToWeekPlannerDialog
        recipe={recipe}
        servings={servings}
        open={showPlannerDialog}
        onOpenChange={setShowPlannerDialog}
        onSuccess={() => toast.success(t.planner.recipeAdded)}
      />
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-2xl font-bold leading-none tracking-[-0.03em] tabular-nums">{value}</div>
      <div className="mt-[6px] text-[11px] font-semibold uppercase tracking-[.1em] text-ink-4">{label}</div>
    </div>
  );
}
