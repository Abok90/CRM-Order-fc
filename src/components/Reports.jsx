import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { PieChart, TrendingUp, BarChart3, Activity } from 'lucide-react';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    statuses: {},
    pages: {}
  });

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('status, page, productPrice');

      if (error) throw error;

      const statuses = {};
      const pages = {};
      let total = 0;

      (data || []).forEach(order => {
        total++;
        // Count Statuses
        const status = order.status || 'أخرى';
        statuses[status] = (statuses[status] || 0) + 1;

        // Sum Pages Revenue
        const page = order.page || 'بدون';
        const price = Number(order.productPrice) || 0;
        pages[page] = (pages[page] || 0) + price;
      });

      setStats({ total, statuses, pages });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'تم': 'bg-emerald-500',
      'جاري التحضير': 'bg-blue-500',
      'الشحن': 'bg-purple-500',
      'مرتجع': 'bg-rose-500',
      'استبدال': 'bg-orange-500',
      'مراجعة': 'bg-amber-500',
      'الغاء': 'bg-red-500'
    };
    return colors[status] || 'bg-slate-500';
  };

  const maxPageRevenue = Math.max(...Object.values(stats.pages), 1);

  return (
    <div className="space-y-6 animate-fade-in relative h-full flex flex-col pb-20 overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="bg-fuchsia-100 p-2 rounded-lg text-fuchsia-600">
          <PieChart className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800">تقارير وإحصائيات</h2>
          <p className="text-slate-500 font-semibold text-xs mt-0.5">مؤشرات الأداء الرئيسية للنظام</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-slate-400" />
            <h3 className="text-lg font-bold text-slate-800">حالات الطلبات</h3>
          </div>
          
          {loading ? (
             <div className="space-y-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-slate-100 rounded w-full animate-pulse"></div>)}
             </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(stats.statuses).sort((a,b) => b[1] - a[1]).map(([status, count]) => {
                const percentage = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;
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
                      <div className={`h-2.5 rounded-full ${getStatusColor(status)}`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Pages Revenue */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-primary-50/50 to-transparent -z-10"></div>
          
          <div className="flex items-center gap-2 mb-6 z-10 relative">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            <h3 className="text-lg font-bold text-slate-800">المبيعات حسب الصفحة (بناءً على طلبات مسجلة)</h3>
          </div>

          {loading ? (
            <div className="flex items-end justify-around h-48 mt-4 animate-pulse">
                {[...Array(5)].map((_, i) => <div key={i} className="w-12 bg-slate-200 rounded-t-lg h-24"></div>)}
             </div>
          ) : (
            <div className="flex items-end justify-between h-56 mt-4 gap-2 border-b border-dashed border-slate-200 pb-2 relative z-10">
              {Object.entries(stats.pages).sort((a,b) => b[1] - a[1]).slice(0, 6).map(([page, revenue]) => {
                const heightPercentage = Math.max((revenue / maxPageRevenue) * 100, 5);
                return (
                  <div key={page} className="group relative flex flex-col justify-end w-full max-w-[48px] h-full">
                    {/* Tooltip */}
                    <div className="absolute -top-10 inset-x-0 mx-auto w-max bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                      {revenue.toLocaleString()} ج.م
                    </div>
                    {/* Bar */}
                    <div 
                      className="w-full bg-gradient-to-t from-primary-600 to-primary-400 rounded-t-lg transition-all duration-500 hover:from-primary-500 hover:to-primary-300 cursor-pointer shadow-lg shadow-primary-500/20"
                      style={{ height: `${heightPercentage}%` }}
                    ></div>
                    {/* Label */}
                    <div className="absolute -bottom-8 w-full text-center truncate text-[10px] font-bold text-slate-500 rotate-[-45deg] origin-top-right whitespace-nowrap">
                      {page}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-12 text-center text-xs font-bold text-slate-400 z-10 relative">
            يعرض أعلى 6 صفحات إيراداً بناءً على سعر المنتج
          </div>
        </div>

      </div>
    </div>
  );
}
