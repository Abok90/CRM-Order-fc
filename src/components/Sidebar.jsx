import React from 'react';
import { 
  Home, 
  Package, 
  Users, 
  Settings, 
  LogOut,
  Wallet,
  Building2,
  ClipboardList,
  LineChart
} from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar({ currentTab, setCurrentTab, userRole, handleLogout }) {
  const isSuperAdmin = ['admin', 'owner', 'social_manager', 'media_buyer'].includes(userRole?.role);
  const canAccessFinance = ['admin', 'owner'].includes(userRole?.role);

  const navItems = [
    { id: 'dashboard', label: 'لوحة القيادة', icon: Home },
    { id: 'orders', label: 'الطلبات', icon: Package },
    ...(isSuperAdmin ? [{ id: 'users', label: 'الموظفين', icon: Users }] : []),
    ...(isSuperAdmin ? [{ id: 'daily_products', label: 'منتجات اليوم', icon: ClipboardList }] : []),
    ...(canAccessFinance ? [{ id: 'finance', label: 'المالية', icon: Wallet }] : []),
    ...(isSuperAdmin ? [{ id: 'reports', label: 'التقارير', icon: LineChart }] : []),
    { id: 'settings', label: 'الإعدادات', icon: Settings }
  ];

  return (
    <aside className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 md:relative md:w-64 md:h-full md:bg-white/80 md:border-t-0 md:border-l md:shadow-2xl flex flex-row md:flex-col transition-all duration-300 pb-safe">
      
      {/* Desktop Branding */}
      <div className="hidden md:flex p-6 items-center justify-center border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Package className="text-white w-6 h-6" />
          </div>
          <h1 className="flex flex-col items-start">
            <span className="text-2xl font-black bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">CRM Pro</span>
            <span className="text-[10px] font-mono text-primary-500 font-bold bg-primary-50 px-2 py-0.5 rounded-full mt-1">v2.5.0</span>
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto w-full md:py-6 px-2 md:px-4 gap-1 md:space-y-2 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={clsx(
                "flex md:w-full flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 p-2 md:px-4 md:py-3 rounded-xl font-semibold transition-all duration-300 group min-w-[70px] md:min-w-0",
                isActive 
                  ? "text-primary-600 md:bg-primary-500 md:text-white md:shadow-md md:shadow-primary-500/25 md:-translate-x-1" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-primary-600 md:hover:-translate-x-1"
              )}
            >
              <Icon className={clsx(
                "w-6 h-6 md:w-5 md:h-5 transition-transform duration-300",
                isActive ? "scale-110" : "group-hover:scale-110"
              )} />
              <span className="text-[10px] md:text-sm whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Desktop user profile and logout */}
      <div className="hidden md:block p-4 border-t border-slate-100">
        <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-100 text-center">
          <p className="text-sm font-semibold text-slate-700 truncate">{userRole?.name || 'مستخدم'}</p>
          <p className="text-xs text-slate-500 mt-1">{userRole?.role || 'موظف'}</p>
          <p className="text-[9px] text-slate-400 mt-1 font-bold">v2.5.0</p>
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
