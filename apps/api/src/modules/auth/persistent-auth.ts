import { createHash, randomBytes } from 'node:crypto';
import { getPrismaClient } from '../../infrastructure/database.ts';
import { verifyPersistentPassword, type Session } from '../../domain/auth.ts';

const SESSION_TTL_MS = Number(process.env.INARI_SESSION_TTL_MS ?? 8 * 60 * 60 * 1000);
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function publicSession(token: string, user: {
  id: string; full_name: string; email: string; role: string;
}, expiresAt: Date): Session {
  return {
    token,
    userId: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role as Session['role'],
    expiresAt: expiresAt.getTime(),
  };
}

/** Database-backed login. Only a SHA-256 digest of the bearer token is persisted. */
export async function loginPersistent(emailInput: string, password: string, metadata?: {
  ipAddress?: string; userAgent?: string;
}): Promise<Session> {
  const prisma = getPrismaClient();
  const email = String(emailInput ?? '').trim().toLowerCase();
  if (!email || typeof password !== 'string' || !password) {
    throw new Error('Invalid email or password');
  }

  const attempt = await prisma.authLoginAttempt.findUnique({ where: { email } });
  if (attempt?.locked_until && attempt.locked_until > new Date()) {
    throw new Error('Account temporarily locked. Try again later.');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.is_active || !verifyPersistentPassword(password, user.password_hash)) {
    const next = await prisma.authLoginAttempt.upsert({
      where: { email },
      create: { email, failed_count: 1 },
      update: { failed_count: { increment: 1 } },
    });
    if (next.failed_count >= MAX_FAILED_ATTEMPTS) {
      await prisma.authLoginAttempt.update({
        where: { email },
        data: { failed_count: 0, locked_until: new Date(Date.now() + LOCKOUT_MS) },
      });
    }
    throw new Error('Invalid email or password');
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.$transaction([
    prisma.authSession.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash(token),
        expires_at: expiresAt,
        ip_address: metadata?.ipAddress,
        user_agent: metadata?.userAgent,
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } }),
    prisma.authLoginAttempt.deleteMany({ where: { email } }),
  ]);

  return publicSession(token, user, expiresAt);
}

/** Revokes the persisted session; repeated logout requests are harmless. */
export async function logoutPersistent(token: string): Promise<void> {
  if (!token) return;
  const prisma = getPrismaClient();
  await prisma.authSession.updateMany({
    where: { token_hash: tokenHash(token), revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

/** Resolves a bearer token against PostgreSQL on every request. */
export async function requirePersistentSession(authHeader?: string): Promise<Session> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Authentication required');
  const token = authHeader.slice(7).trim();
  if (!token) throw new Error('Authentication required');

  const record = await getPrismaClient().authSession.findUnique({
    where: { token_hash: tokenHash(token) },
    include: { user: true },
  });
  const now = new Date();
  if (!record || record.revoked_at || record.expires_at <= now || !record.user.is_active) {
    throw new Error('Invalid or expired session');
  }

  // Touch activity at a bounded frequency to avoid a write on every API request.
  if (!record.last_seen_at || now.getTime() - record.last_seen_at.getTime() > 5 * 60_000) {
    await getPrismaClient().authSession.update({
      where: { id: record.id }, data: { last_seen_at: now },
    });
  }
  return publicSession(token, record.user, record.expires_at);
}
