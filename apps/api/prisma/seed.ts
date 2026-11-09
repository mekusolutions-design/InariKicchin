/**
 * Prisma seed for production PostgreSQL.
 *
 * This seed deliberately does not create sample stock, suppliers, demo staff, or
 * known credentials. The first administrator must be provisioned explicitly
 * through the deployment secret manager.
 */
import { PrismaClient, RoleName } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required to provision the initial administrator.`);
  return value;
}

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  const adminEmail = requiredEnv('INARI_BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const adminName = requiredEnv('INARI_BOOTSTRAP_ADMIN_NAME');
  const adminPassword = requiredEnv('INARI_BOOTSTRAP_ADMIN_PASSWORD');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error('INARI_BOOTSTRAP_ADMIN_EMAIL must be a valid email address.');
  }
  if (adminName.length < 2) {
    throw new Error('INARI_BOOTSTRAP_ADMIN_NAME must contain at least 2 characters.');
  }
  if (adminPassword.length < 16) {
    throw new Error('INARI_BOOTSTRAP_ADMIN_PASSWORD must be at least 16 characters.');
  }

  // Safe, repeatable reference data. No demo inventory or preloaded transactions.
  const units = [
    { code: 'kg', name: 'Kilogram', dimension: 'WEIGHT' as const, factor_to_base: 1 },
    { code: 'g', name: 'Gram', dimension: 'WEIGHT' as const, factor_to_base: 0.001 },
    { code: 'l', name: 'Litre', dimension: 'VOLUME' as const, factor_to_base: 1 },
    { code: 'ml', name: 'Millilitre', dimension: 'VOLUME' as const, factor_to_base: 0.001 },
    { code: 'pcs', name: 'Piece', dimension: 'COUNT' as const, factor_to_base: 1 },
  ];

  await prisma.$transaction(async (tx) => {
    for (const unit of units) {
      await tx.unit.upsert({ where: { code: unit.code }, create: unit, update: {} });
    }

    await tx.user.upsert({
      where: { email: adminEmail },
      create: {
        full_name: adminName,
        email: adminEmail,
        password_hash: hashPassword(adminPassword),
        role: RoleName.ADMINISTRATOR,
      },
      // Do not silently rotate an existing administrator's password on reseed.
      update: {},
    });

    const orderTypes = [
      'Dine In', 'Pick Up', 'Glovo', 'Bolt Food', 'Uber Eats',
      'SpeedyDrop', 'NAI Deliver', 'Yum Deliveries',
    ];
    for (let i = 0; i < orderTypes.length; i++) {
      const name = orderTypes[i];
      const isDelivery = !['Dine In', 'Pick Up'].includes(name);
      await tx.orderType.upsert({
        where: { name },
        create: { name, is_delivery: isDelivery, requires_reference: isDelivery, sort_order: i },
        update: {},
      });
    }

    for (const name of ['Cash', 'M-Pesa', 'Card', 'Bank transfer', 'Platform payout']) {
      await tx.paymentMethod.upsert({
        where: { name },
        create: { name, requires_reference: name === 'M-Pesa' || name === 'Platform payout' },
        update: {},
      });
    }

    const existingVatSetting = await tx.vatSetting.findFirst();
    if (!existingVatSetting) {
      await tx.vatSetting.create({
        data: {
          vat_enabled: true,
          rate_percent: 16,
          prices_include_vat: true,
          effective_from: new Date(),
        },
      });
    }
  });

  console.log(`Reference data seeded. Bootstrap administrator provisioned: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error('Prisma seed failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
