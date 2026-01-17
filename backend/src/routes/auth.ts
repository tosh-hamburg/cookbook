import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken, requireAdmin, generateToken } from '../middleware/auth';

const router = Router();

// Login
router.post('/login', async (req, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    }

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Fehler bei der Anmeldung' });
  }
});

// Register (nur für Admins)
router.post('/register', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
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
    console.error('Register error:', error);
    res.status(500).json({ error: 'Fehler bei der Registrierung' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Benutzers' });
  }
});

export default router;
