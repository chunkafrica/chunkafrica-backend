import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  try {
    const businessId = '22222222-2222-2222-2222-222222222222';
    const roleId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const storeId = '33333333-3333-3333-3333-333333333333';
    const userId = '11111111-1111-1111-1111-111111111111';

    // Create or update business
    const business = await prisma.business.upsert({
      where: { id: businessId },
      update: {
        name: 'Dev Business',
        currencyCode: 'NGN',
        timezone: 'Africa/Lagos',
        deletedAt: null,
      },
      create: {
        id: businessId,
        name: 'Dev Business',
        currencyCode: 'NGN',
        timezone: 'Africa/Lagos',
      },
    });
    console.log(`✓ Business: ${business.name}`);

    // Create or update role
    const role = await prisma.role.upsert({
      where: {
        businessId_name: {
          businessId,
          name: 'admin',
        },
      },
      update: {
        description: 'Administrator role for local development',
        isSystemRole: true,
        deletedAt: null,
      },
      create: {
        id: roleId,
        businessId,
        name: 'admin',
        description: 'Administrator role for local development',
        isSystemRole: true,
      },
    });
    console.log(`✓ Role: ${role.name}`);

    // Create or update store
    const store = await prisma.store.upsert({
      where: { id: storeId },
      update: {
        businessId,
        name: 'Dev Store',
        storeType: 'PHYSICAL',
        isActive: true,
        deletedAt: null,
      },
      create: {
        id: storeId,
        businessId,
        name: 'Dev Store',
        storeType: 'PHYSICAL',
      },
    });
    console.log(`✓ Store: ${store.name}`);

    // Create or update user
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {
        businessId,
        roleId: role.id,
        primaryStoreId: store.id,
        fullName: 'Dev User',
        email: 'dev@localhost',
        isActive: true,
        deletedAt: null,
      },
      create: {
        id: userId,
        businessId,
        roleId: role.id,
        primaryStoreId: store.id,
        fullName: 'Dev User',
        email: 'dev@localhost',
      },
    });
    console.log(`✓ User: ${user.fullName}`);

    console.log('\n✓ Seed completed successfully!');
  } catch (error) {
    console.error('✗ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
