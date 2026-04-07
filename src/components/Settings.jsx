import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Settings as SettingsIcon, User, Lock, Save, LayoutTemplate } from 'lucide-react';
import clsx from 'clsx';

export default function Settings({ userRole }) {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ text: 'كلمات المرور غير متطابقة', type: 'error' });
      return;
    }
    if (password.length < 6) {
      setMessage({ text: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ text: 'تم تحديث كلمة المرور بنجاح!', type: 'success' });
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setMessage({ text: 'حدث خطأ أثناء تحديث كلمة المرور', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative h-full flex flex-col pb-20 custom-scrollbar overflow-y-auto">
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="bg-slate-100 p-2 rounded-lg text-slate-700">
          <SettingsIcon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800">إعدادات الحساب</h2>
          <p className="text-slate-500 font-semibold text-xs mt-0.5">تحديث الملف الشخصي وكلمة المرور</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Profile Info */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-full blur-3xl -z-10"></div>
          
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
            <User className="w-5 h-5 text-primary-500" />
            <h3 className="text-lg font-bold text-slate-800">معلومات الحساب</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">الاسم</label>
              <div className="bg-slate-50 text-slate-800 font-bold px-4 py-3 rounded-xl border border-slate-200">
                {userRole?.name || 'مستخدم بدون اسم'}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">الدور (الصلاحية)</label>
              <div className="bg-primary-50 text-primary-700 font-bold px-4 py-3 rounded-xl border border-primary-100 flex items-center justify-between">
                <span>{userRole?.role === 'admin' ? 'مدير النظام' : 'موظف'}</span>
                {userRole?.role === 'admin' && <span className="bg-primary-200/50 text-primary-800 text-[10px] px-2 py-0.5 rounded-full">صلاحيات كاملة</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -z-10"></div>
          
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
            <Lock className="w-5 h-5 text-slate-800" />
            <h3 className="text-lg font-bold text-slate-800">تغيير كلمة المرور</h3>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {message.text && (
              <div className={clsx(
                "px-4 py-3 rounded-xl text-sm font-bold border",
                message.type === 'error' ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
              )}>
                {message.text}
              </div>
            )}
            
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">كلمة المرور الجديدة</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-slate-400 font-semibold text-left" 
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
            
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">تأكيد كلمة المرور</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:border-slate-400 font-semibold text-left" 
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading || !password || !confirmPassword}
              className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div>
              ) : (
                <><Save className="w-4 h-4" /> حفظ كلمة المرور الجديدة</>
              )}
            </button>
          </form>
        </div>

      </div>

      {/* App Info / UI Settings Placeholder */}
      <div className="bg-slate-800 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
        <div className="w-24 h-24 absolute -bottom-6 -left-6 bg-white/5 rounded-full blur-2xl"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
            <LayoutTemplate className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight">نظام CRM الحديث (v2)</h3>
            <p className="text-slate-400 text-sm font-medium">مبني باستخدام React + Vite + Tailwind</p>
          </div>
        </div>
        <div className="text-center md:text-left relative z-10">
          <p className="text-xs text-slate-400 font-bold">المطور</p>
          <p className="text-sm font-black text-emerald-400">DeepMind Agentic</p>
        </div>
      </div>
      
    </div>
  );
}
