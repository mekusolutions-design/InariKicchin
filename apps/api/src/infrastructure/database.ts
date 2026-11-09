import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma runtime for the API process.
 *
 * This module deliberately does not switch the HTTP server to Prisma by itself.
 * Route/service migration must be completed and integration-tested before the
 * production startup gate in production-server.ts can be removed.
 */
let prisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required before the API can access PostgreSQL.');
  }
  prisma ??= new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  return prisma;
}

/** Verify connectivity without mutating application data. */
export async function verifyDatabaseConnection(client = getPrismaClient()): Promise<void> {
  await client.$connect();
  await client.$queryRaw`SELECT 1`;
}

/** Close the shared pool during graceful process shutdown. */
export async function disconnectDatabase(): Promise<void> {
  if (!prisma) return;
  const current = prisma;
  prisma = undefined;
  await current.$disconnect();
}
