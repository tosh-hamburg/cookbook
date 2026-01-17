import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

// Include configuration for recipe queries
const recipeInclude = {
  ingredients: true,
  categories: {
    include: {
      category: true
    }
  },
  user: {
    select: {
      id: true,
      username: true
    }
  }
} as const;

// Transform recipe to frontend format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformRecipe(recipe: any) {
  return {
    id: recipe.id,
    title: recipe.title,
    images: recipe.images,
    ingredients: recipe.ingredients.map((i: { name: string; amount: string }) => ({ 
      name: i.name, 
      amount: i.amount 
    })),
    instructions: recipe.instructions,
    prepTime: recipe.prepTime,
    restTime: recipe.restTime,
    cookTime: recipe.cookTime,
    totalTime: recipe.totalTime,
    servings: recipe.servings,
    caloriesPerUnit: recipe.caloriesPerUnit,
    weightUnit: recipe.weightUnit,
    sourceUrl: recipe.sourceUrl,
    categories: recipe.categories.map((rc: { category: { name: string } }) => rc.category.name),
    userId: recipe.userId,
    createdAt: recipe.createdAt.toISOString()
  };
}

// Helper to get string id from params
function getIdParam(params: Record<string, unknown>): string {
  const id = params.id;
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid ID');
  }
  return id;
}

// Get all recipes
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;

    const recipes = await prisma.recipe.findMany({
      include: recipeInclude,
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(recipes.map(transformRecipe));
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Rezepte' });
  }
});

// Get single recipe
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const id = getIdParam(req.params);

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: recipeInclude
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Rezept nicht gefunden' });
    }

    res.json(transformRecipe(recipe));
  } catch (error) {
    console.error('Get recipe error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Rezepts' });
  }
});

// Create recipe
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const {
      title,
      images = [],
      ingredients = [],
      instructions,
      prepTime,
      restTime,
      cookTime,
      totalTime,
      servings,
      caloriesPerUnit,
      weightUnit,
      categories = [],
      sourceUrl
    } = req.body;

    if (!title || !instructions) {
      return res.status(400).json({ error: 'Titel und Anweisungen sind erforderlich' });
    }

    // Ensure arrays are arrays
    const imageArray: string[] = Array.isArray(images) ? images : [];
    const ingredientArray: Array<{ name: string; amount: string }> = Array.isArray(ingredients) ? ingredients : [];
    const categoryArray: string[] = Array.isArray(categories) ? categories : [];

    // Get or create categories
    const categoryRecords = await Promise.all(
      categoryArray.map(async (name: string) => {
        return prisma.category.upsert({
          where: { name },
          update: {},
          create: { name }
        });
      })
    );

    const recipe = await prisma.recipe.create({
      data: {
        title,
        images: imageArray,
        instructions,
        prepTime: prepTime || 0,
        restTime: restTime || 0,
        cookTime: cookTime || 0,
        totalTime: totalTime || 0,
        servings: servings || 4,
        caloriesPerUnit: caloriesPerUnit || 0,
        weightUnit: weightUnit || '',
        sourceUrl: sourceUrl || null,
        userId: req.user!.id,
        ingredients: {
          create: ingredientArray.map((i) => ({
            name: i.name,
            amount: i.amount
          }))
        },
        categories: {
          create: categoryRecords.map(cat => ({
            categoryId: cat.id
          }))
        }
      },
      include: recipeInclude
    });

    res.status(201).json(transformRecipe(recipe));
  } catch (error) {
    console.error('Create recipe error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Rezepts' });
  }
});

// Update recipe
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const id = getIdParam(req.params);
    const {
      title,
      images,
      ingredients,
      instructions,
      prepTime,
      restTime,
      cookTime,
      totalTime,
      servings,
      caloriesPerUnit,
      weightUnit,
      categories,
      sourceUrl
    } = req.body;

    // Check if recipe exists and user has permission
    const existingRecipe = await prisma.recipe.findUnique({
      where: { id }
    });

    if (!existingRecipe) {
      return res.status(404).json({ error: 'Rezept nicht gefunden' });
    }

    // Only allow owner or admin to update
    if (existingRecipe.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung zum Bearbeiten' });
    }

    // Delete existing ingredients and categories
    await prisma.ingredient.deleteMany({ where: { recipeId: id } });
    await prisma.recipeCategory.deleteMany({ where: { recipeId: id } });

    // Process arrays
    const imageArray: string[] | undefined = images !== undefined ? (Array.isArray(images) ? images : []) : undefined;
    const ingredientArray: Array<{ name: string; amount: string }> | undefined = 
      ingredients !== undefined ? (Array.isArray(ingredients) ? ingredients : []) : undefined;
    const categoryArray: string[] | undefined = 
      categories !== undefined ? (Array.isArray(categories) ? categories : []) : undefined;

    // Get or create categories
    const categoryRecords = categoryArray ? await Promise.all(
      categoryArray.map(async (name: string) => {
        return prisma.category.upsert({
          where: { name },
          update: {},
          create: { name }
        });
      })
    ) : [];

    const recipe = await prisma.recipe.update({
      where: { id },
      data: {
        title,
        images: imageArray,
        instructions,
        prepTime,
        restTime,
        cookTime,
        totalTime,
        servings,
        caloriesPerUnit,
        weightUnit,
        sourceUrl,
        ingredients: ingredientArray ? {
          create: ingredientArray.map((i) => ({
            name: i.name,
            amount: i.amount
          }))
        } : undefined,
        categories: categoryArray ? {
          create: categoryRecords.map(cat => ({
            categoryId: cat.id
          }))
        } : undefined
      },
      include: recipeInclude
    });

    res.json(transformRecipe(recipe));
  } catch (error) {
    console.error('Update recipe error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Rezepts' });
  }
});

// Delete recipe
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const id = getIdParam(req.params);

    const existingRecipe = await prisma.recipe.findUnique({
      where: { id }
    });

    if (!existingRecipe) {
      return res.status(404).json({ error: 'Rezept nicht gefunden' });
    }

    // Only allow owner or admin to delete
    if (existingRecipe.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung zum Löschen' });
    }

    await prisma.recipe.delete({ where: { id } });

    res.json({ message: 'Rezept gelöscht' });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Rezepts' });
  }
});

export default router;
