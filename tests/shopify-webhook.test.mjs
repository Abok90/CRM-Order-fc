// Regression test for the order-loss bug found on 2026-09-13.
//
// VEE order #4759 arrived at Shopify, the webhook fired, Supabase answered 504
// Gateway Timeout, and the handler replied 200 OK. Shopify treats 200 as
// "delivered" and never retries, so the order was gone for good and had to be
// entered by hand.
//
// Run with:  npm test
import crypto from 'crypto';
import { Readable } from 'stream';

process.env.SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'x.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.y';
process.env.SHOPIFY_VEE_STORE = 'dvy00c-va.myshopify.com';
process.env.SHOPIFY_VEE_WEBHOOK_SECRET = 'test-secret';

const { default: handler } = await import('../api/shopify-webhook.js');

const ORDER = JSON.stringify({
  id: 10903183786276, name: '#4759', subtotal_price: '900.00',
  shipping_address: { name: 'VEE Customer', phone: '01111111111', address1: 'شارع 1', province: 'القاهرة' },
  line_items: [{ title: 'Hoodie', quantity: 1, handle: 'hoodie' }],
});

function makeReq(body) {
  const req = Readable.from([Buffer.from(body)]);
  req.method = 'POST';
  req.headers = {
    'x-shopify-shop-domain': 'dvy00c-va.myshopify.com',
    'x-shopify-topic': 'orders/create',
    'x-shopify-hmac-sha256': crypto.createHmac('sha256', 'test-secret').update(Buffer.from(body)).digest('base64'),
  };
  return req;
}
function makeRes() {
  const res = { code: null, body: null };
  res.status = (c) => { res.code = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}
const reply = (status, body = '{}') =>
  new Response(body, { status, headers: { 'content-type': 'application/json' } });

const results = [];
const check = (name, cond) => { results.push([name, cond]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

// ── 1. The exact failure from the log: Supabase 504 on every attempt ──────────
let calls = 0;
globalThis.fetch = async () => { calls++; return reply(504, '{"message":"Gateway Timeout"}'); };
let res = makeRes();
let t0 = Date.now();
await handler(makeReq(ORDER), res);
check('persistent 504 → retried (was 1 attempt)', calls === 4);
check('persistent 504 → replies 500 so Shopify retries (was 200)', res.code === 500);

// ── 2. A brief blip: first call 504, retry succeeds ──────────────────────────
calls = 0;
globalThis.fetch = async () => { calls++; return calls === 1 ? reply(504) : reply(201, '[]'); };
res = makeRes();
await handler(makeReq(ORDER), res);
check('transient 504 → recovers without Shopify retry', calls === 2 && res.code === 200 && res.body.ok === true);

// ── 3. A permanent 4xx must not be retried in a loop ─────────────────────────
calls = 0;
globalThis.fetch = async () => { calls++; return reply(400, '{"message":"bad column"}'); };
res = makeRes();
await handler(makeReq(ORDER), res);
check('permanent 400 → fails fast, no retry storm', calls === 1 && res.code === 500);

// ── 4. Happy path unchanged ──────────────────────────────────────────────────
calls = 0;
globalThis.fetch = async () => { calls++; return reply(201, '[]'); };
res = makeRes();
await handler(makeReq(ORDER), res);
check('normal delivery still 200 with one call', calls === 1 && res.code === 200);

// ── 5. A forged HMAC is still rejected ───────────────────────────────────────
const bad = makeReq(ORDER);
bad.headers['x-shopify-hmac-sha256'] = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
res = makeRes();
await handler(bad, res);
check('bad HMAC still rejected with 401', res.code === 401);

const failed = results.filter(([, ok]) => !ok);
console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
process.exit(failed.length ? 1 : 0);
