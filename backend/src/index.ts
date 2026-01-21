import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import recipesRoutes from './routes/recipes';
import categoriesRoutes from './routes/categories';
import collectionsRoutes from './routes/collections';
import usersRoutes from './routes/users';
import importRoutes from './routes/import';
import mealplansRoutes from './routes/mealplans';
import settingsRoutes from './routes/settings';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4002;

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

// 1. Disable X-Powered-By header
app.disable('x-powered-by');

// 2. Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API (no HTML served)
  crossOriginEmbedderPolicy: false, // Allow embedding
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin resources
}));

// 3. CORS Configuration - Origins from environment
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];
  
  // Read from CORS_ORIGINS environment variable (comma-separated)
  if (process.env.CORS_ORIGINS) {
    origins.push(...process.env.CORS_ORIGINS.split(',').map(o => o.trim()));
  }
  
  // Fallback defaults if not configured
  if (origins.length === 0) {
    origins.push(
      'https://cookbook.gout-diary.com',
      'http://localhost:3002'
    );
  }
  
  return origins;
};

const allowedOrigins = getAllowedOrigins();
console.log('📋 Erlaubte CORS-Origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log blocked origins for debugging
    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error('CORS not allowed'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 4. Rate Limiting

// General API rate limit: 100 requests per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/api/health',
});

// Strict login rate limit: 5 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Zu viele Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Use IP + username as key
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const username = req.body?.username || '';
    return `${ip}:${username}`;
  },
});

// Apply general rate limiter to all routes
app.use('/api', generalLimiter);

// =============================================================================
// STANDARD MIDDLEWARE
// =============================================================================

// 5. Input Sanitization - Check URL for null bytes BEFORE parsing
app.use((req, res, next) => {
  // Check URL for null bytes
  if (req.url.includes('\x00') || req.url.includes('%00')) {
    return res.status(400).json({ error: 'Ungültige Anfrage' });
  }
  next();
});

// JSON body parser with size limit and null-byte validation
app.use(express.json({ 
  limit: '25mb',
  verify: (req, res, buf) => {
    // Check raw body for null bytes before parsing
    const bodyStr = buf.toString();
    if (bodyStr.includes('\x00') || bodyStr.includes('\0')) {
      throw new Error('Null byte in request body');
    }
  }
}));

// Handle JSON parsing errors (including null-byte errors)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.message === 'Null byte in request body') {
    return res.status(400).json({ error: 'Ungültige Zeichen in der Anfrage' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Ungültiges JSON-Format' });
  }
  next(err);
});

// Serve static files (downloads, etc.)
app.use('/public', express.static(path.join(__dirname, '../public')));

// Make prisma available in routes
app.locals.prisma = prisma;

// =============================================================================
// ROUTES
// =============================================================================

// Apply strict rate limit to login routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/google', loginLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/import', importRoutes);
app.use('/api/mealplans', mealplansRoutes);
app.use('/api/settings', settingsRoutes);

// Health check (excluded from rate limiting)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// App download endpoint
app.get('/api/app/download', (req, res) => {
  const apkPath = path.join(__dirname, '../public/downloads/cookbook-app.apk');
  res.download(apkPath, 'Cookbook.apk', (err) => {
    if (err) {
      console.error('Download error:', err);
      res.status(404).json({ error: 'App nicht gefunden' });
    }
  });
});

// App info endpoint
app.get('/api/app/info', (req, res) => {
  res.json({
    name: 'Cookbook',
    version: '1.0',
    platform: 'Android',
    downloadUrl: '/api/app/download',
    size: '7 MB'
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Nicht gefunden' });
});

// Global error handler - Don't leak error details
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log full error internally
  console.error('Error:', err);
  
  // Return generic error to client
  if (err.message === 'CORS not allowed') {
    return res.status(403).json({ error: 'Zugriff verweigert' });
  }
  
  res.status(500).json({ error: 'Interner Serverfehler' });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Datenbankverbindung hergestellt');

    // Create default categories if not exist
    const defaultCategories = ['Vorspeise', 'Hauptgericht', 'Dessert', 'Snack', 'Getränk'];
    for (const name of defaultCategories) {
      await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name }
      });
    }
    console.log('✅ Standard-Kategorien erstellt');

    // Security info
    console.log('🔐 Security-Features aktiviert:');
    console.log('   • Helmet Security Headers');
    console.log('   • CORS Whitelist');
    console.log('   • Rate Limiting (100/min, Login: 5/15min)');
    console.log('   • Input Sanitization (Null-Byte-Filter)');
    console.log('   • X-Powered-By deaktiviert');

    app.listen(PORT, () => {
      console.log(`🚀 Server läuft auf Port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Fehler beim Starten des Servers:', error);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Server wird heruntergefahren...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Server wird heruntergefahren...');
  await prisma.$disconnect();
  process.exit(0);
});
