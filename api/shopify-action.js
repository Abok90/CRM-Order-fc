const SHOPIFY_API_VERSION = '2026-04';
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
  if (storeKey === 'aida_web')  return { url: process.env.SHOPIFY_AIDA_STORE,  clientId: process.env.SHOPIFY_AIDA_CLIENT_ID,  clientSecret: process.env.SHOPIFY_AIDA_CLIENT_SECRET,  pageName: 'عايدة ويب' };
  if (storeKey === 'offer_web') return { url: process.env.SHOPIFY_OFFER_STORE, clientId: process.env.SHOPIFY_OFFER_CLIENT_ID, clientSecret: process.env.SHOPIFY_OFFER_CLIENT_SECRET, pageName: 'اوفر ويب'  };
  if (storeKey === 'vee_web')   return { url: process.env.SHOPIFY_VEE_STORE,   clientId: process.env.SHOPIFY_VEE_CLIENT_ID,   clientSecret: process.env.SHOPIFY_VEE_CLIENT_SECRET,   pageName: 'VEE'       };
  return null;
}

async function getToken(storeUrl, clientId, clientSecret) {
  const now = Date.now();
  const cached = tokenCache[storeUrl];
  if (cached && cached.expiresAt > now + 60000) return cached.token;
  const res = await fetch(`https://${storeUrl}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
  });
  if (!res.ok) throw new Error(`Shopify token failed: ${res.status} — ${await res.text()}`);
  const data = await res.json();
  tokenCache[storeUrl] = { token: data.access_token, expiresAt: now + (data.expires_in || 86400) * 1000 };
  return data.access_token;
}

async function shopifyApi(storeUrl, token, method, path, body) {
  const res = await fetch(`https://${storeUrl}/admin/api/${SHOPIFY_API_VERSION}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Shopify ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function supabaseRequest(method, path, body, prefer = 'return=minimal') {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${method} failed: ${res.status} — ${await res.text()}`);
  return res.headers.get('content-type')?.includes('json') ? res.json() : null;
}

async function fulfill(url, token, orderId) {
  const { fulfillment_orders = [] } = await shopifyApi(url, token, 'GET', `/orders/${orderId}/fulfillment_orders.json`);
  for (const fo of fulfillment_orders) {
    if (fo.status === 'open') {
      await shopifyApi(url, token, 'POST', '/fulfillments.json', {
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
  if (!action || !shopifyStore) {
    return res.status(400).json({ error: 'Missing: action, shopifyStore' });
  }
  // Validate shopifyOrderId is a safe numeric string to prevent path traversal
  if (shopifyOrderId !== undefined && !/^\d+$/.test(String(shopifyOrderId))) {
    return res.status(400).json({ error: 'Invalid shopifyOrderId' });
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
    // ===== جلب أوردر من شوبيفاي بالرقم وإضافته للسيستم =====
    if (action === 'fetch_order') {
      const rawName = (body.orderName || '').toString().trim();
      if (!rawName) return res.status(400).json({ error: 'Missing orderName' });
      const orderName = rawName.startsWith('#') ? rawName : `#${rawName}`;

      const result = await shopifyApi(store.url, token, 'GET', `/orders.json?name=${encodeURIComponent(orderName)}&status=any`);
      const shopifyOrders = result.orders || [];
      if (shopifyOrders.length === 0) {
        return res.status(200).json({ ok: false, error: `الأوردر ${orderName} مش موجود في شوبيفاي` });
      }

      const order = shopifyOrders[0];
      const b = order.billing_address || {};
      const s = order.shipping_address || {};
      const items = order.line_items || [];
      const totalQty = items.reduce((sum, it) => sum + (it.quantity || 1), 0);
      const itemStr = items.map(it => {
        const name = it.variant_title ? `${it.title} - ${it.variant_title}` : it.title;
        return it.quantity > 1 ? `${name} (${it.quantity})` : name;
      }).join(' + ');
      const totalShipping = parseFloat(
        order.total_shipping_price_set?.shop_money?.amount ||
        (order.shipping_lines || []).reduce((sum, sl) => sum + parseFloat(sl.price || 0), 0) ||
        0
      );

      await supabaseRequest('POST', 'orders', {
        id: order.name,
        customer: b.name || s.name || `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'عميل Shopify',
        phone: order.phone || b.phone || s.phone || '',
        address: s.address1 || b.address1 || '',
        item: itemStr || 'منتج Shopify',
        quantity: totalQty,
        productPrice: parseFloat(order.subtotal_price || 0),
        shippingPrice: totalShipping,
        notes: order.note || '',
        status: 'جاري التحضير',
        page: store.pageName,
        shopify_order_id: order.id,
        shopify_store: shopifyStore,
        source: 'shopify',
        date: new Date().toISOString().split('T')[0],
        user_id: null,
      }, 'return=minimal,resolution=merge-duplicates');

      console.log(`[action] fetch_order ${orderName} (${shopifyStore}) → OK`);
      return res.status(200).json({
        ok: true,
        order: { id: order.name, customer: b.name || s.name || '', page: store.pageName }
      });

    } else if (action === 'fulfill') {
      if (!shopifyOrderId) return res.status(400).json({ error: 'Missing shopifyOrderId' });
      await fulfill(store.url, token, shopifyOrderId);

    } else if (action === 'cancel') {
      if (!shopifyOrderId) return res.status(400).json({ error: 'Missing shopifyOrderId' });
      await shopifyApi(store.url, token, 'POST', `/orders/${shopifyOrderId}/cancel.json`, {});

    } else if (action === 'update') {
      if (!shopifyOrderId) return res.status(400).json({ error: 'Missing shopifyOrderId' });
      const updateData = {};
      if (body.note !== undefined) updateData.note = body.note;
      if (body.status) updateData.tags = `crm-status:${body.status}`;
      if (body.customer || body.phone || body.address) {
        updateData.shipping_address = {};
        if (body.customer) updateData.shipping_address.name = body.customer;
        if (body.phone)    updateData.shipping_address.phone = body.phone;
        if (body.address)  updateData.shipping_address.address1 = body.address;
      }
      await shopifyApi(store.url, token, 'PUT', `/orders/${shopifyOrderId}.json`, { order: updateData });

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

export default handler;
