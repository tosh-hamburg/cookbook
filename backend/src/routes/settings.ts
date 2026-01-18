import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Setting keys
const GEMINI_PROMPT_KEY = 'gemini_prompt';

// Get Gemini prompt setting (authenticated users)
router.get('/gemini-prompt', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;

    const setting = await prisma.setting.findUnique({
      where: { key: GEMINI_PROMPT_KEY },
    });

    res.json({
      geminiPrompt: setting?.value || '',
    });
  } catch (error) {
    console.error('Get Gemini prompt error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Einstellung' });
  }
});

// Update Gemini prompt setting (admin only)
router.put('/gemini-prompt', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.locals.prisma;
    const { geminiPrompt } = req.body;

    if (typeof geminiPrompt !== 'string') {
      return res.status(400).json({ error: 'geminiPrompt muss ein String sein' });
    }

    const setting = await prisma.setting.upsert({
      where: { key: GEMINI_PROMPT_KEY },
      create: {
        key: GEMINI_PROMPT_KEY,
        value: geminiPrompt,
      },
      update: {
        value: geminiPrompt,
      },
    });

    res.json({
      geminiPrompt: setting.value,
    });
  } catch (error) {
    console.error('Update Gemini prompt error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern der Einstellung' });
  }
});

export default router;
