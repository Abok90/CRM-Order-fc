import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Wallet, TrendingUp, HandCoins, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

export default function FinanceView() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ revenue: 0, shippingCost: 0, deliveredCount: 0 });

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      // جلب الطلبات المسلمة (تم)
      const { data, error } = await supabase
        .from('orders')
        .select('productPrice, shippingPrice')
        .eq('status', 'تم');

      if (error) throw error;

      let totalRevenue = 0;
      let totalShipping = 0;

      (data || []).forEach(order => {
        totalRevenue += Number(order.productPrice) || 0;
        totalShipping += Number(order.shippingPrice) || 0;
      });

      setStats({
        revenue: totalRevenue,
        shippingCost: totalShipping,
        deliveredCount: data ? data.length : 0
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const netProfit = stats.revenue; // Profit from products. If shipping isn't included in profit, we leave it separated.

  return (
    <div className="space-y-6 animate-fade-in relative h-full flex flex-col">
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
          <Wallet className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800">الحسابات والمالية</h2>
          <p className="text-slate-500 font-semibold text-xs mt-0.5">ملخص الأرباح والطلبات المُسلمة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Revenue Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-50 rounded-full blur-2xl group-hover:bg-emerald-100 transition-colors"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-slate-500 font-bold mb-1 text-sm">إجمالي إيرادات المنتجات</p>
              {loading ? <div className="h-8 bg-slate-200 rounded w-24 animate-pulse"></div> : (
                <h3 className="text-3xl font-black text-slate-800">{stats.revenue.toLocaleString()} <span className="text-base text-slate-500">ج.م</span></h3>
              )}
            </div>
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-2xl shadow-inner">
               <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 text-xs font-bold text-emerald-600 bg-emerald-50 inline-block px-2 py-1 rounded">
             {stats.deliveredCount} أوردر مُسلم
          </div>
        </div>

        {/* Shipping Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-50 rounded-full blur-2xl group-hover:bg-blue-100 transition-colors"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-slate-500 font-bold mb-1 text-sm">إجمالي مصاريف الشحن</p>
              {loading ? <div className="h-8 bg-slate-200 rounded w-24 animate-pulse"></div> : (
                <h3 className="text-3xl font-black text-slate-800">{stats.shippingCost.toLocaleString()} <span className="text-base text-slate-500">ج.م</span></h3>
              )}
            </div>
            <div className="w-12 h-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-2xl shadow-inner">
               <ExternalLink className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Net Profit Summary */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-3xl shadow-xl relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-500/20 rounded-full blur-3xl group-hover:bg-primary-500/30 transition-colors"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-slate-400 font-bold mb-1 text-sm">إجمالي التحصيلات الكلية</p>
              {loading ? <div className="h-8 bg-white/20 rounded w-24 animate-pulse"></div> : (
                <h3 className="text-3xl font-black text-white">{(stats.revenue + stats.shippingCost).toLocaleString()} <span className="text-base text-slate-400">ج.م</span></h3>
              )}
            </div>
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md text-white flex items-center justify-center rounded-2xl shadow-inner border border-white/10">
               <HandCoins className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 text-xs font-bold text-slate-300">
             (الإيرادات + الشحن)
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mt-4 flex items-center justify-center text-center">
        <div className="max-w-sm">
           <Wallet className="w-16 h-16 mx-auto mb-4 text-slate-200" />
           <h3 className="text-xl font-bold text-slate-500 mb-2">سجلات المصروفات والأرباح</h3>
           <p className="text-sm text-slate-400 leading-relaxed">
             هذه الشاشة الأولى والمبسطة للمالية (تجميع الأوردرات المُسلمة). يمكن إضافة أي بنود مصروفات، أو رواتب موظفين هنا لاحقاً متى أردت.
           </p>
        </div>
      </div>
    </div>
  );
}
