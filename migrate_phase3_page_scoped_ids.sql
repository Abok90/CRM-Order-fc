-- ============================================================================
--  المرحلة 3 — تبديل المفتاح الأساسي (هوية الأوردر = البيدج + الرقم)
-- ============================================================================
--
--  ⚠️  متشغّلش الملف ده غير بعد ما الكود الجديد (v7.9.0) يبقى شغّال على
--      production فعلاً. الترتيب مهم:
--
--        1. المرحلة 1  — إضافة الأعمدة            ✅ اتعملت
--        2. نشر الكود  — Promote لـ production     ← لازم قبل الملف ده
--        3. الملف ده   — تبديل المفتاح
--
--      السبب: الملف ده بيخلي نفس الرقم مسموح في بيدجين. الكود القديم بيدوّر
--      بالرقم لوحده، فلو اشتغل بعد التغيير ممكن يعدّل أوردر البيدج الغلط.
--
--  الملف بيتنفّذ في transaction واحدة — يا كله يا ولا حاجة.
-- ============================================================================

BEGIN;

-- فحص أمان: لو في أي (بيدج + رقم) مكرر، أوقف كل حاجة قبل ما نلمس المفتاح.
DO $$
DECLARE dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (SELECT page, id FROM public.orders GROUP BY page, id HAVING COUNT(*) > 1) t;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'في % (بيدج + رقم) مكرر — لازم يتحلوا الأول قبل تطبيق القيد.', dup_count;
  END IF;
END $$;

ALTER TABLE public.orders DROP CONSTRAINT orders_pkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (uid);
ALTER TABLE public.orders ADD CONSTRAINT orders_page_id_key UNIQUE (page, id);

COMMIT;


-- ============================================================================
--  إصلاح منفصل: حذف الموظف
-- ============================================================================
--  orders.updated_by مربوط بـ auth.users من غير ON DELETE، وده بيمنع حذف أي
--  موظف عدّل أوردر. (ملف db_fixes.sql كان بيدوّر على علاقات user_roles بس،
--  فمكنش شايف دي.)

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_updated_by_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


-- ============================================================================
--  التأكيد بعد التشغيل
-- ============================================================================
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint WHERE conrelid='public.orders'::regclass;
--
--   المفروض تشوف:  PRIMARY KEY (uid)  و  UNIQUE (page, id)
--
--  وبعدها جرّب في السيستم: عدّل أوردر، غيّر حالته، احذف واحد، وافتح تبويب
--  السجل — كلهم لازم يشتغلوا عادي.
-- ============================================================================
