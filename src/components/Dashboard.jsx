import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Package, TrendingUp, Truck, CheckCircle, Tag, Layers, MousePointerClick, DollarSign, BarChart3, Clock, Trophy, ChevronDown, ChevronUp, Star, Zap, Award } from 'lucide-react';
import clsx from 'clsx';

export default function Dashboard({ onNavigateWithFilter, userRole }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [expandedUser, setExpandedUser] = useState(null);

  // Dashboard section order (default)
  const [sectionOrder, setSectionOrder] = useState(['stats', 'leaderboard', 'quickStatus', 'revenue', 'statusGrid', 'brands']);

  useEffect(() => {
    // Load saved section order
    try {
      const saved = localStorage.getItem('dashboardSectionOrder');
      if (saved) setSectionOrder(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersRes, usersRes] = await Promise.all([
          supabase.from('orders').select('id, status, page, productPrice, shippingPrice, created_at, user_id, date'),
          supabase.from('user_roles').select('id, name, role, is_approved')
        ]);
        if (ordersRes.error) throw ordersRes.error;
        setOrders(ordersRes.data || []);
        setUsers(usersRes.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'super_admin' || userRole?.role === 'owner';

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

  // ===== Monthly Revenue =====
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
    return Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([, v]) => v);
  }, [orders]);

  // ===== Leaderboard =====
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const leaderboard = useMemo(() => {
    const userStats = {};
    const activeUsers = users.filter(u => u.is_approved);

    activeUsers.forEach(u => {
      userStats[u.id] = { name: u.name, role: u.role, total: 0, created: 0, edited: 0, delivered: 0, shipped: 0, cancelled: 0, monthly: {} };
    });

    orders.forEach(o => {
      if (!o.user_id || !userStats[o.user_id]) return;
      const d = o.date || o.created_at?.split('T')[0] || '';
      const month = d.slice(0, 7);

      userStats[o.user_id].total++;
      userStats[o.user_id].created++;
      
      if (o.status === 'تم') userStats[o.user_id].delivered++;
      if (o.status === 'الشحن') userStats[o.user_id].shipped++;
      if (o.status === 'الغاء') userStats[o.user_id].cancelled++;

      // Monthly breakdown
      if (!userStats[o.user_id].monthly[month]) userStats[o.user_id].monthly[month] = 0;
      userStats[o.user_id].monthly[month]++;
    });

    return Object.entries(userStats)
      .map(([id, data]) => ({ id, ...data, currentMonthCount: data.monthly[currentMonth] || 0 }))
      .sort((a, b) => b.total - a.total);
  }, [orders, users, currentMonth]);

  const maxTotal = Math.max(...leaderboard.map(u => u.total), 1);

  // ===== User last 6 months history =====
  const getUserHistory = (userId) => {
    const history = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
      const userOrders = orders.filter(o => o.user_id === userId && (o.date || o.created_at?.split('T')[0] || '').startsWith(key));
      history.push({ label, count: userOrders.length, key });
    }
    return history;
  };

  const orderStatuses = ['جاري التحضير', 'مراجعة', 'الشحن', 'تم', 'استبدال', 'مرتجع', 'الغاء', 'تاجيل'];

  const getStatusColor = (status) => {
    const colors = { 'جاري التحضير': 'bg-blue-100 text-blue-800 border-blue-200', 'الشحن': 'bg-purple-100 text-purple-800 border-purple-200', 'تم': 'bg-emerald-100 text-emerald-800 border-emerald-200', 'استبدال': 'bg-orange-100 text-orange-800 border-orange-200', 'مراجعة': 'bg-amber-100 text-amber-800 border-amber-200', 'مرتجع': 'bg-rose-100 text-rose-800 border-rose-200', 'الغاء': 'bg-red-100 text-red-800 border-red-200', 'تاجيل': 'bg-slate-200 text-slate-800 border-slate-300' };
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

  const medalColors = ['from-yellow-400 to-amber-500', 'from-slate-300 to-slate-400', 'from-orange-400 to-orange-500'];
  const medalIcons = [Trophy, Award, Star];

  // ==== Render Sections ====
  const renderSection = (sectionId) => {
    switch (sectionId) {
      case 'stats': return renderStats();
      case 'leaderboard': return renderLeaderboard();
      case 'quickStatus': return renderQuickStatus();
      case 'revenue': return isAdmin ? renderRevenue() : null;
      case 'statusGrid': return renderStatusGrid();
      case 'brands': return renderBrands();
      default: return null;
    }
  };

  const renderStats = () => (
    <div key="stats" className={`grid gap-3 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
      <div className="glass-panel p-3 md:p-5 rounded-2xl flex items-center gap-3" style={{ borderTop: '3px solid #0ea5e9' }}>
        <div className="p-2 md:p-3 bg-sky-50 text-sky-500 rounded-xl md:rounded-2xl shrink-0"><Package className="w-4 h-4 md:w-5 md:h-5" /></div>
        <div><p className="text-slate-400 text-[9px] md:text-xs font-bold mb-0.5">إجمالي الطلبات</p><p className="text-xl md:text-3xl font-black text-slate-800 leading-none">{orders.length.toLocaleString()}</p></div>
      </div>
      <div className="glass-panel p-3 md:p-5 rounded-2xl flex items-center gap-3" style={{ borderTop: '3px solid #f59e0b' }}>
        <div className="p-2 md:p-3 bg-amber-50 text-amber-500 rounded-xl md:rounded-2xl shrink-0"><Clock className="w-4 h-4 md:w-5 md:h-5" /></div>
        <div><p className="text-slate-400 text-[9px] md:text-xs font-bold mb-0.5">قيد المعالجة</p><p className="text-xl md:text-3xl font-black text-amber-600 leading-none">{processingCount.toLocaleString()}</p></div>
      </div>
      <div className="glass-panel p-3 md:p-5 rounded-2xl flex items-center gap-3" style={{ borderTop: '3px solid #22c55e' }}>
        <div className="p-2 md:p-3 bg-green-50 text-green-500 rounded-xl md:rounded-2xl shrink-0"><CheckCircle className="w-4 h-4 md:w-5 md:h-5" /></div>
        <div><p className="text-slate-400 text-[9px] md:text-xs font-bold mb-0.5">تم التوصيل</p><p className="text-xl md:text-3xl font-black text-green-600 leading-none">{deliveredCount.toLocaleString()}</p></div>
      </div>
      {isAdmin && (
        <div className="glass-panel p-3 md:p-5 rounded-2xl flex items-center gap-3" style={{ borderTop: '3px solid #8b5cf6' }}>
          <div className="p-2 md:p-3 bg-purple-50 text-purple-500 rounded-xl md:rounded-2xl shrink-0"><DollarSign className="w-4 h-4 md:w-5 md:h-5" /></div>
          <div><p className="text-slate-400 text-[9px] md:text-xs font-bold mb-0.5">الإيرادات</p><p className="text-lg md:text-2xl font-black text-purple-700 leading-none">{totalRevenue.toLocaleString()}<span className="text-[10px] font-bold text-slate-400 mr-0.5">ج.م</span></p></div>
        </div>
      )}
    </div>
  );

  const renderLeaderboard = () => {
    if (leaderboard.length === 0) return null;
    return (
      <div key="leaderboard">
        <h2 className="font-black text-sm md:text-xl text-slate-800 mb-3 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          لوحة المنافسة
          <span className="text-[9px] md:text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">تحديث شهري</span>
        </h2>
        <div className="space-y-2 md:space-y-3">
          {leaderboard.map((user, idx) => {
            const pct = Math.round((user.total / maxTotal) * 100);
            const isExpanded = expandedUser === user.id;
            const MedalIcon = idx < 3 ? medalIcons[idx] : null;
            const history = isExpanded ? getUserHistory(user.id) : [];
            const maxHist = Math.max(...(history.map(h => h.count)), 1);

            return (
              <div key={user.id} className={clsx("glass-panel rounded-2xl overflow-hidden transition-all border", isExpanded ? "border-primary-200 shadow-lg" : "border-white")}>
                <button onClick={() => setExpandedUser(isExpanded ? null : user.id)} className="w-full p-3 md:p-4 flex items-center gap-2 md:gap-3 text-right">
                  {/* Rank */}
                  <div className={clsx("w-7 h-7 md:w-9 md:h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs md:text-sm", idx < 3 ? `bg-gradient-to-br ${medalColors[idx]} text-white shadow-md` : "bg-slate-100 text-slate-500")}>
                    {MedalIcon ? <MedalIcon className="w-4 h-4 md:w-5 md:h-5" /> : idx + 1}
                  </div>

                  {/* Name + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-xs md:text-sm text-slate-800 truncate">{user.name}</span>
                      <span className="font-black text-sm md:text-lg text-primary-700 shrink-0">{user.total}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 md:h-2.5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-700" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>

                  <ChevronDown className={clsx("w-4 h-4 text-slate-400 shrink-0 transition-transform", isExpanded && "rotate-180")} />
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 md:px-4 pb-3 md:pb-4 space-y-3 animate-fade-in border-t border-slate-100">
                    {/* Stats grid */}
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 md:gap-2 mt-3">
                      {[
                        { label: 'إنشاء', value: user.created, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                        { label: 'تم', value: user.delivered, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        { label: 'شحن', value: user.shipped, color: 'bg-purple-50 text-purple-700 border-purple-200' },
                        { label: 'إلغاء', value: user.cancelled, color: 'bg-red-50 text-red-700 border-red-200' },
                        { label: 'هذا الشهر', value: user.currentMonthCount, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                      ].map(s => (
                        <div key={s.label} className={`rounded-xl p-2 text-center border ${s.color}`}>
                          <div className="font-black text-base md:text-lg">{s.value}</div>
                          <div className="text-[8px] md:text-[10px] font-bold">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Last 6 months mini chart */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 mb-2">آخر 6 شهور:</p>
                      <div className="flex items-end gap-1 h-16">
                        {history.map((h, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <span className="text-[8px] font-bold text-slate-500">{h.count}</span>
                            <div className="w-full bg-gradient-to-t from-primary-500 to-primary-300 rounded-t" style={{ height: `${Math.max(4, (h.count / maxHist) * 48)}px` }}></div>
                            <span className="text-[7px] md:text-[8px] font-bold text-slate-400">{h.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderQuickStatus = () => {
    if (sortedPages.length === 0) return null;
    return (
      <div key="quickStatus">
        <h2 className="font-black text-sm md:text-xl text-slate-800 mb-3 flex items-center gap-2">
          متابعة الحالات السريعة
          <span className="text-[9px] md:text-sm font-bold text-slate-500">(انقر لعرض الطلبات)</span>
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6">
          {sortedPages.map(([pg]) => {
            const pageOrders = orders.filter(o => (o.page || 'بدون صفحة') === pg);
            if (pageOrders.length === 0) return null;
            return (
              <div key={pg} className="glass-panel p-3 md:p-5 rounded-2xl shadow-sm border border-white hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center mb-2 md:mb-3 border-b border-slate-100 pb-2">
                  <h3 className="font-black text-xs md:text-lg text-sky-900 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 md:w-4 md:h-4" /> {pg}</h3>
                  <span className="bg-sky-100 text-sky-800 text-[9px] md:text-xs font-bold px-2 py-0.5 md:py-1 rounded-lg">{pageOrders.length} طلب</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 md:gap-2">
                  {orderStatuses.map(status => {
                    const count = pageOrders.filter(o => o.status === status).length;
                    if (count === 0) return null;
                    return (
                      <button key={status} onClick={() => onNavigateWithFilter('status', status, { pageFilter: pg })} className={`flex justify-between items-center px-1.5 md:px-3 py-1 md:py-2 rounded-lg md:rounded-xl border text-[9px] md:text-xs font-bold transition-transform hover:scale-105 ${getStatusColor(status)}`}>
                        <span className="truncate ml-0.5 md:ml-1">{status}</span>
                        <span className="bg-white/90 px-1 md:px-1.5 py-0.5 rounded shadow-sm text-slate-800">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRevenue = () => {
    if (monthlyRevenue.length < 2) return null;
    const maxRev = Math.max(...monthlyRevenue.map(m => m.revenue), 1);
    const chartH = 120;
    const colors = ['#0ea5e9', '#6366f1', '#22c55e', '#f59e0b', '#f43f5e', '#8b5cf6'];
    return (
      <div key="revenue">
        <h2 className="font-black text-sm md:text-xl text-slate-800 mb-3 flex items-center gap-2"><BarChart3 className="w-5 h-5" /> الإيرادات الشهرية</h2>
        <div className="glass-panel p-3 md:p-6 rounded-2xl shadow-sm border border-white">
          <div className="flex items-end gap-1.5 md:gap-2 justify-around" style={{ height: chartH + 30 }}>
            {monthlyRevenue.map((m, i) => {
              const h = Math.max(12, Math.round((m.revenue / maxRev) * chartH));
              return (
                <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                  <span className="text-[8px] md:text-[10px] font-black text-slate-600">{m.revenue >= 1000 ? (m.revenue / 1000).toFixed(0) + 'k' : m.revenue}</span>
                  <div className="w-full rounded-t-lg relative group" style={{ height: h, background: colors[i % colors.length], minWidth: 20, maxWidth: 70 }}>
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-black px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {m.revenue.toLocaleString()} ج.م — {m.count} طلب
                    </div>
                  </div>
                  <span className="text-[8px] md:text-[10px] font-bold text-slate-500">{m.label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] md:text-[10px] text-slate-400 font-bold border-t border-slate-100 pt-2 mt-2">
            <span>إجمالي: {monthlyRevenue.reduce((s, m) => s + m.revenue, 0).toLocaleString()} ج.م</span>
            <span>أعلى شهر: {Math.max(...monthlyRevenue.map(m => m.revenue)).toLocaleString()} ج.م</span>
          </div>
        </div>
      </div>
    );
  };

  const renderStatusGrid = () => (
    <div key="statusGrid">
      <h3 className="text-sm md:text-lg font-black text-slate-800 flex items-center gap-2 mb-3 md:mb-4">
        <Layers className="w-4 h-4 md:w-5 md:h-5 text-primary-500" /> الحالات السريعة
      </h3>
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
        <div onClick={() => onNavigateWithFilter('status', 'الكل')} className="glass-panel p-3 md:p-4 rounded-xl md:rounded-2xl border-2 border-slate-200 hover:border-primary-400 hover:shadow-md cursor-pointer transition-all group flex flex-col justify-between h-20 md:h-28">
          <div className="flex items-start justify-between">
            <span className="font-bold text-[10px] md:text-sm text-slate-600 group-hover:text-primary-600">كل الطلبات</span>
            <div className="p-1 md:p-1.5 rounded-lg bg-slate-100 text-slate-500"><Package className="w-3 h-3 md:w-4 md:h-4" /></div>
          </div>
          <div className="text-xl md:text-3xl font-black text-slate-800">{orders.length}</div>
        </div>
        {sortedStatuses.map(([status, count]) => {
          const style = STATUS_STYLES[status] || { icon: Tag, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200 hover:border-slate-400' };
          const Icon = style.icon;
          return (
            <div key={status} onClick={() => onNavigateWithFilter('status', status)} className={clsx("p-3 md:p-4 rounded-xl md:rounded-2xl border-2 bg-white cursor-pointer transition-all group flex flex-col justify-between h-20 md:h-28 hover:-translate-y-1 hover:shadow-lg", style.border)}>
              <div className="flex items-start justify-between">
                <span className={clsx("font-extrabold text-[10px] md:text-sm", style.color)}>{status}</span>
                <div className={clsx("p-1 md:p-1.5 rounded-lg", style.bg, style.color)}><Icon className="w-3 h-3 md:w-4 md:h-4" /></div>
              </div>
              <div className="text-xl md:text-3xl font-black text-slate-800 flex items-end justify-between">
                <span>{count}</span>
                <MousePointerClick className="w-3 h-3 md:w-4 md:h-4 text-slate-300 opacity-0 group-hover:opacity-100 mb-1 md:mb-2 transition-opacity" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderBrands = () => (
    <div key="brands">
      <h3 className="text-sm md:text-lg font-black text-slate-800 flex items-center gap-2 mb-3 md:mb-4">
        <Tag className="w-4 h-4 md:w-5 md:h-5 text-indigo-500" /> البراندات / الصفحات
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
        {sortedPages.map(([pg, count]) => (
          <div key={pg} onClick={() => onNavigateWithFilter('page', pg)} className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border border-indigo-100 hover:border-indigo-400 cursor-pointer transition-all hover:bg-indigo-50/30 group hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-center gap-2 md:gap-3 mb-1.5 md:mb-2">
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-[10px] md:text-xs shadow-sm">{pg.charAt(0)}</div>
              <span className="font-bold text-slate-700 truncate text-xs md:text-sm">{pg}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-slate-500 text-[9px] md:text-xs font-bold">إجمالي</span>
              <span className="text-lg md:text-xl font-black text-indigo-700">{count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ==== Section reorder (Admin only) ====
  const sectionLabels = { stats: 'الإحصائيات', leaderboard: 'لوحة المنافسة', quickStatus: 'الحالات السريعة', revenue: 'الإيرادات', statusGrid: 'بطاقات الحالات', brands: 'البراندات' };

  const moveSection = (idx, dir) => {
    const newOrder = [...sectionOrder];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= newOrder.length) return;
    [newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]];
    setSectionOrder(newOrder);
    localStorage.setItem('dashboardSectionOrder', JSON.stringify(newOrder));
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in pb-20 px-2 md:px-0">
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Admin section reorder controls */}
          {isAdmin && (
            <div className="glass-panel p-3 rounded-xl border border-dashed border-slate-300 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] md:text-xs font-bold text-slate-500">ترتيب الأقسام:</span>
              {sectionOrder.map((s, i) => (
                <div key={s} className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold text-slate-600">
                  <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="hover:text-primary-600 disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                  <span>{sectionLabels[s] || s}</span>
                  <button onClick={() => moveSection(i, 1)} disabled={i === sectionOrder.length - 1} className="hover:text-primary-600 disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}

          {sectionOrder.map(sId => renderSection(sId))}
        </>
      )}
    </div>
  );
}
