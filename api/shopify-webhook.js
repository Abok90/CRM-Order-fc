import crypto from 'crypto';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyHmac(rawBody, receivedHmac, secret) {
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  try {
    const a = Buffer.from(computed);
    const b = Buffer.from(receivedHmac);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getStore(shopDomain) {
  const d = (shopDomain || '').toLowerCase();
  const aidaEnv  = (process.env.SHOPIFY_AIDA_STORE  || '').toLowerCase();
  const offerEnv = (process.env.SHOPIFY_OFFER_STORE || '').toLowerCase();
  const veeEnv   = (process.env.SHOPIFY_VEE_STORE   || '').toLowerCase();

  console.log(`[getStore] domain="${d}" | aida_env="${aidaEnv}" | offer_env="${offerEnv}" | vee_env="${veeEnv}"`);

  if (aidaEnv && d === aidaEnv) {
    return { secret: process.env.SHOPIFY_AIDA_WEBHOOK_SECRET, storeKey: 'aida_web', pageName: 'عايدة ويب', url: shopDomain };
  }
  if (d.includes('aidaset') || d.includes('hfgnj')) {
    return { secret: process.env.SHOPIFY_AIDA_WEBHOOK_SECRET, storeKey: 'aida_web', pageName: 'عايدة ويب', url: shopDomain };
  }

  if (offerEnv && d === offerEnv) {
    return { secret: process.env.SHOPIFY_OFFER_WEBHOOK_SECRET, storeKey: 'offer_web', pageName: 'اوفر ويب', url: shopDomain };
  }
  // All known variants of the offer store domain
  if (d.includes('oversizewear') || d.includes('oversiza') || d.includes('oversize') || d.includes('febwqx-4i')) {
    return { secret: process.env.SHOPIFY_OFFER_WEBHOOK_SECRET, storeKey: 'offer_web', pageName: 'اوفر ويب', url: shopDomain };
  }

  if (veeEnv && d === veeEnv) {
    return { secret: process.env.SHOPIFY_VEE_WEBHOOK_SECRET, storeKey: 'vee_web', pageName: 'VEE', url: shopDomain };
  }
  if (d.includes('dvy00c-va') || d.includes('vee-9523') || d.includes('veeegypt')) {
    return { secret: process.env.SHOPIFY_VEE_WEBHOOK_SECRET, storeKey: 'vee_web', pageName: 'VEE', url: shopDomain };
  }

  console.warn(`[getStore] NO MATCH for domain: "${d}"`);
  return null;
}

// Decode the role from a JWT without verifying signature
function jwtRole(token) {
  try {
    return JSON.parse(Buffer.from((token || '').split('.')[1], 'base64url').toString()).role || 'unknown';
  } catch { return 'invalid'; }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Supabase occasionally answers 504/503 for a second or two. A webhook delivery
// that hits one of those windows used to lose the order for good, so retry the
// blip here before falling back to Shopify's own redelivery.
const TRANSIENT_STATUSES = [408, 425, 429, 500, 502, 503, 504];
const RETRY_DELAYS_MS = [400, 1500, 4000];

async function supabaseRequest(method, path, body, prefer = 'return=minimal') {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.SUPABASE_URL;
  console.log(`[supabase] url=${url ? 'SET' : 'MISSING'} key_role=${jwtRole(key)}`);

  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      console.warn(`[supabase] retry ${attempt}/${RETRY_DELAYS_MS.length} for ${method} ${path.split('?')[0]} — ${lastError.message}`);
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
    }

    let res;
    try {
      res = await fetch(`${url}/rest/v1/${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          apikey: key,
          Authorization: `Bearer ${key}`,
          Prefer: prefer,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      // Network-level failure — always worth retrying.
      lastError = new Error(`Supabase ${method} failed: ${err.message}`);
      continue;
    }

    if (res.ok) {
      return res.headers.get('content-type')?.includes('json') ? res.json() : null;
    }

    const text = await res.text();
    lastError = new Error(`Supabase ${method} failed: ${res.status} — ${text}`);
    lastError.status = res.status;

    // A 4xx (bad payload, missing column, ...) will fail the same way forever.
    if (!TRANSIENT_STATUSES.includes(res.status)) break;
  }

  throw lastError;
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await readRawBody(req).catch(() => null);
  if (!rawBody) return res.status(400).json({ error: 'Failed to read body' });

  const shopDomain = req.headers['x-shopify-shop-domain'] || '';
  const receivedHmac = req.headers['x-shopify-hmac-sha256'] || '';
  const topic = req.headers['x-shopify-topic'] || '';

  console.log(`[webhook] topic=${topic} shop=${shopDomain} bytes=${rawBody.length}`);

  const store = getStore(shopDomain);
  if (!store) {
    console.warn(`[webhook] Unknown domain — ignoring: ${shopDomain}`);
    return res.status(200).json({ ok: true, ignored: true });
  }

  if (!store.secret) {
    // 500 so the delivery is retried and Shopify surfaces the failing endpoint,
    // instead of quietly dropping every order from this store.
    console.error(`[webhook] Missing WEBHOOK_SECRET for ${store.storeKey} — set env var in Vercel`);
    return res.status(500).json({ ok: false, error: 'Server misconfigured — missing secret' });
  }

  if (!verifyHmac(rawBody, receivedHmac, store.secret)) {
    console.warn(`[webhook] HMAC failed for ${shopDomain} (storeKey=${store.storeKey})`);
    return res.status(401).json({ error: 'Invalid HMAC' });
  }

  console.log(`[webhook] HMAC OK for ${store.storeKey} — processing topic=${topic}`);

  let order;
  try { order = JSON.parse(rawBody.toString('utf8')); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  // Validate order.id is a safe numeric value before using in DB filters
  const safeOrderId = order && /^\d+$/.test(String(order.id)) ? String(order.id) : null;

  try {
    if (topic === 'orders/create') {
      const b = order.billing_address || {};
      const s = order.shipping_address || {};
      const items = order.line_items || [];
      const totalQty = items.reduce((sum, it) => sum + (it.quantity || 1), 0);
      const itemStr = items.map(it => {
        const name = it.variant_title ? `${it.title} - ${it.variant_title}` : it.title;
        return it.quantity > 1 ? `${name} (${it.quantity})` : name;
      }).join(' + ');
      // روابط المنتجات من Shopify — لكل منتج في الأوردر
      const productUrls = items.map(it => {
        const handle = it.handle || it.product_handle;
        if (handle) return `https://${store.url}/products/${handle}`;
        if (it.product_id) return `https://${store.url}/admin/products/${it.product_id}`;
        return null;
      }).filter(Boolean);
      const totalShipping = parseFloat(
        order.total_shipping_price_set?.shop_money?.amount ||
        (order.shipping_lines || []).reduce((sum, sl) => sum + parseFloat(sl.price || 0), 0) ||
        0
      );

      // استخراج المحافظة من بيانات شوبيفاي
      const governorate = s.province || s.city || b.province || b.city || '';

      await supabaseRequest('POST', 'orders', {
        id: order.name || `#${order.order_number}` || `SH-${Date.now().toString(36).toUpperCase()}`,
        customer: b.name || s.name || `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'عميل Shopify',
        phone: order.phone || b.phone || s.phone || '',
        address: s.address1 || b.address1 || '',
        governorate: governorate,
        item: itemStr || 'منتج Shopify',
        quantity: totalQty,
        productPrice: parseFloat(order.subtotal_price || 0),
        shippingPrice: totalShipping,
        notes: order.note || '',
        status: 'جاري التحضير',
        page: store.pageName,
        shopify_order_id: order.id,
        shopify_store: store.storeKey,
        source: 'shopify',
        date: new Date().toISOString().split('T')[0],
        product_urls: productUrls.length > 0 ? JSON.stringify(productUrls) : null,
        user_id: null,
      }, 'return=minimal,resolution=ignore-duplicates');
      console.log(`[webhook] Inserted order ${order.name} (${store.storeKey})`);

    } else if (topic === 'orders/cancelled') {
      if (!safeOrderId) { console.warn('[webhook] Skipping cancelled — invalid order.id'); return res.status(400).json({ error: 'Invalid order ID' }); }
      await supabaseRequest('PATCH', `orders?shopify_order_id=eq.${safeOrderId}&shopify_store=eq.${store.storeKey}`, { status: 'الغاء' });
      console.log(`[webhook] Cancelled order ${safeOrderId}`);

    } else if (topic === 'orders/fulfilled') {
      // الأوردر اتشحن في شوبيفاي → غيّر الحالة لـ "الشحن"
      if (!safeOrderId) { console.warn('[webhook] Skipping fulfilled — invalid order.id'); return res.status(400).json({ error: 'Invalid order ID' }); }
      const trackingNum = order.fulfillments?.[0]?.tracking_number || '';
      const update = { status: 'الشحن' };
      if (trackingNum) update.trackingNumber = trackingNum;
      await supabaseRequest('PATCH', `orders?shopify_order_id=eq.${safeOrderId}&shopify_store=eq.${store.storeKey}`, update);
      console.log(`[webhook] Fulfilled order ${safeOrderId} tracking=${trackingNum}`);

    } else if (topic === 'orders/updated') {
      // تعديل في شوبيفاي → حدّث البيانات الأساسية في السيستم
      const s = order.shipping_address || order.billing_address || {};
      const contact = {};
      if (s.name)     contact.customer = s.name;
      if (s.phone || order.phone) contact.phone = order.phone || s.phone;
      if (s.address1) contact.address = s.address1;
      if (order.note !== undefined) contact.notes = order.note || '';

      if (!safeOrderId) {
        console.warn('[webhook] Skipping updated — invalid order.id');
      } else {
        const base = `orders?shopify_order_id=eq.${safeOrderId}&shopify_store=eq.${store.storeKey}`;

        // Contact details: only write them onto orders nobody has touched in the
        // CRM (updated_by IS NULL). Shopify fires orders/updated for all sorts of
        // reasons (tags, notes, fulfillment), and it used to overwrite a phone or
        // an address that staff had just corrected by hand.
        if (Object.keys(contact).length > 0) {
          // return=representation so the log says whether a row actually matched
          // — a PATCH that matches nothing succeeds silently, which is exactly
          // what made the lost-order case hard to spot.
          const rows = await supabaseRequest('PATCH', `${base}&updated_by=is.null`, contact, 'return=representation');
          const matched = Array.isArray(rows) ? rows.length : 0;
          console.log(`[webhook] orders/updated ${safeOrderId} → ${matched} row(s) matched, fields=${Object.keys(contact).join(',')}`);
          if (matched === 0) {
            console.warn(`[webhook] No CRM row for Shopify order ${safeOrderId} (${store.storeKey}) — either edited by staff already, or never created.`);
          }
        }

        // Cancellation is authoritative and always applies.
        if (order.cancelled_at) {
          await supabaseRequest('PATCH', base, { status: 'الغاء' });
          console.log(`[webhook] Order ${safeOrderId} cancelled in Shopify → الغاء`);
        }
      }

    } else {
      console.log(`[webhook] Ignored topic: ${topic}`);
    }
  } catch (err) {
    // Answer 500, NOT 200. Shopify only redelivers a webhook when the endpoint
    // reports failure; returning 200 here told it the order had been stored and
    // the delivery was never repeated, so a momentary database error dropped the
    // order permanently. Shopify now retries this delivery for ~48 hours, and
    // orders/create is insert-if-absent so a retry cannot duplicate anything.
    console.error(`[webhook] Error processing ${topic} for ${shopDomain}: ${err.message} — returning 500 so Shopify retries`);
    return res.status(500).json({ ok: false, error: err.message });
  }

  return res.status(200).json({ ok: true });
}

export default handler;
export const config = { api: { bodyParser: false } };
