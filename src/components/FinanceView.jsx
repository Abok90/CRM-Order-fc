import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Wallet, TrendingUp, TrendingDown, HandCoins, Plus, Pencil, Trash2, X, Save, Filter } from 'lucide-react';
import clsx from 'clsx';

const EXPENSE_CATEGORIES = ['إيجار', 'كهرباء ومياه', 'مرتبات', 'شحن وتوصيل', 'مواد خام', 'تسويق وإعلانات', 'صيانة', 'مصروفات متنوعة', 'مصنع', 'أخرى'];
const INCOME_CATEGORIES = ['تحصيلات طلبات', 'تحصيلات شحن', 'مبيعات نقدية', 'إيرادات متنوعة', 'أخرى'];

export default function FinanceView() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [subTab, setSubTab] = useState('expense');
  
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({ date: '', category: '', details: '', amount: '', department: '' });

  // Order-derived stats
  const [orderStats, setOrderStats] = useState({ totalIncome: 0, totalShipping: 0, deliveredCount: 0 });

  useEffect(() => {
    fetchRecords();
    fetchOrderStats();
  }, []);

  const fetchOrderStats = async () => {
    try {
      const { data } = await supabase.from('orders').select('productPrice, shippingPrice').eq('status', 'تم');
      let income = 0, shipping = 0;
      (data || []).forEach(o => {
        income += Number(o.productPrice) || 0;
        shipping += Number(o.shippingPrice) || 0;
      });
      setOrderStats({ totalIncome: income + shipping, totalShipping: shipping, deliveredCount: data?.length || 0 });
    } catch (e) { console.error(e); }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('finance_records')
        .select('*')
        .order('date', { ascending: false });
      if (error) {
        // If table doesn't exist yet, just use empty
        console.warn('Finance table may not exist:', error.message);
        setRecords([]);
      } else {
        setRecords(data || []);
      }
    } catch (e) {
      console.error(e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (r.type !== subTab) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(r.category)) return false;
      return true;
    });
  }, [records, subTab, dateFrom, dateTo, selectedCategories]);

  const totalExpense = useMemo(() => records.filter(r => r.type === 'expense').reduce((s, r) => s + (Number(r.amount) || 0), 0), [records]);
  const totalIncome = useMemo(() => records.filter(r => r.type === 'income').reduce((s, r) => s + (Number(r.amount) || 0), 0), [records]);
  const filteredTotal = filteredRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const net = totalIncome - totalExpense;

  const openModal = (type, record = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({ date: record.date, category: record.category, details: record.details || '', amount: record.amount, department: record.department || '' });
    } else {
      setEditingRecord(null);
      setFormData({ date: new Date().toISOString().split('T')[0], category: (type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[0], details: '', amount: '', department: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.amount || !formData.date) { alert('يرجى ملء المبلغ والتاريخ'); return; }
    try {
      const payload = { ...formData, type: subTab, amount: Number(formData.amount) };
      if (editingRecord) {
        const { error } = await supabase.from('finance_records').update(payload).eq('id', editingRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('finance_records').insert([payload]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchRecords();
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await supabase.from('finance_records').delete().eq('id', id);
      fetchRecords();
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const categories = subTab === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in pb-20">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
        <div className="glass-panel p-4 md:p-6 rounded-2xl shadow-sm border border-white flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-red-500"></div>
          <p className="text-slate-500 text-xs md:text-sm font-bold">إجمالي المصروفات</p>
          <p className="text-2xl md:text-3xl font-black text-red-600">{totalExpense.toLocaleString()} <span className="text-sm">ج.م</span></p>
        </div>
        <div className="glass-panel p-4 md:p-6 rounded-2xl shadow-sm border border-white flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-green-500"></div>
          <p className="text-slate-500 text-xs md:text-sm font-bold">إجمالي الإيرادات اليدوية</p>
          <p className="text-2xl md:text-3xl font-black text-green-600">{totalIncome.toLocaleString()} <span className="text-sm">ج.م</span></p>
          <p className="text-[10px] text-slate-400 font-bold mt-1 border-t border-slate-100 pt-1">تحصيلات الأوردرات (تم): <span className="text-slate-700 font-black">{orderStats.totalIncome.toLocaleString()} ج.م</span> — {orderStats.deliveredCount} أوردر</p>
        </div>
        <div className="glass-panel p-4 md:p-6 rounded-2xl shadow-sm border border-white flex flex-col gap-2 relative overflow-hidden bg-slate-800 text-white">
          <p className="text-slate-300 text-xs md:text-sm font-bold">الصافي</p>
          <p className={`text-2xl md:text-3xl font-black ${net >= 0 ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
            {net.toLocaleString()} <span className="text-sm">ج.م</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <button onClick={() => { setSubTab('expense'); setSelectedCategories([]); }} className={`flex-1 py-3 md:py-4 font-black text-sm transition-colors ${subTab === 'expense' ? 'bg-red-50 text-red-600 border-b-2 border-red-600' : 'text-slate-500 hover:bg-slate-50'}`}>
          المصروفات
        </button>
        <button onClick={() => { setSubTab('income'); setSelectedCategories([]); }} className={`flex-1 py-3 md:py-4 font-black text-sm transition-colors ${subTab === 'income' ? 'bg-green-50 text-green-600 border-b-2 border-green-600' : 'text-slate-500 hover:bg-slate-50'}`}>
          الإيرادات والتحصيلات
        </button>
      </div>

      {/* Filters & Table */}
      <div className="glass-panel rounded-2xl shadow-sm border border-white flex flex-col overflow-hidden">
        <div className="p-3 md:p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-xs md:text-sm text-slate-700 flex items-center gap-2"><Filter className="w-4 h-4" /> تصفية وبحث الحسابات</h3>
            <div className="flex items-center gap-2">
              <span className="font-black text-sky-700 bg-sky-100 px-3 py-1.5 rounded-lg text-[11px] md:text-sm shadow-sm border border-sky-200">
                إجمالي الفلتر: {filteredTotal.toLocaleString()} ج.م
              </span>
              <button onClick={() => openModal(subTab)} className={`hidden md:flex px-4 py-1.5 rounded-lg font-bold text-white text-xs md:text-sm shadow-md items-center gap-1 transition-transform hover:-translate-y-0.5 ${subTab === 'expense' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                <Plus className="w-4 h-4" /> إضافة {subTab === 'expense' ? 'مصروف' : 'إيراد'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] md:text-xs text-slate-500 font-bold">من تاريخ</label>
              <input type="date" className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-sky-500 outline-none" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] md:text-xs text-slate-500 font-bold">إلى تاريخ</label>
              <input type="date" className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-sky-500 outline-none" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] md:text-xs text-slate-500 font-bold">البنود</label>
              <div className="flex flex-wrap gap-1 border border-slate-300 rounded-lg p-2 bg-white min-h-[38px] max-h-24 overflow-y-auto">
                {selectedCategories.length === 0 ? <span className="text-slate-400 text-xs font-bold">كل البنود</span> :
                  selectedCategories.map(c => (
                    <span key={c} className="bg-sky-100 text-sky-700 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold border border-sky-200">
                      {c} <button onClick={() => toggleCategory(c)} className="hover:text-red-500">×</button>
                    </span>
                  ))
                }
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {categories.map(cat => (
              <button key={cat} onClick={() => toggleCategory(cat)} className={clsx("text-[10px] px-2 py-1 rounded-lg font-bold border transition-all", selectedCategories.includes(cat) ? 'bg-sky-100 text-sky-700 border-sky-300 ring-1 ring-sky-400' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50')}>
                {cat}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-3">
            <button onClick={() => openModal(subTab)} className={`md:hidden px-4 py-1.5 rounded-lg font-bold text-white text-[11px] shadow-md flex items-center gap-1 ${subTab === 'expense' ? 'bg-red-600' : 'bg-green-600'}`}>
              <Plus className="w-3.5 h-3.5" /> إضافة جديد
            </button>
            {(dateFrom || dateTo || selectedCategories.length > 0) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setSelectedCategories([]); }} className="text-xs text-red-500 font-bold hover:underline bg-red-50 px-2 py-1 rounded mr-auto border border-red-100">
                ✖ إلغاء الفلتر
              </button>
            )}
          </div>
        </div>

        {/* Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right whitespace-nowrap min-w-[600px]">
            <thead className="bg-slate-800 text-white text-[11px]">
              <tr>
                <th className="px-3 py-3 w-10 text-center">#</th>
                <th className="px-3 py-3">التاريخ</th>
                <th className="px-3 py-3">{subTab === 'expense' ? 'البند الرئيسي' : 'نوع التحصيل'}</th>
                <th className="px-3 py-3 w-1/3">التفاصيل / الوصف</th>
                {subTab === 'expense' && <th className="px-3 py-3">القسم</th>}
                <th className="px-3 py-3">المبلغ</th>
                <th className="px-3 py-3 text-center w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-3 py-3"><div className="h-4 bg-slate-200 rounded w-6"></div></td>
                    <td className="px-3 py-3"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="px-3 py-3"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-3 py-3"><div className="h-4 bg-slate-200 rounded w-40"></div></td>
                    <td className="px-3 py-3"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-3 py-3"><div className="h-4 bg-slate-200 rounded w-12"></div></td>
                  </tr>
                ))
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={subTab === 'expense' ? 7 : 6} className="text-center py-10 text-slate-500 font-bold">لا توجد سجلات مطابقة.</td></tr>
              ) : (
                filteredRecords.map((r, i) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 text-center font-bold text-slate-400">{i + 1}</td>
                    <td className="px-3 py-3 font-bold text-slate-700">{r.date}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${subTab === 'expense' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{r.category}</span>
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-600 whitespace-pre-wrap">{r.details || '—'}</td>
                    {subTab === 'expense' && <td className="px-3 py-3 font-bold text-slate-700">{r.department || '—'}</td>}
                    <td className={`px-3 py-3 font-black ${subTab === 'expense' ? 'text-red-600' : 'text-green-600'}`}>{Number(r.amount).toLocaleString()} ج.م</td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => openModal(subTab, r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors ml-1"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">{editingRecord ? 'تعديل السجل' : `إضافة ${subTab === 'expense' ? 'مصروف' : 'إيراد'} جديد`}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">التاريخ <span className="text-rose-500">*</span></label>
                  <input type="date" className="custom-input" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">المبلغ (ج.م) <span className="text-rose-500">*</span></label>
                  <input type="number" className="custom-input" placeholder="0" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">{subTab === 'expense' ? 'البند الرئيسي' : 'نوع التحصيل'}</label>
                <select className="custom-input cursor-pointer" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {subTab === 'expense' && (
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">القسم (مصنع/أونلاين)</label>
                  <input type="text" className="custom-input" placeholder="مثال: أونلاين" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">التفاصيل / الوصف</label>
                <textarea className="custom-input min-h-[80px]" placeholder="تفاصيل إضافية..." value={formData.details} onChange={e => setFormData({ ...formData, details: e.target.value })}></textarea>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary px-6">إلغاء</button>
              <button onClick={handleSave} className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-white shadow-md ${subTab === 'expense' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                <Save className="w-5 h-5" /> حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
