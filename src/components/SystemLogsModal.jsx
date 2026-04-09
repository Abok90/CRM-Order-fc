import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { X, BellRing, User, Clock, Package, CheckCircle2, ShoppingBag } from 'lucide-react';
import clsx from 'clsx';

export default function SystemLogsModal({ isOpen, onClose }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    if (isOpen) fetchAll();
  }, [isOpen]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [usersRes, ordersRes] = await Promise.all([
        supabase.from('user_roles').select('*').eq('is_approved', false).order('created_at', { ascending: false }),
        supabase.from('orders').select('id, customer, page, status, date, productPrice, shippingPrice, source').order('date', { ascending: false }).limit(50),
      ]);
      setPendingUsers(usersRes.data || []);
      setRecentOrders(ordersRes.data || []);
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

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800">
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
          <button
            onClick={() => setActiveTab('orders')}
            className={clsx('flex-1 py-2.5 text-xs font-black flex items-center justify-center gap-1.5 transition-colors',
              activeTab === 'orders' ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            آخر الأوردرات
          </button>
        </div>

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
            recentOrders.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-10 font-bold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                لا توجد أوردرات
              </div>
            ) : (
              recentOrders.map(order => (
                <div key={order.id} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded flex items-center gap-1">
                      <Package className="w-3 h-3" /> {order.id}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold">{order.date}</span>
                  </div>
                  <p className="font-bold text-sm text-slate-800 truncate">{order.customer}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-500 font-bold">{order.page}</span>
                    <span className={clsx('text-[10px] font-black px-2 py-0.5 rounded-full border',
                      order.source === 'shopify' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                    )}>
                      {order.status}
                    </span>
                  </div>
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
