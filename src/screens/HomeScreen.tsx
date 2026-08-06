import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowDownLeft,
  QrCode,
  Receipt,
  LogOut,
  Eye,
  EyeOff,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  Store,
  ScanLine,
  Globe,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAccount } from '@/hooks/useAccount';
import { supabase, type TransactionWithParties } from '@/lib/supabase';
import { formatCurrency, formatDate, getTransactionDirection } from '@/lib/format';

export default function HomeScreen() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { account, loading, refresh } = useAccount();
  const [hideBalance, setHideBalance] = useState(false);
  const [recentTx, setRecentTx] = useState<TransactionWithParties[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payCode, setPayCode] = useState('');

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    async function fetchRecent() {
      const { data } = await supabase
        .from('transactions')
        .select(`
          *,
          from_account:from_account_id (account_number, account_name),
          to_account:to_account_id (account_number, account_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentTx((data ?? []) as TransactionWithParties[]);
    }
    fetchRecent();
  }, [account]);

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading || !account) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-emerald-500">
          <Wallet className="w-10 h-10" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 px-5 pt-12 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-slate-400 text-sm">สวัสดี</p>
            <p className="text-white font-semibold text-lg">
              {account.account_name || user?.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-6 shadow-2xl shadow-emerald-900/50">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-black/10 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-emerald-50 text-sm font-medium">ยอดเงินคงเหลือ</span>
              <button
                onClick={() => setHideBalance(!hideBalance)}
                className="text-emerald-50/80 hover:text-white transition-colors"
              >
                {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-white text-4xl font-bold tracking-tight">
              {hideBalance ? '฿ ••••••' : formatCurrency(account.balance)}
            </p>
            <div className="flex items-center gap-2 mt-4">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg">
                <Wallet className="w-3.5 h-3.5 text-emerald-50" />
                <span className="text-emerald-50 text-xs font-medium">P Bank</span>
              </div>
              <span className="text-emerald-50/70 text-xs font-mono tracking-wider">
                {account.account_number.replace(/(\d{3})(\d{3})(\d{1})/, '$1-$2-$3-')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 -mt-4">
        <div className="grid grid-cols-4 gap-2 bg-slate-900 rounded-2xl p-4 border border-white/5 shadow-xl">
          <ActionButton
            icon={<ArrowUpRight className="w-5 h-5" />}
            label="โอนเงิน"
            onClick={() => navigate('/transfer')}
          />
          <ActionButton
            icon={<ScanLine className="w-5 h-5" />}
            label="จ่ายบิล"
            onClick={() => setShowPayModal(true)}
          />
          <ActionButton
            icon={<QrCode className="w-5 h-5" />}
            label="คิวอาร์ของฉัน"
            onClick={() => navigate('/my-qr')}
          />
          <ActionButton
            icon={<Receipt className="w-5 h-5" />}
            label="ประวัติ"
            onClick={() => navigate('/history')}
          />
        </div>
        <div className="grid grid-cols-4 gap-2 bg-slate-900 rounded-2xl p-4 border border-white/5 shadow-xl mt-2">
          <ActionButton
            icon={<Store className="w-5 h-5" />}
            label="ร้านค้า"
            onClick={() => navigate('/merchant')}
          />
          <ActionButton
            icon={<ArrowDownLeft className="w-5 h-5" />}
            label="รับเงิน"
            onClick={() => navigate('/my-qr')}
          />
          <ActionButton
            icon={<ScanLine className="w-5 h-5" />}
            label="สแกนจ่าย"
            onClick={() => navigate('/qr-scan')}
          />
          <ActionButton
            icon={<Globe className="w-5 h-5" />}
            label="สกุลเงิน"
            onClick={() => navigate('/currency')}
          />
        </div>
      </div>

      {/* Pay by Code Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="text-white font-semibold">กรอกรหัสชำระเงิน</h3>
              <button
                onClick={() => setShowPayModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:text-white transition-all"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <input
                type="text"
                value={payCode}
                onChange={(e) => setPayCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="เช่น AB1234"
                autoFocus
                className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-center text-2xl font-mono tracking-widest placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
              <button
                onClick={() => payCode.length === 6 && navigate(`/pay/${payCode}`)}
                disabled={payCode.length !== 6}
                className="w-full mt-3 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl disabled:opacity-40 transition-all"
              >
                ไปชำระเงิน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="px-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">รายการล่าสุด</h2>
          <button
            onClick={() => navigate('/history')}
            className="text-emerald-400 text-sm font-medium hover:text-emerald-300 transition-colors"
          >
            ดูทั้งหมด
          </button>
        </div>

        {recentTx.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">ยังไม่มีรายการธุรกรรม</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTx.map((tx) => {
              const dir = getTransactionDirection(tx, account.id);
              const isOut = dir === 'out';
              return (
                <button
                  key={tx.id}
                  onClick={() => navigate(`/slip/${tx.id}`)}
                  className="w-full flex items-center gap-3 p-3.5 bg-slate-900 rounded-2xl border border-white/5 hover:border-white/10 transition-all text-left"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isOut ? 'bg-orange-500/10 text-orange-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}
                  >
                    {isOut ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {isOut
                        ? tx.to_account?.account_name || 'โอนออก'
                        : tx.from_account?.account_name || 'รับเข้า'}
                    </p>
                    <p className="text-slate-500 text-xs">{formatDate(tx.created_at)}</p>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      isOut ? 'text-orange-400' : 'text-emerald-400'
                    }`}
                  >
                    {isOut ? '-' : '+'}
                    {formatCurrency(tx.amount)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
    >
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:from-emerald-500/30 group-hover:to-teal-600/30 group-hover:scale-105 transition-all">
        {icon}
      </div>
      <span className="text-slate-300 text-xs font-medium group-hover:text-white transition-colors">
        {label}
      </span>
    </button>
  );
}
