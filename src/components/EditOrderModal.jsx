import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { X, Save, Lock, History, Clock, FileText } from 'lucide-react';

// Statuses that require can_edit_after_ship permission to edit
const POST_SHIP_STATUSES = ['الشحن', 'تم', 'مرتجع', 'الغاء', 'استبدال'];

const EGYPT_GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الشرقية', 'القليوبية', 'كفر الشيخ',
  'الغربية', 'المنوفية', 'البحيرة', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس',
  'شمال سيناء', 'جنوب سيناء', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج',
  'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح',
];

export default function EditOrderModal({ isOpen, onClose, userRole, onSuccess, initialOrder }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'history'
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
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

  useEffect(() => {
    if (isOpen && activeTab === 'history' && initialOrder?.id) {
      fetchHistory();
    }
  }, [isOpen, activeTab, initialOrder?.id]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('order_history')
        .select(`
          *,
          user_roles:updated_by ( username, role )
        `)
        .eq('order_id', initialOrder.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const translateField = (field) => {
    const map = {
      status: 'الحالة',
      trackingNumber: 'رقم الشحنة',
      customer: 'اسم العميل',
      phone: 'الموبايل',
      address: 'العنوان',
      governorate: 'المحافظة',
      item: 'المنتجات',
      quantity: 'الكمية',
      productPrice: 'سعر المنتج',
      shippingPrice: 'سعر الشحن',
      notes: 'ملاحظات'
    };
    return map[field] || field;
  };

  const isAdmin = ['admin', 'brand_owner', 'super_admin', 'owner'].includes(userRole?.role);
  // Lock the form if order is post-ship and user lacks the permission
  const isLocked = POST_SHIP_STATUSES.includes(initialOrder?.status) && !isAdmin && !userRole?.can_edit_after_ship;
  // Lock order ID if order has moved out of جاري التحضير (non-admins only)
  const isOrderIdLocked = isLocked || (!isAdmin && initialOrder?.status !== 'جاري التحضير');

  const fallbackPages = ['عايدة', 'عايدة ويب', 'اوفر', 'اوفر ويب', 'VEE'];

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
        governorate: order.governorate,
        item: order.item,
        quantity: order.quantity,
        page: order.page,
        productPrice: order.productPrice,
        shippingPrice: order.shippingPrice,
        notes: order.notes,
        status: order.status,
        trackingNumber: order.trackingNumber,
        updated_by: userRole?.id || null,
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
        <div className="sticky top-0 bg-white/90 backdrop-blur border-b border-slate-100 z-10">
          <div className="p-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">تعديل الطلب #{order.id}</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="flex px-4 gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`pb-3 px-2 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'details' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>بيانات الأوردر</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`pb-3 px-2 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'history' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <History className="w-4 h-4" />
              <span>سجل التعديلات</span>
            </button>
          </div>
        </div>
        
        {activeTab === 'details' ? (
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
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">المحافظة</label>
              <select disabled={isLocked} value={order.governorate || ''} onChange={e => setOrder({...order, governorate: e.target.value})} className="custom-input cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                <option value="">— اختر المحافظة —</option>
                {EGYPT_GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
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
        ) : (
          <div className="p-6 space-y-6 min-h-[400px]">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-10 flex flex-col items-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                <History className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">لا توجد تعديلات مسجلة لهذا الأوردر</p>
                <p className="text-xs text-slate-400 mt-1">يتم تسجيل التعديلات تلقائياً بعد تشغيل النظام الجديد</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((h, i) => (
                  <div key={h.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3 animate-fade-in" style={{animationDelay: `${i * 50}ms`}}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg shadow-inner">
                          {h.user_roles?.username?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{h.user_roles?.username || 'مستخدم مجهول'}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span dir="ltr">{new Date(h.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {h.changed_fields && (
                      <div className="flex flex-col gap-2 mt-2">
                        {Object.entries(h.changed_fields).map(([field, vals]) => (
                          <div key={field} className="text-sm bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="font-semibold text-slate-700 min-w-[100px] flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                              {translateField(field)}:
                            </span>
                            <div className="flex items-center flex-wrap gap-2 text-xs sm:text-sm flex-1">
                              <span className="line-through text-rose-500 bg-rose-50 px-2 py-1 rounded truncate max-w-[200px]" title={vals.old}>{vals.old || 'فارغ'}</span>
                              <span className="text-slate-400 font-bold shrink-0">←</span>
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-semibold truncate max-w-[200px]" title={vals.new}>{vals.new || 'فارغ'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
