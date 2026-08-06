import { useEffect, useState } from 'react';
import { Loader2, Receipt, Search } from 'lucide-react';
import { supabase, type ChargeWithMerchant } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';

export default function AdminChargesScreen() {
  const [charges, setCharges] = useState<ChargeWithMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('admin_list_charges', { limit_count: 200 });
      if (!error && data) {
        setCharges(data as unknown as ChargeWithMerchant[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = charges.filter(
    (c) =>
      c.short_code.toLowerCase().includes(search.toLowerCase()) ||
      c.reference.toLowerCase().includes(search.toLowerCase()) ||
      (c.merchant_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      expired: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    const labels: Record<string, string> = {
      pending: 'รอชำระ',
      paid: 'ชำระแล้ว',
      expired: 'หมดอายุ',
      cancelled: 'ยกเลิก',
    };
    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">คำสั่งเรียกเก็บเงิน</h1>
      <p className="text-slate-400 text-sm mb-6">คำสั่งเรียกเก็บเงินจากร้านค้าทั้งหมด</p>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาด้วยรหัส อ้างอิง หรือร้านค้า..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
        />
      </div>

      <div className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">รหัส</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">ร้านค้า</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">อ้างอิง</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider text-right">ยอดเงิน</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">สถานะ</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">วันที่</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบคำสั่งเรียกเก็บ
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-slate-300 text-sm font-mono">{c.short_code}</td>
                  <td className="px-4 py-3 text-white text-sm font-medium">{c.merchant_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{c.reference || '—'}</td>
                  <td className="px-4 py-3 text-right text-white text-sm font-semibold">{formatCurrency(c.amount)}</td>
                  <td className="px-4 py-3">{statusBadge(c.status)}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{formatDate(c.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
