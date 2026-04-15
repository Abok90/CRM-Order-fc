import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { X, BellRing, User, Clock, Package, CheckCircle2, ShoppingBag, Search } from 'lucide-react';
import clsx from 'clsx';

export default function SystemLogsModal({ isOpen, onClose }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');
  const [orderSearch, setOrderSearch] = useState('');

  useEffect(() => {
    if (isOpen) fetchAll();
  }, [isOpen]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [usersRes, ordersRes] = await Promise.allSettled([
        supabase.from('user_roles').select('*').eq('is_approved', false).order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('id, customer, page, status, date, created_at, productPrice, shippingPrice, source, updated_by')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (usersRes.status === 'fulfilled') setPendingUsers(usersRes.value.data || []);

      const orders = ordersRes.status === 'fulfilled' ? (ordersRes.value.data || []) : [];
      setRecentOrders(orders);

      // Batch-fetch editor names for updated_by UUIDs
      const updatedByIds = [...new Set(orders.map(o => o.updated_by).filter(Boolean))];
      if (updatedByIds.length > 0) {
        const { data: users } = await supabase.from('user_roles').select('id, name').in('id', updatedByIds);
        const map = {};
        (users || []).forEach(u => { map[u.id] = u.name; });
        setUserMap(map);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId) => {
    await supabase.from('user_roles').update({ is_approved: true }).eq('id', userId);
    setPendingUsers(prev => prev.filter(u => u.id !== userId));
  };

  const formatTime = (dt) => {
    if (!dt) return '';
    return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const filteredOrders = orderSearch.trim()
    ? recentOrders.filter(o => String(o.id || '').includes(orderSearch.trim()))
    : recentOrders;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex justify-end">
      <div className="w-full md:w-[420px] bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-slide-in-right border-l dark:border-slate-800">

        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <h2 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BellRing className="w-5 h-5 text-indigo-500" /> مركز الإشعارات
          </h2>
          <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-500 shadow-sm transition-colors border border-slate-100 dark:border-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs — orders first */}
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('orders')}
            className={clsx('flex-1 py-2.5 text-xs font-black flex items-center justify-center gap-1.5 transition-colors',
              activeTab === 'orders' ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            آخر الأوردرات
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={clsx('flex-1 py-2.5 text-xs font-black flex items-center justify-center gap-1.5 transition-colors',
              activeTab === 'users' ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <User className="w-3.5 h-3.5" />
            طلبات الانضمام
            {pendingUsers.length > 0 && (
              <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{pendingUsers.length}</span>
            )}
          </button>
        </div>

        {/* Search bar — orders tab only */}
        {activeTab === 'orders' && (
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث برقم الأوردر..."
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pr-9 pl-3 py-2 text-xs font-bold outline-none focus:border-indigo-400 transition-colors text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : activeTab === 'users' ? (
            pendingUsers.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-10 font-bold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                لا توجد طلبات انضمام معلّقة ✅
              </div>
            ) : (
              pendingUsers.map(user => (
                <div key={user.id} className="bg-white border border-indigo-100 rounded-xl p-3.5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-bold text-sm">
                      {(user.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-sm truncate">{user.name || 'بدون اسم'}</p>
                      <p className="text-[10px] text-slate-500 truncate" dir="ltr">{user.email}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {user.created_at ? new Date(user.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => approveUser(user.id)}
                      className="shrink-0 flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> موافقة
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            filteredOrders.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-10 font-bold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                {orderSearch ? 'لا توجد نتائج لهذا الرقم' : 'لا توجد أوردرات'}
              </div>
            ) : (
              filteredOrders.map(order => (
                <div key={order.id} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <Package className="w-3 h-3" /> {order.id}
                    </span>
                    <div className="text-left">
                      <div className="text-[9px] text-slate-400 font-bold leading-tight">
                        {order.date || order.created_at?.split('T')[0]}
                      </div>
                      <div className="text-[9px] text-slate-400 leading-tight" dir="ltr">
                        {formatTime(order.created_at)}
                      </div>
                    </div>
                  </div>
                  <p className="font-bold text-sm text-slate-800 truncate">{order.customer}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-slate-500 font-bold">{order.page}</span>
                    <span className={clsx('text-[10px] font-black px-2 py-0.5 rounded-full border',
                      order.source === 'shopify' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                    )}>
                      {order.status}
                    </span>
                  </div>
                  {order.updated_by && userMap[order.updated_by] && (
                    <div className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-400 border-t border-slate-50 pt-1.5">
                      <User className="w-2.5 h-2.5 shrink-0" />
                      <span>عُدّل بواسطة: <span className="font-black text-indigo-500">{userMap[order.updated_by]}</span></span>
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>

        {/* Refresh */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <button onClick={fetchAll} className="w-full text-xs text-slate-500 hover:text-indigo-600 font-bold py-2 rounded-lg hover:bg-indigo-50 transition-colors">
            🔄 تحديث
          </button>
        </div>
      </div>
    </div>
  );
}
