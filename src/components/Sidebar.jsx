import React from 'react';
import { 
  Home, 
  Package, 
  Users, 
  Settings, 
  LogOut,
  LineChart,
  Wallet
} from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar({ currentTab, setCurrentTab, userRole, handleLogout }) {
  const isSuperAdmin = ['admin', 'owner', 'social_manager', 'media_buyer'].includes(userRole?.role);
  const canAccessFinance = ['admin', 'owner'].includes(userRole?.role);

  const navItems = [
    { id: 'dashboard', label: 'لوحة القيادة', icon: Home },
    { id: 'orders', label: 'الطلبات', icon: Package },
    ...(isSuperAdmin ? [{ id: 'users', label: 'الموظفين', icon: Users }] : []),
    ...(isSuperAdmin ? [{ id: 'factory', label: 'المصنع', icon: LogOut }] : []), // Update icon later
    ...(canAccessFinance ? [{ id: 'finance', label: 'المالية', icon: Wallet }] : []),
    ...(isSuperAdmin ? [{ id: 'reports', label: 'التقارير', icon: LineChart }] : []),
    { id: 'settings', label: 'الإعدادات', icon: Settings }
  ];

  return (
    <aside className="w-64 h-full bg-white/80 backdrop-blur-xl border-l border-slate-200/50 shadow-2xl flex flex-col transition-all duration-300">
      <div className="p-6 flex items-center justify-center border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Package className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            CRM Pro
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-300 group",
                isActive 
                  ? "bg-primary-500 text-white shadow-md shadow-primary-500/25 translate-x-1" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-primary-600 hover:translate-x-1"
              )}
            >
              <Icon className={clsx(
                "w-5 h-5 transition-transform duration-300",
                isActive ? "scale-110" : "group-hover:scale-110"
              )} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-100 text-center">
          <p className="text-sm font-semibold text-slate-700 truncate">{userRole?.name || 'مستخدم'}</p>
          <p className="text-xs text-slate-500 mt-1">{userRole?.role || 'موظف'}</p>
        </div>
        
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-rose-500 font-semibold hover:bg-rose-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
