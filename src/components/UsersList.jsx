import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import clsx from 'clsx';
import { UserCog, Trash2, CheckCircle2, ShieldCheck, User, Pencil, Save, X } from 'lucide-react';

const ROLES = {
  'admin':           { label: 'مدير النظام',     color: 'bg-amber-100 text-amber-700',   icon: '👑', desc: 'كل الصلاحيات' },
  'brand_owner':     { label: 'صاحب البرند',      color: 'bg-purple-100 text-purple-700', icon: '💼', desc: 'كل الصلاحيات' },
  'pages_manager':   { label: 'مدير البيدجات',   color: 'bg-sky-100 text-sky-700',       icon: '📋', desc: 'كل شيء عدا المالية والتقارير' },
  'customer_service':{ label: 'خدمة عملاء',       color: 'bg-green-100 text-green-700',   icon: '🎧', desc: 'بيدجات محددة فقط' },
};

const AVAILABLE_PAGES = ['عايدة', 'عايدة ويب', 'اوفر', 'اوفر ويب', 'Elite EG', 'VEE'];

const DASHBOARD_PERMS = [
  { key: 'stats',       label: 'الإحصائيات الكلية' },
  { key: 'quickStatus', label: 'الحالات السريعة' },
  { key: 'statusGrid',  label: 'بطاقات الحالات' },
  { key: 'brands',      label: 'البراندات / الصفحات' },
  { key: 'leaderboard', label: 'لوحة المنافسة' },
  { key: 'revenue',     label: 'الإيرادات' },
  { key: 'allPages',    label: 'يرى كل الصفحات' },
];

const DASH_DEFAULTS = { stats: true, quickStatus: true, statusGrid: true, brands: true, leaderboard: true, revenue: false, allPages: false };

function getDashPerms(user) {
  try { return { ...DASH_DEFAULTS, ...JSON.parse(user.dashboard_perms || '{}') }; }
  catch { return { ...DASH_DEFAULTS }; }
}

export default function UsersList({ userRole }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNameId, setEditingNameId] = useState(null);
  const [nameInput, setNameInput]         = useState('');

  const isAdmin = ['admin', 'brand_owner', 'super_admin', 'owner'].includes(userRole?.role);
  const currentUserId = userRole?.id;

  useEffect(() => { fetchUsers(); }, []);

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

  const updateUser = async (userId, fields) => {
    try {
      const { error } = await supabase.from('user_roles').update(fields).eq('id', userId);
      if (error) {
        // Guide user if a column is missing in the DB schema
        if (error.message?.includes('column') && error.message?.includes('schema cache')) {
          const col = Object.keys(fields)[0];
          alert(`حدث خطأ: عمود "${col}" غير موجود في قاعدة البيانات.\n\nشغّل هذا الأمر في Supabase SQL Editor:\nALTER TABLE user_roles ADD COLUMN IF NOT EXISTS ${col} text;`);
          return;
        }
        throw error;
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...fields } : u));
    } catch (err) {
      alert('حدث خطأ: ' + err.message);
    }
  };

  const toggleDashPerm = async (user, permKey) => {
    const curr = getDashPerms(user);
    curr[permKey] = !curr[permKey];
    await updateUser(user.id, { dashboard_perms: JSON.stringify(curr) });
  };

  const togglePageAccess = async (user, pageName) => {
    const curr = user.assigned_page ? user.assigned_page.split(',').filter(Boolean) : [];
    const next = curr.includes(pageName) ? curr.filter(p => p !== pageName) : [...curr, pageName];
    await updateUser(user.id, { assigned_page: next.join(',') });
  };

  const saveName = async (userId) => {
    if (!nameInput.trim()) return;
    await updateUser(userId, { name: nameInput.trim() });
    setEditingNameId(null);
  };

  const deleteUser = async (userId) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await supabase.from('user_roles').delete().eq('id', userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      alert('خطأ في الحذف: ' + err.message);
    }
  };

  // Who can edit names: admin edits all, user edits own
  const canEditName = (user) => isAdmin || user.id === currentUserId;
  // Who can change role/permissions: admin only
  const canEditRole = (user) => isAdmin && user.id !== currentUserId;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl font-bold text-rose-500 bg-rose-50 px-6 py-4 rounded-2xl border border-rose-200">
          عفواً، لا تملك صلاحية الوصول لهذه الصفحة
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><UserCog className="w-6 h-6" /></div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-slate-800">إدارة الموظفين والصلاحيات</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">تحكم في الأدوار والصفحات والصلاحيات الإضافية</p>
          </div>
        </div>
        <span className="bg-slate-100 text-slate-600 px-3 py-1 text-sm font-bold rounded-full">{users.length} موظف</span>
      </div>

      {/* Role Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Object.entries(ROLES).map(([key, r]) => (
          <div key={key} className={clsx("flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold", r.color, 'border-current/20')}>
            <span>{r.icon}</span>
            <div>
              <p className="font-black">{r.label}</p>
              <p className="opacity-70 font-medium text-[10px]">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-24 overflow-y-auto custom-scrollbar flex-1">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 h-64 animate-pulse">
              <div className="h-10 bg-slate-200 rounded-full w-10 mb-4"></div>
              <div className="h-4 bg-slate-200 rounded mb-2 w-1/2"></div>
              <div className="h-4 bg-slate-100 rounded w-1/3"></div>
            </div>
          ))
        ) : (
          users.map(user => {
            const roleInfo = ROLES[user.role] || ROLES['customer_service'];
            const isCurrentUser = user.id === currentUserId;
            const showPages = ['customer_service', 'pages_manager'].includes(user.role);

            return (
              <div key={user.id} className={clsx(
                "bg-white p-4 md:p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all",
                isCurrentUser ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200"
              )}>
                {/* User Header */}
                <div className="flex items-start justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={clsx("w-11 h-11 flex items-center justify-center rounded-2xl font-bold text-lg shadow-sm", roleInfo.color)}>
                      {roleInfo.icon}
                    </div>
                    <div className="min-w-0">
                      {/* Name + Edit */}
                      {editingNameId === user.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={nameInput}
                            onChange={e => setNameInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveName(user.id)}
                            className="border border-primary-400 rounded-lg px-2 py-1 text-sm font-bold outline-none w-28 focus:ring-2 ring-primary-200"
                            autoFocus
                          />
                          <button onClick={() => saveName(user.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Save className="w-4 h-4" /></button>
                          <button onClick={() => setEditingNameId(null)} className="p-1 text-slate-400 hover:bg-slate-50 rounded"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <h3 className="font-bold text-slate-800 text-base truncate max-w-[130px]">{user.name || 'بدون اسم'}</h3>
                          {canEditName(user) && (
                            <button onClick={() => { setEditingNameId(user.id); setNameInput(user.name || ''); }}
                              className="p-0.5 text-slate-300 hover:text-primary-500 transition-colors">
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-slate-400 text-[10px] font-medium truncate max-w-[160px]" dir="ltr">{user.email}</p>
                    </div>
                  </div>
                  {isCurrentUser && <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">أنت</span>}
                </div>

                <div className="space-y-3">
                  {/* Role Selector */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1">الدور / الصلاحية</label>
                    {canEditRole(user) ? (
                      <select
                        value={user.role || 'customer_service'}
                        onChange={e => updateUser(user.id, { role: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs px-2.5 py-2 font-bold text-slate-700 outline-none focus:border-primary-400"
                      >
                        {Object.entries(ROLES).map(([val, r]) => (
                          <option key={val} value={val}>{r.icon} {r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <div className={clsx("px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5", roleInfo.color)}>
                        {roleInfo.icon} {roleInfo.label}
                      </div>
                    )}
                  </div>

                  {/* Assigned Pages — only for pages_manager & customer_service */}
                  {showPages && (
                    <div>
                      <label className="text-[10px] font-black text-slate-500 block mb-1.5">الصفحات المسموحة</label>
                      <div className="flex flex-wrap gap-1.5">
                        {AVAILABLE_PAGES.map(pg => {
                          const isSelected = user.assigned_page?.includes(pg);
                          return (
                            <button key={pg} onClick={() => canEditRole(user) && togglePageAccess(user, pg)}
                              disabled={!canEditRole(user)}
                              className={clsx(
                                "px-2 py-1 rounded-md text-[10px] font-bold transition-colors border",
                                isSelected ? "bg-primary-50 text-primary-700 border-primary-200" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50",
                                !canEditRole(user) && "opacity-70 cursor-default"
                              )}>
                              {pg}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Default Page — shown when user has assigned pages */}
                  {showPages && user.assigned_page && (
                    <div>
                      <label className="text-[10px] font-black text-slate-500 block mb-1">الصفحة الافتراضية عند الإضافة</label>
                      {canEditRole(user) ? (
                        <select
                          value={user.default_page || ''}
                          onChange={e => updateUser(user.id, { default_page: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs px-2.5 py-2 font-bold text-slate-700 outline-none focus:border-primary-400"
                        >
                          <option value="">— اختر الصفحة الافتراضية —</option>
                          {user.assigned_page.split(',').filter(Boolean).map(pg => (
                            <option key={pg} value={pg}>{pg}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200">
                          {user.default_page || <span className="text-slate-300">غير محددة</span>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Extra Permissions */}
                  {canEditRole(user) && (
                    <div>
                      <label className="text-[10px] font-black text-slate-500 block mb-1.5">الصلاحيات الإضافية</label>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!user.can_delete_order}
                            onChange={e => updateUser(user.id, { can_delete_order: e.target.checked })}
                            className="w-4 h-4 accent-red-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-700">مسح أوردر 🗑️</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!user.can_edit_after_ship}
                            onChange={e => updateUser(user.id, { can_edit_after_ship: e.target.checked })}
                            className="w-4 h-4 accent-orange-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-700">تعديل أوردر بعد الشحن 🔓</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Dashboard Visibility */}
                  {canEditRole(user) && (
                    <div>
                      <label className="text-[10px] font-black text-slate-500 block mb-1.5">ما يظهر في لوحة القيادة</label>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {DASHBOARD_PERMS.map(({ key, label }) => {
                          const perms = getDashPerms(user);
                          return (
                            <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={!!perms[key]}
                                onChange={() => toggleDashPerm(user, key)}
                                className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer"
                              />
                              <span className="text-[10px] font-bold text-slate-700">{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Activate + Delete */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => updateUser(user.id, { is_approved: !user.is_approved })}
                      className={clsx(
                        "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors",
                        user.is_approved ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      )}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {user.is_approved ? '✅ حساب نشط' : '⏳ تفعيل الحساب'}
                    </button>
                    {isAdmin && !isCurrentUser && (
                      <button onClick={() => deleteUser(user.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
