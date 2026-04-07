import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { PieChart, BarChart3, Activity, Calendar, Tag, Store } from 'lucide-react';
import clsx from 'clsx';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [statsDateFrom, setStatsDateFrom] = useState('');
  const [statsDateTo, setStatsDateTo] = useState('');
  const [selectedPageStatus, setSelectedPageStatus] = useState({});

  const orderStatuses = ['جاري التحضير', 'مراجعة', 'الشحن', 'تم', 'استبدال', 'مرتجع', 'الغاء', 'تاجيل'];

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('status, page, productPrice, shippingPrice, date, created_at');
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getIsoDate = (o) => o.date || o.created_at?.split('T')[0] || '';

  // Pages available
  const pages = useMemo(() => {
    const pageSet = new Set(orders.map(o => o.page).filter(Boolean));
    return [...pageSet].sort();
  }, [orders]);

  // Status counts
  const statusCounts = useMemo(() => {
    return orders.reduce((acc, o) => {
      const s = o.status || 'غير محدد';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
  }, [orders]);

  const total = orders.length;

  const getStatusColor = (status) => {
    const colors = {
      'تم': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'جاري التحضير': 'bg-blue-100 text-blue-800 border-blue-200',
      'الشحن': 'bg-purple-100 text-purple-800 border-purple-200',
      'مرتجع': 'bg-rose-100 text-rose-800 border-rose-200',
      'استبدال': 'bg-orange-100 text-orange-800 border-orange-200',
      'مراجعة': 'bg-amber-100 text-amber-800 border-amber-200',
      'الغاء': 'bg-red-100 text-red-800 border-red-200',
      'تاجيل': 'bg-slate-200 text-slate-800 border-slate-300',
    };
    return colors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getBarColor = (status) => {
    const c = { 'تم': 'bg-emerald-500', 'جاري التحضير': 'bg-blue-500', 'الشحن': 'bg-purple-500', 'مرتجع': 'bg-rose-500', 'استبدال': 'bg-orange-500', 'مراجعة': 'bg-amber-500', 'الغاء': 'bg-red-500', 'تاجيل': 'bg-slate-400' };
    return c[status] || 'bg-slate-500';
  };

  const getThemeBorder = (page) => {
    const themes = ['border-sky-300', 'border-indigo-300', 'border-rose-300', 'border-amber-300', 'border-emerald-300', 'border-fuchsia-300', 'border-cyan-300'];
    let hash = 0;
    for (let i = 0; i < page.length; i++) hash += page.charCodeAt(i);
    return themes[hash % themes.length];
  };

  const togglePageStatus = (page, status) => {
    const cur = selectedPageStatus[page] || ['تم'];
    const next = cur.includes(status) ? (cur.length > 1 ? cur.filter(s => s !== status) : cur) : [...cur, status];
    setSelectedPageStatus(prev => ({ ...prev, [page]: next }));
  };

  return (
    <div className="space-y-6 animate-fade-in relative h-full flex flex-col pb-20 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="bg-fuchsia-100 p-2 rounded-lg text-fuchsia-600">
          <PieChart className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800">تقارير وإحصائيات الصفحات</h2>
          <p className="text-slate-500 font-semibold text-xs mt-0.5">مؤشرات الأداء لكل صفحة مع إمكانية تحديد الحالات والفترات</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-fuchsia-600"></div>
        </div>
      ) : (
        <>
          {/* Status Distribution */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-bold text-slate-800">حالات الطلبات</h3>
            </div>
            <div className="space-y-5">
              {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                return (
                  <div key={status} className="relative">
                    <div className="flex justify-between items-end mb-1">
                      <span className="font-bold text-slate-700 text-sm">{status}</span>
                      <div className="text-right">
                        <span className="font-black text-slate-800">{count}</span>
                        <span className="text-xs text-slate-400 mr-1 opacity-70">({percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-2.5 rounded-full ${getBarColor(status)}`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===== Page Statistics (like old system) ===== */}
          <div>
            <div className="glass-panel p-4 md:p-5 rounded-2xl shadow-sm border border-white flex flex-col md:flex-row items-center gap-3 md:gap-4 justify-between mb-4">
              <div className="flex items-center gap-2 font-bold text-sm md:text-base text-slate-700">
                <Calendar className="w-5 h-5" /> <span>تحديد فترة الإحصائيات:</span>
              </div>
              <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto flex-wrap">
                <div className="flex items-center gap-2 flex-1 md:flex-none">
                  <label className="text-xs md:text-sm text-slate-500">من:</label>
                  <input type="date" className="px-2 py-1.5 md:px-3 md:py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-xs md:text-sm font-bold w-full" value={statsDateFrom} onChange={e => setStatsDateFrom(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 flex-1 md:flex-none">
                  <label className="text-xs md:text-sm text-slate-500">إلى:</label>
                  <input type="date" className="px-2 py-1.5 md:px-3 md:py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-xs md:text-sm font-bold w-full" value={statsDateTo} onChange={e => setStatsDateTo(e.target.value)} />
                </div>
                {(statsDateFrom || statsDateTo) && (
                  <button onClick={() => { setStatsDateFrom(''); setStatsDateTo(''); }} className="w-full md:w-auto px-4 py-1.5 md:py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs md:text-sm rounded-lg border border-red-200 transition-colors">
                    إلغاء الفلتر ✖
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {pages.map((page, idx) => {
                const pageOrders = orders.filter(o => o.page === page && (!statsDateFrom || getIsoDate(o) >= statsDateFrom) && (!statsDateTo || getIsoDate(o) <= statsDateTo));
                const activeStatuses = selectedPageStatus[page] || ['تم'];
                const activeOrders = pageOrders.filter(o => activeStatuses.includes(o.status));
                const totalShipping = activeOrders.reduce((sum, o) => sum + Number(o.shippingPrice || 0), 0);
                const totalProducts = activeOrders.reduce((sum, o) => sum + Number(o.productPrice || 0), 0);
                const pageRevenue = totalShipping + totalProducts;

                return (
                  <div key={idx} className={`bg-white rounded-2xl shadow-md border-2 p-4 md:p-6 ${getThemeBorder(page)} transition-all hover:shadow-lg flex flex-col`}>
                    <div className="flex items-center gap-3 md:gap-4 border-b border-slate-100 pb-3 md:pb-4 mb-3 md:mb-4">
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shadow-inner bg-sky-50 text-sky-600">
                        <Store className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-black text-lg md:text-2xl text-sky-900">{page}</h3>
                        <p className="text-slate-500 text-[10px] md:text-sm font-bold mt-1">إجمالي أوردرات الصفحة: <span className="text-slate-800">{pageOrders.length}</span></p>
                      </div>
                    </div>

                    <div className="mb-4 md:mb-6">
                      <p className="text-[10px] md:text-xs font-bold text-slate-400 mb-2 md:mb-3">اضغط للتحديد — يمكنك اختيار أكثر من حالة لحساب الإجمالي معاً</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 md:gap-2">
                        {orderStatuses.map(status => {
                          const count = pageOrders.filter(o => o.status === status).length;
                          const isSelected = activeStatuses.includes(status);
                          return (
                            <button
                              key={status}
                              onClick={() => togglePageStatus(page, status)}
                              className={clsx(
                                "flex justify-between items-center px-2 md:px-3 py-1.5 md:py-2 rounded-xl border text-[10px] md:text-xs font-bold transition-all hover:scale-105",
                                getStatusColor(status),
                                isSelected ? 'ring-2 ring-slate-800 ring-offset-1 scale-105 shadow-md' : 'opacity-60 hover:opacity-100'
                              )}
                            >
                              <span className="truncate mr-1 flex items-center gap-1">{isSelected && <span className="text-[8px]">✓</span>}{status}</span>
                              <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-white text-slate-800">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-auto bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-100 space-y-2 md:space-y-3">
                      <div className="flex justify-between text-xs md:text-sm items-center border-b border-slate-200 pb-2 mb-2">
                        <span className="text-slate-700 font-black flex items-center gap-1 flex-wrap">
                          إحصائيات: {activeStatuses.map(s => <span key={s} className={`px-2 py-0.5 rounded text-[10px] md:text-xs ${getStatusColor(s)}`}>{s}</span>)}
                        </span>
                        <span className="font-bold text-slate-500 bg-white px-2 py-0.5 rounded border shadow-sm shrink-0">العدد: {activeOrders.length}</span>
                      </div>
                      <div className="flex justify-between text-xs md:text-sm items-center">
                        <span className="text-slate-500 font-bold">إجمالي مبالغ المنتجات:</span>
                        <span className="font-black text-slate-700 bg-white px-2 py-1 rounded border shadow-sm">{totalProducts.toLocaleString()} ج</span>
                      </div>
                      <div className="flex justify-between text-xs md:text-sm items-center">
                        <span className="text-slate-500 font-bold">إجمالي مبالغ الشحن:</span>
                        <span className="font-black text-slate-700 bg-white px-2 py-1 rounded border shadow-sm">{totalShipping.toLocaleString()} ج</span>
                      </div>
                      <div className="pt-2 md:pt-3 border-t border-slate-200 flex justify-between text-base md:text-lg items-center">
                        <span className="text-slate-800 font-black">الإجمالي الكلي:</span>
                        <span className="font-black text-green-600 bg-green-50 px-2 md:px-3 py-1 rounded-lg border border-green-200 shadow-sm">{pageRevenue.toLocaleString()} ج.م</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
