import { Router, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import {
  MAX_DISHES_PER_SLOT,
  applyLegacySlotUpdate,
  buildSlotRows,
  buildWeekRows,
  parseDish,
  parseSlotTarget,
  parseSlotUpdates,
  type DishInput,
  type SlotTarget
} from '../lib/meal-slots';

const router = Router();

// Include for meal plan queries
const mealPlanInclude = {
  meals: {
    orderBy: [{ dayIndex: 'asc' }, { mealType: 'asc' }, { position: 'asc' }],
    include: {
      recipe: {
        include: {
          ingredients: true,
          categories: {
            include: {
              category: true
            }
          }
        }
      }
    }
  }
} satisfies Prisma.MealPlanInclude;

// Transform meal plan for frontend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformMealPlan(mealPlan: any) {
  return {
    id: mealPlan.id,
    weekStart: mealPlan.weekStart.toISOString(),
    sentIngredients: mealPlan.sentIngredients || [],
    excludedIngredients: mealPlan.excludedIngredients || [],
    meals: mealPlan.meals.map((slot: any) => ({
      dayIndex: slot.dayIndex,
      mealType: slot.mealType,
      position: slot.position,
      servings: slot.servings,
      recipe: slot.recipe ? {
        id: slot.recipe.id,
        title: slot.recipe.title,
        images: slot.recipe.images,
        ingredients: slot.recipe.ingredients.map((i: any) => ({
          name: i.name,
          amount: i.amount
        })),
        servings: slot.recipe.servings,
        totalTime: slot.recipe.totalTime,
        categories: slot.recipe.categories.map((rc: any) => rc.category.name)
      } : null
    }))
  };
}

// Helper to normalize date to start of day (UTC)
function normalizeWeekStart(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

// Helper to find or create a shared meal plan for a given week
async function findOrCreateMealPlan(prisma: PrismaClient, weekStart: Date, userId: string) {
  let mealPlan = await prisma.mealPlan.findFirst({
    where: { weekStart }
  });

  if (!mealPlan) {
    mealPlan = await prisma.mealPlan.create({
      data: { userId, weekStart }
    });
  }

  return mealPlan;
}

async function respondWithMealPlan(prisma: PrismaClient, mealPlanId: string, res: Response) {
  const mealPlan = await prisma.mealPlan.findUnique({
    where: { id: mealPlanId },
    include: mealPlanInclude
  });
  res.json(transformMealPlan(mealPlan));
}

async function allRecipesExist(prisma: PrismaClient, recipeIds: string[]): Promise<boolean> {
  const unique = [...new Set(recipeIds)];
  if (unique.length === 0) return true;
  const found = await prisma.recipe.count({ where: { id: { in: unique } } });
  return found === unique.length;
}

function slotWhere(mealPlanId: string, target: SlotTarget) {
  return { mealPlanId, dayIndex: target.dayIndex, mealType: target.mealType };
}

type Tx = Prisma.TransactionClient;

// Run slot writes of one plan in a transaction that locks the plan row, so
// concurrent read-then-write requests (append, legacy update) are serialized.
async function withLockedPlan<T>(prisma: PrismaClient, mealPlanId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "MealPlan" WHERE id = ${mealPlanId} FOR UPDATE`;
    return work(tx);
  });
}

// Dishes of one slot in order; rows whose recipe was deleted are skipped
async function readSlotDishes(tx: Tx, mealPlanId: string, target: SlotTarget): Promise<DishInput[]> {
  const rows = await tx.mealSlot.findMany({
    where: { ...slotWhere(mealPlanId, target), recipeId: { not: null } },
    orderBy: { position: 'asc' },
    select: { recipeId: true, servings: true }
  });
  return rows.map((row) => ({ recipeId: row.recipeId!, servings: row.servings }));
}

async function replaceSlotDishes(tx: Tx, mealPlanId: string, target: SlotTarget, dishes: DishInput[]) {
  await tx.mealSlot.deleteMany({ where: slotWhere(mealPlanId, target) });
  await tx.mealSlot.createMany({ data: buildSlotRows(mealPlanId, target, dishes) });
}

function parseWeekStart(param: string): Date | null {
  const weekStart = normalizeWeekStart(new Date(param));
  return isNaN(weekStart.getTime()) ? null : weekStart;
}

// Get meal plan for a specific week (shared across all users)
router.get('/:weekStart', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const weekStartParam = req.params.weekStart as string;

    // Parse and normalize the week start date
    const weekStart = normalizeWeekStart(new Date(weekStartParam));

    if (isNaN(weekStart.getTime())) {
      return res.status(400).json({ error: 'Ungültiges Datum' });
    }

    // Find existing meal plan (shared - no userId filter)
    const mealPlan = await prisma.mealPlan.findFirst({
      where: { weekStart },
      include: mealPlanInclude
    });

    if (!mealPlan) {
      // Return empty plan structure
      return res.json({
        id: null,
        weekStart: weekStart.toISOString(),
        sentIngredients: [],
        excludedIngredients: [],
        meals: []
      });
    }

    res.json(transformMealPlan(mealPlan));
  } catch (error) {
    console.error('Get meal plan error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Wochenplans' });
  }
});

// Create or update meal plan for a week (shared across all users)
router.put('/:weekStart', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const userId = req.user!.id;
    const weekStartParam = req.params.weekStart as string;
    const { meals } = req.body;

    // Parse and normalize the week start date
    const weekStart = normalizeWeekStart(new Date(weekStartParam));

    if (isNaN(weekStart.getTime())) {
      return res.status(400).json({ error: 'Ungültiges Datum' });
    }

    if (!Array.isArray(meals)) {
      return res.status(400).json({ error: 'Mahlzeiten müssen ein Array sein' });
    }

    // Find or create shared meal plan
    const mealPlan = await findOrCreateMealPlan(prisma, weekStart, userId);

    // Replace all meal slots; several dishes per day/meal are allowed
    const rows = buildWeekRows(mealPlan.id, meals);
    if (!(await allRecipesExist(prisma, rows.map((row) => row.recipeId)))) {
      return res.status(400).json({ error: 'Unbekanntes Rezept im Wochenplan' });
    }

    await withLockedPlan(prisma, mealPlan.id, async (tx) => {
      await tx.mealSlot.deleteMany({ where: { mealPlanId: mealPlan.id } });
      await tx.mealSlot.createMany({ data: rows });
    });

    await respondWithMealPlan(prisma, mealPlan.id, res);
  } catch (error) {
        console.error('Update meal plan error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern des Wochenplans' });
  }
});

// Replace the dishes of one or more slots in one transaction (shared across all users).
// Moving a dish touches two slots, so both are sent together.
// Body: { slots: [{ dayIndex, mealType, dishes: [{ recipeId, servings }] }] } - an empty dish list clears a slot.
router.put('/:weekStart/slots', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const weekStart = parseWeekStart(req.params.weekStart as string);
    if (!weekStart) return res.status(400).json({ error: 'Ungültiges Datum' });

    const updates = parseSlotUpdates(req.body.slots);
    if (!updates.ok) return res.status(400).json({ error: updates.error });
    const recipeIds = updates.value.flatMap((update) => update.dishes.map((dish) => dish.recipeId));
    if (!(await allRecipesExist(prisma, recipeIds))) {
      return res.status(400).json({ error: 'Rezept nicht gefunden' });
    }

    const mealPlan = await findOrCreateMealPlan(prisma, weekStart, req.user!.id);
    await withLockedPlan(prisma, mealPlan.id, async (tx) => {
      for (const update of updates.value) {
        await replaceSlotDishes(tx, mealPlan.id, update.target, update.dishes);
      }
    });
    await respondWithMealPlan(prisma, mealPlan.id, res);
  } catch (error) {
    console.error('Replace meal slots error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der Mahlzeit' });
  }
});

// Append one dish to a slot (shared across all users).
// Body: { dayIndex, mealType, recipeId, servings }
router.post('/:weekStart/slot', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const weekStart = parseWeekStart(req.params.weekStart as string);
    if (!weekStart) return res.status(400).json({ error: 'Ungültiges Datum' });

    const target = parseSlotTarget(req.body);
    if (!target.ok) return res.status(400).json({ error: target.error });
    const dish = parseDish(req.body);
    if (!dish.ok) return res.status(400).json({ error: dish.error });
    if (!(await allRecipesExist(prisma, [dish.value.recipeId]))) {
      return res.status(400).json({ error: 'Rezept nicht gefunden' });
    }

    const mealPlan = await findOrCreateMealPlan(prisma, weekStart, req.user!.id);
    const conflict = await withLockedPlan(prisma, mealPlan.id, async (tx) => {
      const existing = await readSlotDishes(tx, mealPlan.id, target.value);
      if (existing.some((other) => other.recipeId === dish.value.recipeId)) {
        return 'Rezept ist in diesem Slot schon geplant';
      }
      if (existing.length >= MAX_DISHES_PER_SLOT) {
        return `Höchstens ${MAX_DISHES_PER_SLOT} Gerichte pro Slot`;
      }
      await replaceSlotDishes(tx, mealPlan.id, target.value, [...existing, dish.value]);
      return null;
    });
    if (conflict) return res.status(409).json({ error: conflict });

    await respondWithMealPlan(prisma, mealPlan.id, res);
  } catch (error) {
    console.error('Append meal slot error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der Mahlzeit' });
  }
});

// Legacy (Android app, one dish per slot): set or clear the FIRST dish of a slot.
// Further dishes (e.g. dessert planned in the web app) are kept.
// Body: { dayIndex, mealType, recipeId, servings }
router.patch('/:weekStart/slot', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const weekStart = parseWeekStart(req.params.weekStart as string);
    if (!weekStart) return res.status(400).json({ error: 'Ungültiges Datum' });

    const target = parseSlotTarget(req.body);
    if (!target.ok) return res.status(400).json({ error: target.error });

    const { recipeId, servings } = req.body;
    const dish = recipeId ? parseDish({ recipeId, servings: servings || undefined }) : null;
    if (dish && !dish.ok) return res.status(400).json({ error: dish.error });
    const newDish = dish && dish.ok ? dish.value : null;
    if (newDish && !(await allRecipesExist(prisma, [newDish.recipeId]))) {
      return res.status(400).json({ error: 'Rezept nicht gefunden' });
    }

    const mealPlan = await findOrCreateMealPlan(prisma, weekStart, req.user!.id);
    await withLockedPlan(prisma, mealPlan.id, async (tx) => {
      const existing = await readSlotDishes(tx, mealPlan.id, target.value);
      await replaceSlotDishes(tx, mealPlan.id, target.value, applyLegacySlotUpdate(existing, newDish));
    });
    await respondWithMealPlan(prisma, mealPlan.id, res);
  } catch (error) {
    console.error('Update meal slot error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der Mahlzeit' });
  }
});

// Mark ingredients as sent to Gemini (shared across all users)
router.post('/:weekStart/sent-ingredients', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const userId = req.user!.id;
    const weekStartParam = req.params.weekStart as string;
    const { ingredients } = req.body;

    // Parse and normalize the week start date
    const weekStart = normalizeWeekStart(new Date(weekStartParam));

    if (isNaN(weekStart.getTime())) {
      return res.status(400).json({ error: 'Ungültiges Datum' });
    }

    if (!Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Zutaten müssen ein Array sein' });
    }

    // Find or create shared meal plan
    const mealPlan = await findOrCreateMealPlan(prisma, weekStart, userId);

    // Merge new ingredients with existing ones
    await prisma.mealPlan.update({
      where: { id: mealPlan.id },
      data: {
        sentIngredients: {
          push: ingredients
        }
      }
    });

    // Re-fetch to get updated data
    const updated = (await prisma.mealPlan.findUnique({
      where: { id: mealPlan.id }
    }))!;

    // Get unique ingredients
    const uniqueIngredients = [...new Set(updated.sentIngredients)];

    // Update with unique ingredients if there were duplicates
    if (uniqueIngredients.length !== updated.sentIngredients.length) {
      await prisma.mealPlan.update({
        where: { id: mealPlan.id },
        data: { sentIngredients: uniqueIngredients }
      });
    }

    res.json({
      sentIngredients: uniqueIngredients,
      message: `${ingredients.length} Zutaten als gesendet markiert`
    });
  } catch (error) {
    console.error('Mark sent ingredients error:', error);
    res.status(500).json({ error: 'Fehler beim Markieren der Zutaten' });
  }
});

// Reset sent ingredients for a week (shared across all users)
router.delete('/:weekStart/sent-ingredients', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const weekStartParam = req.params.weekStart as string;

    // Parse and normalize the week start date
    const weekStart = normalizeWeekStart(new Date(weekStartParam));

    if (isNaN(weekStart.getTime())) {
      return res.status(400).json({ error: 'Ungültiges Datum' });
    }

    await prisma.mealPlan.updateMany({
      where: { weekStart },
      data: {
        sentIngredients: []
      }
    });

    res.json({ message: 'Gesendete Zutaten zurückgesetzt' });
  } catch (error) {
    console.error('Reset sent ingredients error:', error);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen der Zutaten' });
  }
});

// Exclude ingredients from shopping list (shared across all users)
router.post('/:weekStart/excluded-ingredients', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const userId = req.user!.id;
    const weekStartParam = req.params.weekStart as string;
    const { ingredients } = req.body;

    // Parse and normalize the week start date
    const weekStart = normalizeWeekStart(new Date(weekStartParam));

    if (isNaN(weekStart.getTime())) {
      return res.status(400).json({ error: 'Ungültiges Datum' });
    }

    if (!Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Zutaten müssen ein Array sein' });
    }

    // Find or create shared meal plan
    const mealPlan = await findOrCreateMealPlan(prisma, weekStart, userId);

    // Merge new ingredients with existing ones
    await prisma.mealPlan.update({
      where: { id: mealPlan.id },
      data: {
        excludedIngredients: {
          push: ingredients
        }
      }
    });

    // Re-fetch to get updated data
    const updated = (await prisma.mealPlan.findUnique({
      where: { id: mealPlan.id }
    }))!;

    // Get unique ingredients
    const uniqueIngredients = [...new Set(updated.excludedIngredients)];

    // Update with unique ingredients if there were duplicates
    if (uniqueIngredients.length !== updated.excludedIngredients.length) {
      await prisma.mealPlan.update({
        where: { id: mealPlan.id },
        data: { excludedIngredients: uniqueIngredients }
      });
    }

    res.json({
      excludedIngredients: uniqueIngredients,
      message: `${ingredients.length} Zutaten ausgeschlossen`
    });
  } catch (error) {
    console.error('Exclude ingredients error:', error);
    res.status(500).json({ error: 'Fehler beim Ausschließen der Zutaten' });
  }
});

// Remove ingredient from excluded list (restore) (shared across all users)
router.delete('/:weekStart/excluded-ingredients/:ingredientName', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const weekStartParam = req.params.weekStart as string;
    const ingredientNameParam = req.params.ingredientName as string;
    const ingredientName = decodeURIComponent(ingredientNameParam).toLowerCase();

    // Parse and normalize the week start date
    const weekStart = normalizeWeekStart(new Date(weekStartParam));

    if (isNaN(weekStart.getTime())) {
      return res.status(400).json({ error: 'Ungültiges Datum' });
    }

    // Find existing meal plan (shared - no userId filter)
    const mealPlan = await prisma.mealPlan.findFirst({
      where: { weekStart }
    });

    if (!mealPlan) {
      return res.status(404).json({ error: 'Wochenplan nicht gefunden' });
    }

    // Remove ingredient from excluded list
    const updatedExcluded = mealPlan.excludedIngredients.filter(
      (ing: string) => ing.toLowerCase() !== ingredientName
    );

    await prisma.mealPlan.update({
      where: { id: mealPlan.id },
      data: { excludedIngredients: updatedExcluded }
    });

    res.json({ 
      excludedIngredients: updatedExcluded,
      message: 'Zutat wiederhergestellt'
    });
  } catch (error) {
    console.error('Restore ingredient error:', error);
    res.status(500).json({ error: 'Fehler beim Wiederherstellen der Zutat' });
  }
});

// Reset all excluded ingredients for a week (shared across all users)
router.delete('/:weekStart/excluded-ingredients', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const weekStartParam = req.params.weekStart as string;

    // Parse and normalize the week start date
    const weekStart = normalizeWeekStart(new Date(weekStartParam));

    if (isNaN(weekStart.getTime())) {
      return res.status(400).json({ error: 'Ungültiges Datum' });
    }

    await prisma.mealPlan.updateMany({
      where: { weekStart },
      data: {
        excludedIngredients: []
      }
    });

    res.json({ message: 'Ausgeschlossene Zutaten zurückgesetzt' });
  } catch (error) {
    console.error('Reset excluded ingredients error:', error);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen der ausgeschlossenen Zutaten' });
  }
});

// Delete entire meal plan for a week (shared across all users)
router.delete('/:weekStart', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const weekStartParam = req.params.weekStart as string;

    // Parse and normalize the week start date
    const weekStart = normalizeWeekStart(new Date(weekStartParam));

    if (isNaN(weekStart.getTime())) {
      return res.status(400).json({ error: 'Ungültiges Datum' });
    }

    await prisma.mealPlan.deleteMany({
      where: { weekStart }
    });

    res.json({ message: 'Wochenplan gelöscht' });
  } catch (error) {
    console.error('Delete meal plan error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Wochenplans' });
  }
});

export default router;
