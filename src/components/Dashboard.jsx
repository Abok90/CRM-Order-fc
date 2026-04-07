import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Package, TrendingUp, Truck, CheckCircle, Tag, Layers, MousePointerClick } from 'lucide-react';
import clsx from 'clsx';

export default function Dashboard({ onNavigateWithFilter }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase.from('orders').select('status, page');
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

  const statusCounts = orders.reduce((acc, curr) => {
    const s = curr.status || 'غير محدد';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const pageCounts = orders.reduce((acc, curr) => {
    const p = curr.page || 'بدون صفحة';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  const sortedStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  const sortedPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]);

  const STATUS_STYLES = {
    'جاري التحضير': { icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200 hover:border-amber-400' },
    'الشحن': { icon: Truck, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200 hover:border-purple-400' },
    'تم': { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200 hover:border-emerald-400' },
    'استبدال': { icon: Package, color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200 hover:border-orange-400' },
    'مراجعة': { icon: Package, color: 'text-amber-800', bg: 'bg-amber-100', border: 'border-amber-300 hover:border-amber-500' },
    'مرتجع': { icon: Package, color: 'text-rose-600', bg: 'bg-rose-100', border: 'border-rose-200 hover:border-rose-400' },
    'الغاء': { icon: Package, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200 hover:border-red-400' },
    'تاجيل': { icon: Package, color: 'text-slate-600', bg: 'bg-slate-200', border: 'border-slate-300 hover:border-slate-400' },
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">نظرة عامة على النظام</h2>
          <p className="text-slate-500 mt-1 font-medium">مرحباً بك! اضغط على أي بطاقة للتوجه لها مباشرة.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Quick Statuses Section */}
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
                )
              })}
            </div>
          </div>

          {/* Brands Section */}
          <div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4">
              <Tag className="w-5 h-5 text-indigo-500" />
              <span>البراندات / الصفحات</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {sortedPages.map(([page, count], idx) => (
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
