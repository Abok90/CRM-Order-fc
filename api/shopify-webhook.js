// api/shopify-webhook.js — Shopify → CRM Aida FC
// يستقبل orders/create و orders/cancelled من Shopify
// يتحقق من HMAC ويدخل الأوردر في Supabase

const crypto = require('crypto');

// ---- helpers ----

function verifyHmac(rawBody, receivedHmac, secret) {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
  try {
    const a = Buffer.from(computed);
    const b = Buffer.from(receivedHmac);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getStoreConfig(shopDomain) {
  // ندعم custom domains و myshopify.com
  const d = (shopDomain || '').toLowerCase();
  if (d.includes('aidaset') || d.includes('hfgnj-h0') || d === (process.env.SHOPIFY_AIDA_STORE || '').toLowerCase()) {
    return {
      secret: process.env.SHOPIFY_AIDA_WEBHOOK_SECRET,
      storeKey: 'aida_web',
      pageName: 'عايدة ويب',
    };
  }
  if (d.includes('oversizewear') || d === (process.env.SHOPIFY_OFFER_STORE || '').toLowerCase()) {
    return {
      secret: process.env.SHOPIFY_OFFER_WEBHOOK_SECRET,
      storeKey: 'offer_web',
      pageName: 'اوفر ويب',
    };
  }
  return null;
}

function mapShopifyToCRM(order, storeConfig) {
  const billing = order.billing_address || {};
  const shipping = order.shipping_address || {};
  const firstItem = (order.line_items || [])[0] || {};
  const firstShipping = (order.shipping_lines || [])[0] || {};

  return {
    customer: billing.name || shipping.name || ((order.customer?.first_name || '') + ' ' + (order.customer?.last_name || '')).trim() || 'عميل Shopify',
    phone: order.phone || billing.phone || shipping.phone || '',
    address: shipping.address1 || billing.address1 || '',
    item: firstItem.title || '',
    quantity: firstItem.quantity || 1,
    productPrice: parseFloat(order.subtotal_price || 0),
    shippingPrice: parseFloat(firstShipping.price || 0),
    notes: order.note || '',
    status: 'جاري التحضير',
    page: storeConfig.pageName,
    shopify_order_id: order.id,
    shopify_store: storeConfig.storeKey,
    source: 'shopify',
    date: new Date().toLocaleDateString('ar-EG'),
  };
}

// ---- Supabase insert ----

async function insertOrder(orderData) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/orders`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(orderData),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} — ${text}`);
  }
}

async function cancelOrderByShopifyId(shopifyOrderId, storeKey) {
  // نجيب الأوردر ونغير حالته لـ "الغاء"
  const url = `${process.env.SUPABASE_URL}/rest/v1/orders?shopify_order_id=eq.${shopifyOrderId}&shopify_store=eq.${storeKey}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ status: 'الغاء' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase cancel failed: ${res.status} — ${text}`);
  }
}

// ---- main handler ----

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // نقرأ الـ body الخام قبل أي parse
  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch {
    return res.status(400).json({ error: 'Failed to read body' });
  }

  const shopDomain = req.headers['x-shopify-shop-domain'] || '';
  const receivedHmac = req.headers['x-shopify-hmac-sha256'] || '';
  const topic = req.headers['x-shopify-topic'] || '';

  console.log(`[shopify-webhook] topic=${topic} shop=${shopDomain} bodyLen=${rawBody.length}`);

  // نحدد المتجر
  const storeConfig = getStoreConfig(shopDomain);
  if (!storeConfig) {
    console.warn(`[shopify-webhook] Unknown shop domain: ${shopDomain}`);
    return res.status(200).json({ ok: true, note: 'unknown store, ignored' });
  }

  // نتحقق من HMAC
  if (!storeConfig.secret) {
    console.error('[shopify-webhook] Missing webhook secret env var for', storeConfig.storeKey);
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const valid = verifyHmac(rawBody, receivedHmac, storeConfig.secret);
  if (!valid) {
    console.warn(`[shopify-webhook] Invalid HMAC for ${shopDomain} — secret starts with: ${storeConfig.secret.substring(0,8)}`);
    return res.status(401).json({ error: 'Invalid HMAC' });
  }

  let order;
  try {
    order = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  try {
    if (topic === 'orders/create') {
      const crmOrder = mapShopifyToCRM(order, storeConfig);
      await insertOrder(crmOrder);
      console.log(`[shopify-webhook] Created order ${order.id} for ${storeConfig.storeKey}`);
    } else if (topic === 'orders/cancelled') {
      await cancelOrderByShopifyId(order.id, storeConfig.storeKey);
      console.log(`[shopify-webhook] Cancelled order ${order.id} for ${storeConfig.storeKey}`);
    } else {
      // topics تانية (orders/updated etc.) — نتجاهلها بهدوء
      console.log(`[shopify-webhook] Ignored topic: ${topic}`);
    }
  } catch (err) {
    console.error('[shopify-webhook] Error:', err.message);
    // Shopify بيعيد المحاولة لو جبنا 5xx — نرجع 200 عشان ميعيدش لأوردرات مكررة
    // ماعدا errors مشكلتها في الـ body (4xx)
    return res.status(200).json({ ok: false, error: err.message });
  }

  return res.status(200).json({ ok: true });
};

// مهم جداً — بيمنع Vercel من عمل parse للـ body
// عشان نقدر نقرأ الـ raw bytes للـ HMAC verification
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
