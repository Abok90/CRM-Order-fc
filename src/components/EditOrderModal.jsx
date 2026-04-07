import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { X, Save } from 'lucide-react';

export default function EditOrderModal({ isOpen, onClose, userRole, onSuccess, initialOrder }) {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState({
    customer: '', phone: '', address: '', item: '', quantity: '1', 
    page: userRole?.default_page || 'الصفحة الرئيسية', 
    productPrice: '', shippingPrice: '', notes: '', status: 'جاري التحضير'
  });

  useEffect(() => {
    if (initialOrder) {
      setOrder({ ...initialOrder });
    }
  }, [initialOrder]);

  const fallbackPages = ['عايدة', 'عايدة ويب', 'اوفر', 'اوفر ويب', 'Elite EG', 'VEE'];

  const availablePages = userRole?.assigned_page 
    ? userRole.assigned_page.split(',') 
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
      const { error } = await supabase.from('orders').update({
        customer: order.customer,
        phone: order.phone,
        address: order.address,
        item: order.item,
        quantity: order.quantity,
        page: order.page,
        productPrice: order.productPrice,
        shippingPrice: order.shippingPrice,
        notes: order.notes,
        status: order.status
      }).eq('id', order.id);
      
      if (error) throw error;
      
      onSuccess();
      onClose();
    } catch (err) {
      alert('حدث خطأ أثناء حفظ الأوردر: ' + err.message);
    } finally {
      setLoading(false);
    }
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">اسم العميل <span className="text-rose-500">*</span></label>
              <input required value={order.customer} onChange={e => setOrder({...order, customer: e.target.value})} type="text" className="custom-input" placeholder="مثال: أحمد محمد" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">رقم الموبايل <span className="text-rose-500">*</span></label>
              <input required maxLength="11" value={order.phone} onChange={e => setOrder({...order, phone: e.target.value.replace(/\D/g, '')})} type="tel" className="custom-input text-right select-all" dir="ltr" placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">العنوان بالتفصيل <span className="text-rose-500">*</span></label>
              <input required value={order.address} onChange={e => setOrder({...order, address: e.target.value})} type="text" className="custom-input" placeholder="المدينة، المنطقة، الشارع، رقم العمارة..." />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">المنتج <span className="text-rose-500">*</span></label>
              <input required value={order.item} onChange={e => setOrder({...order, item: e.target.value})} type="text" className="custom-input" placeholder="اسم المنتج وتفاصيله" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">الكمية</label>
              <input value={order.quantity} onChange={e => setOrder({...order, quantity: e.target.value})} type="number" min="1" className="custom-input" />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">الصفحة التابع لها <span className="text-rose-500">*</span></label>
              <select value={order.page} onChange={e => setOrder({...order, page: e.target.value})} className="custom-input cursor-pointer">
                {availablePages.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">سعر المنتج (ج.م) <span className="text-rose-500">*</span></label>
              <input required value={order.productPrice} onChange={e => setOrder({...order, productPrice: e.target.value})} type="number" className="custom-input" placeholder="مثال: 350" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">سعر الشحن (ج.م) <span className="text-rose-500">*</span></label>
              <input required value={order.shippingPrice} onChange={e => setOrder({...order, shippingPrice: e.target.value})} type="number" className="custom-input" placeholder="مثال: 50" />
            </div>

            <div className="space-y-1 md:col-span-2 text-left bg-slate-50 p-4 rounded-lg flex items-center justify-between border border-slate-100">
               <span className="font-semibold text-slate-700 text-lg">إجمالي التحصيل:</span>
               <span className="text-2xl font-black text-primary-600">
                 {(Number(order.productPrice) || 0) + (Number(order.shippingPrice) || 0)} ج.م
               </span>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">ملاحظات إضافية</label>
              <textarea value={order.notes} onChange={e => setOrder({...order, notes: e.target.value})} className="custom-input min-h-[80px]" placeholder="أي تفاصيل لشركة الشحن أو العميل..."></textarea>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary px-6">إلغاء</button>
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 px-8">
              {loading ? 'جاري الحفظ...' : <><Save className="w-5 h-5" /> <span>حفظ التعديلات</span></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
