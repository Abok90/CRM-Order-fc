import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Search, Filter, RefreshCw, Plus, FileSpreadsheet, Printer, ChevronDown, Zap } from 'lucide-react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import AddOrderModal from './AddOrderModal';
import EditOrderModal from './EditOrderModal';

export default function OrdersList({ userRole, initialFilter, onFilterConsumed }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('الكل');
  const [pageFilter, setPageFilter] = useState('الكل');
  
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  // Selection state
  const [selectedOrders, setSelectedOrders] = useState(new Set());

  // Quick status dropdown
  const [activeStatusDropdown, setActiveStatusDropdown] = useState(null);

  const AVAILABLE_PAGES = ['عايدة', 'عايدة ويب', 'اوفر', 'اوفر ويب', 'Elite EG', 'VEE'];

  const ALL_STATUSES = ['جاري التحضير', 'مراجعة', 'الشحن', 'تم', 'استبدال', 'مرتجع', 'الغاء', 'تاجيل'];

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

  // Quick status change
  const handleQuickStatusChange = async (orderId, newStatus) => {
    setActiveStatusDropdown(null);
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (error) throw error;
      // Update locally for instant feedback
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (err) {
      alert('خطأ في تغيير الحالة: ' + err.message);
    }
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
      'كود التاجر': order.id,
      'اسم الراسل علي البوليصة': order.page || '',
      'اسم المستلم': order.customer,
      'موبايل المستلم': order.phone,
      'ملاحظات': order.notes || '',
      'المنطقة': order.address ? order.address.split(' ')[0] : '',
      'العنوان': order.address,
      'محتوى الشحنة': order.item,
      'الكمية': order.quantity || '1',
      'قيمة الشحنة': (Number(order.productPrice) || 0) + (Number(order.shippingPrice) || 0)
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الطلبات");
    
    XLSX.writeFile(workbook, `شيت_الطلبات_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrint = () => {
    const ordersToPrint = selectedOrders.size > 0 
      ? orders.filter(o => selectedOrders.has(o.id))
      : orders;

    if (ordersToPrint.length === 0) {
      alert('لا توجد طلبات للطباعة');
      return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>طباعة الطلبات</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: right; }
            th { background-color: #f4f4f4; }
            .header { text-align: center; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>كشف الطلبات للتسليم</h2>
            <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>اسم العميل</th>
                <th>رقم الموبايل</th>
                <th>العنوان</th>
                <th>المنتج</th>
                <th>الكمية</th>
                <th>المبلغ (ج)</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${ordersToPrint.map(o => `
                <tr>
                  <td><strong>${o.id}</strong></td>
                  <td>${o.customer}</td>
                  <td>${o.phone}</td>
                  <td>${o.address}</td>
                  <td>${o.item}</td>
                  <td>${o.quantity || '1'}</td>
                  <td><strong>${(Number(o.productPrice) || 0) + (Number(o.shippingPrice) || 0)}</strong></td>
                  <td>${o.notes || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
             window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select('*', { count: 'exact' });

      if (statusFilter !== 'الكل') {
        query = query.eq('status', statusFilter);
      }
      
      if (pageFilter !== 'الكل') {
        // Use ilike to handle any trailing/leading spaces in the DB
        query = query.ilike('page', `%${pageFilter}%`);
      }

      if (searchQuery.trim().length >= 3) {
        query = query.or(`customer.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%,trackingNumber.ilike.%${searchQuery}%`);
      }

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
    if (initialFilter) {
      if (initialFilter.type === 'status') setStatusFilter(initialFilter.value);
      if (initialFilter.type === 'page') setPageFilter(initialFilter.value);
      // Support combined filters (page + status from Dashboard cards)
      if (initialFilter.pageFilter) setPageFilter(initialFilter.pageFilter);
      if (initialFilter.statusFilter) setStatusFilter(initialFilter.statusFilter);
      setPage(1);
      
      if (onFilterConsumed) onFilterConsumed();
    }
  }, [initialFilter]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchOrders();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, statusFilter, pageFilter, page]);

  // Close status dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => setActiveStatusDropdown(null);
    if (activeStatusDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeStatusDropdown]);

  // Status badge with quick-change dropdown
  const renderStatusBadge = (order) => {
    const statusStyle = STATUS_STYLES[order.status] || { badge: 'bg-slate-100 text-slate-700 border-slate-200' };
    const isOpen = activeStatusDropdown === order.id;
    
    return (
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveStatusDropdown(isOpen ? null : order.id); }}
          className={clsx("px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold border flex items-center gap-1 cursor-pointer transition-all hover:shadow-md", statusStyle.badge)}
        >
          {order.status || 'أخرى'}
          <ChevronDown className="w-3 h-3" />
        </button>
        
        {isOpen && (
          <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 min-w-[140px] py-1 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-100">تغيير سريع</div>
            {ALL_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => handleQuickStatusChange(order.id, s)}
                className={clsx(
                  "w-full text-right px-3 py-2 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-2",
                  s === order.status ? "text-primary-600 bg-primary-50/50" : "text-slate-700"
                )}
              >
                {s === order.status && <span className="text-primary-500">✓</span>}
                <span className={clsx("px-1.5 py-0.5 rounded text-[10px]", STATUS_STYLES[s]?.badge || 'bg-slate-100')}>{s}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Check if order is from Shopify (auto-imported)
  const isShopifyOrder = (order) => {
    return order.source === 'shopify' || order.source === 'Shopify' || order.shopify_id;
  };

  // UI rendering helper for cards (Mobile view)
  const renderOrderCard = (order) => {
    const statusStyle = STATUS_STYLES[order.status] || { badge: 'bg-slate-100 text-slate-700 border-slate-200', row: 'bg-white' };
    
    return (
      <div key={order.id} className={clsx(
        "bg-white rounded-2xl p-4 border transition-all relative overflow-hidden",
        selectedOrders.has(order.id) ? "border-primary-400 bg-primary-50/20" : "border-slate-200"
      )}>
        {/* Left Status Bar */}
        <div className={clsx("absolute top-0 right-0 w-1.5 h-full", statusStyle.badge.split(' ')[0])}></div>

        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={selectedOrders.has(order.id)}
              onChange={() => toggleSelect(order.id)}
              className="w-5 h-5 cursor-pointer accent-primary-600 rounded"
            />
            <span className="font-mono font-bold text-slate-800 text-sm">#{order.id}</span>
            {isShopifyOrder(order) && (
              <span className="bg-green-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">
                <Zap className="w-2.5 h-2.5" />Auto
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className={clsx("text-[9px] w-16 text-center truncate px-1.5 py-1 rounded-md font-bold shadow-sm", getPageColor(order.page))} title={order.page}>
              {order.page || 'بدون صفحة'}
            </span>
            {renderStatusBadge(order)}
          </div>
        </div>

        <div className="space-y-3 mt-4">
          <div className="flex items-start justify-between">
             <div className="font-bold text-slate-800 text-base">{order.customer || 'عميل محتمل'}</div>
             <button onClick={() => { setEditingOrder(order); setIsEditModalOpen(true); }} className="text-primary-600 font-bold text-sm hover:underline bg-primary-50 px-3 py-1 rounded-lg">
                ✏️ تعديل
             </button>
          </div>
          
          <div className="flex items-center gap-2 justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
            <div className="font-mono text-slate-700 text-sm font-bold" dir="ltr">{order.phone || 'بدون رقم'}</div>
            <div className="flex gap-2">
              <button onClick={() => handleWhatsApp(order)} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-md"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.015c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg></button>
              <button onClick={() => handleCopyMessage(order)} className="p-1.5 bg-blue-100 text-blue-600 rounded-md"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></button>
            </div>
          </div>

          <div className="text-sm font-semibold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="text-slate-400 text-xs ml-1">المنتج:</span> {order.item || '—'}
          </div>

          {order.notes && (
            <div className="text-xs text-yellow-800 bg-yellow-50 p-2 rounded-lg font-bold border border-yellow-100">
               {order.notes}
            </div>
          )}
          
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
             <div className="text-xs text-slate-500 font-bold">{order.date || order.created_at?.split('T')[0]}</div>
             <div className="font-black text-lg text-primary-700">
               {(Number(order.productPrice) || 0) + (Number(order.shippingPrice) || 0)} <span className="text-xs">ج.م</span>
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in relative h-full flex flex-col">
      {/* Table Header Controls */}
      <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-20">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="ابحث برقم الطلب، الاسم، أو الموبايل..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="custom-input pl-4 pr-10 hover:shadow-md transition-shadow w-full"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select 
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="custom-input w-full md:w-40 cursor-pointer"
            >
              <option value="الكل">جميع الحالات</option>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select 
              value={pageFilter}
              onChange={(e) => { setPageFilter(e.target.value); setPage(1); }}
              className="custom-input w-full md:w-40 cursor-pointer"
            >
              <option value="الكل">كل البراندات</option>
              {AVAILABLE_PAGES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 w-full md:w-auto flex-wrap">
          <button onClick={fetchOrders} className="btn-secondary flex-1 md:flex-none justify-center flex items-center gap-2 group p-2 px-3">
            <RefreshCw className={clsx("w-4 h-4 text-slate-600 transition-transform", loading && "animate-spin text-primary-600")} />
          </button>

          <button onClick={handlePrint} className="btn-secondary flex-1 md:flex-none justify-center flex items-center gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">طباعة</span>
          </button>
          
          <button onClick={exportToExcel} className="btn-secondary flex-1 md:flex-none justify-center flex items-center gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">إكسيل</span>
          </button>

          <button onClick={() => setIsAddModalOpen(true)} className="btn-primary flex-1 md:flex-none justify-center flex items-center gap-2 shadow-primary-500/40">
            <Plus className="w-5 h-5" />
            <span>إضافة أوردر</span>
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block glass-panel flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-right text-sm whitespace-nowrap">
          <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
            <tr>
              <th className="px-4 py-4 w-10">
                <input 
                  type="checkbox" 
                  onChange={toggleSelectAll} 
                  checked={orders.length > 0 && selectedOrders.size === orders.length}
                  className="w-4 h-4 cursor-pointer accent-primary-600 rounded"
                />
              </th>
              <th className="px-4 py-4">رقم الطلب</th>
              <th className="px-4 py-4">الصفحة</th>
              <th className="px-4 py-4">العميل</th>
              <th className="px-4 py-4">المنتج</th>
              <th className="px-4 py-4">الحالة</th>
              <th className="px-4 py-4">الملاحظات</th>
              <th className="px-4 py-4">الإجمالي (ج.م)</th>
              <th className="px-4 py-4">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-5"><div className="h-4 bg-slate-200 rounded w-4"></div></td>
                  <td className="px-4 py-5"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                  <td className="px-4 py-5"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                  <td className="px-4 py-5"><div className="h-8 bg-slate-200 rounded w-32"></div></td>
                  <td className="px-4 py-5"><div className="h-4 bg-slate-200 rounded w-40"></div></td>
                  <td className="px-4 py-5"><div className="h-6 bg-slate-200 rounded-full w-24"></div></td>
                  <td className="px-4 py-5"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                  <td className="px-4 py-5"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                  <td className="px-4 py-5"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                </tr>
              ))
            ) : orders.length === 0 ? (
               <tr>
                <td colSpan="9" className="px-6 py-16 text-center text-slate-500 font-medium">
                  لا توجد طلبات مطابقة للبحث أو الفلتر المختار
                </td>
              </tr>
            ) : (
              orders.map(order => {
                const statusStyle = STATUS_STYLES[order.status] || { badge: 'bg-slate-100 text-slate-700 border-slate-200', row: 'hover:bg-slate-50/80 bg-white' };
                return (
                <tr 
                  key={order.id} 
                  className={clsx("transition-colors group cursor-pointer", statusStyle.row, selectedOrders.has(order.id) && "bg-primary-50/50")}
                  onDoubleClick={() => { setEditingOrder(order); setIsEditModalOpen(true); }}
                >
                  <td className="px-4 py-3">
                    <input 
                      type="checkbox" 
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      className="w-4 h-4 cursor-pointer accent-primary-600 rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-700 text-xs">{order.id}</span>
                      {isShopifyOrder(order) && (
                        <span className="bg-green-500 text-white text-[7px] font-black px-1 py-0.5 rounded flex items-center gap-0.5" title="أوردر أوتوماتيك من شوبيفاي">
                          <Zap className="w-2.5 h-2.5" />
                        </span>
                      )}
                      <button 
                        onClick={() => { setEditingOrder(order); setIsEditModalOpen(true); }} 
                        className="text-primary-600 font-bold hover:underline opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-primary-50 px-2 py-0.5 rounded"
                      >
                        ✏️
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx("text-[10px] w-20 text-center inline-block truncate px-2 py-1 rounded-md font-bold shadow-sm", getPageColor(order.page))} title={order.page}>
                      {order.page || 'بدون صفحة'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{order.customer || 'عميل محتمل'}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-[11px] text-slate-600 font-medium bg-white/60 px-1.5 rounded border border-slate-200" dir="ltr">{order.phone || 'بدون رقم'}</div>
                      <button onClick={(e) => { e.stopPropagation(); handleWhatsApp(order); }} className="text-emerald-500 hover:text-emerald-600 transition-colors bg-emerald-50 p-1 rounded-md" title="مراسلة واتساب">
                         <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.015c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleCopyMessage(order); }} className="text-blue-500 hover:text-blue-600 transition-colors bg-blue-50 p-1 rounded-md" title="نسخ رسالة تأكيد">
                         <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[150px] truncate font-medium text-slate-800" title={order.item}>{order.item || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    {renderStatusBadge(order)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[150px] truncate text-slate-600 text-xs font-semibold bg-white/50 px-2 py-1 rounded" title={order.notes}>
                      {order.notes || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-black text-slate-800">
                    {(Number(order.productPrice) || 0) + (Number(order.shippingPrice) || 0)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-medium text-xs border-r border-slate-100/50">
                    {order.date || order.created_at?.split('T')[0] || '—'}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex-1 overflow-auto custom-scrollbar pb-20 space-y-4">
        {/* Select All Checkbox for Mobile */}
        {orders.length > 0 && !loading && (
          <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
             <input 
                type="checkbox" 
                onChange={toggleSelectAll} 
                checked={orders.length > 0 && selectedOrders.size === orders.length}
                className="w-5 h-5 cursor-pointer accent-primary-600 rounded"
             />
             <span className="font-bold text-slate-700 text-sm">تحديد كل الطلبات في هذه الصفحة</span>
          </div>
        )}

        {loading ? (
             [...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse h-40">
                   <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
                   <div className="h-6 bg-slate-200 rounded w-2/3 mb-4"></div>
                   <div className="h-10 bg-slate-100 rounded-lg w-full mb-2"></div>
                </div>
             ))
        ) : orders.length === 0 ? (
            <div className="py-16 text-center text-slate-500 font-medium bg-white rounded-2xl border border-slate-100">
              لا توجد طلبات مطابقة للبحث أو الفلتر المختار
            </div>
        ) : (
            orders.map(order => renderOrderCard(order))
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && orders.length > 0 && (
         <div className="glass-panel p-4 flex items-center justify-between text-sm font-semibold text-slate-600 sticky bottom-0 z-20">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50 transition-colors"
            >
              السابق
            </button>
            <span>الصفحة {page}</span>
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
