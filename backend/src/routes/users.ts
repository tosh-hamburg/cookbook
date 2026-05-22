import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth';
import { encrypt } from '../lib/crypto';

const router = Router();

// Akzeptiert entweder den reinen Cookie-Header-String oder eine Sammlung aller Cookies;
// extrahiert aus beidem die für Zeit-SSO relevanten Cookies (Präfix "zeit_sso_").
function extractZeitSsoCookies(raw: string): string {
  const pairs = raw
    .split(/;\s*/)
    .map(s => s.trim())
    .filter(Boolean);
  const kept = pairs.filter(p => p.toLowerCase().startsWith('zeit_sso_'));
  return kept.join('; ');
}

// Helper to get string param
function getStringParam(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (!value || typeof value !== 'string') {
    throw new Error(`Invalid ${key}`);
  }
  return value;
}

// =============================================================================
// Zeit.de Session-Cookie (per-user, self-service)
// Dient dem Import von Rezepten hinter der Zeit-Paywall.
// Der Cookie wird AES-256-GCM verschlüsselt gespeichert und nie an den Client
// zurückgegeben — das Frontend sieht nur isSet + setAt.
// WICHTIG: Diese Routen müssen VOR den `/:id`-Routen registriert werden,
// sonst matcht Express "me" als :id-Parameter.
// =============================================================================

router.get('/me/zeit-cookie', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { zeitSessionCookie: true, zeitSessionCookieSetAt: true },
    });

    res.json({
      isSet: !!user?.zeitSessionCookie,
      setAt: user?.zeitSessionCookieSetAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('Get zeit-cookie error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Zeit-Cookies' });
  }
});

router.put('/me/zeit-cookie', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const { cookie } = req.body;

    if (typeof cookie !== 'string') {
      return res.status(400).json({ error: 'Cookie muss ein String sein' });
    }

    const trimmed = cookie.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'Cookie darf nicht leer sein' });
    }
    if (trimmed.length > 8192) {
      return res.status(400).json({ error: 'Cookie ist zu lang (max. 8192 Zeichen)' });
    }

    const zeitCookie = extractZeitSsoCookies(trimmed);
    if (zeitCookie.length === 0) {
      return res.status(400).json({
        error: 'Keine Zeit-SSO-Cookies gefunden. Erwartet werden Cookies mit Präfix "zeit_sso_".',
      });
    }

    const encrypted = encrypt(zeitCookie);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        zeitSessionCookie: encrypted,
        zeitSessionCookieSetAt: new Date(),
      },
    });

    res.json({ isSet: true, setAt: new Date().toISOString() });
  } catch (error) {
    console.error('Update zeit-cookie error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern des Zeit-Cookies' });
  }
});

router.delete('/me/zeit-cookie', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        zeitSessionCookie: null,
        zeitSessionCookieSetAt: null,
      },
    });
    res.json({ isSet: false, setAt: null });
  } catch (error) {
    console.error('Delete zeit-cookie error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Zeit-Cookies' });
  }
});

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
