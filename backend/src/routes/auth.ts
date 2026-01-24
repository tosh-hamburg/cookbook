import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { AuthRequest, authenticateToken, requireAdmin, generateToken } from '../middleware/auth';

const router = Router();

// Google OAuth Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Login
router.post('/login', async (req, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const { username, password, twoFactorCode } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    }

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!twoFactorCode) {
        return res.status(200).json({ 
          requires2FA: true,
          message: '2FA-Code erforderlich'
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1
      });

      if (!verified) {
        return res.status(401).json({ error: 'Ungültiger 2FA-Code' });
      }
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Fehler bei der Anmeldung' });
  }
});

// Google OAuth Login
router.post('/google', async (req, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const { credential, twoFactorCode } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential erforderlich' });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Ungültiges Google Token' });
    }

    const { sub: googleId, email, name, picture } = payload;

    // Find user by googleId, email or username
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId },
          { email },
          { username: email } // Allow matching by username = email address
        ]
      }
    });

    if (!user) {
      // Do NOT create new users automatically - only existing users can login
      return res.status(401).json({ 
        error: 'Kein Benutzerkonto mit dieser E-Mail-Adresse gefunden. Bitte kontaktieren Sie einen Administrator.' 
      });
    }
    
    if (!user.googleId) {
      // Link existing user with Google account
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          email: user.email || email, // Also save email if not set
          avatar: user.avatar || picture
        }
      });
    }

    // Skip 2FA for Google login - Google already provides secure authentication
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Fehler bei der Google-Anmeldung' });
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
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      twoFactorEnabled: user.twoFactorEnabled,
      hasPassword: !!user.password,
      createdAt: user.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des Benutzers' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Neues Passwort muss mindestens 6 Zeichen lang sein' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // If user has a password, verify current password
    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Aktuelles Passwort erforderlich' });
      }
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Aktuelles Passwort ist falsch' });
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    res.json({ success: true, message: 'Passwort erfolgreich geändert' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Fehler beim Ändern des Passworts' });
  }
});

// === 2FA ENDPOINTS ===

// Enable 2FA - Step 1: Generate secret and QR code
router.post('/2fa/setup', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA ist bereits aktiviert' });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Cookbook (${user.username})`,
      issuer: 'Cookbook'
    });

    // Save temporary secret (not enabled yet)
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret.base32 }
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: 'Fehler beim Einrichten von 2FA' });
  }
});

// Enable 2FA - Step 2: Verify and activate
router.post('/2fa/verify', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: '2FA-Code erforderlich' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: '2FA-Setup nicht gestartet' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ error: 'Ungültiger Code' });
    }

    // Enable 2FA
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true }
    });

    res.json({ 
      success: true,
      message: '2FA erfolgreich aktiviert'
    });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ error: 'Fehler beim Aktivieren von 2FA' });
  }
});

// Disable 2FA
router.post('/2fa/disable', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const { code, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA ist nicht aktiviert' });
    }

    // Verify 2FA code
    if (user.twoFactorSecret && code) {
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 1
      });

      if (!verified) {
        return res.status(400).json({ error: 'Ungültiger 2FA-Code' });
      }
    } else if (user.password && password) {
      // Allow password verification as backup
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Ungültiges Passwort' });
      }
    } else {
      return res.status(400).json({ error: '2FA-Code oder Passwort erforderlich' });
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        twoFactorEnabled: false,
        twoFactorSecret: null
      }
    });

    res.json({ 
      success: true,
      message: '2FA erfolgreich deaktiviert'
    });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ error: 'Fehler beim Deaktivieren von 2FA' });
  }
});

// Get 2FA status
router.get('/2fa/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json({
      enabled: user.twoFactorEnabled
    });
  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des 2FA-Status' });
  }
});

export default router;
