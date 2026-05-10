-- 1. إنشاء جدول الـ History
CREATE TABLE IF NOT EXISTS order_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    old_tracking TEXT,
    new_tracking TEXT,
    updated_by UUID REFERENCES user_roles(id),
    changed_fields JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- عمل Index عشان البحث برقم الأوردر يكون سريع جداً
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);

-- إعطاء صلاحيات القراءة للجميع (أو للمستخدمين المسجلين فقط)
ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON order_history;
CREATE POLICY "Enable read access for authenticated users" ON order_history FOR SELECT TO authenticated USING (true);

-- 2. إنشاء الـ Function اللي هتسجل التغييرات
CREATE OR REPLACE FUNCTION log_order_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_data JSONB := '{}'::jsonb;
    current_updated_by UUID;
BEGIN
    -- في حالة الإضافة الجديدة (أوردر جديد)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO order_history (
            order_id, action, new_status, new_tracking, updated_by, changed_fields
        ) VALUES (
            NEW.id::text, 'CREATE', NEW.status, NEW."trackingNumber", NEW.updated_by, '{"event": "Order Created"}'::jsonb
        );
        RETURN NEW;
    END IF;

    -- في حالة التعديل
    IF TG_OP = 'UPDATE' THEN
        current_updated_by := NEW.updated_by;

        -- التحقق من تغيير الحالة
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            changed_data := jsonb_set(changed_data, '{status}', jsonb_build_object('old', OLD.status, 'new', NEW.status));
        END IF;
        
        -- التحقق من تغيير بوليصة الشحن
        IF OLD."trackingNumber" IS DISTINCT FROM NEW."trackingNumber" THEN
            changed_data := jsonb_set(changed_data, '{trackingNumber}', jsonb_build_object('old', OLD."trackingNumber", 'new', NEW."trackingNumber"));
        END IF;

        -- التحقق من تغيير اسم العميل
        IF OLD.customer IS DISTINCT FROM NEW.customer THEN
            changed_data := jsonb_set(changed_data, '{customer}', jsonb_build_object('old', OLD.customer, 'new', NEW.customer));
        END IF;

        -- التحقق من تغيير رقم الموبايل
        IF OLD.phone IS DISTINCT FROM NEW.phone THEN
            changed_data := jsonb_set(changed_data, '{phone}', jsonb_build_object('old', OLD.phone, 'new', NEW.phone));
        END IF;

        -- التحقق من تغيير العنوان
        IF OLD.address IS DISTINCT FROM NEW.address THEN
            changed_data := jsonb_set(changed_data, '{address}', jsonb_build_object('old', OLD.address, 'new', NEW.address));
        END IF;

        -- التحقق من المحافظة
        IF OLD.governorate IS DISTINCT FROM NEW.governorate THEN
            changed_data := jsonb_set(changed_data, '{governorate}', jsonb_build_object('old', OLD.governorate, 'new', NEW.governorate));
        END IF;

        -- التحقق من المنتجات
        IF OLD.item IS DISTINCT FROM NEW.item THEN
            changed_data := jsonb_set(changed_data, '{item}', jsonb_build_object('old', OLD.item, 'new', NEW.item));
        END IF;

        -- التحقق من الكمية
        IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
            changed_data := jsonb_set(changed_data, '{quantity}', jsonb_build_object('old', OLD.quantity, 'new', NEW.quantity));
        END IF;

        -- التحقق من الأسعار
        IF OLD."productPrice" IS DISTINCT FROM NEW."productPrice" THEN
            changed_data := jsonb_set(changed_data, '{productPrice}', jsonb_build_object('old', OLD."productPrice", 'new', NEW."productPrice"));
        END IF;

        IF OLD."shippingPrice" IS DISTINCT FROM NEW."shippingPrice" THEN
            changed_data := jsonb_set(changed_data, '{shippingPrice}', jsonb_build_object('old', OLD."shippingPrice", 'new', NEW."shippingPrice"));
        END IF;

        -- التحقق من الملاحظات
        IF OLD.notes IS DISTINCT FROM NEW.notes THEN
            changed_data := jsonb_set(changed_data, '{notes}', jsonb_build_object('old', OLD.notes, 'new', NEW.notes));
        END IF;

        -- لو فيه أي حاجة من دول اتغيرت، سجل ده في الـ History
        IF changed_data != '{}'::jsonb THEN
            INSERT INTO order_history (
                order_id, 
                action, 
                old_status, 
                new_status, 
                old_tracking, 
                new_tracking, 
                updated_by,
                changed_fields
            ) VALUES (
                NEW.id::text, 
                'UPDATE', 
                OLD.status, 
                NEW.status, 
                OLD."trackingNumber", 
                NEW."trackingNumber", 
                current_updated_by,
                changed_data
            );
        END IF;
        
        RETURN NEW;
    END IF;

    -- في حالة الحذف
    IF TG_OP = 'DELETE' THEN
        INSERT INTO order_history (
            order_id, action, old_status, changed_fields
        ) VALUES (
            OLD.id::text, 'DELETE', OLD.status, '{"event": "Order Deleted"}'::jsonb
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. تفعيل الـ Trigger على جدول الـ orders
DROP TRIGGER IF EXISTS order_history_trigger ON orders;
CREATE TRIGGER order_history_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION log_order_changes();


-- 4. ????? ???? ??????? ???????? (???? ????????? ?????? ?? 3 ????)
-- ????? ????? pg_cron ?? ?? ??????
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ????? ?????? ???? ????? ???????? ???????
CREATE OR REPLACE FUNCTION cleanup_old_order_history()
RETURNS void AS $$
BEGIN
  DELETE FROM order_history WHERE created_at < NOW() - INTERVAL '3 months';
END;
$$ LANGUAGE plpgsql;

-- ????? ?????? ???? ????? ?? ??? ?????? 12 ?????? (?????? ???????)
SELECT cron.schedule(
  'cleanup-order-history-job', -- ??? ??????
  '0 0 * * *',                 -- ????? ?? ??? ?????? 00:00
  $$ SELECT cleanup_old_order_history(); $$
);
