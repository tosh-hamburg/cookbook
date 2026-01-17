import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
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

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        _count: {
          select: { recipes: true }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json(users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      recipeCount: u._count.recipes
    })));
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Benutzer' });
  }
});

// Create user (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const { username, password, role = 'user' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Benutzername bereits vergeben' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: role === 'admin' ? 'admin' : 'user'
      }
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Benutzers' });
  }
});

// Update user (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const id = getStringParam(req.params, 'id');
    const { username, password, role } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Check if new username is already taken by another user
    if (username && username !== existingUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username }
      });
      if (usernameExists) {
        return res.status(400).json({ error: 'Benutzername bereits vergeben' });
      }
    }

    const updateData: { username?: string; password?: string; role?: string } = {};
    
    if (username) updateData.username = username;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (role) updateData.role = role === 'admin' ? 'admin' : 'user';

    const user = await prisma.user.update({
      where: { id },
      data: updateData
    });

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Benutzers' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const id = getStringParam(req.params, 'id');

    // Prevent deleting yourself
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Sie können sich nicht selbst löschen' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Check if user has recipes - optionally transfer or delete them
    const recipeCount = await prisma.recipe.count({
      where: { userId: id }
    });

    if (recipeCount > 0) {
      // Delete user's recipes (cascade would handle this, but being explicit)
      await prisma.recipe.deleteMany({
        where: { userId: id }
      });
    }

    await prisma.user.delete({
      where: { id }
    });

    res.json({ message: 'Benutzer gelöscht' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Benutzers' });
  }
});

export default router;
