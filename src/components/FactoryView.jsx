import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Package, Search, Factory, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

export default function FactoryView() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFactoryOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'جاري التحضير')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFactoryOrders();
    
    // Subscribe to real-time changes
    const subscription = supabase
      .channel('factory-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `status=eq.جاري التحضير` }, () => {
        fetchFactoryOrders();
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, []);

  const markAsReady = async (id) => {
    try {
      const { error } = await supabase.from('orders').update({ status: 'الشحن' }).eq('id', id);
      if (error) throw error;
      setOrders(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تحديث الحالة');
    }
  };

  const filteredOrders = orders.filter(o => o.item?.includes(searchQuery) || o.id?.toString().includes(searchQuery));

  return (
    <div className="space-y-6 animate-fade-in relative h-full flex flex-col">
      <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">شاشة المصنع (التجهيز)</h2>
            <p className="text-xs text-slate-500 font-bold">الطلبات الجاري تحضيرها: {orders.length}</p>
          </div>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="ابحث بالمنتج أو رقم الطلب..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="custom-input pl-4 pr-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20 overflow-y-auto custom-scrollbar">
        {loading ? (
           [...Array(8)].map((_, i) => (
             <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 h-40 animate-pulse flex flex-col justify-between">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
             </div>
           ))
        ) : filteredOrders.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
            <CheckCircle2 className="w-16 h-16 mb-4 text-emerald-300" />
            <p className="font-bold text-xl text-slate-500">لا توجد طلبات معلقة</p>
            <p className="text-sm">لقد تم تجهيز جميع الطلبات بنجاح!</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col">
              <div className="absolute top-0 right-0 w-2 h-full bg-amber-400"></div>
              
              <div className="flex justify-between items-start mb-3 mr-2">
                <span className="bg-slate-100 text-slate-600 font-mono text-xs px-2 py-1 rounded font-bold border border-slate-200">
                  #{order.id}
                </span>
                <span className="text-xs font-bold text-slate-400">{order.date || order.created_at?.split('T')[0]}</span>
              </div>
              
              <div className="mb-4 flex-1 pr-2">
                <h3 className="text-lg font-black text-slate-800 leading-tight mb-2">{order.item}</h3>
                {order.notes && (
                  <div className="bg-yellow-50 text-yellow-800 text-xs px-3 py-2 rounded-lg font-bold border border-yellow-200/50">
                    ملاحظة: {order.notes}
                  </div>
                )}
              </div>

              <div className="pr-2 mt-auto">
                <button 
                  onClick={() => markAsReady(order.id)}
                  className="w-full bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200 font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Package className="w-5 h-5" />
                  <span>تأكيد التجهيز للشحن</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
