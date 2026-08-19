-- ============================================================================
--  تأمين جدول user_roles — منع الموظف من ترقية نفسه
-- ============================================================================
--
--  المشكلة:
--  التطبيق بيسمح للمستخدم يضيف صف نفسه في user_roles أول ما يسجّل (App.jsx)،
--  وبيسمحله يعدّل اسمه (زرار تعديل الاسم). يعني لازم تكون في سياسة UPDATE
--  للمستخدم على صفه. لو السياسة دي مش مقيّدة بالأعمدة، أي موظف يقدر يفتح
--  الـ console في المتصفح ويكتب:
--
--      supabase.from('user_roles')
--        .update({ role: 'admin', is_approved: true })
--        .eq('id', '<his own id>')
--
--  ويبقى أدمن على السيستم كله.
--
--  الحل هنا: سياسات RLS + trigger بيمنع تغيير الأعمدة الحساسة إلا من الأدمن.
--
-- ============================================================================
--  ⚠️  اقرأ ده قبل ما تشغّل
-- ============================================================================
--
--  1. شغّله في Supabase → SQL Editor.
--  2. السكريبت مكتوب عشان **يحافظ على كل حاجة شغالة دلوقتي زي ما هي**:
--       • كل موظف مسجّل يفضل شايف كل صفوف user_roles (لوحة المنافسة في
--         الداشبورد بتحتاج ده لكل المستخدمين، مش للأدمن بس).
--       • الموظف الجديد يفضل بيقدر يضيف صف نفسه أول تسجيل دخول.
--       • الموظف يفضل بيقدر يغيّر اسمه.
--       • الأدمن يفضل بيقدر يغيّر كل حاجة لأي حد.
--     اللي بيتمنع بس: إن الموظف يغيّر role أو is_approved أو الصلاحيات
--     بتاعته هو.
--  3. بعد التشغيل، امشِ على "خطوات التأكيد" في آخر الملف.
--  4. لو حصلت أي مشكلة، في أوامر تراجع (rollback) في آخر الملف.
--
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) دالة تتأكد إن المستخدم الحالي أدمن
--    SECURITY DEFINER عشان تقرأ الجدول من غير ما تدخل في حلقة RLS لا نهائية.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_crm_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE id = auth.uid()
      AND role IN ('admin', 'brand_owner', 'super_admin', 'owner')
  );
$$;

REVOKE ALL ON FUNCTION public.is_crm_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_crm_admin() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) تفعيل RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) السياسات
-- ─────────────────────────────────────────────────────────────────────────────

-- قراءة: أي موظف مسجّل يقرأ كل الصفوف.
-- (الداشبورد بيجيب كل المستخدمين للوحة المنافسة لكل مستخدم، مش للأدمن بس —
--  فلو ضيّقنا القراءة هنا، لوحة المنافسة هتفضى للموظفين العاديين.)
DROP POLICY IF EXISTS "user_roles_select_authenticated" ON public.user_roles;
CREATE POLICY "user_roles_select_authenticated"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

-- إضافة: الموظف يضيف صف نفسه بس، وبقيم مبدئية إجبارية.
-- (ده اللي التطبيق بيعمله أول تسجيل دخول: role='customer_service', is_approved=false)
DROP POLICY IF EXISTS "user_roles_insert_self" ON public.user_roles;
CREATE POLICY "user_roles_insert_self"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND COALESCE(is_approved, false) = false
    AND COALESCE(role, 'customer_service') = 'customer_service'
  );

-- إضافة: الأدمن يضيف أي صف.
DROP POLICY IF EXISTS "user_roles_insert_admin" ON public.user_roles;
CREATE POLICY "user_roles_insert_admin"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_crm_admin());

-- تعديل: الموظف يعدّل صفه هو بس (والأعمدة الحساسة محميّة بالـ trigger تحت).
DROP POLICY IF EXISTS "user_roles_update_self" ON public.user_roles;
CREATE POLICY "user_roles_update_self"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- تعديل: الأدمن يعدّل أي صف.
DROP POLICY IF EXISTS "user_roles_update_admin" ON public.user_roles;
CREATE POLICY "user_roles_update_admin"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_crm_admin())
  WITH CHECK (public.is_crm_admin());

-- حذف: الأدمن بس.
-- (التطبيق بقى بيحذف عن طريق /api/delete-user بمفتاح service_role اللي بيتخطى
--  الـ RLS أصلاً — السياسة دي طبقة أمان إضافية.)
DROP POLICY IF EXISTS "user_roles_delete_admin" ON public.user_roles;
CREATE POLICY "user_roles_delete_admin"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_crm_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) حماية الأعمدة الحساسة
--    RLS مبيعرفش يقيّد أعمدة معيّنة، فبنستخدم trigger.
--    الموظف يقدر يغيّر اسمه؛ أي محاولة لتغيير الدور أو الاعتماد أو الصلاحيات
--    بترجع بخطأ واضح.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_user_roles_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- مفتاح الـ service_role (الـ API endpoints) والأدمن ليهم حرية كاملة.
  IF auth.role() = 'service_role' OR public.is_crm_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role              IS DISTINCT FROM OLD.role
     OR NEW.is_approved    IS DISTINCT FROM OLD.is_approved
     OR NEW.assigned_page  IS DISTINCT FROM OLD.assigned_page
     OR NEW.dashboard_perms IS DISTINCT FROM OLD.dashboard_perms
  THEN
    RAISE EXCEPTION 'غير مسموح بتغيير الدور أو الصلاحيات — تواصل مع الأدمن.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_roles_privileges ON public.user_roles;
CREATE TRIGGER trg_guard_user_roles_privileges
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_roles_privileges();

COMMIT;


-- ============================================================================
--  ملاحظة عن الأعمدة الإضافية
-- ============================================================================
--  لو عندك أعمدة صلاحيات تانية في الجدول (زي can_edit_after_ship أو
--  can_delete_order أو default_page)، ضيفها لقايمة الفحص في الـ trigger فوق
--  بنفس الشكل:
--
--      OR NEW.can_edit_after_ship IS DISTINCT FROM OLD.can_edit_after_ship
--      OR NEW.can_delete_order    IS DISTINCT FROM OLD.can_delete_order
--
--  عشان تشوف كل الأعمدة الموجودة فعلاً:
--
--      SELECT column_name, data_type
--      FROM information_schema.columns
--      WHERE table_schema = 'public' AND table_name = 'user_roles'
--      ORDER BY ordinal_position;
--
-- ============================================================================


-- ============================================================================
--  خطوات التأكيد بعد التشغيل
-- ============================================================================
--  1. سجّل دخول بحساب أدمن:
--       • صفحة الموظفين بتفتح وبتعرض كل الموظفين ✅
--       • تقدر تغيّر دور موظف وتعتمد حساب جديد ✅
--  2. سجّل دخول بحساب موظف عادي (خدمة عملاء):
--       • الداشبورد ولوحة المنافسة بيظهروا عادي ✅
--       • تقدر تغيّر اسمك من زرار التعديل ✅
--       • جرّب في console المتصفح:
--
--           await supabase.from('user_roles')
--             .update({ role: 'admin' })
--             .eq('id', (await supabase.auth.getUser()).data.user.id)
--
--         المفروض يرجّع خطأ ❌ — ده اللي إحنا عايزينه.
--  3. سجّل حساب جديد بالكامل:
--       • يتضاف في صفحة الموظفين بحالة "قيد المراجعة" ✅
-- ============================================================================


-- ============================================================================
--  تراجع (لو حصلت مشكلة وعايز ترجع لأول حاجة بسرعة)
-- ============================================================================
--  ⚠️ ده بيرجّع الجدول مفتوح من غير حماية — استخدمه للطوارئ بس.
--
--  DROP TRIGGER IF EXISTS trg_guard_user_roles_privileges ON public.user_roles;
--  ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
-- ============================================================================
