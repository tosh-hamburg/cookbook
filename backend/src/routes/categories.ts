import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Helper to get string param
function getStringParam(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (!value || typeof value !== 'string') {
    throw new Error(`Invalid ${key}`);
  }
  return value;
}

// Get all categories
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;

    const categories = await prisma.category.findMany({
      orderBy: {
        name: 'asc'
      }
    });

    // Return as array of strings to match frontend format
    res.json(categories.map(c => c.name));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Kategorien' });
  }
});

// Get all categories with details
router.get('/details', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;

    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { recipes: true }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json(categories.map(c => ({
      id: c.id,
      name: c.name,
      recipeCount: c._count.recipes
    })));
  } catch (error) {
    console.error('Get categories details error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Kategorien' });
  }
});

// Create category (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Kategoriename erforderlich' });
    }

    const trimmedName = name.trim();

    const existingCategory = await prisma.category.findUnique({
      where: { name: trimmedName }
    });

    if (existingCategory) {
      return res.status(400).json({ error: 'Kategorie existiert bereits' });
    }

    const category = await prisma.category.create({
      data: { name: trimmedName }
    });

    res.status(201).json({ id: category.id, name: category.name });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Kategorie' });
  }
});

// Delete category (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const id = getStringParam(req.params, 'id');

    const existingCategory = await prisma.category.findUnique({
      where: { id }
    });

    if (!existingCategory) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }

    // Delete all recipe-category relations first
    await prisma.recipeCategory.deleteMany({
      where: { categoryId: id }
    });

    await prisma.category.delete({
      where: { id }
    });

    res.json({ message: 'Kategorie gelöscht' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Kategorie' });
  }
});

// Delete category by name (for backwards compatibility)
router.delete('/name/:name', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const name = getStringParam(req.params, 'name');

    const existingCategory = await prisma.category.findUnique({
      where: { name }
    });

    if (!existingCategory) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }

    // Delete all recipe-category relations first
    await prisma.recipeCategory.deleteMany({
      where: { categoryId: existingCategory.id }
    });

    await prisma.category.delete({
      where: { id: existingCategory.id }
    });

    res.json({ message: 'Kategorie gelöscht' });
  } catch (error) {
    console.error('Delete category by name error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Kategorie' });
  }
});

export default router;
