import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

// Include for meal plan queries
const mealPlanInclude = {
  meals: {
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
} as const;

// Transform meal plan for frontend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformMealPlan(mealPlan: any) {
  return {
    id: mealPlan.id,
    weekStart: mealPlan.weekStart.toISOString(),
    meals: mealPlan.meals.map((slot: any) => ({
      dayIndex: slot.dayIndex,
      mealType: slot.mealType,
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

// Get meal plan for a specific week
router.get('/:weekStart', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const userId = req.user!.id;
    const weekStartParam = req.params.weekStart as string;

    // Parse and normalize the week start date
    const weekStart = normalizeWeekStart(new Date(weekStartParam));

    if (isNaN(weekStart.getTime())) {
      return res.status(400).json({ error: 'Ungültiges Datum' });
    }

    // Find existing meal plan
    const mealPlan = await prisma.mealPlan.findUnique({
      where: {
        userId_weekStart: {
          userId,
          weekStart
        }
      },
      include: mealPlanInclude
    });

    if (!mealPlan) {
      // Return empty plan structure
      return res.json({
        id: null,
        weekStart: weekStart.toISOString(),
        meals: []
      });
    }

    res.json(transformMealPlan(mealPlan));
  } catch (error) {
    console.error('Get meal plan error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Wochenplans' });
  }
});

// Create or update meal plan for a week
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

    // Upsert meal plan
    const mealPlan = await prisma.mealPlan.upsert({
      where: {
        userId_weekStart: {
          userId,
          weekStart
        }
      },
      create: {
        userId,
        weekStart
      },
      update: {
        updatedAt: new Date()
      }
    });

    // Delete existing meal slots
    await prisma.mealSlot.deleteMany({
      where: { mealPlanId: mealPlan.id }
    });

    // Create new meal slots
    const validMeals = meals.filter(
      (m: any) => m.recipeId && m.dayIndex >= 0 && m.dayIndex <= 6 && 
      ['breakfast', 'lunch', 'dinner'].includes(m.mealType)
    );

    if (validMeals.length > 0) {
      await prisma.mealSlot.createMany({
        data: validMeals.map((m: any) => ({
          mealPlanId: mealPlan.id,
          dayIndex: m.dayIndex,
          mealType: m.mealType,
          recipeId: m.recipeId,
          servings: m.servings || 2
        }))
      });
    }

    // Fetch updated meal plan
    const updatedMealPlan = await prisma.mealPlan.findUnique({
      where: { id: mealPlan.id },
      include: mealPlanInclude
    });

    res.json(transformMealPlan(updatedMealPlan));
  } catch (error) {
    console.error('Update meal plan error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern des Wochenplans' });
  }
});

// Update a single meal slot
router.patch('/:weekStart/slot', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const userId = req.user!.id;
    const weekStartParam = req.params.weekStart as string;
    const { dayIndex, mealType, recipeId, servings } = req.body;

    // Parse and normalize the week start date
    const weekStart = normalizeWeekStart(new Date(weekStartParam));

    if (isNaN(weekStart.getTime())) {
      return res.status(400).json({ error: 'Ungültiges Datum' });
    }

    if (dayIndex < 0 || dayIndex > 6 || !['breakfast', 'lunch', 'dinner'].includes(mealType)) {
      return res.status(400).json({ error: 'Ungültige Slot-Parameter' });
    }

    // Upsert meal plan
    const mealPlan = await prisma.mealPlan.upsert({
      where: {
        userId_weekStart: {
          userId,
          weekStart
        }
      },
      create: {
        userId,
        weekStart
      },
      update: {
        updatedAt: new Date()
      }
    });

    if (recipeId) {
      // Upsert meal slot
      await prisma.mealSlot.upsert({
        where: {
          mealPlanId_dayIndex_mealType: {
            mealPlanId: mealPlan.id,
            dayIndex,
            mealType
          }
        },
        create: {
          mealPlanId: mealPlan.id,
          dayIndex,
          mealType,
          recipeId,
          servings: servings || 2
        },
        update: {
          recipeId,
          servings: servings || 2
        }
      });
    } else {
      // Remove meal slot if no recipe
      await prisma.mealSlot.deleteMany({
        where: {
          mealPlanId: mealPlan.id,
          dayIndex,
          mealType
        }
      });
    }

    // Fetch updated meal plan
    const updatedMealPlan = await prisma.mealPlan.findUnique({
      where: { id: mealPlan.id },
      include: mealPlanInclude
    });

    res.json(transformMealPlan(updatedMealPlan));
  } catch (error) {
    console.error('Update meal slot error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der Mahlzeit' });
  }
});

// Delete entire meal plan for a week
router.delete('/:weekStart', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient;
    const userId = req.user!.id;
    const weekStartParam = req.params.weekStart as string;

    // Parse and normalize the week start date
    const weekStart = normalizeWeekStart(new Date(weekStartParam));

    if (isNaN(weekStart.getTime())) {
      return res.status(400).json({ error: 'Ungültiges Datum' });
    }

    await prisma.mealPlan.deleteMany({
      where: {
        userId,
        weekStart
      }
    });

    res.json({ message: 'Wochenplan gelöscht' });
  } catch (error) {
    console.error('Delete meal plan error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Wochenplans' });
  }
});

export default router;
