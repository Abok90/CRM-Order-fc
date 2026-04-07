import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Search, Filter, RefreshCw, Plus, FileSpreadsheet } from 'lucide-react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import AddOrderModal from './AddOrderModal';
import EditOrderModal from './EditOrderModal';

export default function OrdersList({ userRole }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('الكل');
  
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  // Selection state
  const [selectedOrders, setSelectedOrders] = useState(new Set());

  const STATUS_STYLES = {
    'جاري التحضير': { badge: 'bg-blue-100 text-blue-800 border-blue-200', row: 'hover:bg-blue-100/50 bg-blue-50/30' },
    'الشحن': { badge: 'bg-purple-100 text-purple-800 border-purple-200', row: 'hover:bg-purple-100/50 bg-purple-50/30' },
    'تم': { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', row: 'hover:bg-emerald-100/50 bg-emerald-50/30' },
    'استبدال': { badge: 'bg-orange-100 text-orange-800 border-orange-200', row: 'hover:bg-orange-100/50 bg-orange-50/30' },
    'مراجعة': { badge: 'bg-amber-100 text-amber-800 border-amber-200', row: 'hover:bg-amber-100/50 bg-amber-50/30' },
    'مرتجع': { badge: 'bg-rose-100 text-rose-800 border-rose-200', row: 'hover:bg-rose-100/50 bg-rose-50/30' },
    'الغاء': { badge: 'bg-red-100 text-red-800 border-red-200', row: 'hover:bg-red-100/50 bg-red-50/30' },
    'تاجيل': { badge: 'bg-slate-200 text-slate-800 border-slate-300', row: 'hover:bg-slate-200/50 bg-slate-50/50' },
  };

  const getPageColor = (pageName) => {
    if (!pageName) return 'bg-slate-100 text-slate-700';
    const colors = [
      'bg-indigo-100 text-indigo-800', 'bg-rose-100 text-rose-800', 
      'bg-amber-100 text-amber-800', 'bg-fuchsia-100 text-fuchsia-800',
      'bg-cyan-100 text-cyan-800', 'bg-lime-100 text-lime-800',
      'bg-violet-100 text-violet-800', 'bg-pink-100 text-pink-800'
    ];
    let intVal = 0;
    for(let i=0; i<pageName.length; i++) intVal += pageName.charCodeAt(i);
    return colors[intVal % colors.length];
  };

  const generateOrderMessage = (order) => {
    const total = (Number(order.productPrice) || 0) + (Number(order.shippingPrice) || 0);
    return `✅ تم استلام طلبك بنجاح!
────────────────────────
🏪 ${order.page || 'الشركة'}
📦 رقم الطلب: ${order.id || ''}
👤 الاسم: ${order.customer || ''}
📱 الموبايل: ${order.phone || ''}
🛍️ المنتج: ${order.item || ''}
📍 العنوان: ${order.address || ''}
────────────────────────
💰 سعر المنتجات: ${order.productPrice || 0} ج.م
🚚 سعر الشحن: ${order.shippingPrice || 0} ج.م
💵 الإجمالي: ${total} ج.م
────────────────────────
شكراً لتعاملك معنا 🙏`;
  };

  const handleWhatsApp = (order) => {
    if (!order.phone) return;
    const cleanPhone = order.phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
    const msg = encodeURIComponent(generateOrderMessage(order));
    window.open(`https://wa.me/${finalPhone}?text=${msg}`, '_blank');
  };

  const handleCopyMessage = (order) => {
    navigator.clipboard.writeText(generateOrderMessage(order));
    alert('تم نسخ الرسالة بنجاح!');
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const toggleSelect = (id) => {
    const newSet = new Set(selectedOrders);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedOrders(newSet);
  };

  const exportToExcel = () => {
    const ordersToExport = selectedOrders.size > 0 
      ? orders.filter(o => selectedOrders.has(o.id))
      : orders;
      
    if (ordersToExport.length === 0) {
      alert('لا توجد طلبات لتصديرها');
      return;
    }

    const dataRows = ordersToExport.map(order => ({
      'رقم الطلب': order.id,
      'إسم العميل': order.customer,
      'رقم التليفون': order.phone,
      'المدينة / المحافظة': '', // user needs to map it manually or if we parse
      'العنوان بالتفصيل': order.address,
      'ملاحظات': order.notes || '',
      'الصنف': order.item,
      'السعر الإجمالي': (Number(order.productPrice) || 0) + (Number(order.shippingPrice) || 0)
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الطلبات");
    
    XLSX.writeFile(workbook, `تصدير_الشحن_${new Date().toISOString().split('T')[0]}.xlsx`);
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
            {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={fetchOrders} className="btn-secondary flex items-center gap-2 relative group">
            <RefreshCw className={clsx("w-4 h-4 text-slate-600 group-hover:text-primary-600 transition-transform", loading && "animate-spin text-primary-600")} />
            <span className="hidden sm:inline">تحديث</span>
          </button>
          
          <button onClick={exportToExcel} className="btn-secondary flex items-center gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">تصدير الشحن</span>
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
              <th className="px-6 py-4 w-10">
                <input 
                  type="checkbox" 
                  onChange={toggleSelectAll} 
                  checked={orders.length > 0 && selectedOrders.size === orders.length}
                  className="w-4 h-4 cursor-pointer accent-primary-600"
                />
              </th>
              <th className="px-6 py-4">التحكم</th>
              <th className="px-6 py-4">رقم الطلب</th>
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
                  <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-4"></div></td>
                  <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
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
                <td colSpan="11" className="px-6 py-16 text-center text-slate-500 font-medium">
                  لا توجد طلبات مطابقة للبحث أو الفلتر المختار
                </td>
              </tr>
            ) : (
              orders.map(order => {
                const statusStyle = STATUS_STYLES[order.status] || { badge: 'bg-slate-100 text-slate-700 border-slate-200', row: 'hover:bg-slate-50/80 bg-white' };
                
                return (
                <tr key={order.id} className={clsx("transition-colors group", statusStyle.row, selectedOrders.has(order.id) && "bg-primary-50/50")}>
                  <td className="px-6 py-3">
                    <input 
                      type="checkbox" 
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      className="w-4 h-4 cursor-pointer accent-primary-600"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <button onClick={() => { setEditingOrder(order); setIsEditModalOpen(true); }} className="text-primary-600 font-bold hover:underline opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      ✏️ تعديل
                    </button>
                  </td>
                  <td className="px-6 py-3 font-mono font-bold text-slate-700 text-xs">
                    {order.id}
                  </td>
                  <td className="px-6 py-3">
                    <span className={clsx("text-xs px-2 py-1 rounded-md font-bold inline-block shadow-sm mr-2", getPageColor(order.page))}>
                      {order.page || 'بدون صفحة'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-bold text-slate-800">{order.customer || 'عميل محتمل'}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-xs text-slate-600 font-medium bg-white/60 px-1 rounded border border-slate-200" dir="ltr">{order.phone || 'بدون رقم'}</div>
                      <button onClick={(e) => { e.stopPropagation(); handleWhatsApp(order); }} className="text-emerald-500 hover:text-emerald-600 transition-colors" title="مراسلة واتساب">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.015c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleCopyMessage(order); }} className="text-blue-500 hover:text-blue-600 transition-colors" title="نسخ رسالة تأكيد">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="max-w-[150px] truncate font-medium text-slate-800" title={order.item}>{order.item || '—'}</div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={clsx(
                      "px-3 py-1 rounded-full text-xs font-bold border",
                      statusStyle.badge
                    )}>
                      {order.status || 'أخرى'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="max-w-[150px] truncate text-slate-600 text-xs font-semibold bg-white/50 px-2 py-1 rounded" title={order.notes}>
                      {order.notes || '—'}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    {order.trackingNumber ? (
                       <span className="bg-white/80 px-2 py-1 rounded font-mono text-xs font-bold border border-slate-200 cursor-copy active:scale-95 inline-block transition-transform">{order.trackingNumber}</span>
                    ) : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  <td className="px-6 py-3 font-black text-slate-800">
                    {(Number(order.productPrice) || 0) + (Number(order.shippingPrice) || 0)}
                  </td>
                  <td className="px-6 py-3 text-slate-500 font-medium text-xs border-r border-slate-100/50">
                    {order.date || order.created_at?.split('T')[0] || '—'}
                  </td>
                </tr>
                );
              })
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
      <EditOrderModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingOrder(null); }}
        userRole={userRole}
        initialOrder={editingOrder}
        onSuccess={() => {
          fetchOrders();
          setEditingOrder(null);
        }}
      />
    </div>
  );
}
