import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Package, TrendingUp, Truck, CheckCircle, Tag, Layers, MousePointerClick, Users, DollarSign, BarChart3, Clock } from 'lucide-react';
import clsx from 'clsx';

export default function Dashboard({ onNavigateWithFilter, userRole }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, status, page, productPrice, shippingPrice, created_at, user_id, date');
        if (error) throw error;
        setOrders(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'super_admin';

  // ===== Status counts =====
  const statusCounts = useMemo(() => orders.reduce((acc, curr) => {
    const s = curr.status || 'غير محدد';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {}), [orders]);

  // ===== Page counts =====
  const pageCounts = useMemo(() => orders.reduce((acc, curr) => {
    const p = curr.page || 'بدون صفحة';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {}), [orders]);

  const sortedStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  const sortedPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]);

  // ===== Revenue =====
  const totalRevenue = useMemo(() => 
    orders.filter(o => o.status === 'تم').reduce((sum, o) => sum + (Number(o.productPrice) || 0) + (Number(o.shippingPrice) || 0), 0)
  , [orders]);

  const processingCount = (statusCounts['جاري التحضير'] || 0) + (statusCounts['مراجعة'] || 0);
  const deliveredCount = statusCounts['تم'] || 0;

  // ===== Monthly Revenue Chart (last 6 months) =====
  const monthlyRevenue = useMemo(() => {
    const months = {};
    orders.filter(o => o.status === 'تم').forEach(o => {
      const d = o.date || o.created_at?.split('T')[0];
      if (!d) return;
      const [year, month] = d.split('-');
      const key = `${year}-${month}`;
      if (!months[key]) months[key] = { revenue: 0, count: 0, label: '' };
      months[key].revenue += (Number(o.productPrice) || 0) + (Number(o.shippingPrice) || 0);
      months[key].count++;
      const date = new Date(Number(year), Number(month) - 1);
      months[key].label = date.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
    });
    return Object.entries(months)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([, v]) => v);
  }, [orders]);

  // ===== Quick status per page (for admin dashboard) =====
  const orderStatuses = ['جاري التحضير', 'مراجعة', 'الشحن', 'تم', 'استبدال', 'مرتجع', 'الغاء', 'تاجيل'];

  const getStatusColor = (status) => {
    const colors = {
      'جاري التحضير': 'bg-blue-100 text-blue-800 border-blue-200',
      'الشحن': 'bg-purple-100 text-purple-800 border-purple-200',
      'تم': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'استبدال': 'bg-orange-100 text-orange-800 border-orange-200',
      'مراجعة': 'bg-amber-100 text-amber-800 border-amber-200',
      'مرتجع': 'bg-rose-100 text-rose-800 border-rose-200',
      'الغاء': 'bg-red-100 text-red-800 border-red-200',
      'تاجيل': 'bg-slate-200 text-slate-800 border-slate-300',
    };
    return colors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const STATUS_STYLES = {
    'جاري التحضير': { icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200 hover:border-amber-400' },
    'الشحن': { icon: Truck, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200 hover:border-purple-400' },
    'تم': { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200 hover:border-emerald-400' },
    'استبدال': { icon: Package, color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200 hover:border-orange-400' },
    'مراجعة': { icon: Clock, color: 'text-amber-800', bg: 'bg-amber-100', border: 'border-amber-300 hover:border-amber-500' },
    'مرتجع': { icon: Package, color: 'text-rose-600', bg: 'bg-rose-100', border: 'border-rose-200 hover:border-rose-400' },
    'الغاء': { icon: Package, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200 hover:border-red-400' },
    'تاجيل': { icon: Package, color: 'text-slate-600', bg: 'bg-slate-200', border: 'border-slate-300 hover:border-slate-400' },
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* ===== Top Stats Cards ===== */}
          <div className={`grid gap-3 md:gap-4 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
            <div className="glass-panel p-4 md:p-5 rounded-2xl flex items-center gap-3 transition-all cursor-default" style={{ borderTop: '3px solid #0ea5e9' }}>
              <div className="p-3 bg-sky-50 text-sky-500 rounded-2xl shrink-0 shadow-sm"><Package className="w-5 h-5" /></div>
              <div>
                <p className="text-slate-400 text-[10px] md:text-xs font-bold mb-1">إجمالي الطلبات</p>
                <p className="text-2xl md:text-3xl font-black text-slate-800 leading-none">{orders.length.toLocaleString()}</p>
              </div>
            </div>
            <div className="glass-panel p-4 md:p-5 rounded-2xl flex items-center gap-3 transition-all cursor-default" style={{ borderTop: '3px solid #f59e0b' }}>
              <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl shrink-0 shadow-sm"><Clock className="w-5 h-5" /></div>
              <div>
                <p className="text-slate-400 text-[10px] md:text-xs font-bold mb-1">قيد المعالجة</p>
                <p className="text-2xl md:text-3xl font-black text-amber-600 leading-none">{processingCount.toLocaleString()}</p>
              </div>
            </div>
            <div className="glass-panel p-4 md:p-5 rounded-2xl flex items-center gap-3 transition-all cursor-default" style={{ borderTop: '3px solid #22c55e' }}>
              <div className="p-3 bg-green-50 text-green-500 rounded-2xl shrink-0 shadow-sm"><CheckCircle className="w-5 h-5" /></div>
              <div>
                <p className="text-slate-400 text-[10px] md:text-xs font-bold mb-1">تم التوصيل</p>
                <p className="text-2xl md:text-3xl font-black text-green-600 leading-none">{deliveredCount.toLocaleString()}</p>
              </div>
            </div>
            {isAdmin && (
              <div className="glass-panel p-4 md:p-5 rounded-2xl flex items-center gap-3 transition-all cursor-default" style={{ borderTop: '3px solid #8b5cf6' }}>
                <div className="p-3 bg-purple-50 text-purple-500 rounded-2xl shrink-0 shadow-sm"><DollarSign className="w-5 h-5" /></div>
                <div>
                  <p className="text-slate-400 text-[10px] md:text-xs font-bold mb-1">الإيرادات</p>
                  <p className="text-lg md:text-2xl font-black text-purple-700 leading-none">{totalRevenue.toLocaleString()}<span className="text-[10px] font-bold text-slate-400 mr-0.5">ج.م</span></p>
                </div>
              </div>
            )}
          </div>

          {/* ===== Quick Status Follow-up by Page ===== */}
          {sortedPages.length > 0 && (
            <div>
              <h2 className="font-black text-sm md:text-xl text-slate-800 mb-3 md:mb-4 flex items-center gap-2">
                متابعة الحالات السريعة
                <span className="text-[10px] md:text-sm font-bold text-slate-500">(انقر لعرض الطلبات)</span>
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                {sortedPages.map(([page]) => {
                  const pageOrders = orders.filter(o => (o.page || 'بدون صفحة') === page);
                  if (pageOrders.length === 0) return null;
                  return (
                    <div key={page} className="glass-panel p-4 md:p-5 rounded-2xl shadow-sm border border-white hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2 md:pb-3">
                        <h3 className="font-black text-sm md:text-lg text-sky-900 flex items-center gap-1.5 md:gap-2">
                          <Tag className="w-4 h-4" /> {page}
                        </h3>
                        <span className="bg-sky-100 text-sky-800 text-[10px] md:text-xs font-bold px-2 py-1 rounded-lg">{pageOrders.length} طلب</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 md:gap-2">
                        {orderStatuses.map(status => {
                          const count = pageOrders.filter(o => o.status === status).length;
                          if (count === 0) return null;
                          return (
                            <button
                              key={status}
                              onClick={() => onNavigateWithFilter('status', status)}
                              className={`flex justify-between items-center px-2 md:px-3 py-1.5 md:py-2 rounded-xl border text-[10px] md:text-xs font-bold transition-transform hover:scale-105 ${getStatusColor(status)}`}
                            >
                              <span className="truncate ml-1">{status}</span>
                              <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm text-slate-800">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== Monthly Revenue Chart (Admin only) ===== */}
          {isAdmin && monthlyRevenue.length >= 2 && (
            <div>
              <h2 className="font-black text-sm md:text-xl text-slate-800 mb-3 md:mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                الإيرادات الشهرية
                <span className="text-[10px] md:text-sm font-bold text-slate-500">(طلبات حالة تم)</span>
              </h2>
              <div className="glass-panel p-4 md:p-6 rounded-2xl shadow-sm border border-white">
                {(() => {
                  const maxRev = Math.max(...monthlyRevenue.map(m => m.revenue), 1);
                  const chartH = 140;
                  const colors = ['#0ea5e9', '#6366f1', '#22c55e', '#f59e0b', '#f43f5e', '#8b5cf6'];
                  return (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-end gap-2 justify-around" style={{ height: chartH + 40 }}>
                        {monthlyRevenue.map((m, i) => {
                          const h = Math.max(12, Math.round((m.revenue / maxRev) * chartH));
                          return (
                            <div key={i} className="flex flex-col items-center gap-1 flex-1">
                              <span className="text-[9px] md:text-[10px] font-black text-slate-600 text-center leading-tight">
                                {m.revenue >= 1000 ? (m.revenue / 1000).toFixed(1) + 'k' : m.revenue}
                              </span>
                              <div
                                className="w-full rounded-t-lg transition-all duration-700 relative group"
                                style={{ height: h, background: colors[i % colors.length], minWidth: 28, maxWidth: 80 }}
                              >
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                  {m.revenue.toLocaleString()} ج.م<br />{m.count} طلب
                                </div>
                              </div>
                              <span className="text-[9px] md:text-[10px] font-bold text-slate-500 text-center">{m.label}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold border-t border-slate-100 pt-2">
                        <span>إجمالي الأشهر الـ{monthlyRevenue.length}: {monthlyRevenue.reduce((s, m) => s + m.revenue, 0).toLocaleString()} ج.م</span>
                        <span>أعلى شهر: {Math.max(...monthlyRevenue.map(m => m.revenue)).toLocaleString()} ج.م</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ===== All Statuses Quick Grid ===== */}
          <div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-primary-500" />
              <span>الحالات السريعة</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <div
                onClick={() => onNavigateWithFilter('status', 'الكل')}
                className="glass-panel p-4 rounded-2xl border-2 border-slate-200 hover:border-primary-400 hover:shadow-md cursor-pointer transition-all group flex flex-col justify-between h-28"
              >
                <div className="flex items-start justify-between">
                  <span className="font-bold text-slate-600 group-hover:text-primary-600 transition-colors">كل الطلبات</span>
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500"><Package className="w-4 h-4" /></div>
                </div>
                <div className="text-3xl font-black text-slate-800">{orders.length}</div>
              </div>

              {sortedStatuses.map(([status, count]) => {
                const style = STATUS_STYLES[status] || { icon: Tag, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200 hover:border-slate-400' };
                const Icon = style.icon;
                return (
                  <div
                    key={status}
                    onClick={() => onNavigateWithFilter('status', status)}
                    className={clsx(
                      "p-4 rounded-2xl border-2 bg-white cursor-pointer transition-all group flex flex-col justify-between h-28 hover:-translate-y-1 hover:shadow-lg",
                      style.border
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span className={clsx("font-extrabold text-sm transition-colors", style.color)}>{status}</span>
                      <div className={clsx("p-1.5 rounded-lg", style.bg, style.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-slate-800 flex items-end justify-between">
                      <span>{count}</span>
                      <MousePointerClick className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 mb-2 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===== Brands / Pages Section ===== */}
          <div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4">
              <Tag className="w-5 h-5 text-indigo-500" />
              <span>البراندات / الصفحات</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {sortedPages.map(([page, count]) => (
                <div
                  key={page}
                  onClick={() => onNavigateWithFilter('page', page)}
                  className="bg-white p-4 rounded-2xl border border-indigo-100 hover:border-indigo-400 cursor-pointer transition-all hover:bg-indigo-50/30 group hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                      {page.charAt(0)}
                    </div>
                    <span className="font-bold text-slate-700 truncate">{page}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-slate-500 text-xs font-bold">إجمالي الطلبات</span>
                    <span className="text-xl font-black text-indigo-700">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
