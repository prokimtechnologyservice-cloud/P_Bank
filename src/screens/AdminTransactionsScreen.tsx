import { useEffect, useState } from 'react';
import { Loader2, ArrowLeftRight, Search } from 'lucide-react';
import { supabase, type AdminTransaction } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';

export default function AdminTransactionsScreen() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('admin_list_transactions', { limit_count: 200 });
      if (!error && data) {
        setTransactions(data as unknown as AdminTransaction[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = transactions.filter(
    (t) =>
      t.slip_code.toLowerCase().includes(search.toLowerCase()) ||
      (t.from_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.to_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.from_number || '').includes(search) ||
      (t.to_number || '').includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">ประวัติธุรกรรม</h1>
      <p className="text-slate-400 text-sm mb-6">ธุรกรรมการโอนเงินทั้งหมดในระบบ</p>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาด้วยเลขอ้างอิง ชื่อ หรือเลขบัญชี..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
        />
      </div>

      <div className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">เลขอ้างอิง</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">จาก</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">ถึง</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider text-right">ยอดเงิน</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">วันที่</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบธุรกรรม
                </td>
              </tr>
            ) : (
              filtered.map((tx) => (
                <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-slate-300 text-sm font-mono">{tx.slip_code}</td>
                  <td className="px-4 py-3">
                    <p className="text-white text-sm font-medium">{tx.from_name || '—'}</p>
                    <p className="text-slate-500 text-xs font-mono">{tx.from_number || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white text-sm font-medium">{tx.to_name || '—'}</p>
                    <p className="text-slate-500 text-xs font-mono">{tx.to_number || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-400 text-sm font-semibold">{formatCurrency(tx.amount)}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{formatDate(tx.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
