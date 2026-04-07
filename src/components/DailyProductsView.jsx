import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Search, ClipboardList, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function DailyProductsView() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryStock, setInventoryStock] = useState({});
  const [pageMap, setPageMap] = useState({});
  const [prepCount, setPrepCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  // Load saved stock from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('inventoryStock');
      if (saved) setInventoryStock(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const updateStock = (productName, value) => {
    const updated = { ...inventoryStock, [productName]: value };
    setInventoryStock(updated);
    localStorage.setItem('inventoryStock', JSON.stringify(updated));
  };

  const fetchDailyProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('item, quantity, page, status')
        .in('status', ['جاري التحضير', 'مراجعة']);

      if (error) throw error;

      const orders = data || [];
      setPrepCount(orders.filter(o => o.status === 'جاري التحضير').length);
      setReviewCount(orders.filter(o => o.status === 'مراجعة').length);

      // Group by product name, also track pages
      const productMap = {};
      const pMap = {};
      orders.forEach(order => {
        const lines = (order.item || 'منتج غير معروف').split('\n').map(l => l.replace(/^[-–•*]\s*/, '').trim()).filter(Boolean);
        const pg = order.page || 'غير محدد';
        if (!pMap[pg]) pMap[pg] = 0;
        pMap[pg]++;

        lines.forEach(line => {
          const key = line;
          if (!productMap[key]) productMap[key] = { name: line, count: 0, pages: {} };
          productMap[key].count++;
          productMap[key].pages[pg] = (productMap[key].pages[pg] || 0) + 1;
        });
      });

      setPageMap(pMap);

      const productList = Object.values(productMap)
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
  const totalRequired = products.reduce((acc, curr) => acc + curr.count, 0);
  const totalOrders = prepCount + reviewCount;
  const today = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-5 animate-fade-in relative h-full flex flex-col max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-l from-emerald-800 via-teal-800 to-cyan-800 rounded-2xl p-5 md:p-6 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="font-black text-xl md:text-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5" />
              </div>
              بيان الجرد اليومي
            </h2>
            <p className="text-teal-200 text-sm font-bold mt-1">المنتجات المطلوبة لأوردرات "جاري التحضير" و"مراجعة" — {today}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2.5 text-center">
              <div className="font-black text-2xl">{totalOrders}</div>
              <div className="text-[10px] text-teal-200 font-bold">إجمالي الأوردرات</div>
            </div>
            <div className="bg-sky-500/30 backdrop-blur rounded-xl px-3 py-2 text-center">
              <div className="font-black text-lg text-sky-200">{prepCount}</div>
              <div className="text-[9px] text-sky-300 font-bold">جاري التحضير</div>
            </div>
            <div className="bg-yellow-500/30 backdrop-blur rounded-xl px-3 py-2 text-center">
              <div className="font-black text-lg text-yellow-200">{reviewCount}</div>
              <div className="text-[9px] text-yellow-300 font-bold">مراجعة</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2.5 text-center">
              <div className="font-black text-2xl text-yellow-300">{products.length}</div>
              <div className="text-[10px] text-teal-200 font-bold">منتج مختلف</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass-panel p-3 flex items-center gap-3 sticky top-0 z-20">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="ابحث عن منتج محدد..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="custom-input pl-4 pr-10 w-full"
          />
        </div>
      </div>

      {/* Pages distribution summary */}
      {Object.keys(pageMap).length > 1 && (
        <div className="glass-panel p-4 rounded-2xl border border-white shadow-sm">
          <h3 className="font-black text-sm text-slate-700 mb-3 flex items-center gap-2">
            📦 توزيع الأوردرات على الصفحات
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(pageMap).sort((a,b)=>b[1]-a[1]).map(([pg, cnt]) => (
              <div key={pg} className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="font-black text-teal-800 text-xs">{pg}</span>
                <span className="bg-teal-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg">{cnt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
        </div>
      ) : totalOrders === 0 ? (
        <div className="glass-panel rounded-2xl p-16 text-center">
          <CheckCircle2 className="w-16 h-16 mb-4 text-emerald-300 mx-auto" />
          <p className="font-bold text-xl text-slate-500">لا توجد أوردرات بحالة "جاري التحضير" أو "مراجعة" حالياً</p>
          <p className="text-sm text-slate-400 mt-2">لقد تم تجهيز جميع الطلبات أو لا توجد طلبات جديدة.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-white shadow-sm overflow-hidden pb-20">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-700 flex items-center gap-2">
              📋 قائمة المنتجات المطلوبة
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">{filteredProducts.length} صنف</span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 w-10">#</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500">اسم المنتج</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 text-center w-20">مطلوب</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 text-center w-28">المتاح عندي</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 text-center w-20">المتبقي</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500">توزيع الصفحات</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((prod, idx) => {
                  const avail = inventoryStock[prod.name];
                  const availNum = avail === '' || avail === undefined ? null : Number(avail);
                  const remaining = availNum !== null ? availNum - prod.count : null;
                  return (
                    <tr key={idx} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-sm text-slate-800">{prod.name}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-emerald-100 text-emerald-800 font-black text-sm px-3 py-1 rounded-xl border border-emerald-200">{prod.count}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number" min="0"
                          className="w-20 text-center px-2 py-1 border border-slate-200 rounded-lg text-sm font-black outline-none focus:ring-2 focus:ring-sky-400 bg-white"
                          placeholder="—"
                          value={inventoryStock[prod.name] ?? ''}
                          onChange={e => updateStock(prod.name, e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {remaining === null ? (
                          <span className="text-slate-300 font-bold text-sm">—</span>
                        ) : remaining >= 0 ? (
                          <span className="bg-green-100 text-green-800 font-black text-sm px-3 py-1 rounded-xl border border-green-200">+{remaining}</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 font-black text-sm px-3 py-1 rounded-xl border border-red-200 animate-pulse">{remaining}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(prod.pages).map(([pg, cnt]) => (
                            <span key={pg} className="text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-lg">{pg}: {cnt}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-3 p-4">
            {filteredProducts.map((prod, idx) => {
              const avail = inventoryStock[prod.name];
              const availNum = avail === '' || avail === undefined ? null : Number(avail);
              const remaining = availNum !== null ? availNum - prod.count : null;
              return (
                <div key={idx} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-teal-400 to-teal-600"></div>
                  
                  <div className="flex items-start justify-between mb-3 pr-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold">#{idx + 1}</span>
                      <h4 className="font-black text-slate-800 text-sm leading-tight">{prod.name}</h4>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 font-black text-sm px-3 py-1 rounded-xl border border-emerald-200 shrink-0">
                      {prod.count} مطلوب
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">المتاح عندي</label>
                      <input
                        type="number" min="0"
                        className="w-full text-center px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-black outline-none focus:ring-2 focus:ring-sky-400 bg-white"
                        placeholder="—"
                        value={inventoryStock[prod.name] ?? ''}
                        onChange={e => updateStock(prod.name, e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">المتبقي</label>
                      <div className="h-[34px] flex items-center justify-center">
                        {remaining === null ? (
                          <span className="text-slate-300 font-bold text-sm">—</span>
                        ) : remaining >= 0 ? (
                          <span className="bg-green-100 text-green-800 font-black text-sm px-3 py-1 rounded-xl border border-green-200">+{remaining}</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 font-black text-sm px-3 py-1 rounded-xl border border-red-200 animate-pulse flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />{remaining}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {Object.keys(prod.pages).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(prod.pages).map(([pg, cnt]) => (
                        <span key={pg} className="text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-lg">{pg}: {cnt}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
