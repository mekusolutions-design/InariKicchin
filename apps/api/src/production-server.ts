/**
 * Phase 5 — Production-shaped HTTP API
 * Auth required on mutating routes; health/readiness; CORS; permission checks.
 */
import { createServer } from 'node:http';
import { seedDemoStore, type InariStore } from './domain/store.ts';
import {
  enablePhase4,
  supplierAnalytics,
  salesReportCsv,
  buildEtimsReceipt,
  type Phase4State,
} from './domain/phase4.ts';
import {
  login,
  logout,
  requireSession,
  assertPermission,
  bootstrapAdminPasswords,
  DEMO_CREDENTIALS,
  type Session,
} from './domain/auth.ts';

// SAFETY GATE: this archive's HTTP server still uses the in-memory demo store.
// Refuse production startup rather than silently losing business data on restart.
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Production startup blocked: persistent Prisma-backed repositories are not wired into production-server.ts. ' +
    'Do not deploy this API for live operations until database persistence, migrations, and production user provisioning are implemented and tested.',
  );
}

if (!process.env.INARI_TOKEN_SECRET || process.env.INARI_TOKEN_SECRET.length < 32) {
  throw new Error('INARI_TOKEN_SECRET must be set to a random value of at least 32 characters.');
}

const store = seedDemoStore() as InariStore & Phase4State;
enablePhase4(store);
bootstrapAdminPasswords(store);

const PORT = Number(process.env.PORT ?? 4040);
const startedAt = Date.now();

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function applyCors(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
}

function json(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  status: number,
  body: unknown,
) {
  applyCors(req, res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    const chunk = c as Buffer;
    size += chunk.length;
    if (size > 1_048_576) throw new Error('Request body too large (maximum 1 MB)');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('Invalid JSON request body');
  }
}

function auth(req: import('node:http').IncomingMessage): Session {
  return requireSession(req.headers.authorization);
}

const server = createServer(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    // Public
    if (req.method === 'GET' && path === '/health') {
      return json(req, res, 200, {
        status: 'ok',
        product: 'Inari Kicchin',
        phase: 5,
        uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      });
    }
    if (req.method === 'GET' && path === '/ready') {
      return json(req, res, 503, {
        ready: false,
        storage: 'in-memory-demo-store',
        durable: false,
        reason: 'Prisma persistence is not connected to the production HTTP server.',
      });
    }
    if (req.method === 'POST' && path === '/auth/login') {
      const body = await readBody(req);
      const session = login(store, body.email, body.password);
      return json(req, res, 200, {
        accessToken: session.token,
        tokenType: 'Bearer',
        expiresAt: new Date(session.expiresAt).toISOString(),
        user: {
          id: session.userId,
          fullName: session.fullName,
          email: session.email,
          role: session.role,
        },
      });
    }
    if (req.method === 'POST' && path === '/auth/logout') {
      const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
      logout(token);
      return json(req, res, 200, { ok: true });
    }
    if (req.method === 'GET' && path === '/auth/demo-users') {
      // Only for non-production
      if (process.env.NODE_ENV === 'production') {
        return json(req, res, 404, { error: 'Not found' });
      }
      return json(req, res, 200, DEMO_CREDENTIALS);
    }

    // Authenticated reads
    if (req.method === 'GET' && path === '/me') {
      const s = auth(req);
      return json(req, res, 200, s);
    }
    if (req.method === 'GET' && path === '/dashboard') {
      const s = auth(req);
      assertPermission(s.role, 'dashboard:read');
      return json(req, res, 200, store.dashboard());
    }
    if (req.method === 'GET' && path === '/products') {
      const s = auth(req);
      assertPermission(s.role, 'products:read');
      return json(req, res, 200, store.products);
    }
    if (req.method === 'GET' && path === '/orders') {
      const s = auth(req);
      assertPermission(s.role, 'orders:read');
      return json(req, res, 200, store.orders);
    }
    if (req.method === 'GET' && path === '/kitchen/tickets') {
      const s = auth(req);
      assertPermission(s.role, 'kitchen:read');
      return json(req, res, 200, store.tickets);
    }
    if (req.method === 'GET' && path === '/audit') {
      const s = auth(req);
      assertPermission(s.role, 'audit:read');
      return json(req, res, 200, store.audit);
    }
    if (req.method === 'GET' && path === '/reports/sales') {
      const s = auth(req);
      assertPermission(s.role, 'reports:read');
      const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
      const to = url.searchParams.get('to') ?? from;
      return json(req, res, 200, store.salesReport(from, to));
    }
    if (req.method === 'GET' && path === '/reports/sales.csv') {
      const s = auth(req);
      assertPermission(s.role, 'reports:read');
      const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
      const to = url.searchParams.get('to') ?? from;
      applyCors(req, res);
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(salesReportCsv(store, from, to));
      return;
    }
    if (req.method === 'GET' && path === '/reports/suppliers') {
      const s = auth(req);
      assertPermission(s.role, 'reports:read');
      const from = url.searchParams.get('from') ?? '2020-01-01';
      const to = url.searchParams.get('to') ?? '2099-12-31';
      return json(req, res, 200, supplierAnalytics(store, from, to));
    }
    if (req.method === 'GET' && path === '/menu') {
      const s = auth(req);
      assertPermission(s.role, 'menu:read');
      return json(req, res, 200, { categories: store.menuCategories, items: store.menuItems });
    }
    if (req.method === 'GET' && path === '/meta') {
      auth(req);
      return json(req, res, 200, {
        orderTypes: store.orderTypes,
        paymentMethods: store.paymentMethods,
        vat: store.vat,
        users: store.users.map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
        })),
      });
    }
    if (req.method === 'GET' && path === '/closings') {
      const s = auth(req);
      assertPermission(s.role, 'closing:read');
      return json(req, res, 200, store.closings);
    }
    if (req.method === 'GET' && path === '/makeline') {
      auth(req);
      return json(req, res, 200, store.makelineProducts);
    }
    if (req.method === 'GET' && path === '/suppliers') {
      auth(req);
      return json(req, res, 200, store.suppliers);
    }

    // Mutations
    if (req.method === 'POST' && path === '/purchases') {
      const s = auth(req);
      assertPermission(s.role, 'purchases:write');
      const body = await readBody(req);
      body.createdById = body.createdById ?? s.userId;
      return json(req, res, 201, store.receiveStock(body));
    }
    if (req.method === 'POST' && path === '/closings') {
      const s = auth(req);
      assertPermission(s.role, 'closing:write');
      const body = await readBody(req);
      body.submittedById = body.submittedById ?? s.userId;
      return json(req, res, 201, store.submitClosing(body));
    }
    if (req.method === 'POST' && path === '/pos/orders') {
      const s = auth(req);
      assertPermission(s.role, 'pos:write');
      const body = await readBody(req);
      body.cashierId = body.cashierId ?? s.userId;
      return json(req, res, 201, store.createOrder(body));
    }
    if (req.method === 'POST' && path.startsWith('/kitchen/tickets/') && path.endsWith('/status')) {
      const s = auth(req);
      assertPermission(s.role, 'kitchen:write');
      const id = path.split('/')[3];
      const body = await readBody(req);
      return json(req, res, 200, store.updateTicketStatus(id, body.status, s.userId));
    }
    if (req.method === 'POST' && path.startsWith('/orders/') && path.endsWith('/void')) {
      const s = auth(req);
      assertPermission(s.role, 'orders:void');
      const id = path.split('/')[2];
      const body = await readBody(req);
      return json(req, res, 200, store.voidOrder(id, body.reason, s.userId));
    }
    if (req.method === 'GET' && path.startsWith('/orders/') && path.endsWith('/etims')) {
      const s = auth(req);
      assertPermission(s.role, 'orders:read');
      const id = path.split('/')[2];
      const order = store.orders.find((o) => o.id === id);
      if (!order) return json(req, res, 404, { error: 'Order not found' });
      return json(req, res, 200, buildEtimsReceipt(store, order));
    }

    json(req, res, 404, { error: 'Not found', path });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    const status =
      msg.includes('Authentication') || msg.includes('Session')
        ? 401
        : msg.includes('Forbidden')
          ? 403
          : msg.includes('too large') ? 413
            : msg.includes('Invalid JSON') ? 400
              : 400;
    // Keep detailed exceptions in server logs; do not expose stack traces.
    if (status >= 500) console.error('API request failed:', e);
    json(req, res, status, { error: msg });
  }
});

server.headersTimeout = 15_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;

server.listen(PORT, () => {
  console.log(`Inari Kicchin Phase 5 API on http://localhost:${PORT}`);
  console.log('POST /auth/login  — then Authorization: Bearer <token>');
});
