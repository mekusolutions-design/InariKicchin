import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma runtime for the API process.
 *
 * Supabase exposes two URLs:
 * - DATABASE_URL — pooler (PgBouncer, often port 6543). Fine for ordinary queries.
 * - DIRECT_URL  — session/direct (port 5432). Required for Prisma interactive
 *                 transactions ($transaction(async tx => ...)), which PgBouncer
 *                 transaction pooling does not support reliably.
 */
let prisma: PrismaClient | undefined;
let directPrisma: PrismaClient | undefined;

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is required before the API can access PostgreSQL.');
  }
  return url;
}

export function getPrismaClient(): PrismaClient {
  requireDatabaseUrl();
  prisma ??= new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  return prisma;
}

/**
 * Client for interactive transactions and other session-level features.
 * Prefers DIRECT_URL when set and different from DATABASE_URL.
 */
export function getTransactionalPrismaClient(): PrismaClient {
  const direct = process.env.DIRECT_URL?.trim();
  const pooled = process.env.DATABASE_URL?.trim();
  if (!pooled && !direct) {
    throw new Error('DATABASE_URL or DIRECT_URL is required for transactional access.');
  }
  if (direct && direct !== pooled) {
    directPrisma ??= new PrismaClient({
      datasources: { db: { url: direct } },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
    return directPrisma;
  }
  return getPrismaClient();
}

/** Verify connectivity without mutating application data. */
export async function verifyDatabaseConnection(client = getPrismaClient()): Promise<void> {
  await client.$connect();
  await client.$queryRaw`SELECT 1`;
}

/** Close shared pools during graceful process shutdown. */
export async function disconnectDatabase(): Promise<void> {
  const jobs: Promise<void>[] = [];
  if (prisma) {
    const current = prisma;
    prisma = undefined;
    jobs.push(current.$disconnect());
  }
  if (directPrisma) {
    const current = directPrisma;
    directPrisma = undefined;
    jobs.push(current.$disconnect());
  }
  await Promise.all(jobs);
}
