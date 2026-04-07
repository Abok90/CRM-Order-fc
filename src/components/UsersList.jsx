import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import clsx from 'clsx';
import { UserCog, Trash2, CheckCircle2, ShieldCheck, User } from 'lucide-react';

export default function UsersList({ userRole }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const ROLES = {
    'admin': 'مدير النظام',
    'agent': 'خدمة عملاء',
    'factory': 'المصنع',
    'shipping': 'الشحن'
  };

  const AVAILABLE_PAGES = ['عايدة', 'عايدة ويب', 'اوفر', 'اوفر ويب', 'Elite EG', 'VEE'];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error(err);
      alert('خطأ في تحميل الموظفين');
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId, field, value) => {
    try {
      const { error } = await supabase.from('user_roles').update({ [field]: value }).eq('id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: value } : u));
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء التحديث');
    }
  };

  const togglePageAccess = async (user, pageName) => {
    const currentPages = user.assigned_page ? user.assigned_page.split(',').filter(Boolean) : [];
    const newPages = currentPages.includes(pageName)
      ? currentPages.filter(p => p !== pageName)
      : [...currentPages, pageName];
    
    await updateRole(user.id, 'assigned_page', newPages.join(','));
  };

  if (!['admin', 'owner'].includes(userRole?.role)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl font-bold text-rose-500 bg-rose-50 px-6 py-4 rounded-2xl">
          عفواً، لا تملك صلاحية لمدير النظام
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative h-full flex flex-col md:pr-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
            <UserCog className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-slate-800">إدارة الموظفين والصلاحيات</h2>
        </div>
        <span className="bg-slate-100 text-slate-600 px-3 py-1 text-sm font-bold rounded-full">
          {users.length} موظف
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20 custom-scrollbar overflow-y-auto">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 h-48 animate-pulse">
              <div className="h-10 bg-slate-200 rounded-full w-10 mb-4"></div>
              <div className="h-4 bg-slate-200 rounded mb-2 w-1/2"></div>
              <div className="h-4 bg-slate-100 rounded w-1/3"></div>
            </div>
          ))
        ) : (
          users.map(user => (
            <div key={user.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    "w-12 h-12 flex items-center justify-center rounded-2xl font-bold shadow-sm",
                    user.role === 'admin' ? "bg-amber-100 text-amber-600" : "bg-primary-100 text-primary-600"
                  )}>
                    {user.role === 'admin' ? <ShieldCheck className="w-6 h-6" /> : <User className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">{user.name || 'بدون اسم'}</h3>
                    <p className="text-slate-500 text-xs font-medium" dir="ltr">{user.email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">الصلاحية (الدور)</label>
                  <select 
                    value={user.role || 'agent'}
                    onChange={(e) => updateRole(user.id, 'role', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 font-semibold text-slate-700 outline-none focus:border-primary-500"
                  >
                    {Object.entries(ROLES).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                
                {user.role !== 'admin' && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-2">الصفحات المسموحة</label>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {AVAILABLE_PAGES.map(page => {
                        const isSelected = user.assigned_page?.includes(page);
                        return (
                          <button
                            key={page}
                            onClick={() => togglePageAccess(user, page)}
                            className={clsx(
                              "px-2 py-1.5 rounded-md font-bold transition-colors border",
                              isSelected 
                                ? "bg-primary-50 text-primary-700 border-primary-200" 
                                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button 
                    onClick={() => updateRole(user.id, 'is_approved', !user.is_approved)}
                    className={clsx(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors",
                      user.is_approved 
                        ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" 
                        : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {user.is_approved ? 'حساب نشط ومفعل' : 'مراجعة وتفعيل الحساب'}
                  </button>
                  <button className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
