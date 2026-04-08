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

  if (d === aidaEnv || d.includes('aidaset') || d.includes('hfgnj')) {
    return { secret: process.env.SHOPIFY_AIDA_WEBHOOK_SECRET, storeKey: 'aida_web', pageName: 'عايدة ويب', url: shopDomain };
  }
  if (d === offerEnv || d.includes('oversizewear') || d.includes('febwqx-4i')) {
    return { secret: process.env.SHOPIFY_OFFER_WEBHOOK_SECRET, storeKey: 'offer_web', pageName: 'اوفر ويب', url: shopDomain };
  }
  if (d === veeEnv || d.includes('dvy00c-va') || d.includes('vee-9523') || d.includes('veeegypt')) {
    return { secret: process.env.SHOPIFY_VEE_WEBHOOK_SECRET, storeKey: 'vee_web', pageName: 'VEE', url: shopDomain };
  }
  return null;
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
    console.warn(`[webhook] Unknown domain: ${shopDomain}`);
    return res.status(200).json({ ok: true });
  }

  if (!store.secret) {
    console.error(`[webhook] Missing secret for ${store.storeKey}`);
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  if (!verifyHmac(rawBody, receivedHmac, store.secret)) {
    console.warn(`[webhook] HMAC failed for ${shopDomain}`);
    return res.status(401).json({ error: 'Invalid HMAC' });
  }

  let order;
  try { order = JSON.parse(rawBody.toString('utf8')); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

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

      await supabaseRequest('POST', 'orders', {
        id: order.name || `#${order.order_number}` || `SH-${Date.now().toString(36).toUpperCase()}`,
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
        shopify_store: store.storeKey,
        source: 'shopify',
        date: new Date().toISOString().split('T')[0],
        product_urls: productUrls.length > 0 ? JSON.stringify(productUrls) : null,
        user_id: null,
      }, 'return=minimal,resolution=ignore-duplicates');
      console.log(`[webhook] Inserted order ${order.name} (${store.storeKey})`);

    } else if (topic === 'orders/cancelled') {
      await supabaseRequest('PATCH', `orders?shopify_order_id=eq.${order.id}&shopify_store=eq.${store.storeKey}`, { status: 'الغاء' });
      console.log(`[webhook] Cancelled order ${order.id}`);

    } else if (topic === 'orders/fulfilled') {
      // الأوردر اتشحن في شوبيفاي → غيّر الحالة لـ "الشحن"
      const trackingNum = order.fulfillments?.[0]?.tracking_number || '';
      const update = { status: 'الشحن' };
      if (trackingNum) update.trackingNumber = trackingNum;
      await supabaseRequest('PATCH', `orders?shopify_order_id=eq.${order.id}&shopify_store=eq.${store.storeKey}`, update);
      console.log(`[webhook] Fulfilled order ${order.id} tracking=${trackingNum}`);

    } else if (topic === 'orders/updated') {
      // تعديل في شوبيفاي → حدّث البيانات الأساسية في السيستم
      const s = order.shipping_address || order.billing_address || {};
      const update = {};
      if (s.name)     update.customer = s.name;
      if (s.phone || order.phone) update.phone = order.phone || s.phone;
      if (s.address1) update.address = s.address1;
      if (order.note !== undefined) update.notes = order.note || '';
      // لو اتلغى من شوبيفاي
      if (order.cancelled_at) update.status = 'الغاء';
      // تحقق إن في حاجة تتحدث
      if (Object.keys(update).length === 0) {
        console.log(`[webhook] Updated order ${order.id} — no relevant changes`);
      } else {
        await supabaseRequest('PATCH', `orders?shopify_order_id=eq.${order.id}&shopify_store=eq.${store.storeKey}`, update);
        console.log(`[webhook] Updated order ${order.id} fields=${Object.keys(update).join(',')}`);
      }

    } else {
      console.log(`[webhook] Ignored topic: ${topic}`);
    }
  } catch (err) {
    console.error(`[webhook] Error processing ${topic} for ${shopDomain}: ${err.message}`);
    return res.status(200).json({ ok: false, error: err.message });
  }

  return res.status(200).json({ ok: true });
}

export default handler;
export const config = { api: { bodyParser: false } };
