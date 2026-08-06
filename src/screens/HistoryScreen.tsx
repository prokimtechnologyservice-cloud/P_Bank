import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Inbox, Loader2 } from 'lucide-react';
import { useRequireAccount } from '@/hooks/useAccount';
import { supabase, type TransactionWithParties } from '@/lib/supabase';
import { formatCurrency, formatDateShort, getTransactionDirection } from '@/lib/format';

type Filter = 'all' | 'in' | 'out';

export default function HistoryScreen() {
  const navigate = useNavigate();
  const { account } = useRequireAccount();
  const [transactions, setTransactions] = useState<TransactionWithParties[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!account) return;
    async function fetchTx() {
      setLoading(true);
      const { data } = await supabase
        .from('transactions')
        .select(`
          *,
          from_account:from_account_id (account_number, account_name),
          to_account:to_account_id (account_number, account_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      setTransactions((data ?? []) as TransactionWithParties[]);
      setLoading(false);
    }
    fetchTx();
  }, [account]);

  if (!account) return null;

  const filtered = transactions.filter((tx) => {
    if (filter === 'all') return true;
    const dir = getTransactionDirection(tx, account.id);
    return dir === filter;
  });

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 px-5 pt-12 pb-5 sticky top-0 z-10 border-b border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-white font-semibold text-lg">ประวัติการทำธุรกรรม</h1>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl">
          {([
            { key: 'all', label: 'ทั้งหมด' },
            { key: 'out', label: 'โอนออก' },
            { key: 'in', label: 'รับเข้า' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === tab.key
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">ยังไม่มีรายการธุรกรรม</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((tx) => {
              const dir = getTransactionDirection(tx, account.id);
              const isOut = dir === 'out';
              return (
                <button
                  key={tx.id}
                  onClick={() => navigate(`/slip/${tx.id}`)}
                  className="w-full flex items-center gap-3 p-4 bg-slate-900 rounded-2xl border border-white/5 hover:border-white/10 transition-all text-left"
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isOut
                        ? 'bg-orange-500/10 text-orange-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}
                  >
                    {isOut ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {isOut
                        ? tx.to_account?.account_name || 'โอนออก'
                        : tx.from_account?.account_name || 'รับเข้า'}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {formatDateShort(tx.created_at)}
                    </p>
                    {tx.memo && (
                      <p className="text-slate-600 text-xs truncate mt-0.5">{tx.memo}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        isOut ? 'text-orange-400' : 'text-emerald-400'
                      }`}
                    >
                      {isOut ? '-' : '+'}
                      {formatCurrency(tx.amount)}
                    </p>
                    <p className="text-slate-600 text-xs font-mono mt-0.5">
                      {tx.slip_code}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
