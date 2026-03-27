// CRM Pro Service Worker — v1
const CACHE_NAME = 'crm-pro-v1';
const STATIC_ASSETS = ['/'];

// تثبيت: خزّن الصفحة الرئيسية في الكاش
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// تفعيل: امسح الكاشات القديمة
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// طلبات الشبكة
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Supabase و APIs — دايماً من الشبكة (بيانات لازم تكون fresh)
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) {
    return;
  }

  // الصفحة الرئيسية — Stale-While-Revalidate
  // بيرجع من الكاش فوراً وبيحدّث في الخلفية
  if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match('/');
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) cache.put('/', response.clone());
          return response;
        }).catch(() => cached);

        // لو في كاش: ارجعه فوراً وحدّث في الخلفية
        // لو مفيش كاش: استنى الشبكة
        return cached || fetchPromise;
      })
    );
    return;
  }

  // باقي الملفات الثابتة (CSS, JS, fonts) — من الكاش لو موجود
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
