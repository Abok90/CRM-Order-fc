import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrdersList from './components/OrdersList';

function App() {
  const [session, setSession] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [userRole, setUserRole] = useState({ name: 'مدير النظام', role: 'admin' }); // Mock for now until fetchUserRole is implemented

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      setAuthError('كلمة المرور أو البريد الإلكتروني غير صحيح');
    }
    setAuthLoading(false);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="glass-panel p-8 max-w-md w-full text-center animate-hover-pop">
          <h1 className="text-3xl font-extrabold text-slate-800 mb-2 font-sans tracking-tight">CRM Pro</h1>
          <p className="text-slate-500 mb-8 font-medium">تسجيل الدخول للموظفين</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {authError && <div className="text-rose-500 text-sm font-bold bg-rose-50 p-2 rounded">{authError}</div>}
            
            <input 
              type="email" 
              placeholder="البريد الإلكتروني" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="custom-input text-right" 
            />
            
            <input 
              type="password" 
              placeholder="كلمة المرور" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="custom-input text-right" 
            />
            
            <button 
              type="submit" 
              disabled={authLoading}
              className="btn-primary w-full shadow-lg"
            >
              {authLoading ? 'جاري التحضير...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
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
      <main className="flex-1 overflow-hidden p-4 md:p-8 relative flex flex-col">
        {/* Subtle Background Elements */}
        <div className="absolute top-0 right-0 w-full h-96 bg-gradient-to-b from-primary-50/50 to-transparent -z-10 blur-3xl pointer-events-none"></div>
        
        {currentTab === 'dashboard' && <Dashboard stats={{ total: 1542, processing: 34, shipping: 120, delivered: 1300 }} />}
        {currentTab === 'orders' && <OrdersList userRole={userRole} />}
      </main>
    </div>
  );
}

export default App;
