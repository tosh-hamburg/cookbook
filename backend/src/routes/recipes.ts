import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import sharp from 'sharp';

const router = Router();

// Thumbnail settings
const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_QUALITY = 70;

/**
 * Generate a thumbnail from a Base64 image
 * Returns the original if it's a URL or if processing fails
 */
async function generateThumbnail(imageData: string): Promise<string> {
  try {
    // Skip if it's a URL (not Base64)
    if (!imageData.startsWith('data:image/')) {
      return imageData;
    }

    // Extract Base64 data
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return imageData;
    }

    const [, format, base64Data] = matches;
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate thumbnail
    const thumbnailBuffer = await sharp(buffer)
      .resize(THUMBNAIL_WIDTH, null, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toBuffer();

    // Return as Base64 data URL
    return `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Thumbnail generation failed:', error);
    return imageData; // Return original on error
  }
}

// Include configuration for recipe queries
const recipeInclude = {
  ingredients: true,
  categories: {
    include: {
      category: true
    }
  },
  collections: {
    include: {
      collection: true
    }
  },
  user: {
    select: {
      id: true,
      username: true
    }
  }
} as const;

// Transform recipe to frontend format (full details)
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
    collections: recipe.collections?.map((rc: { collection: { id: string; name: string } }) => ({
      id: rc.collection.id,
      name: rc.collection.name
    })) || [],
    userId: recipe.userId,
    createdAt: recipe.createdAt.toISOString()
  };
}

// Transform recipe for list view (with thumbnail, no full images)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function transformRecipeForList(recipe: any): Promise<{
  id: string;
  title: string;
  thumbnail: string | null;
  prepTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  categories: string[];
  createdAt: string;
}> {
  // Generate thumbnail from first image
  let thumbnail: string | null = null;
  if (recipe.images && recipe.images.length > 0) {
    thumbnail = await generateThumbnail(recipe.images[0]);
  }

  return {
    id: recipe.id,
    title: recipe.title,
    thumbnail,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    totalTime: recipe.totalTime,
    servings: recipe.servings,
    categories: recipe.categories.map((rc: { category: { name: string } }) => rc.category.name),
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

// Get all recipes with optional filters and pagination
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    
    // Parse filter parameters
    const { category, collection, search } = req.query;
    
    // Parse pagination parameters
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    
    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    
    // Filter by category
    if (category && typeof category === 'string') {
      where.categories = {
        some: {
          category: {
            name: category
          }
        }
      };
    }
    
    // Filter by collection
    if (collection && typeof collection === 'string') {
      where.collections = {
        some: {
          collectionId: collection
        }
      };
    }
    
    // Search in title
    if (search && typeof search === 'string') {
      where.title = {
        contains: search,
        mode: 'insensitive'
      };
    }

    // Get total count for pagination
    const total = await prisma.recipe.count({ where });

    // Get paginated recipes
    const recipes = await prisma.recipe.findMany({
      where,
      include: recipeInclude,
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    });

    // Transform recipes with thumbnails (parallel processing)
    const transformedRecipes = await Promise.all(
      recipes.map(recipe => transformRecipeForList(recipe))
    );

    // Return paginated response
    res.json({
      items: transformedRecipes,
      total,
      limit,
      offset,
      hasMore: offset + recipes.length < total
    });
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

    // Debug logging for images
    console.log(`[UPDATE] Recipe ${id}: Received ${images?.length || 0} images`);
    if (images && images.length > 0) {
      images.forEach((img: string, index: number) => {
        console.log(`  Image ${index}: ${img.length} chars, starts with: ${img.substring(0, 50)}...`);
      });
    }

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

    // Debug logging for saved images
    console.log(`[UPDATE] Recipe ${id}: Saved ${recipe.images?.length || 0} images to database`);

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
