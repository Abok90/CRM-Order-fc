import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Search, Filter, RefreshCw, Plus, FileSpreadsheet } from 'lucide-react';
import clsx from 'clsx';
import AddOrderModal from './AddOrderModal';

export default function OrdersList({ userRole }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('الكل');
  
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const STATUS_COLORS = {
    'جاري التحضير': 'bg-blue-100 text-blue-800 border-blue-200',
    'الشحن': 'bg-purple-100 text-purple-800 border-purple-200',
    'تم': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'استبدال': 'bg-orange-100 text-orange-800 border-orange-200',
    'مراجعة': 'bg-amber-100 text-amber-800 border-amber-200',
    'مرتجع': 'bg-rose-100 text-rose-800 border-rose-200',
    'الغاء': 'bg-red-100 text-red-800 border-red-200',
    'تاجيل': 'bg-slate-100 text-slate-800 border-slate-200',
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // 🚀 التحميل الذكي (Pagination): لجلب جزء محدد وتوفير باقة النت (Egress)
      let query = supabase
        .from('orders')
        .select('*', { count: 'exact' });

      if (statusFilter !== 'الكل') {
        query = query.eq('status', statusFilter);
      }
      
      if (searchQuery.trim().length >= 3) {
        query = query.or(`customer.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%,trackingNumber.ilike.%${searchQuery}%`);
      }

      // Pagination applying
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Delay search to avoid spamming the database
    const delayDebounceFn = setTimeout(() => {
      fetchOrders();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, statusFilter, page]);

  return (
    <div className="space-y-6 animate-fade-in relative h-full flex flex-col">
      {/* Table Header Controls */}
      <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="ابحث برقم الطلب، الاسم، أو الموبايل..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="custom-input pl-4 pr-10 hover:shadow-md transition-shadow"
            />
          </div>
          
          <select 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="custom-input w-40 cursor-pointer"
          >
            <option value="الكل">جميع الحالات</option>
            {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={fetchOrders} className="btn-secondary flex items-center gap-2 relative group">
            <RefreshCw className={clsx("w-4 h-4 text-slate-600 group-hover:text-primary-600 transition-transform", loading && "animate-spin text-primary-600")} />
            <span className="hidden sm:inline">تحديث</span>
          </button>
          
          <button className="btn-secondary flex items-center gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">إكسيل</span>
          </button>

          <button onClick={() => setIsAddModalOpen(true)} className="btn-primary flex items-center gap-2 shadow-primary-500/40">
            <Plus className="w-5 h-5" />
            <span>طلب جديد</span>
          </button>
        </div>
      </div>

      {/* Orders Dynamic Table */}
      <div className="glass-panel flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-right text-sm whitespace-nowrap">
          <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
            <tr>
              <th className="px-6 py-4">التحكم</th>
              <th className="px-6 py-4">الصفحة</th>
              <th className="px-6 py-4">العميل</th>
              <th className="px-6 py-4">المنتج</th>
              <th className="px-6 py-4">الحالة</th>
              <th className="px-6 py-4">الملاحظات</th>
              <th className="px-6 py-4">بوليصة الشحن</th>
              <th className="px-6 py-4">الإجمالي (ج.م)</th>
              <th className="px-6 py-4">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                  <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                  <td className="px-6 py-5">
                    <div className="space-y-2">
                       <div className="h-4 bg-slate-200 rounded w-32"></div>
                       <div className="h-3 bg-slate-100 rounded w-24"></div>
                    </div>
                  </td>
                  <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-40"></div></td>
                  <td className="px-6 py-5"><div className="h-6 bg-slate-200 rounded-full w-24"></div></td>
                  <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                  <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                  <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                  <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                </tr>
              ))
            ) : orders.length === 0 ? (
               <tr>
                <td colSpan="9" className="px-6 py-16 text-center text-slate-500 font-medium">
                  لا توجد طلبات مطابقة للبحث أو الفلتر المختار
                </td>
              </tr>
            ) : (
              orders.map(order => (
                <tr key={order.id} className="hover:bg-primary-50/50 transition-colors group">
                  <td className="px-6 py-3">
                    <button className="text-primary-600 font-bold hover:underline opacity-0 group-hover:opacity-100 transition-opacity">تعديل</button>
                  </td>
                  <td className="px-6 py-3">
                    <span className="bg-slate-800 text-white text-xs px-2 py-1 rounded-md font-medium inline-block shadow-sm">
                      {order.page || 'بدون صفحة'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-bold text-slate-800">{order.customer || 'عميل محتمل'}</div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5" dir="ltr">{order.phone || 'بدون رقم'}</div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="max-w-[150px] truncate" title={order.item}>{order.item || '—'}</div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={clsx(
                      "px-3 py-1 rounded-full text-xs font-bold border",
                      STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                    )}>
                      {order.status || 'أخرى'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="max-w-[150px] truncate text-slate-500 text-xs font-medium" title={order.notes}>
                      {order.notes || '—'}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    {order.trackingNumber ? (
                       <span className="bg-slate-100 px-2 py-1 rounded font-mono text-sm border border-slate-200 cursor-copy active:scale-95 inline-block transition-transform">{order.trackingNumber}</span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-6 py-3 font-black text-slate-800">
                    {(Number(order.productPrice) || 0) + (Number(order.shippingPrice) || 0)}
                  </td>
                  <td className="px-6 py-3 text-slate-500 font-medium text-sm">
                    {order.date || order.created_at?.split('T')[0] || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!loading && orders.length > 0 && (
         <div className="glass-panel p-4 flex items-center justify-between text-sm font-semibold text-slate-600">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50 transition-colors"
            >
              السابق
            </button>
            <span>الصفحة {page} ... (سيتم برمجتها بشكل ذكي)</span>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={orders.length < itemsPerPage}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50 transition-colors"
            >
              التالي
            </button>
         </div>
      )}

      <AddOrderModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        userRole={userRole} 
        onSuccess={fetchOrders} 
      />
    </div>
  );
}
