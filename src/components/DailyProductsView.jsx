import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Package, Search, ClipboardList, CheckCircle2 } from 'lucide-react';

export default function DailyProductsView() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDailyProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('item, quantity')
        .in('status', ['جاري التحضير', 'مراجعة']);

      if (error) throw error;

      // Group by product name
      const productMap = {};
      (data || []).forEach(order => {
        const itemName = (order.item || 'منتج غير معروف').trim();
        const qty = Number(order.quantity) || 1;
        
        if (productMap[itemName]) {
          productMap[itemName] += qty;
        } else {
          productMap[itemName] = qty;
        }
      });

      // Convert to array and sort by quantity descending
      const productList = Object.entries(productMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      setProducts(productList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyProducts();
    
    const subscription = supabase
      .channel('daily-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchDailyProducts();
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, []);

  const filteredProducts = products.filter(p => p.name.includes(searchQuery));

  return (
    <div className="space-y-6 animate-fade-in relative h-full flex flex-col">
      <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">منتجات اليوم (التحضير)</h2>
            <p className="text-xs text-slate-500 font-bold">
              إجمالي المنتجات المطلوبة اليوم: {products.reduce((acc, curr) => acc + curr.count, 0)}
            </p>
          </div>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="ابحث عن منتج محدد..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="custom-input pl-4 pr-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20 overflow-y-auto custom-scrollbar">
        {loading ? (
           [...Array(8)].map((_, i) => (
             <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 h-32 animate-pulse flex flex-col justify-center gap-3">
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                <div className="h-8 bg-slate-200 rounded-lg w-1/3"></div>
             </div>
           ))
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
            <CheckCircle2 className="w-16 h-16 mb-4 text-emerald-300" />
            <p className="font-bold text-xl text-slate-500">لا توجد منتجات للتحضير مبدئياً</p>
            <p className="text-sm">لقد تم تجهيز جميع الطلبات أو لا توجد طلبات جديدة.</p>
          </div>
        ) : (
          filteredProducts.map((product, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-indigo-50 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col gap-2">
              <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-indigo-400 to-indigo-600"></div>
              
              <h3 className="text-lg font-black text-slate-800 leading-tight pr-2">{product.name}</h3>
              
              <div className="flex items-center gap-2 pr-2 mt-2">
                <div className="bg-indigo-50 text-indigo-700 font-black text-2xl px-4 py-2 rounded-xl flex items-center gap-2">
                  <span>{product.count}</span>
                  <span className="text-xs font-bold text-indigo-500">قطعة</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
