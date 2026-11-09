/**
 * Prisma seed for production Postgres (Phase 5).
 * Run after migrate: npx prisma db seed
 *
 * Requires DATABASE_URL. Uses scrypt-compatible hash via domain auth when available;
 * here we document the bootstrap admin matching demo credentials.
 */
import { PrismaClient, RoleName } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  const units = [
    { code: 'kg', name: 'Kilogram', dimension: 'WEIGHT' as const, factor_to_base: 1 },
    { code: 'g', name: 'Gram', dimension: 'WEIGHT' as const, factor_to_base: 0.001 },
    { code: 'l', name: 'Litre', dimension: 'VOLUME' as const, factor_to_base: 1 },
    { code: 'ml', name: 'Millilitre', dimension: 'VOLUME' as const, factor_to_base: 0.001 },
    { code: 'pcs', name: 'Piece', dimension: 'COUNT' as const, factor_to_base: 1 },
  ];

  for (const u of units) {
    await prisma.unit.upsert({
      where: { code: u.code },
      create: u,
      update: {},
    });
  }

  const kg = await prisma.unit.findUniqueOrThrow({ where: { code: 'kg' } });
  const litre = await prisma.unit.findUniqueOrThrow({ where: { code: 'l' } });

  await prisma.user.upsert({
    where: { email: 'keya8020@gmail.com' },
    create: {
      full_name: 'Simon Keya',
      email: 'keya8020@gmail.com',
      password_hash: hashPassword('keya2000'),
      role: RoleName.ADMINISTRATOR,
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: 'manager@inarikicchin.test' },
    create: {
      full_name: 'Mercy A.',
      email: 'manager@inarikicchin.test',
      password_hash: hashPassword('manager1'),
      role: RoleName.MANAGER,
    },
    update: {},
  });

  const cat = await prisma.productCategory.upsert({
    where: { name: 'Proteins' },
    create: { name: 'Proteins', sort_order: 1 },
    update: {},
  });

  await prisma.product.upsert({
    where: { name: 'Chicken Breast' },
    create: {
      name: 'Chicken Breast',
      category_id: cat.id,
      base_unit_id: kg.id,
      min_stock_level: 5,
      on_hand_qty: 10,
      avg_unit_cost: 500,
    },
    update: {},
  });

  await prisma.product.upsert({
    where: { name: 'Cooking Oil' },
    create: {
      name: 'Cooking Oil',
      base_unit_id: litre.id,
      min_stock_level: 4,
      on_hand_qty: 12,
      avg_unit_cost: 290,
    },
    update: {},
  });

  await prisma.supplier.createMany({
    data: [{ name: 'Fresh Farm Supplies', phone: '+254700000000' }],
    skipDuplicates: true,
  });

  await prisma.vatSetting.create({
    data: {
      vat_enabled: true,
      rate_percent: 16,
      prices_include_vat: true,
      effective_from: new Date(),
    },
  });

  const orderTypes = [
    'Dine In',
    'Pick Up',
    'Glovo',
    'Bolt Food',
    'Uber Eats',
    'SpeedyDrop',
    'NAI Deliver',
    'Yum Deliveries',
  ];
  for (let i = 0; i < orderTypes.length; i++) {
    await prisma.orderType.upsert({
      where: { name: orderTypes[i] },
      create: {
        name: orderTypes[i],
        is_delivery: !['Dine In', 'Pick Up'].includes(orderTypes[i]),
        requires_reference: !['Dine In', 'Pick Up'].includes(orderTypes[i]),
        sort_order: i,
      },
      update: {},
    });
  }

  for (const name of ['Cash', 'M-Pesa', 'Card', 'Bank transfer', 'Platform payout']) {
    await prisma.paymentMethod.upsert({
      where: { name },
      create: {
        name,
        requires_reference: name === 'M-Pesa' || name === 'Platform payout',
      },
      update: {},
    });
  }

  console.log('Seed complete: admin keya8020@gmail.com / keya2000');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
