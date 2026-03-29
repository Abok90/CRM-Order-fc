const SHOPIFY_API_VERSION = '2024-01';

// كاش التوكن في الذاكرة — يصلح لنفس الـ warm instance
const tokenCache = {};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getStore(storeKey) {
  if (storeKey === 'aida_web')  return { url: process.env.SHOPIFY_AIDA_STORE,  clientId: process.env.SHOPIFY_AIDA_CLIENT_ID,  clientSecret: process.env.SHOPIFY_AIDA_CLIENT_SECRET };
  if (storeKey === 'offer_web') return { url: process.env.SHOPIFY_OFFER_STORE, clientId: process.env.SHOPIFY_OFFER_CLIENT_ID, clientSecret: process.env.SHOPIFY_OFFER_CLIENT_SECRET };
  return null;
}

// جلب أو تجديد التوكن تلقائياً (صالح 24 ساعة)
async function getToken(storeUrl, clientId, clientSecret) {
  const now = Date.now();
  const cached = tokenCache[storeUrl];
  if (cached && cached.expiresAt > now + 60000) return cached.token;

  const res = await fetch(`https://${storeUrl}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`Shopify token fetch failed: ${res.status} — ${await res.text()}`);
  const data = await res.json();
  tokenCache[storeUrl] = { token: data.access_token, expiresAt: now + (data.expires_in || 86400) * 1000 };
  return data.access_token;
}

async function shopify(storeUrl, token, method, path, body) {
  const res = await fetch(`https://${storeUrl}/admin/api/${SHOPIFY_API_VERSION}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Shopify ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function fulfill(url, token, orderId) {
  const { fulfillment_orders = [] } = await shopify(url, token, 'GET', `/orders/${orderId}/fulfillment_orders.json`);
  for (const fo of fulfillment_orders) {
    if (fo.status === 'open') {
      await shopify(url, token, 'POST', '/fulfillments.json', {
        fulfillment: { line_items_by_fulfillment_order: [{ fulfillment_order_id: fo.id }], notify_customer: false },
      });
    }
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const authToken = req.headers['x-crm-auth'] || '';
  if (!authToken) return res.status(401).json({ error: 'Unauthorized' });

  const authRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${authToken}` },
  });
  if (!authRes.ok) return res.status(401).json({ error: 'Invalid session' });

  let body;
  try {
    const raw = await readRawBody(req);
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { action, shopifyOrderId, shopifyStore } = body || {};
  if (!action || !shopifyOrderId || !shopifyStore) {
    return res.status(400).json({ error: 'Missing: action, shopifyOrderId, shopifyStore' });
  }

  const store = getStore(shopifyStore);
  if (!store || !store.url || !store.clientId || !store.clientSecret) {
    return res.status(400).json({ error: `Unknown or unconfigured store: ${shopifyStore}` });
  }

  let token;
  try {
    token = await getToken(store.url, store.clientId, store.clientSecret);
  } catch (err) {
    console.error(`[action] Token error: ${err.message}`);
    return res.status(200).json({ ok: false, error: `Token error: ${err.message}` });
  }

  try {
    if (action === 'fulfill') {
      await fulfill(store.url, token, shopifyOrderId);
    } else if (action === 'cancel') {
      await shopify(store.url, token, 'POST', `/orders/${shopifyOrderId}/cancel.json`, {});
    } else if (action === 'complete') {
      // Shopify يغلق الأوردر تلقائياً بعد الشحن — مش محتاج action
    } else if (action === 'update') {
      const updateData = {};
      if (body.note !== undefined) updateData.note = body.note;
      if (body.status) updateData.tags = `crm-status:${body.status}`;
      await shopify(store.url, token, 'PUT', `/orders/${shopifyOrderId}.json`, { order: updateData });
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }
    console.log(`[action] ${action} on ${shopifyOrderId} (${shopifyStore}) OK`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`[action] Error: ${err.message}`);
    return res.status(200).json({ ok: false, error: err.message });
  }
}

module.exports = handler;
