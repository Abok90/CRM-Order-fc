import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { X, Search, BellRing, User, Clock, Package } from 'lucide-react';
import clsx from 'clsx';

export default function SystemLogsModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  const fetchLogs = async (query = '') => {
    setLoading(true);
    try {
      let q = supabase
        .from('system_logs')
        .select(`*, user_roles:user_id(name, role)`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (query) {
         q = q.ilike('order_id', `%${query}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.error('Error fetching logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs(searchQuery);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex justify-end">
      <div className="w-full md:w-[400px] bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-slide-in-right border-l dark:border-slate-800">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
           <h2 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
             <BellRing className="w-5 h-5 text-indigo-500" /> سجل حركات النظام
           </h2>
           <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500 shadow-sm transition-colors border border-slate-100 dark:border-slate-700">
              <X className="w-4 h-4" />
           </button>
        </div>

        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
           <form onSubmit={handleSearch} className="relative">
             <input type="text" placeholder="ابحث برقم الأوردر أو البوليصة..." 
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
                    className="custom-input pl-10 w-full text-sm" />
             <button type="submit" className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 bg-slate-100 dark:bg-slate-700/50 rounded-md">
                <Search className="w-4 h-4" />
             </button>
           </form>
           <p className="text-[10px] text-slate-400 mt-2 font-bold text-center">يعرض أحدث 100 حركة، للبحث الأقدم اكتب الرقم واضغط انتر.</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {loading ? (
             <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
          ) : logs.length === 0 ? (
             <div className="text-center text-slate-500 text-sm py-10 font-bold bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">لا توجد حركات مسجلة أو لم يتم العثور على الطلب.</div>
          ) : (
             logs.map(log => (
               <div key={log.id} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-colors group">
                 <div className="flex items-start justify-between mb-2">
                    <div className="flex flex-col gap-0.5">
                       <span className={clsx("text-xs font-black px-2 py-0.5 rounded flex items-center w-max border", 
                         log.action === 'إضافة' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800' :
                         log.action === 'تعديل' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:border-amber-800' : 
                         'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-900/30 dark:border-sky-800'
                       )}>
                         {log.action}
                       </span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1" dir="ltr">
                      {new Date(log.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                      <Clock className="w-3 h-3" />
                    </span>
                 </div>
                 
                 <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed mb-2">
                   {log.details}
                 </p>
                 
                 <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-700/50 text-[10px]">
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded">
                      <User className="w-3 h-3" /> {log.user_roles?.name || 'النظام الآلي / Shopify'}
                    </div>
                    {log.order_id && (
                      <div className="font-mono bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800 flex items-center gap-1 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                        <Package className="w-3 h-3" /> {log.order_id}
                      </div>
                    )}
                 </div>
               </div>
             ))
          )}
        </div>
      </div>
    </div>
  );
}
