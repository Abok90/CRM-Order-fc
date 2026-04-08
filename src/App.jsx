import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrdersList from './components/OrdersList';
import UsersList from './components/UsersList';
import DailyProductsView from './components/DailyProductsView';
import FinanceView from './components/FinanceView';
import Reports from './components/Reports';
import Settings from './components/Settings';
import SystemLogsModal from './components/SystemLogsModal';
import { Lock, Mail, LogIn, UserPlus, Settings as SettingsIcon, ZoomIn, ZoomOut, Moon, Sun, LogOut, User, BellRing } from 'lucide-react';

function App() {
  const [session, setSession] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [userRole, setUserRole] = useState(null);
  const [appLoading, setAppLoading] = useState(true);

  const [initialOrderFilter, setInitialOrderFilter] = useState(null);
  const navigateToOrdersWithFilter = (type, value, extraFilters) => {
    setInitialOrderFilter({ type, value, ...extraFilters });
    setCurrentTab('orders');
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  // UI Accessibility Zoom Settings & Dark Mode
  const [zoomLevel, setZoomLevel] = useState(Number(localStorage.getItem('appZoom')) || 1);
  const [theme, setTheme] = useState(localStorage.getItem('appTheme') || 'light');
  const [showConfig, setShowConfig] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  const isAdmin = ['admin', 'super_admin', 'brand_owner', 'owner'].includes(userRole?.role);

  useEffect(() => {
    document.documentElement.style.fontSize = `${zoomLevel * 16}px`;
    localStorage.setItem('appZoom', zoomLevel.toString());
  }, [zoomLevel]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('appTheme', theme);
  }, [theme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserRole(session.user.id, session.user.email);
      else setAppLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserRole(session.user.id, session.user.email);
      else {
        setUserRole(null);
        setAppLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId, userEmail) => {
    try {
      const { data, error } = await supabase.from('user_roles').select('*').eq('id', userId).maybeSingle();
      if (data) {
        setUserRole(data);
      } else {
        const dummyRole = { id: userId, name: userEmail?.split('@')[0] || 'مستخدم', role: 'agent', is_approved: false };
        setUserRole(dummyRole);
      }
    } catch (e) {
      console.error(e);
      const dummyRole = { id: userId, name: userEmail?.split('@')[0] || 'مستخدم', role: 'agent', is_approved: false };
      setUserRole(dummyRole);
    } finally {
      setAppLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    
    if (isLoginMode) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError('كلمة المرور أو البريد الإلكتروني غير صحيح');
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthError(error.message.includes('already registered') ? 'هذا الحساب مسجل بالفعل' : 'حدث خطأ أثناء التسجيل، يرجى المحاولة لاحقاً');
      } else {
        alert('تم التسجيل بنجاح! حسابك الآن قيد المراجعة.');
      }
    }
    
    setAuthLoading(false);
  };

  if (appLoading) {
    return <div className="flex items-center justify-center h-screen bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="glass-panel p-8 max-w-md w-full text-center animate-hover-pop">
           <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-primary-500/30 mb-4">
              <Lock className="w-8 h-8 text-white" />
           </div>
          <h1 className="text-3xl font-extrabold text-slate-800 mb-2 font-sans tracking-tight">CRM Pro</h1>
          <p className="text-slate-500 mb-8 font-medium">{isLoginMode ? 'تسجيل الدخول للموظفين' : 'انضم لفريق العمل'}</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {authError && <div className="text-rose-500 text-sm font-bold bg-rose-50 p-2 rounded">{authError}</div>}
            
            <div className="relative">
              <Mail className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="email" 
                placeholder="البريد الإلكتروني" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 outline-none focus:border-primary-500 font-semibold" 
              />
            </div>
            
            <div className="relative">
              <Lock className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="password" 
                placeholder="كلمة المرور" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 outline-none focus:border-primary-500 font-semibold" 
              />
            </div>
            
            <button 
              type="submit" 
              disabled={authLoading}
              className="btn-primary w-full shadow-lg flex justify-center items-center gap-2"
            >
              {authLoading ? (
                <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div>
              ) : (
                <>{isLoginMode ? <LogIn className="w-5 h-5"/> : <UserPlus className="w-5 h-5"/>} {isLoginMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <button 
              onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }} 
              className="text-primary-600 font-bold hover:underline text-sm"
              type="button"
            >
              {isLoginMode ? 'لا تملك حساباً؟ أنشئ حساب جديد' : 'لديك حساب بالفعل؟ قم بتسجيل الدخول'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userRole && !userRole.is_approved && userRole.role !== 'admin') {
     return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-slate-50 p-4 font-sans text-center" dir="rtl">
        <div className="w-20 h-20 bg-amber-100 text-amber-500 flex items-center justify-center rounded-full mb-4">
           <Lock className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">حسابك قيد المراجعة</h2>
        <p className="text-slate-500 max-w-sm mb-6">يرجى التواصل مع الإدارة لتفعيل الحساب الخاص بك وتحديد صلاحياتك.</p>
        <button onClick={handleLogout} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300">تسجيل الخروج</button>
      </div>
     );
  }

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden font-sans text-slate-800 pb-[72px] md:pb-0">
      {/* Sidebar Navigation */}
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        userRole={userRole} 
        handleLogout={handleLogout} 
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto custom-scrollbar p-0 md:p-8 relative flex flex-col pt-4 md:pt-8 w-full">
        {/* Subtle Background Elements */}
        <div className="absolute top-0 right-0 w-full h-96 bg-gradient-to-b from-primary-50/50 to-transparent -z-10 blur-3xl pointer-events-none"></div>
        
        {currentTab === 'dashboard' && <Dashboard onNavigateWithFilter={navigateToOrdersWithFilter} userRole={userRole} />}
        {currentTab === 'orders' && <OrdersList userRole={userRole} initialFilter={initialOrderFilter} onFilterConsumed={() => setInitialOrderFilter(null)} />}
        {currentTab === 'users' && <UsersList userRole={userRole} />}
        {currentTab === 'daily_products' && <DailyProductsView />}
        {currentTab === 'finance' && <FinanceView />}
        {currentTab === 'reports' && <Reports userRole={userRole} />}
        {currentTab === 'settings' && <Settings userRole={userRole} />}
        
        {/* Floating Accessibility Settings Gear */}
        <div className="fixed bottom-24 right-4 md:bottom-8 md:left-8 md:right-auto z-40 flex flex-col items-center">
          <button 
            onClick={() => setShowConfig(!showConfig)} 
            className="w-12 h-12 bg-white text-primary-600 rounded-full shadow-2xl flex items-center justify-center border border-primary-100 hover:scale-110 transition-transform"
            title="إعدادات الرؤية"
          >
             <SettingsIcon className="w-6 h-6 hover:animate-spin" />
          </button>
          
          {showConfig && (
            <div className="absolute bottom-full right-0 md:right-auto md:left-0 mb-4 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 w-64 animate-fade-in flex flex-col gap-4">
               {/* Mobile Profile Display */}
               <div className="flex md:hidden items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
                 <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300">
                    <User className="w-5 h-5" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{userRole?.name || 'مستخدم'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{userRole?.role || ''}</p>
                 </div>
               </div>

               <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm border-b dark:border-slate-700 pb-2 flex justify-between items-center">
                 إعدادات النظام
                 <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-xs text-rose-500 font-bold px-2 py-0.5 rounded-md hover:bg-rose-50 dark:hover:bg-slate-700">إغلاق</button>
               </h4>
               
               <div className="flex flex-col gap-1.5">
                 <span className="text-xs font-bold text-slate-500 dark:text-slate-400">حجم الخط والعرض:</span>
                 <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700 p-2 rounded-xl">
                     <button onClick={() => setZoomLevel(z => Math.max(0.6, parseFloat((z - 0.1).toFixed(1))))} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 shadow-sm"><ZoomOut className="w-5 h-5"/></button>
                     <span className="font-black text-primary-600 dark:text-primary-400 font-mono text-lg" dir="ltr">{Math.round(zoomLevel * 100)}%</span>
                     <button onClick={() => setZoomLevel(z => Math.min(1.5, parseFloat((z + 0.1).toFixed(1))))} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 shadow-sm"><ZoomIn className="w-5 h-5"/></button>
                 </div>
               </div>

               <div className="flex items-center justify-between pt-2">
                 <span className="text-xs font-bold text-slate-500 dark:text-slate-400">الوضع الليلي:</span>
                 <button 
                   onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                   className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                 >
                   {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                 </button>
               </div>

               <button onClick={() => setZoomLevel(1)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold w-full text-center hover:bg-slate-50 dark:hover:bg-slate-700 py-1.5 rounded-lg transition-colors">إعادة الحجم الافتراضي (100%)</button>
               
               <button 
                 onClick={handleLogout} 
                 className="mt-2 flex md:hidden items-center justify-center gap-2 w-full p-2 bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 rounded-xl font-bold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
               >
                 <LogOut className="w-5 h-5" /> تسجيل الخروج
               </button>
            </div>
          )}
          
          {isAdmin && (
            <button 
              onClick={() => setIsLogsOpen(!isLogsOpen)} 
              className="w-12 h-12 mt-3 bg-white dark:bg-slate-800 text-indigo-500 rounded-full shadow-2xl flex items-center justify-center border border-indigo-100 dark:border-slate-700 hover:scale-110 transition-transform relative group"
              title="سجل الحركات وإشعارات النظام"
            >
               <BellRing className="w-5 h-5 group-hover:animate-bounce" />
               <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 hidden"></span>
            </button>
          )}
        </div>
      </main>

      {isAdmin && <SystemLogsModal isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} />}
    </div>
  );
}

export default App;
