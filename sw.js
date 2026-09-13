// CRM Pro Service Worker — v4
const CACHE_NAME = 'crm-pro-v6';
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

  // الصفحة الرئيسية — Network-First
  //
  // كانت Stale-While-Revalidate: بترجّع الـ HTML المخزَّن على طول وتحدّث في
  // الخلفية. المشكلة إن الـ HTML هو اللي فيه أسامي ملفات الـ JS، فبعد أي
  // نشر جديد أول فتحة كانت بتفضل شغّالة على النسخة القديمة والابديت
  // مبيبانش غير في الفتحة اللي بعدها.
  //
  // دلوقتي بنجيب من الشبكة الأول ونرجع للكاش لو مفيش نت — يعني الابديت
  // يظهر من أول فتحة، والتطبيق لسه بيفتح أوفلاين.
  if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response.ok) cache.put('/', response.clone());
          return response;
        } catch {
          const cached = await cache.match('/');
          if (cached) return cached;
          throw new Error('offline and nothing cached');
        }
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
