import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Package, TrendingUp, Truck, CheckCircle, Tag, Layers, MousePointerClick, DollarSign, BarChart3, Clock, Trophy, ChevronDown, ChevronUp, Star, Zap, Award } from 'lucide-react';
import clsx from 'clsx';

export default function Dashboard({ onNavigateWithFilter, userRole }) {
  // ===== RPC Data =====
  const [countsData, setCountsData]       = useState([]); // get_order_counts()
  const [userStatsData, setUserStatsData] = useState([]); // get_user_order_stats()
  const [revenueData, setRevenueData]     = useState([]); // get_monthly_revenue()
  const [users, setUsers]                 = useState([]);
  const [loading, setLoading]             = useState(true);

  // ===== UI State =====
  const [expandedUser, setExpandedUser]   = useState(null);
  const [sectionOrder, setSectionOrder]   = useState(['stats', 'leaderboard', 'quickStatus', 'revenue', 'statusGrid', 'brands']);
  const [brandOrder, setBrandOrder]       = useState([]); // admin-controlled, saved to Supabase

  const isAdmin = ['admin', 'brand_owner', 'super_admin', 'owner'].includes(userRole?.role);

  // Load section order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dashboardSectionOrder');
      if (saved) setSectionOrder(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Fetch all data via RPCs
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [countsRes, userStatsRes, revenueRes, usersRes, brandOrderRes] = await Promise.all([
        supabase.rpc('get_order_counts'),
        supabase.rpc('get_user_order_stats'),
        supabase.rpc('get_monthly_revenue'),
        supabase.from('user_roles').select('id, name, role, is_approved'),
        supabase.from('app_settings').select('value').eq('key', 'dashboard_brand_order').maybeSingle()
      ]);

      if (countsRes.data)  setCountsData(countsRes.data);
      if (userStatsRes.data) setUserStatsData(userStatsRes.data);
      if (revenueRes.data) setRevenueData([...revenueRes.data].reverse()); // oldest→newest for chart
      if (usersRes.data)   setUsers(usersRes.data);
      if (brandOrderRes.data?.value) {
        try { setBrandOrder(JSON.parse(brandOrderRes.data.value)); } catch {}
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ===== Derived: Status & Page counts from RPC =====
  const statusCounts = useMemo(() => {
    const map = {};
    countsData.forEach(r => { map[r.status_name] = (map[r.status_name] || 0) + Number(r.cnt); });
    return map;
  }, [countsData]);

  const pageCounts = useMemo(() => {
    const map = {};
    countsData.forEach(r => {
      const pg = r.page_name || 'بدون صفحة';
      map[pg] = (map[pg] || 0) + Number(r.cnt);
    });
    return map;
  }, [countsData]);

  // pageStatusMap: { 'VEE': { 'جاري التحضير': 5, 'تم': 12 }, ... }
  const pageStatusMap = useMemo(() => {
    const map = {};
    countsData.forEach(r => {
      const pg = r.page_name || 'بدون صفحة';
      if (!map[pg]) map[pg] = {};
      map[pg][r.status_name] = Number(r.cnt);
    });
    return map;
  }, [countsData]);

  const totalOrders      = useMemo(() => Object.values(pageCounts).reduce((s, c) => s + c, 0), [pageCounts]);
  const processingCount  = (statusCounts['جاري التحضير'] || 0) + (statusCounts['مراجعة'] || 0);
  const deliveredCount   = statusCounts['تم'] || 0;
  const totalRevenue     = useMemo(() => revenueData.reduce((s, r) => s + Number(r.total_revenue || 0), 0), [revenueData]);

  const sortedStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

  // ===== Sorted Pages: respects admin-set brandOrder =====
  const sortedPages = useMemo(() => {
    const allEntries = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]);
    if (brandOrder.length === 0) return allEntries;
    const ordered = brandOrder.filter(pg => pageCounts[pg] !== undefined).map(pg => [pg, pageCounts[pg]]);
    const rest     = allEntries.filter(([pg]) => !brandOrder.includes(pg));
    return [...ordered, ...rest];
  }, [pageCounts, brandOrder]);

  // ===== Save brand order globally to Supabase (admin only) =====
  const saveBrandOrder = useCallback(async (newOrder) => {
    setBrandOrder(newOrder);
    if (!isAdmin) return;
    await supabase.from('app_settings').upsert({
      key: 'dashboard_brand_order',
      value: JSON.stringify(newOrder),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
  }, [isAdmin]);

  const moveBrand = useCallback((pgName, dir) => {
    const base = brandOrder.length > 0 ? [...brandOrder] : sortedPages.map(([pg]) => pg);
    if (!base.includes(pgName)) base.push(pgName);
    const idx = base.indexOf(pgName);
    if ((dir === -1 && idx === 0) || (dir === 1 && idx === base.length - 1)) return;
    [base[idx], base[idx + dir]] = [base[idx + dir], base[idx]];
    saveBrandOrder(base);
  }, [brandOrder, sortedPages, saveBrandOrder]);

  // ===== Monthly Revenue =====
  const monthlyRevenue = useMemo(() =>
    revenueData.map(row => {
      const [year, month] = row.month_key.split('-');
      const date = new Date(Number(year), Number(month) - 1);
      return {
        revenue: Number(row.total_revenue || 0),
        count:   Number(row.order_count  || 0),
        label:   date.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' })
      };
    }), [revenueData]);

  // ===== Leaderboard from userStatsData + users =====
  const currentMonth = new Date().toISOString().slice(0, 7);

  const leaderboard = useMemo(() => {
    const activeUsers = users.filter(u => u.is_approved);
    const userStats = {};
    activeUsers.forEach(u => {
      userStats[u.id] = { id: u.id, name: u.name, role: u.role, total: 0, delivered: 0, shipped: 0, cancelled: 0, monthly: {} };
    });
    userStatsData.forEach(row => {
      if (!row.uid || !userStats[row.uid]) return;
      const cnt = Number(row.cnt);
      userStats[row.uid].total += cnt;
      if (row.status_name === 'تم')     userStats[row.uid].delivered += cnt;
      if (row.status_name === 'الشحن')  userStats[row.uid].shipped   += cnt;
      if (row.status_name === 'الغاء')  userStats[row.uid].cancelled += cnt;
      if (row.month_key) {
        userStats[row.uid].monthly[row.month_key] = (userStats[row.uid].monthly[row.month_key] || 0) + cnt;
      }
    });
    return Object.values(userStats)
      .filter(u => u.total > 0)
      .sort((a, b) => (b.monthly[currentMonth] || 0) - (a.monthly[currentMonth] || 0));
  }, [userStatsData, users, currentMonth]);

  const maxTotal = Math.max(...leaderboard.map(u => u.total), 1);

  // User 6-month history from userStatsData
  const getUserHistory = useCallback((userId) => {
    const history = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key   = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
      const count = userStatsData
        .filter(r => r.uid === userId && r.month_key === key)
        .reduce((s, r) => s + Number(r.cnt), 0);
      history.push({ label, count, key });
    }
    return history;
  }, [userStatsData]);

  // ===== Helpers =====
  const orderStatuses = ['جاري التحضير', 'مراجعة', 'الشحن', 'تم', 'استبدال', 'مرتجع', 'الغاء', 'تاجيل'];

  const getStatusColor = (status) => {
    const colors = {
      'جاري التحضير': 'bg-blue-100 text-blue-800 border-blue-200',
      'الشحن':        'bg-purple-100 text-purple-800 border-purple-200',
      'تم':           'bg-emerald-100 text-emerald-800 border-emerald-200',
      'استبدال':      'bg-orange-100 text-orange-800 border-orange-200',
      'مراجعة':       'bg-amber-100 text-amber-800 border-amber-200',
      'مرتجع':        'bg-rose-100 text-rose-800 border-rose-200',
      'الغاء':        'bg-red-100 text-red-800 border-red-200',
      'تاجيل':        'bg-slate-200 text-slate-800 border-slate-300'
    };
    return colors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const STATUS_STYLES = {
    'جاري التحضير': { icon: TrendingUp,  color: 'text-amber-600',   bg: 'bg-amber-100',   border: 'border-amber-200 hover:border-amber-400' },
    'الشحن':        { icon: Truck,        color: 'text-purple-600',  bg: 'bg-purple-100',  border: 'border-purple-200 hover:border-purple-400' },
    'تم':           { icon: CheckCircle,  color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200 hover:border-emerald-400' },
    'استبدال':      { icon: Package,      color: 'text-orange-600',  bg: 'bg-orange-100',  border: 'border-orange-200 hover:border-orange-400' },
    'مراجعة':       { icon: Clock,        color: 'text-amber-800',   bg: 'bg-amber-100',   border: 'border-amber-300 hover:border-amber-500' },
    'مرتجع':        { icon: Package,      color: 'text-rose-600',    bg: 'bg-rose-100',    border: 'border-rose-200 hover:border-rose-400' },
    'الغاء':        { icon: Package,      color: 'text-red-600',     bg: 'bg-red-100',     border: 'border-red-200 hover:border-red-400' },
    'تاجيل':        { icon: Package,      color: 'text-slate-600',   bg: 'bg-slate-200',   border: 'border-slate-300 hover:border-slate-400' },
  };

  const medalColors = ['from-yellow-400 to-amber-500', 'from-slate-300 to-slate-400', 'from-orange-400 to-orange-500'];
  const medalIcons  = [Trophy, Award, Star];

  // ===== Section reorder (Admin only) =====
  const sectionLabels = { stats: 'الإحصائيات', leaderboard: 'المنافسة', quickStatus: 'الحالات السريعة', revenue: 'الإيرادات', statusGrid: 'بطاقات الحالات', brands: 'البراندات' };

  const moveSection = (idx, dir) => {
    const newOrder = [...sectionOrder];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= newOrder.length) return;
    [newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]];
    setSectionOrder(newOrder);
    localStorage.setItem('dashboardSectionOrder', JSON.stringify(newOrder));
  };

  const renderSection = (sectionId) => {
    switch (sectionId) {
      case 'stats':       return renderStats();
      case 'leaderboard': return renderLeaderboard();
      case 'quickStatus': return renderQuickStatus();
      case 'revenue':     return isAdmin ? renderRevenue() : null;
      case 'statusGrid':  return renderStatusGrid();
      case 'brands':      return renderBrands();
      default:            return null;
    }
  };

  // ===== Render: Stats =====
  const renderStats = () => (
    <div key="stats" className={`grid gap-3 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
      <div className="glass-panel p-3 md:p-5 rounded-2xl flex items-center gap-3" style={{ borderTop: '3px solid #0ea5e9' }}>
        <div className="p-2 md:p-3 bg-sky-50 text-sky-500 rounded-xl md:rounded-2xl shrink-0"><Package className="w-4 h-4 md:w-5 md:h-5" /></div>
        <div><p className="text-slate-400 text-[9px] md:text-xs font-bold mb-0.5">إجمالي الطلبات</p><p className="text-xl md:text-3xl font-black text-slate-800 leading-none">{totalOrders.toLocaleString()}</p></div>
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

  // ===== Render: Leaderboard =====
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
            const pct      = Math.round((user.total / maxTotal) * 100);
            const isExpanded = expandedUser === user.id;
            const MedalIcon  = idx < 3 ? medalIcons[idx] : null;
            const history    = isExpanded ? getUserHistory(user.id) : [];
            const maxHist    = Math.max(...(history.map(h => h.count)), 1);

            return (
              <div key={user.id} className={clsx("glass-panel rounded-2xl overflow-hidden transition-all border", isExpanded ? "border-primary-200 shadow-lg" : "border-white")}>
                <button className="w-full text-right p-3 md:p-4 flex items-center gap-3" onClick={() => setExpandedUser(isExpanded ? null : user.id)}>
                  <div className={clsx("w-8 h-8 md:w-10 md:h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0",
                    idx < 3 ? `bg-gradient-to-br ${medalColors[idx]} shadow-md` : 'bg-slate-200 text-slate-600'
                  )}>
                    {MedalIcon ? <MedalIcon className="w-4 h-4 md:w-5 md:h-5" /> : <span>{idx + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-xs md:text-sm text-slate-800 truncate">{user.name}</span>
                      <span className="font-black text-xs md:text-sm text-slate-700 shrink-0 mr-2">{user.monthly[currentMonth] || 0} <span className="text-[9px] text-slate-400">هذا الشهر</span></span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 md:h-2">
                      <div className={clsx("h-full rounded-full bg-gradient-to-r transition-all", idx < 3 ? medalColors[idx] : 'from-slate-400 to-slate-500')} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <ChevronDown className={clsx("w-4 h-4 text-slate-400 shrink-0 transition-transform", isExpanded && "rotate-180")} />
                </button>

                {isExpanded && (
                  <div className="px-3 md:px-4 pb-3 md:pb-4 border-t border-slate-100">
                    <div className="grid grid-cols-4 gap-1.5 md:gap-2 my-2 md:my-3">
                      {[['الكل', user.total, 'text-slate-700'], ['تم', user.delivered, 'text-emerald-600'], ['شحن', user.shipped, 'text-purple-600'], ['إلغاء', user.cancelled, 'text-red-500']].map(([label, val, color]) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-1.5 md:p-2 text-center border border-slate-100">
                          <p className={clsx("text-base md:text-xl font-black", color)}>{val}</p>
                          <p className="text-[9px] md:text-[10px] text-slate-400 font-bold">{label}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] md:text-[10px] font-bold text-slate-400 mb-1.5 md:mb-2">آخر 6 شهور</p>
                    <div className="flex items-end gap-1" style={{ height: 40 }}>
                      {history.map((h, i) => {
                        const barH = Math.max(4, Math.round((h.count / maxHist) * 36));
                        return (
                          <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                            <div className="w-full rounded-t" style={{ height: barH, background: h.key === currentMonth ? '#6366f1' : '#e2e8f0' }} />
                            <span className="text-[7px] md:text-[8px] text-slate-400">{h.label}</span>
                          </div>
                        );
                      })}
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

  // ===== Render: Quick Status (with admin brand reordering) =====
  const renderQuickStatus = () => {
    if (sortedPages.length === 0) return null;
    return (
      <div key="quickStatus">
        <h2 className="font-black text-sm md:text-xl text-slate-800 mb-3 flex items-center gap-2">
          متابعة الحالات السريعة
          <span className="text-[9px] md:text-sm font-bold text-slate-500">(انقر لعرض الطلبات)</span>
          {isAdmin && <span className="text-[8px] md:text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">↑↓ لترتيب البراندات</span>}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6">
          {sortedPages.map(([pg, totalCount], idx) => {
            const pgStatuses = pageStatusMap[pg] || {};
            if (totalCount === 0) return null;
            return (
              <div key={pg} className="glass-panel p-3 md:p-5 rounded-2xl shadow-sm border border-white hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center mb-2 md:mb-3 border-b border-slate-100 pb-2">
                  <h3 className="font-black text-xs md:text-lg text-sky-900 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 md:w-4 md:h-4" /> {pg}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="bg-sky-100 text-sky-800 text-[9px] md:text-xs font-bold px-2 py-0.5 md:py-1 rounded-lg">{totalCount} طلب</span>
                    {isAdmin && (
                      <div className="flex flex-col">
                        <button onClick={() => moveBrand(pg, -1)} disabled={idx === 0} className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 text-[10px] leading-none">↑</button>
                        <button onClick={() => moveBrand(pg, 1)} disabled={idx === sortedPages.length - 1} className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 text-[10px] leading-none">↓</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 md:gap-2">
                  {orderStatuses.map(status => {
                    const count = pgStatuses[status] || 0;
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

  // ===== Render: Revenue Chart =====
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

  // ===== Render: Status Grid =====
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
          <div className="text-xl md:text-3xl font-black text-slate-800">{totalOrders}</div>
        </div>
        {sortedStatuses.map(([status, count]) => {
          const style = STATUS_STYLES[status] || { icon: Tag, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200 hover:border-slate-400' };
          const Icon  = style.icon;
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

  // ===== Render: Brands (with admin reordering) =====
  const renderBrands = () => (
    <div key="brands">
      <h3 className="text-sm md:text-lg font-black text-slate-800 flex items-center gap-2 mb-3 md:mb-4">
        <Tag className="w-4 h-4 md:w-5 md:h-5 text-indigo-500" /> البراندات / الصفحات
        {isAdmin && <span className="text-[8px] md:text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">↑↓ للترتيب</span>}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
        {sortedPages.map(([pg, count], idx) => (
          <div key={pg} className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border border-indigo-100 hover:border-indigo-400 cursor-pointer transition-all hover:bg-indigo-50/30 group hover:-translate-y-1 hover:shadow-md relative">
            {isAdmin && (
              <div className="absolute top-1.5 left-1.5 flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); moveBrand(pg, -1); }} disabled={idx === 0} className="p-0.5 hover:bg-indigo-100 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 text-[10px] leading-none">↑</button>
                <button onClick={(e) => { e.stopPropagation(); moveBrand(pg, 1); }} disabled={idx === sortedPages.length - 1} className="p-0.5 hover:bg-indigo-100 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 text-[10px] leading-none">↓</button>
              </div>
            )}
            <div onClick={() => onNavigateWithFilter('page', pg)}>
              <div className="flex items-center gap-2 md:gap-3 mb-1.5 md:mb-2">
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-[10px] md:text-xs shadow-sm">{pg.charAt(0)}</div>
                <span className="font-bold text-slate-700 truncate text-xs md:text-sm">{pg}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-slate-500 text-[9px] md:text-xs font-bold">إجمالي</span>
                <span className="text-lg md:text-xl font-black text-indigo-700">{count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ===== Main Render =====
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
