import { useEffect, useState } from 'react';
import {
  Wallet,
  ArrowLeftRight,
  Store,
  Receipt,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { supabase, type AdminStats } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';

const DEFAULT_STATS: AdminStats = {
  total_accounts: 0,
  total_balance: 0,
  total_transactions: 0,
  total_volume: 0,
  total_merchants: 0,
  pending_merchants: 0,
  active_merchants: 0,
  total_charges: 0,
  paid_charges: 0,
  pending_charges: 0,
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('admin_stats');
      if (error) {
        setError('ไม่สามารถโหลดข้อมูลได้ กรุณารีเฟรชหน้า');
      } else if (data) {
        // RPC returns an array; pick first row and coerce numeric string columns
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setStats({
            ...row,
            total_balance: Number(row.total_balance ?? 0),
            total_volume: Number(row.total_volume ?? 0),
          } as AdminStats);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  const cards = [
    {
      label: 'ยอดเงินรวมในระบบ',
      value: formatCurrency(stats.total_balance),
      icon: Wallet,
      gradient: 'from-emerald-500/20 to-teal-600/20',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'ปริมาณธุรกรรมทั้งหมด',
      value: formatCurrency(stats.total_volume),
      icon: TrendingUp,
      gradient: 'from-blue-500/20 to-cyan-600/20',
      iconColor: 'text-blue-400',
    },
    {
      label: 'จำนวนบัญชีผู้ใช้',
      value: stats.total_accounts.toLocaleString(),
      icon: Wallet,
      gradient: 'from-amber-500/20 to-orange-600/20',
      iconColor: 'text-amber-400',
    },
    {
      label: 'จำนวนธุรกรรม',
      value: stats.total_transactions.toLocaleString(),
      icon: ArrowLeftRight,
      gradient: 'from-amber-500/20 to-orange-600/20',
      iconColor: 'text-amber-400',
    },
    {
      label: 'ร้านค้าทั้งหมด',
      value: stats.total_merchants.toLocaleString(),
      icon: Store,
      gradient: 'from-pink-500/20 to-rose-600/20',
      iconColor: 'text-pink-400',
    },
    {
      label: 'ร้านค้ารออนุมัติ',
      value: stats.pending_merchants.toLocaleString(),
      icon: AlertCircle,
      gradient: 'from-red-500/20 to-orange-600/20',
      iconColor: 'text-red-400',
    },
    {
      label: 'คำสั่งเรียกเก็บเงิน',
      value: stats.total_charges.toLocaleString(),
      icon: Receipt,
      gradient: 'from-indigo-500/20 to-blue-600/20',
      iconColor: 'text-indigo-400',
    },
    {
      label: 'ชำระแล้ว',
      value: stats.paid_charges.toLocaleString(),
      icon: CheckCircle2,
      gradient: 'from-emerald-500/20 to-green-600/20',
      iconColor: 'text-emerald-400',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">แดชบอร์ด</h1>
      <p className="text-slate-400 text-sm mb-6">ภาพรวมระบบ P Bank</p>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className={`bg-gradient-to-br ${card.gradient} rounded-2xl p-5 border border-white/5`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
              <p className="text-slate-400 text-xs mb-1">{card.label}</p>
              <p className="text-white text-xl font-bold">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-2xl p-5 border border-white/5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Store className="w-4 h-4 text-pink-400" />
            สถานะร้านค้า
          </h3>
          <div className="space-y-3">
            <StatusRow label="รออนุมัติ" value={stats.pending_merchants} color="text-amber-400" />
            <StatusRow label="ใช้งานอยู่" value={stats.active_merchants} color="text-emerald-400" />
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-5 border border-white/5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-400" />
            สถานะคำสั่งเรียกเก็บ
          </h3>
          <div className="space-y-3">
            <StatusRow label="รอชำระ" value={stats.pending_charges} color="text-amber-400" />
            <StatusRow label="ชำระแล้ว" value={stats.paid_charges} color="text-emerald-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`text-lg font-bold ${color}`}>{value.toLocaleString()}</span>
    </div>
  );
}
