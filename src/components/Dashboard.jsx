import React from 'react';
import { Package, TrendingUp, Truck, CheckCircle } from 'lucide-react';

export default function Dashboard({ stats }) {
  const statCards = [
    { title: 'إجمالي الطلبات', value: stats?.total || 0, icon: Package, color: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/30' },
    { title: 'جاري التحضير', value: stats?.processing || 0, icon: TrendingUp, color: 'from-amber-500 to-amber-600', shadow: 'shadow-amber-500/30' },
    { title: 'قيد الشحن', value: stats?.shipping || 0, icon: Truck, color: 'from-purple-500 to-purple-600', shadow: 'shadow-purple-500/30' },
    { title: 'تم التسليم', value: stats?.delivered || 0, icon: CheckCircle, color: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-500/30' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">نظرة عامة</h2>
          <p className="text-slate-500 mt-1 font-medium">مرحباً بك مجدداً! إليك ملخص الأداء اليوم.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div 
              key={idx} 
              className="glass-panel p-6 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300"
            >
              {/* Premium Background Glow Effect */}
              <div className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${card.color} rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-300`}></div>
              
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-slate-500 font-semibold mb-1">{card.title}</p>
                  <h3 className="text-3xl font-black text-slate-800">{card.value}</h3>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg ${card.shadow} text-white`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 glass-panel p-6 min-h-[400px] flex items-center justify-center">
          <p className="text-slate-400 font-medium">سيتم عرض الرسم البياني هنا (Recharts)</p>
        </div>
        <div className="glass-panel p-6 min-h-[400px] flex items-center justify-center">
          <p className="text-slate-400 font-medium">سجل النشاطات السريعة (Activity Feed)</p>
        </div>
      </div>
    </div>
  );
}
