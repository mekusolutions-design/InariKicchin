import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoStore } from './store.ts';
import {
  hashPassword,
  verifyPassword,
  verifyPersistentPassword,
  login,
  logout,
  requireSession,
  assertPermission,
  bootstrapAdminPasswords,
  DEMO_CREDENTIALS,
} from './auth.ts';

describe('Phase 5 — Auth', () => {
  it('hashes and verifies passwords with scrypt', () => {
    const h = hashPassword('keya2000');
    assert.match(h, /^scrypt:/);
    assert.equal(verifyPassword('keya2000', h), true);
    assert.equal(verifyPassword('wrong', h), false);
    assert.equal(verifyPersistentPassword('keya2000', h), true);
    assert.equal(verifyPersistentPassword('keya2000', 'hashed:keya2000'), false);
  });

  it('login returns bearer session for admin', () => {
    const store = seedDemoStore();
    bootstrapAdminPasswords(store);
    const session = login(store, 'keya8020@gmail.com', 'keya2000');
    assert.ok(session.token.length > 20);
    assert.equal(session.role, 'ADMINISTRATOR');
    const again = requireSession(`Bearer ${session.token}`);
    assert.equal(again.userId, session.userId);
  });

  it('rejects bad password', () => {
    const store = seedDemoStore();
    bootstrapAdminPasswords(store);
    assert.throws(() => login(store, 'keya8020@gmail.com', 'nope'));
  });

  it('logout invalidates token', () => {
    const store = seedDemoStore();
    bootstrapAdminPasswords(store);
    const session = login(store, DEMO_CREDENTIALS[2].email, DEMO_CREDENTIALS[2].password);
    logout(session.token);
    assert.throws(() => requireSession(`Bearer ${session.token}`));
  });
});

describe('Phase 5 — Permissions', () => {
  it('manager can close stock; cashier cannot', () => {
    assert.doesNotThrow(() => assertPermission('MANAGER', 'closing:write'));
    assert.throws(() => assertPermission('CASHIER', 'closing:write'));
  });

  it('kitchen cannot use POS', () => {
    assert.throws(() => assertPermission('KITCHEN_STAFF', 'pos:write'));
    assert.doesNotThrow(() => assertPermission('CASHIER', 'pos:write'));
    assert.doesNotThrow(() => assertPermission('CASHIER', 'reports:read'));
    assert.doesNotThrow(() => assertPermission('KITCHEN_STAFF', 'kitchen:read'));
  });

  it('admin has all permissions', () => {
    assert.doesNotThrow(() => assertPermission('ADMINISTRATOR', 'settings:write'));
  });
});
