-- ============================================================================
--  إصلاحات قاعدة البيانات — v7.8.6
-- ============================================================================
--
--  شغّل الملف ده في Supabase → SQL Editor.
--  الترتيب المفضّل: secure_user_roles_rls.sql الأول، وبعده الملف ده.
--
--  الملف آمن للتشغيل أكتر من مرة (كله IF NOT EXISTS أو فحص قبل التنفيذ)،
--  ومبيغيّرش أي بيانات موجودة — بيصلّح العلاقات ويضيف فهارس بس.
--
--  محتويات الملف:
--    القسم 1 — إصلاح مطلوب: حذف الموظف بيفشل حاليًا
--    القسم 2 — فهارس (سرعة + تقليل خطر الـ timeout في الويبهوك)
--    القسم 3 — استعلامات فحص (متشغّلش أي تعديل — للاطلاع بس)
--    القسم 4 — خطوة اختيارية بعد مراجعة نتايج القسم 3
--
-- ============================================================================


-- ============================================================================
--  القسم 1 — إصلاح مطلوب: الـ Foreign Keys اللي بتمنع حذف الموظف
-- ============================================================================
--
--  المشكلة:
--  جدول order_history فيه:
--
--      updated_by UUID REFERENCES user_roles(id)
--
--  من غير جملة ON DELETE. القيمة الافتراضية في بوستجرس هي NO ACTION، يعني
--  بوستجرس بيرفض حذف أي صف من user_roles طالما في صف في order_history
--  بيشاور عليه.
--
--  النتيجة العملية: أي موظف عدّل أوردر واحد في حياته، زرار "حذف الموظف"
--  (/api/delete-user) هيفشل معاه بخطأ foreign key. الموظفين الجدد بس اللي
--  هيتحذفوا بنجاح.
--
--  الحل: نخلي العلاقة ON DELETE SET NULL — يعني السجل التاريخي يفضل موجود
--  (مهم، ده سجل مراجعة) بس من غير اسم الشخص المحذوف.
--
--  البلوك تحت بيدوّر لوحده على كل العلاقات اللي بتشاور على user_roles(id)
--  في أي جدول، ويحوّلها لـ ON DELETE SET NULL. لو لقى عمود NOT NULL
--  (اللي مينفعش يتعمله SET NULL) بيسيبه وبيقولك عليه في رسالة.
--
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  fk       RECORD;
  col_name TEXT;
  is_nullable TEXT;
BEGIN
  FOR fk IN
    SELECT
      con.oid          AS con_oid,
      con.conname      AS con_name,
      rel.relname      AS table_name,
      nsp.nspname      AS schema_name,
      con.conkey::int2[] AS col_nums,
      con.confdeltype  AS on_delete
    FROM pg_constraint con
    JOIN pg_class     rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.user_roles'::regclass
  LOOP
    -- العلاقات المركّبة (أكتر من عمود) نتخطاها ونبلّغ عنها
    IF array_length(fk.col_nums, 1) <> 1 THEN
      RAISE NOTICE 'تم التخطي (علاقة مركّبة): %.% → %', fk.schema_name, fk.table_name, fk.con_name;
      CONTINUE;
    END IF;

    SELECT attname INTO col_name
    FROM pg_attribute
    WHERE attrelid = (fk.schema_name || '.' || fk.table_name)::regclass
      AND attnum = fk.col_nums[1];

    SELECT CASE WHEN attnotnull THEN 'NO' ELSE 'YES' END INTO is_nullable
    FROM pg_attribute
    WHERE attrelid = (fk.schema_name || '.' || fk.table_name)::regclass
      AND attnum = fk.col_nums[1];

    -- 'n' معناها إن العلاقة أصلاً ON DELETE SET NULL — مفيش حاجة تتعمل
    IF fk.on_delete = 'n' THEN
      RAISE NOTICE 'تمام بالفعل: %.%(%) — ON DELETE SET NULL', fk.schema_name, fk.table_name, col_name;
      CONTINUE;
    END IF;

    IF is_nullable = 'NO' THEN
      RAISE WARNING 'محتاج مراجعة يدوية: %.%(%) عمود NOT NULL فمينفعش SET NULL — حذف الموظف هيفضل بيفشل بسببه.',
        fk.schema_name, fk.table_name, col_name;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', fk.schema_name, fk.table_name, fk.con_name);
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.user_roles(id) ON DELETE SET NULL',
      fk.schema_name, fk.table_name, fk.con_name, col_name
    );
    RAISE NOTICE 'تم الإصلاح: %.%(%) → ON DELETE SET NULL', fk.schema_name, fk.table_name, col_name;
  END LOOP;
END $$;


-- ============================================================================
--  القسم 2 — فهارس (Indexes)
-- ============================================================================
--
--  كل الأوامر دي IF NOT EXISTS، فلو الفهرس موجود مش هيحصل حاجة.
--
--  ملاحظة: لو جدول orders كبير، الإنشاء ممكن ياخد ثواني ويقفل الجدول.
--  لو عايز تعمله من غير قفل، شغّل كل سطر لوحده بـ CREATE INDEX CONCURRENTLY
--  (بس CONCURRENTLY مينفعش جوه transaction، فلازم يتشغّل منفرد).
--
-- ----------------------------------------------------------------------------

-- (أهم واحد) الويبهوك بيدوّر بالعمودين دول في كل مرة شوبيفاي يبعت حاجة:
--     PATCH orders?shopify_order_id=eq.X&shopify_store=eq.Y
-- من غير فهرس ده بيعمل مسح كامل للجدول في كل أوردر وكل تحديث. ومع كبر
-- الجدول ده بيبقى أبطأ — وده بالظبط نوع البطء اللي بينتهي بـ 504 من Supabase،
-- وهو اللي ضيّع أوردر VEE رقم 4759.
CREATE INDEX IF NOT EXISTS idx_orders_shopify_lookup
  ON orders (shopify_order_id, shopify_store)
  WHERE shopify_order_id IS NOT NULL;

-- قائمة الطلبات: ترتيب بالأحدث + ترقيم الصفحات
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders (created_at DESC);

-- فلتر البراند + الترتيب بالأحدث (شاشة الطلبات، واقتراح رقم الأوردر الجديد)
CREATE INDEX IF NOT EXISTS idx_orders_page_created_at
  ON orders (page, created_at DESC);

-- فلتر الحالة (شاشة الطلبات، منتجات اليوم، وحساب إيرادات المالية)
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders (status);

-- فلتر التاريخ (من / إلى في شاشة الطلبات والتقارير)
CREATE INDEX IF NOT EXISTS idx_orders_date
  ON orders (date);

-- سجل التعديلات: الربط باسم الشخص اللي عدّل
CREATE INDEX IF NOT EXISTS idx_order_history_updated_by
  ON order_history (updated_by);

-- صفحة المالية: الفلترة بالنوع والتاريخ
-- (متحاط بفحص، لأن جدول finance_records ممكن ميكونش موجود عندك)
DO $$
BEGIN
  IF to_regclass('public.finance_records') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_finance_records_type_date
      ON finance_records (type, date DESC);
    RAISE NOTICE 'تم: فهرس finance_records';
  ELSE
    RAISE NOTICE 'تم التخطي: جدول finance_records مش موجود';
  END IF;
END $$;


-- ============================================================================
--  القسم 3 — استعلامات فحص (قراءة فقط — مش بتغيّر أي حاجة)
-- ============================================================================
--  شغّل كل استعلام لوحده وشوف النتيجة.
-- ----------------------------------------------------------------------------

-- ── 3.1 أوردرات شوبيفاي من غير محافظة ───────────────────────────────────────
-- المحافظة بتتصدّر في شيت الشحن. الأوردرات اللي اتجابت بزرار "جلب شوبيفاي"
-- قبل نسخة 7.8.5 نزلت من غير محافظة (منها أوردر 4759).
--
--   SELECT id, page, customer, date
--   FROM orders
--   WHERE source = 'shopify'
--     AND (governorate IS NULL OR governorate = '')
--   ORDER BY created_at DESC;


-- ── 3.2 أوردرات شوبيفاي مكررة ────────────────────────────────────────────────
-- المفروض تطلع فاضية. لو طلعت صفوف، يبقى نفس أوردر شوبيفاي اتسجّل أكتر من مرة.
-- شغّلها قبل القسم 4.
--
--   SELECT shopify_order_id, shopify_store, COUNT(*) AS عدد_الصفوف
--   FROM orders
--   WHERE shopify_order_id IS NOT NULL
--   GROUP BY shopify_order_id, shopify_store
--   HAVING COUNT(*) > 1;


-- ── 3.3 خطر تصادم أرقام الأوردرات بين البراندات ──────────────────────────────
--
-- مهم تفهم ده: رقم الأوردر (عمود id) بييجي من اسم الأوردر في شوبيفاي زي
-- "#4759"، والرقم ده مضمون إنه فريد **داخل المتجر الواحد بس** — مش بين
-- المتاجر. يعني ممكن عايدة ويب و VEE يبقى عندهم أوردر بنفس الرقم.
--
-- ولأن الويبهوك بيدخّل الأوردر بـ ignore-duplicates، لو حصل تصادم **الأوردر
-- التاني هيتم تجاهله في صمت** — نفس نوع الاختفاء اللي حصل مع 4759 بالظبط،
-- بس من غير حتى رسالة خطأ في اللوج.
--
-- دلوقتي الأرقام بعيدة عن بعض (عايدة في العشرات الآلاف و VEE في الآلاف)،
-- فالخطر مش قريب — بس كل ما VEE يكبر، المسافة بتقل.
--
-- الاستعلام ده بيوريك أعلى رقم في كل براند عشان تراقب المسافة:
--
--   SELECT page,
--          COUNT(*) AS عدد_الأوردرات,
--          MAX(NULLIF(regexp_replace(id, '\D', '', 'g'), '')::bigint) AS أعلى_رقم
--   FROM orders
--   GROUP BY page
--   ORDER BY أعلى_رقم DESC NULLS LAST;
--
-- لو المسافة بين براندين بقت صغيرة، كلّمني وقتها ونغيّر المفتاح الأساسي
-- ليكون (رقم الأوردر + المتجر) بدل رقم الأوردر لوحده.


-- ============================================================================
--  القسم 4 — خطوة اختيارية (بعد ما تتأكد إن 3.2 رجعت فاضية)
-- ============================================================================
--
--  قيد فريد يمنع تسجيل نفس أوردر شوبيفاي مرتين — شبكة أمان إضافية لو الويبهوك
--  اتبعت مرتين (وده بقى وارد أكتر دلوقتي، لأن شوبيفاي بقى بيعيد الإرسال عند
--  الفشل، وده التصرف الصح).
--
--  ⚠️ شغّله بس لو استعلام 3.2 رجع **صفر صفوف**، وإلا هيفشل.
--
--   CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_shopify_order
--     ON orders (shopify_order_id, shopify_store)
--     WHERE shopify_order_id IS NOT NULL;
--
-- ============================================================================


-- ============================================================================
--  التأكيد بعد التشغيل
-- ============================================================================
--  1. لازم تشوف رسايل NOTICE من القسم 1 بتقول "تم الإصلاح" أو "تمام بالفعل".
--     لو ظهرت WARNING، ابعتهالي.
--  2. جرّب تحذف موظف من صفحة الموظفين (واحد عدّل أوردرات قبل كده) — المفروض
--     يتحذف من غير خطأ، وميقدرش يسجّل دخول تاني.
--  3. افتح أوردر عدّلته قبل كده → تبويب "السجل" → لازم تلاقي السجل القديم
--     موجود زي ما هو.
-- ============================================================================
