import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Helper to get string id from params
function getIdParam(params: Record<string, unknown>): string {
  const id = params.id;
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid ID');
  }
  return id;
}

function getRecipeIdParam(params: Record<string, unknown>): string {
  const id = params.recipeId;
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid Recipe ID');
  }
  return id;
}

// Get all collections (all users)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    
    const collections = await prisma.collection.findMany({
      include: {
        recipes: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                images: true,
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    // Transform to simpler format
    const result = collections.map(col => ({
      id: col.id,
      name: col.name,
      description: col.description,
      recipeCount: col.recipes.length,
      recipes: col.recipes.map(rc => rc.recipe),
      createdAt: col.createdAt.toISOString()
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Sammlungen' });
  }
});

// Get single collection with recipes
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const id = getIdParam(req.params as Record<string, unknown>);
    
    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        recipes: {
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
      }
    });
    
    if (!collection) {
      return res.status(404).json({ error: 'Sammlung nicht gefunden' });
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectionWithRecipes = collection as any;
    
    res.json({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      recipes: collectionWithRecipes.recipes.map((rc: any) => ({
        ...rc.recipe,
        categories: rc.recipe.categories.map((cat: any) => cat.category.name)
      })),
      createdAt: collection.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Get collection error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Sammlung' });
  }
});

// Create collection (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const { name, description } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }
    
    // Check if collection already exists
    const existing = await prisma.collection.findUnique({
      where: { name: name.trim() }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Eine Sammlung mit diesem Namen existiert bereits' });
    }
    
    const collection = await prisma.collection.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null
      }
    });
    
    res.status(201).json({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      recipeCount: 0,
      recipes: [],
      createdAt: collection.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Create collection error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Sammlung' });
  }
});

// Update collection (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const id = getIdParam(req.params as Record<string, unknown>);
    const { name, description } = req.body;
    
    const existing = await prisma.collection.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Sammlung nicht gefunden' });
    }
    
    // Check if new name conflicts with another collection
    if (name && name.trim() !== existing.name) {
      const nameConflict = await prisma.collection.findUnique({
        where: { name: name.trim() }
      });
      if (nameConflict) {
        return res.status(400).json({ error: 'Eine Sammlung mit diesem Namen existiert bereits' });
      }
    }
    
    const collection = await prisma.collection.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        description: description !== undefined ? (description?.trim() || null) : existing.description
      },
      include: {
        recipes: true
      }
    });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collectionWithRecipes = collection as any;
    
    res.json({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      recipeCount: collectionWithRecipes.recipes.length,
      createdAt: collection.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Update collection error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Sammlung' });
  }
});

// Delete collection (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const id = getIdParam(req.params as Record<string, unknown>);
    
    const existing = await prisma.collection.findUnique({
      where: { id }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Sammlung nicht gefunden' });
    }
    
    await prisma.collection.delete({
      where: { id }
    });
    
    res.json({ message: 'Sammlung gelöscht' });
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Sammlung' });
  }
});

// Add recipe to collection (admin only)
router.post('/:id/recipes/:recipeId', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const id = getIdParam(req.params as Record<string, unknown>);
    const recipeId = getRecipeIdParam(req.params as Record<string, unknown>);
    
    // Check if collection exists
    const collection = await prisma.collection.findUnique({
      where: { id }
    });
    if (!collection) {
      return res.status(404).json({ error: 'Sammlung nicht gefunden' });
    }
    
    // Check if recipe exists
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId }
    });
    if (!recipe) {
      return res.status(404).json({ error: 'Rezept nicht gefunden' });
    }
    
    // Check if already in collection
    const existing = await prisma.recipeCollection.findUnique({
      where: {
        recipeId_collectionId: {
          recipeId,
          collectionId: id
        }
      }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Rezept ist bereits in dieser Sammlung' });
    }
    
    await prisma.recipeCollection.create({
      data: {
        recipeId,
        collectionId: id
      }
    });
    
    res.status(201).json({ message: 'Rezept zur Sammlung hinzugefügt' });
  } catch (error) {
    console.error('Add recipe to collection error:', error);
    res.status(500).json({ error: 'Fehler beim Hinzufügen des Rezepts zur Sammlung' });
  }
});

// Remove recipe from collection (admin only)
router.delete('/:id/recipes/:recipeId', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const id = getIdParam(req.params as Record<string, unknown>);
    const recipeId = getRecipeIdParam(req.params as Record<string, unknown>);
    
    const existing = await prisma.recipeCollection.findUnique({
      where: {
        recipeId_collectionId: {
          recipeId,
          collectionId: id
        }
      }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Rezept ist nicht in dieser Sammlung' });
    }
    
    await prisma.recipeCollection.delete({
      where: {
        recipeId_collectionId: {
          recipeId,
          collectionId: id
        }
      }
    });
    
    res.json({ message: 'Rezept aus Sammlung entfernt' });
  } catch (error) {
    console.error('Remove recipe from collection error:', error);
    res.status(500).json({ error: 'Fehler beim Entfernen des Rezepts aus der Sammlung' });
  }
});

export default router;
