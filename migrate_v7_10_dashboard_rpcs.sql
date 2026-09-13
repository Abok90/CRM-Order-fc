-- ============================================================================
--  v7.10 — دوال جديدة للداشبورد وصفحة الموظفين
-- ============================================================================
--  ⚠️ الدوال دي **متطبّقة فعلاً** على قاعدة البيانات. الملف ده نسخة محفوظة
--     في الريبو عشان تفضل موجودة لو احتجت ترجّعها أو تشغّلها على قاعدة تانية.
--
--  اللي فيه:
--    1) إصلاح تواريخ قديمة غلط + إعادة كتابة get_monthly_revenue()
--    2) get_daily_workload()  — أرقام "شغل النهاردة" في الداشبورد
--    3) get_user_activity()   — أوردرات كل موظف وآخر نشاط له
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) الإيرادات
--    كانت الداشبورد بتعرض ٣٫٣ مليون بدل ٩٫٩ مليون لسببين:
--      • الدالة كانت فيها LIMIT 6 فبتقطع باقي الشهور.
--      • ٥٤ أوردر كان عمود date بتاعهم غلط (٣٧ بـ 1970-01-01 و١٧ بأرقام
--        عربية زي ٢٩‏/٣‏/٢٠٢٦)، فكانوا بيتصنّفوا في شهور وهمية وياخدوا
--        مكان شهور حقيقية.
--    عمود date مش متتبَّع في trigger التاريخ، فتصليحه مبيسيبش أثر في
--    order_history.
--    ملاحظة: الدالة بتحسب الأوردرات اللي حالتها 'تم' بس — يعني فلوس اتحصّلت
--    فعلاً، مش كل الأوردرات.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.orders
SET date = created_at::date::text
WHERE date IS NULL
   OR date = '1970-01-01'
   OR date !~ '^\d{4}-\d{2}-\d{2}$';

CREATE OR REPLACE FUNCTION public.get_monthly_revenue()
RETURNS TABLE (month_key text, total_revenue numeric, order_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    to_char(
      CASE
        WHEN date ~ '^\d{4}-\d{2}-\d{2}$' AND date <> '1970-01-01'
        THEN date::date
        ELSE created_at::date
      END, 'YYYY-MM')                                            AS month_key,
    SUM(
      COALESCE(NULLIF("productPrice"::text,'')::numeric, 0) +
      COALESCE(NULLIF("shippingPrice"::text,'')::numeric, 0)
    )                                                            AS total_revenue,
    COUNT(*)                                                     AS order_count
  FROM orders
  WHERE status = 'تم'
  GROUP BY 1
  ORDER BY 1 DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_monthly_revenue() FROM public;
GRANT EXECUTE ON FUNCTION public.get_monthly_revenue() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) شغل النهاردة
--    كل bucket هو حاجة محتاجة تتعمل، مقسّمة على البيدجات عشان الموظف اللي
--    شايف بيدجات محددة بس ياخد أرقامه هو. التوقيت بتوقيت القاهرة.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_daily_workload()
RETURNS TABLE (page_name text, bucket text, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH o AS (
    SELECT COALESCE(page, 'بدون صفحة') AS page_name,
           status,
           (created_at AT TIME ZONE 'Africa/Cairo')::date AS created_day,
           now() - created_at AS age
    FROM orders
  ), today AS (
    SELECT page_name, 'today'::text AS bucket, COUNT(*) AS cnt FROM o
    WHERE created_day = (now() AT TIME ZONE 'Africa/Cairo')::date
    GROUP BY page_name
  ), prep AS (
    SELECT page_name, 'needs_prep'::text, COUNT(*) FROM o
    WHERE status = 'جاري التحضير' GROUP BY page_name
  ), review AS (
    SELECT page_name, 'needs_review'::text, COUNT(*) FROM o
    WHERE status = 'مراجعة' GROUP BY page_name
  ), shipping AS (
    SELECT page_name, 'in_shipping'::text, COUNT(*) FROM o
    WHERE status = 'الشحن' GROUP BY page_name
  ), late AS (
    SELECT page_name, 'late_prep'::text, COUNT(*) FROM o
    WHERE status IN ('جاري التحضير','مراجعة') AND age > interval '3 days'
    GROUP BY page_name
  ), stuck AS (
    SELECT page_name, 'stuck_shipping'::text, COUNT(*) FROM o
    WHERE status = 'الشحن' AND age > interval '7 days'
    GROUP BY page_name
  )
  SELECT * FROM today
  UNION ALL SELECT * FROM prep
  UNION ALL SELECT * FROM review
  UNION ALL SELECT * FROM shipping
  UNION ALL SELECT * FROM late
  UNION ALL SELECT * FROM stuck;
$function$;

REVOKE ALL ON FUNCTION public.get_daily_workload() FROM public;
GRANT EXECUTE ON FUNCTION public.get_daily_workload() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) نشاط الموظفين
--    كام أوردر دخّل، كام الشهر ده، وآخر مرة ضاف أو عدّل فيها.
--    آخر تعديل بييجي من order_history لأن جدول orders مفيهوش updated_at.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_activity()
RETURNS TABLE (
  uid            uuid,
  total_orders   bigint,
  month_orders   bigint,
  last_order_at  timestamptz,
  last_action_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH created AS (
    SELECT
      o.user_id AS uid,
      COUNT(*)  AS total_orders,
      COUNT(*) FILTER (
        WHERE o.created_at >= date_trunc('month', (now() AT TIME ZONE 'Africa/Cairo'))
                              AT TIME ZONE 'Africa/Cairo'
      ) AS month_orders,
      MAX(o.created_at) AS last_order_at
    FROM public.orders o
    WHERE o.user_id IS NOT NULL
    GROUP BY o.user_id
  ),
  touched AS (
    SELECT h.updated_by AS uid, MAX(h.created_at) AS last_action_at
    FROM public.order_history h
    WHERE h.updated_by IS NOT NULL
    GROUP BY h.updated_by
  )
  SELECT
    COALESCE(c.uid, t.uid)      AS uid,
    COALESCE(c.total_orders, 0) AS total_orders,
    COALESCE(c.month_orders, 0) AS month_orders,
    c.last_order_at,
    t.last_action_at
  FROM created c
  FULL OUTER JOIN touched t ON t.uid = c.uid;
$$;

REVOKE ALL ON FUNCTION public.get_user_activity() FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_activity() TO authenticated;


-- ============================================================================
--  تأكيد سريع بعد التشغيل
-- ============================================================================
--  SELECT COUNT(*) FROM orders WHERE date !~ '^\d{4}-\d{2}-\d{2}$' OR date = '1970-01-01';
--    -- المفروض 0
--
--  SELECT SUM(total_revenue) FROM get_monthly_revenue();
--  SELECT SUM(COALESCE(NULLIF("productPrice"::text,'')::numeric, 0)
--           + COALESCE(NULLIF("shippingPrice"::text,'')::numeric, 0))
--  FROM orders WHERE status = 'تم';
--    -- المفروض الرقمين متساويين
--
--  SELECT bucket, SUM(cnt) FROM get_daily_workload() GROUP BY bucket ORDER BY 1;
--  SELECT * FROM get_user_activity() ORDER BY total_orders DESC LIMIT 5;
-- ============================================================================
