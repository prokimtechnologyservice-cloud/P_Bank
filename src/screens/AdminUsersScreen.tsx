import { useEffect, useState } from 'react';
import { Loader2, Search, Wallet, Plus, Minus, X } from 'lucide-react';
import { supabase, type AdminAccount } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';

type ActionMode = 'topup' | 'deduct' | null;

export default function AdminUsersScreen() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [selectedAccount, setSelectedAccount] = useState<AdminAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_accounts');
    if (!error && data) {
      setAccounts(data as unknown as AdminAccount[]);
    }
    setLoading(false);
  }

  const filtered = accounts.filter(
    (a) =>
      a.account_name.toLowerCase().includes(search.toLowerCase()) ||
      a.account_number.includes(search)
  );

  const openAction = (mode: ActionMode, acc: AdminAccount) => {
    setActionMode(mode);
    setSelectedAccount(acc);
    setAmount('');
    setMemo('');
    setActionError('');
    setActionSuccess('');
  };

  const closeAction = () => {
    setActionMode(null);
    setSelectedAccount(null);
    setAmount('');
    setMemo('');
    setActionError('');
    setActionSuccess('');
  };

  const handleAction = async () => {
    if (!selectedAccount) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setActionError('กรุณากรอกยอดเงินที่ถูกต้อง');
      return;
    }
    setActionLoading(true);
    setActionError('');
    try {
      const fnName = actionMode === 'topup' ? 'admin_topup' : 'admin_deduct';
      const { error } = await supabase.rpc(fnName, {
        p_account_id: selectedAccount.id,
        p_amount: amt,
        p_memo: memo.trim() || (actionMode === 'topup' ? 'เติมเงินโดยผู้ดูแล' : 'หักเงินโดยผู้ดูแล'),
      });
      if (error) throw error;
      setActionSuccess(
        actionMode === 'topup'
          ? `เติมเงิน ${formatCurrency(amt)} ให้ ${selectedAccount.account_name || selectedAccount.account_number} สำเร็จ`
          : `หักเงิน ${formatCurrency(amt)} จาก ${selectedAccount.account_name || selectedAccount.account_number} สำเร็จ`
      );
      await load();
      setTimeout(closeAction, 1500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">จัดการผู้ใช้งาน</h1>
      <p className="text-slate-400 text-sm mb-6">บัญชีธนาคารทั้งหมดในระบบ — สามารถเติมเงินหรือหักเงินได้</p>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาด้วยชื่อหรือเลขบัญชี..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
        />
      </div>

      <div className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">ชื่อบัญชี</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">เลขบัญชี</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider text-right">ยอดเงิน</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">วันที่สมัคร</th>
              <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบบัญชี
                </td>
              </tr>
            ) : (
              filtered.map((acc) => (
                <tr key={acc.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-white text-sm font-medium">{acc.account_name || 'ไม่ระบุชื่อ'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-sm font-mono">{acc.account_number}</td>
                  <td className="px-4 py-3 text-right text-white text-sm font-semibold">{formatCurrency(acc.balance)}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{formatDate(acc.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openAction('topup', acc)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        เติมเงิน
                      </button>
                      <button
                        onClick={() => openAction('deduct', acc)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-all"
                      >
                        <Minus className="w-3.5 h-3.5" />
                        หักเงิน
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Top-up / Deduct Modal */}
      {actionMode && selectedAccount && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="text-white font-semibold">
                {actionMode === 'topup' ? 'เติมเงินเข้าบัญชี' : 'หักเงินจากบัญชี'}
              </h3>
              <button
                onClick={closeAction}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Account info */}
              <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    {selectedAccount.account_name || 'ไม่ระบุชื่อ'}
                  </p>
                  <p className="text-slate-400 text-xs font-mono">{selectedAccount.account_number}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-slate-400 text-xs">ยอดปัจจุบัน</p>
                  <p className="text-white text-sm font-semibold">{formatCurrency(selectedAccount.balance)}</p>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  {actionMode === 'topup' ? 'ยอดเติมเงิน' : 'ยอดหักเงิน'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg font-medium">฿</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    inputMode="decimal"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-xl font-semibold placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[100, 500, 1000, 5000, 10000].map((q) => (
                    <button
                      key={q}
                      onClick={() => setAmount(String(q))}
                      className="flex-1 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-slate-300 text-xs font-medium hover:border-amber-500/30 hover:text-amber-400 transition-all"
                    >
                      {q.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Memo */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">หมายเหตุ (ไม่บังคับ)</label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder={actionMode === 'topup' ? 'เติมเงินโดยผู้ดูแล' : 'หักเงินโดยผู้ดูแล'}
                  maxLength={50}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                />
              </div>

              {/* Error / Success */}
              {actionError && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                  {actionSuccess}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={closeAction}
                  className="flex-1 py-3 bg-slate-800 border border-white/10 rounded-xl text-white font-medium hover:bg-slate-700 transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading}
                  className={`flex-1 py-3 font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                    actionMode === 'topup'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white'
                      : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white'
                  }`}
                >
                  {actionLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {actionMode === 'topup' ? 'ยืนยันเติมเงิน' : 'ยืนยันหักเงิน'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
