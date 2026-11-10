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
import {
  loginPersistent,
  logoutPersistent,
  requirePersistentSession,
} from './modules/auth/persistent-auth.ts';
import {
  getPrismaClient,
  verifyDatabaseConnection,
  disconnectDatabase,
} from './infrastructure/database.ts';
import { StockRepository } from './infrastructure/repositories/stock-repository.ts';
import { OrderRepository } from './infrastructure/repositories/order-repository.ts';
import { ReadRepository, CatalogRepository } from './infrastructure/repositories/read-repository.ts';

// SAFETY GATE: production must never start on in-memory storage.
// DATABASE_URL is required in production so all business routes use PostgreSQL.
// INARI_DURABLE_CONFIRMED is an operational readiness signal (reported by /ready)
// and is intentionally NOT required to boot — otherwise staging can never be verified.
const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const durableConfirmed = process.env.INARI_DURABLE_CONFIRMED === '1';
if (process.env.NODE_ENV === 'production' && !hasDatabase) {
  throw new Error(
    'Production startup blocked: DATABASE_URL is required. ' +
    'Configure PostgreSQL (Supabase) before deploying. ' +
    'INARI_DURABLE_CONFIRMED=1 should be set only after staging smoke tests pass.',
  );
}

if (!process.env.INARI_TOKEN_SECRET || process.env.INARI_TOKEN_SECRET.length < 32) {
  throw new Error('INARI_TOKEN_SECRET must be set to a random value of at least 32 characters.');
}

const store = seedDemoStore() as InariStore & Phase4State;
enablePhase4(store);
bootstrapAdminPasswords(store);

const useDurable = hasDatabase; // prefer PostgreSQL whenever DATABASE_URL is configured
let stockRepo: StockRepository | null = null;
let orderRepo: OrderRepository | null = null;
let readRepo: ReadRepository | null = null;
let catalogRepo: CatalogRepository | null = null;
if (useDurable) {
  const prisma = getPrismaClient();
  stockRepo = new StockRepository(prisma);
  orderRepo = new OrderRepository(prisma);
  readRepo = new ReadRepository(prisma);
  catalogRepo = new CatalogRepository(prisma);
}

const PORT = Number(process.env.PORT ?? 4040);
const startedAt = Date.now();

// Accept CORS_ORIGINS (preferred) or legacy CORS_ORIGIN alias.
const corsEnv =
  process.env.CORS_ORIGINS?.trim() ||
  process.env.CORS_ORIGIN?.trim() ||
  'http://localhost:3001';
const allowedOrigins = new Set(
  corsEnv
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
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

async function auth(req: import('node:http').IncomingMessage): Promise<Session> {
  if (process.env.DATABASE_URL) {
    return requirePersistentSession(req.headers.authorization);
  }
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
      if (!process.env.DATABASE_URL) {
        return json(req, res, 503, {
          ready: false,
          storage: 'in-memory-demo-store',
          durable: false,
          reason: 'DATABASE_URL is not configured.',
        });
      }
      try {
        await verifyDatabaseConnection();
        return json(req, res, 200, {
          ready: true,
          storage: 'postgresql',
          durable: durableConfirmed,
          durableConfirmed,
          auth: 'persistent',
          note: durableConfirmed
            ? 'Operator confirmed durable deployment'
            : 'PostgreSQL connected; set INARI_DURABLE_CONFIRMED=1 after smoke tests',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'database unreachable';
        return json(req, res, 503, {
          ready: false,
          storage: 'postgresql',
          durable: false,
          reason: msg,
        });
      }
    }
    if (req.method === 'POST' && path === '/auth/login') {
      const body = await readBody(req);
      const meta = {
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim(),
        userAgent: req.headers['user-agent'],
      };
      const session = process.env.DATABASE_URL
        ? await loginPersistent(body.email, body.password, meta)
        : login(store, body.email, body.password);
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
      if (process.env.DATABASE_URL) await logoutPersistent(token);
      else logout(token);
      return json(req, res, 200, { ok: true });
    }
    if (req.method === 'GET' && path === '/auth/demo-users') {
      if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) {
        return json(req, res, 404, { error: 'Not found' });
      }
      return json(req, res, 200, DEMO_CREDENTIALS);
    }

    // Authenticated reads
    if (req.method === 'GET' && path === '/me') {
      const s = await auth(req);
      return json(req, res, 200, s);
    }
    if (req.method === 'GET' && path === '/dashboard') {
      const s = await auth(req);
      assertPermission(s.role, 'dashboard:read');
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.dashboard());
      return json(req, res, 200, store.dashboard());
    }
    if (req.method === 'GET' && path === '/products') {
      const s = await auth(req);
      assertPermission(s.role, 'products:read');
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.products());
      return json(req, res, 200, store.products);
    }
    if (req.method === 'GET' && path === '/orders') {
      const s = await auth(req);
      assertPermission(s.role, 'orders:read');
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.orders());
      return json(req, res, 200, store.orders);
    }
    if (req.method === 'GET' && path === '/kitchen/tickets') {
      const s = await auth(req);
      assertPermission(s.role, 'kitchen:read');
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.kitchenTickets());
      return json(req, res, 200, store.tickets);
    }
    if (req.method === 'GET' && path === '/audit') {
      const s = await auth(req);
      assertPermission(s.role, 'audit:read');
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.audit());
      return json(req, res, 200, store.audit);
    }
    if (req.method === 'GET' && path === '/reports/sales') {
      const s = await auth(req);
      assertPermission(s.role, 'reports:read');
      const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
      const to = url.searchParams.get('to') ?? from;
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.salesReport(from, to));
      return json(req, res, 200, store.salesReport(from, to));
    }
    if (req.method === 'GET' && path === '/reports/sales.csv') {
      const s = await auth(req);
      assertPermission(s.role, 'reports:read');
      const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
      const to = url.searchParams.get('to') ?? from;
      applyCors(req, res);
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store' });
      if (useDurable && readRepo) {
        res.end(await readRepo.salesReportCsv(from, to));
      } else {
        res.end(salesReportCsv(store, from, to));
      }
      return;
    }
    if (req.method === 'GET' && path === '/reports/suppliers') {
      const s = await auth(req);
      assertPermission(s.role, 'reports:read');
      const from = url.searchParams.get('from') ?? '2020-01-01';
      const to = url.searchParams.get('to') ?? '2099-12-31';
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.supplierAnalytics(from, to));
      return json(req, res, 200, supplierAnalytics(store, from, to));
    }
    if (req.method === 'GET' && path === '/menu') {
      const s = await auth(req);
      assertPermission(s.role, 'menu:read');
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.menu());
      return json(req, res, 200, { categories: store.menuCategories, items: store.menuItems });
    }
    if (req.method === 'GET' && path === '/meta') {
      await auth(req);
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.meta());
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
      const s = await auth(req);
      assertPermission(s.role, 'closing:read');
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.closings());
      return json(req, res, 200, store.closings);
    }
    if (req.method === 'GET' && path === '/makeline') {
      await auth(req);
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.makelineProducts());
      return json(req, res, 200, store.makelineProducts);
    }
    if (req.method === 'POST' && path === '/makeline') {
      const s = await auth(req);
      assertPermission(s.role, 'makeline:write');
      const body = await readBody(req);
      if (useDurable && stockRepo) {
        return json(req, res, 201, await stockRepo.recordMakelineProduction({
          makelineProductId: body.productId ?? body.makelineProductId,
          quantity: Number(body.quantity),
          producedById: s.userId,
          notes: body.notes,
        }));
      }
      return json(req, res, 501, { error: 'Makeline production requires PostgreSQL' });
    }
    if (req.method === 'POST' && path === '/makeline/products') {
      const s = await auth(req);
      assertPermission(s.role, 'makeline:write');
      const body = await readBody(req);
      if (useDurable && catalogRepo) {
        return json(req, res, 201, await catalogRepo.createMakelineProduct({
          name: body.name,
          unitCode: body.unitCode ?? body.unit ?? 'kg',
          notes: body.notes,
          userId: s.userId,
        }));
      }
      return json(req, res, 501, { error: 'Makeline product create requires PostgreSQL' });
    }
    if (req.method === 'GET' && path === '/suppliers') {
      await auth(req);
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.suppliers());
      return json(req, res, 200, store.suppliers);
    }

    // Mutations — prefer PostgreSQL repositories when DATABASE_URL is set
    if (req.method === 'GET' && path === '/purchases') {
      const s = await auth(req);
      assertPermission(s.role, 'products:read');
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.purchases());
      return json(req, res, 200, []);
    }
    if (req.method === 'POST' && path === '/purchases') {
      const s = await auth(req);
      assertPermission(s.role, 'purchases:write');
      const body = await readBody(req);
      body.createdById = body.createdById ?? s.userId;
      if (body.invoiceNumber && !body.invoiceNo) body.invoiceNo = body.invoiceNumber;
      if (useDurable && stockRepo) return json(req, res, 201, await stockRepo.receiveStock(body));
      return json(req, res, 201, store.receiveStock(body));
    }
    if (req.method === 'POST' && path === '/closings') {
      const s = await auth(req);
      assertPermission(s.role, 'closing:write');
      const body = await readBody(req);
      body.submittedById = body.submittedById ?? s.userId;
      if (!body.idempotencyKey) body.idempotencyKey = (req.headers['idempotency-key'] as string) || crypto.randomUUID();
      if (useDurable && stockRepo) return json(req, res, 201, await stockRepo.submitClosing(body));
      return json(req, res, 201, store.submitClosing(body));
    }
    if (req.method === 'POST' && path === '/pos/orders') {
      const s = await auth(req);
      assertPermission(s.role, 'pos:write');
      const body = await readBody(req);
      body.cashierId = body.cashierId ?? s.userId;
      if (!body.idempotencyKey) body.idempotencyKey = (req.headers['idempotency-key'] as string) || crypto.randomUUID();
      if (useDurable && orderRepo) {
        const order = await orderRepo.createOrder(body);
        return json(req, res, 201, {
          order: {
            ...order,
            grandTotal: order.totalAmount ?? order.grandTotal,
          },
          ticket: order.kitchenTicketId
            ? { id: order.kitchenTicketId, ticketNo: order.orderNo }
            : undefined,
        });
      }
      return json(req, res, 201, store.createOrder(body));
    }
    if (req.method === 'POST' && path.startsWith('/kitchen/tickets/') && path.endsWith('/status')) {
      const s = await auth(req);
      assertPermission(s.role, 'kitchen:write');
      const id = path.split('/')[3];
      const body = await readBody(req);
      if (useDurable && orderRepo) return json(req, res, 200, await orderRepo.updateTicketStatus(id, body.status, s.userId));
      return json(req, res, 200, store.updateTicketStatus(id, body.status, s.userId));
    }
    if (req.method === 'POST' && path.startsWith('/orders/') && path.endsWith('/void')) {
      const s = await auth(req);
      assertPermission(s.role, 'orders:void');
      const id = path.split('/')[2];
      const body = await readBody(req);
      if (useDurable && orderRepo) return json(req, res, 200, await orderRepo.voidOrder(id, body.reason, s.userId));
      return json(req, res, 200, store.voidOrder(id, body.reason, s.userId));
    }
    if (req.method === 'GET' && path.startsWith('/orders/') && path.endsWith('/etims')) {
      const s = await auth(req);
      assertPermission(s.role, 'orders:read');
      const id = path.split('/')[2];
      if (useDurable && readRepo) {
        const payload = await readRepo.etimsReceipt(id);
        if (!payload) return json(req, res, 404, { error: 'Order not found' });
        return json(req, res, 200, payload);
      }
      const order = store.orders.find((o) => o.id === id);
      if (!order) return json(req, res, 404, { error: 'Order not found' });
      return json(req, res, 200, buildEtimsReceipt(store, order));
    }


    if (req.method === 'POST' && path === '/suppliers') {
      const s = await auth(req);
      assertPermission(s.role, 'suppliers:write');
      const body = await readBody(req);
      if (useDurable && catalogRepo) {
        return json(req, res, 201, await catalogRepo.createSupplier({ ...body, userId: s.userId }));
      }
      return json(req, res, 501, { error: 'Supplier create requires durable PostgreSQL' });
    }
    if (req.method === 'GET' && path === '/settings') {
      const s = await auth(req);
      assertPermission(s.role, 'settings:read');
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.getSettings());
      return json(req, res, 200, {});
    }
    if (req.method === 'PUT' && path === '/settings') {
      const s = await auth(req);
      assertPermission(s.role, 'settings:write');
      const body = await readBody(req);
      if (useDurable && readRepo) {
        return json(req, res, 200, await readRepo.putSettings({
          settings: body.settings ?? body,
          userId: s.userId,
        }));
      }
      return json(req, res, 501, { error: 'Settings require PostgreSQL' });
    }
    if (req.method === 'GET' && path === '/reports/pos-orders') {
      const s = await auth(req);
      assertPermission(s.role, 'reports:read');
      const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
      const to = url.searchParams.get('to') ?? from;
      if (useDurable && readRepo) return json(req, res, 200, await readRepo.posOrderReport(from, to));
      return json(req, res, 200, store.salesReport?.(from, to) ?? {});
    }
    if (req.method === 'POST' && path.startsWith('/menu/items/') && path.endsWith('/archive')) {
      const s = await auth(req);
      assertPermission(s.role, 'menu:write');
      const id = path.split('/')[3];
      const body = await readBody(req);
      if (useDurable && catalogRepo) {
        return json(req, res, 200, await catalogRepo.setMenuItemActive({
          id,
          isActive: body.isActive !== false && body.archive !== true,
          userId: s.userId,
        }));
      }
      return json(req, res, 501, { error: 'Menu archive requires PostgreSQL' });
    }
    if (req.method === 'GET' && path.startsWith('/orders/') && !path.endsWith('/void') && !path.endsWith('/etims') && path.split('/').length === 3) {
      const s = await auth(req);
      assertPermission(s.role, 'orders:read');
      const id = path.split('/')[2];
      if (useDurable && readRepo) {
        const all = await readRepo.orders(500);
        const order = all.find((o: any) => o.id === id || o.orderNo === id);
        if (!order) return json(req, res, 404, { error: 'Order not found' });
        return json(req, res, 200, order);
      }
      return json(req, res, 404, { error: 'Order not found' });
    }
    if (req.method === 'POST' && path === '/products') {
      const s = await auth(req);
      assertPermission(s.role, 'products:write');
      const body = await readBody(req);
      if (useDurable && catalogRepo) {
        return json(req, res, 201, await catalogRepo.createProduct({ ...body, userId: s.userId }));
      }
      return json(req, res, 501, { error: 'Product create requires durable PostgreSQL' });
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
