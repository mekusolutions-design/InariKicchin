/**
 * Phase 5 — Authentication & session security
 * Password hashing via scrypt (Node built-in). JWT-style opaque session tokens.
 * Production Nest deployment can swap to @nestjs/jwt + bcrypt without changing route contracts.
 */
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import type { Role, User, InariStore } from './store.ts';

const SCRYPT_KEYLEN = 64;
const TOKEN_SECRET = process.env.INARI_TOKEN_SECRET ?? 'inari-kicchin-dev-secret-change-me';
const SESSION_TTL_MS = Number(process.env.INARI_SESSION_TTL_MS ?? 8 * 60 * 60 * 1000); // 8h
const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export interface Session {
  token: string;
  userId: string;
  role: Role;
  fullName: string;
  email: string;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const failedAttempts = new Map<string, { count: number; lockedUntil?: number }>();

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (stored.startsWith('hashed:')) {
    // Demo seed compatibility: hashed:plaintext
    return stored === `hashed:${plain}`;
  }
  if (!stored.startsWith('scrypt:')) return false;
  const [, salt, hash] = stored.split(':');
  const derived = scryptSync(plain, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Production authentication must never accept the legacy demo-only plaintext marker. */
export function verifyPersistentPassword(plain: string, stored: string): boolean {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt:')) return false;
  return verifyPassword(plain, stored);
}

function signToken(payload: string): string {
  const sig = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function login(
  store: InariStore,
  email: string,
  password: string,
): Session {
  const key = email.trim().toLowerCase();
  const lock = failedAttempts.get(key);
  if (lock?.lockedUntil && Date.now() < lock.lockedUntil) {
    throw new Error('Account temporarily locked. Try again later.');
  }

  const user = store.users.find((u) => u.email.toLowerCase() === key && u.isActive);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    const prev = failedAttempts.get(key) ?? { count: 0 };
    prev.count += 1;
    if (prev.count >= MAX_FAILED) {
      prev.lockedUntil = Date.now() + LOCKOUT_MS;
      prev.count = 0;
    }
    failedAttempts.set(key, prev);
    throw new Error('Invalid email or password');
  }

  failedAttempts.delete(key);
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, role: user.role, exp: Date.now() + SESSION_TTL_MS }),
  ).toString('base64url');
  const token = signToken(payload);
  const session: Session = {
    token,
    userId: user.id,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(token, session);
  user.lastLoginAt = new Date().toISOString();
  store.log('LOGIN', 'user', user.id, user.id);
  return session;
}

export function logout(token: string): void {
  sessions.delete(token);
}

export function requireSession(authHeader?: string): Session {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Authentication required');
  }
  const token = authHeader.slice(7).trim();
  const session = sessions.get(token);
  if (!session) throw new Error('Invalid or expired session');
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    throw new Error('Session expired');
  }
  return session;
}

/** Blueprint §11 permission matrix (simplified enforcement). */
const PERMISSIONS: Record<Role, Set<string>> = {
  ADMINISTRATOR: new Set(['*']),
  MANAGER: new Set([
    'dashboard:read',
    'products:read',
    'products:write',
    'purchases:write',
    'makeline:write',
    'closing:write',
    'closing:read',
    'menu:write',
    'menu:read',
    'reports:read',
    'orders:read',
    'orders:void',
    'kitchen:read',
    'kitchen:write',
    'wastage:write',
    'audit:read',
    'suppliers:write',
    'settings:read',
  ]),
  CASHIER: new Set([
    'dashboard:read',
    'pos:write',
    'orders:read',
    'orders:void',
    'kitchen:read',
    'menu:read',
    'products:read',
  ]),
  KITCHEN_STAFF: new Set(['kitchen:read', 'kitchen:write', 'makeline:write', 'menu:read']),
};

export function assertPermission(role: Role, permission: string): void {
  const set = PERMISSIONS[role];
  if (!set) throw new Error('Unknown role');
  if (set.has('*') || set.has(permission)) return;
  throw new Error(`Forbidden: ${role} cannot perform ${permission}`);
}

export function bootstrapAdminPasswords(store: InariStore): void {
  for (const u of store.users) {
    if (u.passwordHash.startsWith('hashed:')) {
      const plain = u.passwordHash.slice('hashed:'.length);
      u.passwordHash = hashPassword(plain);
    }
  }
}

/** Upgrade seed users to scrypt and expose known demo passwords in docs only. */
export const DEMO_CREDENTIALS = [
  { email: 'keya8020@gmail.com', password: 'keya2000', role: 'ADMINISTRATOR' },
  { email: 'manager@inarikicchin.test', password: 'manager1', role: 'MANAGER' },
  { email: 'cashier@inarikicchin.test', password: 'cashier1', role: 'CASHIER' },
  { email: 'kitchen@inarikicchin.test', password: 'kitchen1', role: 'KITCHEN_STAFF' },
] as const;
