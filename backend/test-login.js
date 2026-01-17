const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // List all users
  const users = await prisma.user.findMany();
  console.log('Users in database:');
  users.forEach(u => {
    console.log(`  - ${u.username} (${u.role})`);
  });

  // Test login
  const admin = await prisma.user.findUnique({
    where: { username: 'admin' }
  });

  if (admin) {
    const validPassword = await bcrypt.compare('admin123', admin.password);
    console.log('\nLogin test for admin/admin123:', validPassword ? 'SUCCESS' : 'FAILED');
    console.log('Stored password hash:', admin.password.substring(0, 20) + '...');
  } else {
    console.log('Admin user not found!');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
