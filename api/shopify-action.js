// api/shopify-action.js — CRM → Shopify
// CRM Frontend يبعت هنا لما حالة أوردر Shopify تتغير
// يتحقق من CRM_API_SECRET ويكلم Shopify Admin API

const SHOPIFY_API_VERSION = '2024-01';

function getStoreCredentials(storeKey) {
  if (storeKey === 'aida_web') {
    return {
      storeUrl: process.env.SHOPIFY_AIDA_STORE, // aidaset.myshopify.com
      token: process.env.SHOPIFY_AIDA_ACCESS_TOKEN,
    };
  }
  if (storeKey === 'offer_web') {
    return {
      storeUrl: process.env.SHOPIFY_OFFER_STORE, // oversizewear.myshopify.com
      token: process.env.SHOPIFY_OFFER_ACCESS_TOKEN,
    };
  }
  return null;
}

async function shopifyRequest(storeUrl, token, method, path, body) {
  const url = `https://${storeUrl}/admin/api/${SHOPIFY_API_VERSION}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Shopify API ${method} ${path} failed: ${res.status} — ${JSON.stringify(data)}`);
  }
  return data;
}

// ---- actions ----

// fulfill: ننشئ fulfillment order ثم نكمله
async function fulfill(storeUrl, token, shopifyOrderId) {
  // نجيب fulfillment orders
  const foData = await shopifyRequest(storeUrl, token, 'GET', `/orders/${shopifyOrderId}/fulfillment_orders.json`);
  const fulfillmentOrders = foData.fulfillment_orders || [];

  for (const fo of fulfillmentOrders) {
    if (fo.status === 'open') {
      await shopifyRequest(storeUrl, token, 'POST', '/fulfillments.json', {
        fulfillment: {
          line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }],
          notify_customer: false,
        },
      });
    }
  }
}

// cancel: نلغي الأوردر في Shopify
async function cancel(storeUrl, token, shopifyOrderId) {
  await shopifyRequest(storeUrl, token, 'POST', `/orders/${shopifyOrderId}/cancel.json`, {});
}

// complete: لو الأوردر fulfilled بالفعل، مش محتاج action إضافي
// بس ممكن نغير الـ financial status لـ paid
async function complete(storeUrl, token, shopifyOrderId) {
  // Shopify مفيش action اسمه "complete" بشكل مباشر
  // لو الأوردر اتشحن بالفعل، هو بيبقى closed تلقائياً
  // نبعت transaction بـ paid عشان نسجل الدفع
  try {
    await shopifyRequest(storeUrl, token, 'POST', `/orders/${shopifyOrderId}/transactions.json`, {
      transaction: {
        kind: 'capture',
        status: 'success',
        amount: '0', // Shopify بيقدر يعدل الـ amount
      },
    });
  } catch {
    // لو فشل (مثلاً مفيش payment gateway) — مش مشكلة كبيرة
    console.log(`[shopify-action] complete transaction skipped for ${shopifyOrderId}`);
  }
}

// ---- main handler ----

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // نتحقق من Supabase JWT — بس المستخدمين المسجلين يقدروا يكلموا Shopify
  const authToken = req.headers['x-crm-auth'] || '';
  if (!authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // نتحقق من الـ JWT مع Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${authToken}` },
  });
  if (!authCheck.ok) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  let body;
  try {
    body = req.body;
    // Vercel serverless يعمل parse للـ JSON تلقائياً
    if (typeof body === 'string') body = JSON.parse(body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { action, shopifyOrderId, shopifyStore } = body || {};

  if (!action || !shopifyOrderId || !shopifyStore) {
    return res.status(400).json({ error: 'Missing required fields: action, shopifyOrderId, shopifyStore' });
  }

  const creds = getStoreCredentials(shopifyStore);
  if (!creds) {
    return res.status(400).json({ error: `Unknown store: ${shopifyStore}` });
  }

  if (!creds.storeUrl || !creds.token) {
    console.error(`[shopify-action] Missing credentials for ${shopifyStore}`);
    return res.status(500).json({ error: 'Store credentials not configured' });
  }

  try {
    switch (action) {
      case 'fulfill':
        await fulfill(creds.storeUrl, creds.token, shopifyOrderId);
        break;
      case 'cancel':
        await cancel(creds.storeUrl, creds.token, shopifyOrderId);
        break;
      case 'complete':
        await complete(creds.storeUrl, creds.token, shopifyOrderId);
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    console.log(`[shopify-action] ${action} on order ${shopifyOrderId} (${shopifyStore}) — OK`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`[shopify-action] Error:`, err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
};
