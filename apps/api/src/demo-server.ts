/**
 * Lightweight HTTP demo API for Inari Kicchin blueprint workflows.
 * Production target remains NestJS + Prisma; this server exercises the domain store.
 */
import { createServer } from 'node:http';
import { seedDemoStore, type InariStore } from './domain/store.ts';
import {
  enablePhase4,
  addRecipeLine,
  applyRecipeDeduction,
  grossProfit,
  supplierAnalytics,
  enqueueOfflineOrder,
  syncOfflineQueue,
  buildEtimsReceipt,
  requestMpesaConfirmation,
  confirmMpesaStub,
  salesReportCsv,
  type Phase4State,
} from './domain/phase4.ts';

const store = seedDemoStore() as InariStore & Phase4State;
enablePhase4(store);

const PORT = Number(process.env.PORT ?? 4040);

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  try {
    if (req.method === 'GET' && path === '/health') {
      return json(res, 200, { ok: true, product: 'Inari Kicchin', blueprint: 'v1.0' });
    }
    if (req.method === 'GET' && path === '/dashboard') {
      return json(res, 200, store.dashboard());
    }
    if (req.method === 'GET' && path === '/suppliers') {
      return json(res, 200, store.suppliers);
    }
    if (req.method === 'GET' && path === '/products') {
      return json(res, 200, store.products);
    }
    if (req.method === 'GET' && path === '/makeline') {
      return json(res, 200, store.makelineProducts);
    }
    if (req.method === 'GET' && path === '/menu') {
      return json(res, 200, { categories: store.menuCategories, items: store.menuItems });
    }
    if (req.method === 'GET' && path === '/orders') {
      return json(res, 200, store.orders);
    }
    if (req.method === 'GET' && path === '/kitchen/tickets') {
      return json(res, 200, store.tickets);
    }
    if (req.method === 'GET' && path === '/closings') {
      return json(res, 200, store.closings);
    }
    if (req.method === 'GET' && path === '/audit') {
      return json(res, 200, store.audit);
    }
    if (req.method === 'GET' && path === '/reports/sales') {
      const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
      const to = url.searchParams.get('to') ?? from;
      return json(res, 200, store.salesReport(from, to));
    }
    if (req.method === 'GET' && path === '/meta') {
      return json(res, 200, {
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

    if (req.method === 'POST' && path === '/purchases') {
      const body = await readBody(req);
      const purchase = store.receiveStock(body);
      return json(res, 201, purchase);
    }
    if (req.method === 'POST' && path === '/makeline/production') {
      const body = await readBody(req);
      return json(res, 201, store.recordMakelineProduction(body));
    }
    if (req.method === 'POST' && path === '/wastage') {
      const body = await readBody(req);
      return json(res, 201, store.recordWastage(body));
    }
    if (req.method === 'POST' && path === '/closings') {
      const body = await readBody(req);
      return json(res, 201, store.submitClosing(body));
    }

    if (req.method === 'GET' && path === '/reports/suppliers') {
      const from = url.searchParams.get('from') ?? '2020-01-01';
      const to = url.searchParams.get('to') ?? '2099-12-31';
      return json(res, 200, supplierAnalytics(store, from, to));
    }
    if (req.method === 'GET' && path === '/reports/sales.csv') {
      const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
      const to = url.searchParams.get('to') ?? from;
      res.writeHead(200, { 'Content-Type': 'text/csv', 'Access-Control-Allow-Origin': '*' });
      res.end(salesReportCsv(store, from, to));
      return;
    }
    if (req.method === 'GET' && path === '/phase4/recipes') {
      return json(res, 200, store.recipeLines);
    }
    if (req.method === 'POST' && path === '/phase4/recipes') {
      const body = await readBody(req);
      return json(res, 201, addRecipeLine(store, body));
    }
    if (req.method === 'POST' && path === '/phase4/offline/enqueue') {
      const body = await readBody(req);
      return json(res, 201, enqueueOfflineOrder(store, body));
    }
    if (req.method === 'POST' && path === '/phase4/offline/sync') {
      return json(res, 200, syncOfflineQueue(store));
    }
    if (req.method === 'GET' && path.startsWith('/orders/') && path.endsWith('/etims')) {
      const id = path.split('/')[2];
      const order = store.orders.find(o => o.id === id);
      if (!order) return json(res, 404, { error: 'Order not found' });
      return json(res, 200, buildEtimsReceipt(store, order));
    }
    if (req.method === 'GET' && path.startsWith('/orders/') && path.endsWith('/food-cost')) {
      const id = path.split('/')[2];
      const order = store.orders.find(o => o.id === id);
      if (!order) return json(res, 404, { error: 'Order not found' });
      return json(res, 200, grossProfit(store, order));
    }
    if (req.method === 'POST' && path === '/phase4/mpesa/confirm') {
      const body = await readBody(req);
      return json(res, 201, requestMpesaConfirmation(store, body.orderId, body.code, body.amount));
    }
    if (req.method === 'POST' && path === '/phase4/mpesa/confirm/resolve') {
      const body = await readBody(req);
      return json(res, 200, confirmMpesaStub(store, body.id, Boolean(body.ok)));
    }
    if (req.method === 'POST' && path === '/pos/orders') {
      const body = await readBody(req);
      const result = store.createOrder(body);
      if (store.autoDeductRecipes) applyRecipeDeduction(store, result.order);
      return json(res, 201, result);
    }

    if (req.method === 'POST' && path.startsWith('/kitchen/tickets/') && path.endsWith('/status')) {
      const id = path.split('/')[3];
      const body = await readBody(req);
      return json(res, 200, store.updateTicketStatus(id, body.status, body.userId));
    }
    if (req.method === 'POST' && path.startsWith('/orders/') && path.endsWith('/void')) {
      const id = path.split('/')[2];
      const body = await readBody(req);
      return json(res, 200, store.voidOrder(id, body.reason, body.userId));
    }

    json(res, 404, { error: 'Not found', path });
  } catch (e) {
    json(res, 400, { error: e instanceof Error ? e.message : 'Error' });
  }
});

server.listen(PORT, () => {
  console.log(`Inari Kicchin demo API on http://localhost:${PORT}`);
});
