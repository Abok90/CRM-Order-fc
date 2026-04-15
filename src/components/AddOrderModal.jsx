import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { X, Save } from 'lucide-react';

export default function AddOrderModal({ isOpen, onClose, userRole, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [idLoading, setIdLoading] = useState(false);
  const [order, setOrder] = useState({
    id: '',
    customer: '', phone: '', address: '', item: '', quantity: '1',
    page: '',
    productPrice: '', shippingPrice: '', notes: '', status: 'جاري التحضير', trackingNumber: ''
  });

  // Minimum starting order number per brand
  const PAGE_MIN_ORDER_NUMBER = {
    'عايدة': 23551,
    'اوفر': 6842,
    'VEE': 112,
  };

  const fetchNextId = async (page) => {
    setIdLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('id')
        .eq('page', page)
        .order('created_at', { ascending: false })
        .limit(1);
      const lastId = parseInt(data?.[0]?.id, 10);
      const minStart = PAGE_MIN_ORDER_NUMBER[page] || 1;
      const nextId = !isNaN(lastId) ? Math.max(lastId + 1, minStart) : minStart;
      setOrder(prev => ({ ...prev, id: nextId.toString() }));
    } catch {
      setOrder(prev => ({ ...prev, id: '' }));
    } finally {
      setIdLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const preferredPage = userRole?.default_page;
      const pages = userRole?.assigned_page
        ? userRole.assigned_page.split(',').filter(Boolean)
        : ['عايدة', 'عايدة ويب', 'اوفر', 'اوفر ويب', 'Elite EG', 'VEE'];
      // Use preferred page only if it's actually in the available list, else first available
      const defaultPage = (preferredPage && pages.includes(preferredPage))
        ? preferredPage
        : pages[0];
      setOrder({
        id: '',
        customer: '', phone: '', address: '', item: '', quantity: '1',
        page: defaultPage,
        productPrice: '', shippingPrice: '', notes: '', status: 'جاري التحضير', trackingNumber: ''
      });
      fetchNextId(defaultPage);
    }
  }, [isOpen]);

  const handlePageChange = (newPage) => {
    setOrder(prev => ({ ...prev, page: newPage }));
    fetchNextId(newPage);
  };

  const handleTrackingChange = (e) => {
    const val = e.target.value;
    let nextStatus = order.status;
    if (val && order.status !== 'تم' && order.status !== 'مرتجع' && order.status !== 'الغاء') {
       nextStatus = 'الشحن';
    }
    setOrder({ ...order, trackingNumber: val, status: nextStatus });
  };

  const fallbackPages = ['عايدة', 'عايدة ويب', 'اوفر', 'اوفر ويب', 'Elite EG', 'VEE'];

  const availablePages = userRole?.assigned_page
    ? userRole.assigned_page.split(',').filter(Boolean)
    : fallbackPages;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanPhone = order.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 11 && cleanPhone.length !== 8) {
      alert("رقم الموبايل يجب أن يكون 11 أو 8 أرقام فقط.");
      setLoading(false);
      return;
    }
    
    try {
      const payload = {
        ...order,
        user_id: userRole?.id || null,
        date: new Date().toISOString().split('T')[0]
      };

      const { error } = await supabase.from('orders').insert([payload]);
      
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
          <h2 className="text-xl font-bold text-slate-800">إضافة طلب جديد</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">رقم الأوردر</label>
              <input value={order.id} onChange={e => setOrder({...order, id: e.target.value})} type="text" className="custom-input font-mono" placeholder={idLoading ? 'جاري التحميل...' : 'رقم الأوردر'} disabled={idLoading} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">اسم العميل <span className="text-rose-500">*</span></label>
              <input required value={order.customer} onChange={e => setOrder({...order, customer: e.target.value})} type="text" className="custom-input" placeholder="مثال: أحمد محمد" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">رقم الموبايل <span className="text-rose-500">*</span></label>
              <input required pattern="^\d{8}$|^\d{11}$" title="يجب أن يكون الرقم 8 أو 11 رقم بالضبط" maxLength="11" value={order.phone} onChange={e => setOrder({...order, phone: e.target.value.replace(/\D/g, '')})} type="tel" className="custom-input text-right select-all" dir="ltr" placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">العنوان بالتفصيل <span className="text-rose-500">*</span></label>
              <input required value={order.address} onChange={e => setOrder({...order, address: e.target.value})} type="text" className="custom-input" placeholder="المدينة، المنطقة، الشارع، رقم العمارة..." />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">المنتج <span className="text-rose-500">*</span></label>
              <textarea required rows="2" value={order.item} onChange={e => setOrder({...order, item: e.target.value})} className="custom-input" placeholder="اسم المنتج وتفاصيله (اضغط Enter للمنتج التالي)"></textarea>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">الكمية</label>
              <input value={order.quantity} onChange={(e) => handleNumericInput('quantity', e)} type="text" inputMode="numeric" min="1" className="custom-input" />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">الصفحة التابع لها <span className="text-rose-500">*</span></label>
              <select value={order.page} onChange={e => handlePageChange(e.target.value)} className="custom-input cursor-pointer">
                {availablePages.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">سعر المنتج (ج.م) <span className="text-rose-500">*</span></label>
              <input required value={order.productPrice} onChange={(e) => handleNumericInput('productPrice', e)} type="text" inputMode="numeric" className="custom-input" placeholder="مثال: 350" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">سعر الشحن (ج.م) <span className="text-rose-500">*</span></label>
              <input required value={order.shippingPrice} onChange={(e) => handleNumericInput('shippingPrice', e)} type="text" inputMode="numeric" className="custom-input" placeholder="مثال: 50" />
            </div>

            <div className="space-y-1 md:col-span-2 text-left bg-slate-50 p-4 rounded-lg flex items-center justify-between border border-slate-100">
               <span className="font-semibold text-slate-700 text-lg">إجمالي التحصيل:</span>
               <span className="text-2xl font-black text-primary-600">
                 {(Number(order.productPrice) || 0) + (Number(order.shippingPrice) || 0)} ج.م
               </span>
            </div>

            <div className="space-y-1 md:col-span-2 text-right">
              <label className="text-sm font-semibold text-slate-700">رقم البوليصة (Tracking Number)</label>
              <input value={order.trackingNumber || ''} onChange={handleTrackingChange} type="text" className="custom-input bg-yellow-50 focus:bg-white transition-colors" placeholder="عند كتابة رقم بوليصة سيتحول الطلب إلى 'الشحن' تلقائياً" />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">ملاحظات إضافية</label>
              <textarea value={order.notes} onChange={e => setOrder({...order, notes: e.target.value})} className="custom-input min-h-[80px]" placeholder="أي تفاصيل لشركة الشحن أو العميل..."></textarea>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary px-6">إلغاء</button>
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 px-8">
              {loading ? 'جاري الحفظ...' : <><Save className="w-5 h-5" /> <span>حفظ الأوردر</span></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
