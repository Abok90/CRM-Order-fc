import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { X, Save, Lock } from 'lucide-react';

// Statuses that require can_edit_after_ship permission to edit
const POST_SHIP_STATUSES = ['الشحن', 'تم', 'مرتجع', 'الغاء', 'استبدال'];

export default function EditOrderModal({ isOpen, onClose, userRole, onSuccess, initialOrder }) {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState({
    customer: '', phone: '', address: '', item: '', quantity: '1', 
    page: userRole?.default_page || 'الصفحة الرئيسية', 
    productPrice: '', shippingPrice: '', notes: '', status: 'جاري التحضير', trackingNumber: ''
  });

  const handleTrackingChange = (e) => {
    const val = e.target.value;
    let nextStatus = order.status;
    if (val && order.status !== 'تم' && order.status !== 'مرتجع' && order.status !== 'الغاء') {
       nextStatus = 'الشحن';
    }
    setOrder({ ...order, trackingNumber: val, status: nextStatus });
  };

  useEffect(() => {
    if (initialOrder) {
      setOrder({ ...initialOrder });
    }
  }, [initialOrder]);

  const isAdmin = ['admin', 'brand_owner', 'super_admin', 'owner'].includes(userRole?.role);
  // Lock the form if order is post-ship and user lacks the permission
  const isLocked = POST_SHIP_STATUSES.includes(initialOrder?.status) && !isAdmin && !userRole?.can_edit_after_ship;
  // Lock order ID if order has moved out of جاري التحضير (non-admins only)
  const isOrderIdLocked = isLocked || (!isAdmin && initialOrder?.status !== 'جاري التحضير');

  const fallbackPages = ['عايدة', 'عايدة ويب', 'اوفر', 'اوفر ويب', 'Elite EG', 'VEE'];

  const availablePages = userRole?.assigned_page 
    ? userRole.assigned_page.split(',') 
    : fallbackPages;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return;
    setLoading(true);

    const cleanPhone = order.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 11 && cleanPhone.length !== 8) {
      alert("رقم الموبايل يجب أن يكون 11 أو 8 أرقام فقط.");
      setLoading(false);
      return;
    }
    
    try {
      const { error } = await supabase.from('orders').update({
        id: order.id,
        customer: order.customer,
        phone: order.phone,
        address: order.address,
        item: order.item,
        quantity: order.quantity,
        page: order.page,
        productPrice: order.productPrice,
        shippingPrice: order.shippingPrice,
        notes: order.notes,
        status: order.status,
        trackingNumber: order.trackingNumber
      }).eq('id', initialOrder.id);
      
      if (error) throw error;
      
      onSuccess();
      onClose();
    } catch (err) {
      alert('حدث خطأ أثناء حفظ الأوردر: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNumericInput = (field, e) => {
    let rawVal = e.target.value.toString();
    const englishVal = rawVal.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^\d.]/g, '');
    setOrder(prev => ({ ...prev, [field]: englishVal }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 bg-white/90 backdrop-blur border-b border-slate-100 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-slate-800">تعديل الطلب #{order.id}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {isLocked && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3">
              <Lock className="w-5 h-5 shrink-0" />
              <p className="text-sm font-bold">هذا الطلب في مرحلة <span className="underline">{initialOrder?.status}</span> — لا يمكنك تعديله. تواصل مع الأدمن إذا كنت بحاجة لتغيير.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">رقم الأوردر</label>
              <input disabled={isOrderIdLocked} value={order.id || ''} onChange={e => setOrder({...order, id: e.target.value})} type="text" className="custom-input font-mono disabled:opacity-60 disabled:cursor-not-allowed" />
              {isOrderIdLocked && !isLocked && (
                <p className="text-[11px] text-slate-400 font-medium">رقم الأوردر لا يمكن تعديله بعد مرحلة جاري التحضير</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">اسم العميل <span className="text-rose-500">*</span></label>
              <input required disabled={isLocked} value={order.customer} onChange={e => setOrder({...order, customer: e.target.value})} type="text" className="custom-input disabled:opacity-60 disabled:cursor-not-allowed" placeholder="مثال: أحمد محمد" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">رقم الموبايل <span className="text-rose-500">*</span></label>
              <input required disabled={isLocked} pattern="^\d{8}$|^\d{11}$" title="يجب أن يكون الرقم 8 أو 11 رقم بالضبط" maxLength="11" value={order.phone} onChange={e => setOrder({...order, phone: e.target.value.replace(/\D/g, '')})} type="tel" className="custom-input text-right select-all disabled:opacity-60 disabled:cursor-not-allowed" dir="ltr" placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">العنوان بالتفصيل <span className="text-rose-500">*</span></label>
              <input required disabled={isLocked} value={order.address} onChange={e => setOrder({...order, address: e.target.value})} type="text" className="custom-input disabled:opacity-60 disabled:cursor-not-allowed" placeholder="المدينة، المنطقة، الشارع، رقم العمارة..." />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">المنتج <span className="text-rose-500">*</span></label>
              <textarea required disabled={isLocked} rows="2" value={order.item} onChange={e => setOrder({...order, item: e.target.value})} className="custom-input disabled:opacity-60 disabled:cursor-not-allowed" placeholder="اسم المنتج وتفاصيله (اضغط Enter للمنتج التالي)"></textarea>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">الكمية</label>
              <input disabled={isLocked} value={order.quantity} onChange={e => handleNumericInput('quantity', e)} type="text" inputMode="numeric" min="1" className="custom-input disabled:opacity-60 disabled:cursor-not-allowed" />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">الصفحة التابع لها <span className="text-rose-500">*</span></label>
              <select disabled={isLocked} value={order.page} onChange={e => setOrder({...order, page: e.target.value})} className="custom-input cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                {availablePages.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">سعر المنتج (ج.م) <span className="text-rose-500">*</span></label>
              <input required disabled={isLocked} value={order.productPrice} onChange={e => handleNumericInput('productPrice', e)} type="text" inputMode="numeric" className="custom-input disabled:opacity-60 disabled:cursor-not-allowed" placeholder="مثال: 350" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">سعر الشحن (ج.م) <span className="text-rose-500">*</span></label>
              <input required disabled={isLocked} value={order.shippingPrice} onChange={e => handleNumericInput('shippingPrice', e)} type="text" inputMode="numeric" className="custom-input disabled:opacity-60 disabled:cursor-not-allowed" placeholder="مثال: 50" />
            </div>

            <div className="space-y-1 md:col-span-2 text-left bg-slate-50 p-4 rounded-lg flex items-center justify-between border border-slate-100">
               <span className="font-semibold text-slate-700 text-lg">إجمالي التحصيل:</span>
               <span className="text-2xl font-black text-primary-600">
                 {(Number(order.productPrice) || 0) + (Number(order.shippingPrice) || 0)} ج.م
               </span>
            </div>

            <div className="space-y-1 md:col-span-2 text-right">
              <label className="text-sm font-semibold text-slate-700">رقم البوليصة (Tracking Number)</label>
              <input disabled={isLocked} value={order.trackingNumber || ''} onChange={handleTrackingChange} type="text" className="custom-input bg-yellow-50 focus:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed" placeholder="عند تعديل أو إضافة رقم بوليصة سيتحول للـ 'الشحن'" />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">ملاحظات إضافية</label>
              <textarea disabled={isLocked} value={order.notes} onChange={e => setOrder({...order, notes: e.target.value})} className="custom-input min-h-[80px] disabled:opacity-60 disabled:cursor-not-allowed" placeholder="أي تفاصيل لشركة الشحن أو العميل..."></textarea>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary px-6">إلغاء</button>
            <button type="submit" disabled={loading || isLocked} className="btn-primary flex items-center gap-2 px-8 disabled:opacity-50 disabled:cursor-not-allowed">
              {isLocked
                ? <><Lock className="w-5 h-5" /><span>مقفل</span></>
                : loading ? 'جاري الحفظ...' : <><Save className="w-5 h-5" /><span>حفظ التعديلات</span></>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
