import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import recipesRoutes from './routes/recipes';
import categoriesRoutes from './routes/categories';
import collectionsRoutes from './routes/collections';
import usersRoutes from './routes/users';
import importRoutes from './routes/import';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4002;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '25mb' })); // For base64 images (max 5MB each)

// Make prisma available in routes
app.locals.prisma = prisma;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/import', importRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Interner Serverfehler' });
});

// Initialize and start server
async function main() {
  try {
    await prisma.$connect();
    console.log('Datenbankverbindung hergestellt');

    // Create default admin user if not exists
    const adminExists = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          role: 'admin'
        }
      });
      console.log('Admin-Benutzer erstellt (admin/admin123)');
    }

    // Create default categories if not exist
    const defaultCategories = ['Vorspeise', 'Hauptgericht', 'Dessert', 'Snack', 'Getränk'];
    for (const name of defaultCategories) {
      await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name }
      });
    }
    console.log('Standard-Kategorien erstellt');

    app.listen(PORT, () => {
      console.log(`Server läuft auf Port ${PORT}`);
    });
  } catch (error) {
    console.error('Fehler beim Starten des Servers:', error);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
