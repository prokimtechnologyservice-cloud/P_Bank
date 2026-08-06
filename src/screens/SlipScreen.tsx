import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Share2,
  Wallet,
  Loader2,
  Printer,
} from 'lucide-react';
import { useRequireAccount } from '@/hooks/useAccount';
import { supabase, type TransactionWithParties } from '@/lib/supabase';
import { formatCurrency, formatDateFull, formatAccountNumber } from '@/lib/format';

export default function SlipScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { account } = useRequireAccount();
  const [tx, setTx] = useState<TransactionWithParties | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function fetchTx() {
      setLoading(true);
      const { data } = await supabase
        .from('transactions')
        .select(`
          *,
          from_account:from_account_id (account_number, account_name),
          to_account:to_account_id (account_number, account_name)
        `)
        .eq('id', id)
        .maybeSingle();
      setTx(data as TransactionWithParties | null);
      setLoading(false);
    }
    fetchTx();
  }, [id]);

  if (loading || !account) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-5">
        <p>ไม่พบรายการธุรกรรม</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-5 py-2 bg-emerald-500 text-white rounded-xl font-medium"
        >
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  const isOut = tx.from_account_id === account.id;
  const counterparty = isOut ? tx.to_account : tx.from_account;
  const counterpartyName = counterparty?.account_name || 'ไม่ทราบชื่อ';
  const counterpartyNumber = counterparty?.account_number || '—';

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const text = `สลิปโอนเงิน P Bank\nจาก: ${account.account_name}\nถึง: ${counterpartyName}\nยอด: ${formatCurrency(tx.amount)}\nเลขอ้างอิง: ${tx.slip_code}\nวันที่: ${formatDateFull(tx.created_at)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'สลิปโอนเงิน', text });
      } catch {
        // cancelled
      }
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 px-5 pt-12 pb-5 sticky top-0 z-10 border-b border-white/5 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-white font-semibold text-lg">สลิปการโอนเงิน</h1>
        </div>
      </div>

      <div className="px-5 py-6 print:py-0 print:px-0">
        {/* Slip Card */}
        <div
          id="slip-card"
          className="max-w-md mx-auto bg-white rounded-3xl overflow-hidden shadow-2xl print:shadow-none print:rounded-none"
        >
          {/* Top banner */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-none">P Bank</p>
                <p className="text-emerald-50/80 text-xs">ใบโอนเงิน</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span className="text-white text-xs font-medium">สำเร็จ</span>
            </div>
          </div>

          {/* Amount */}
          <div className="px-6 py-8 text-center border-b border-dashed border-slate-200">
            <p className="text-slate-400 text-sm mb-2">
              {isOut ? 'โอนเงินออก' : 'รับเงินเข้า'}
            </p>
            <p className="text-slate-900 text-4xl font-bold tracking-tight">
              {formatCurrency(tx.amount)}
            </p>
            <p className="text-slate-400 text-sm mt-2">{formatDateFull(tx.created_at)}</p>
          </div>

          {/* Details */}
          <div className="px-6 py-5 space-y-4">
            {/* From */}
            <div>
              <p className="text-slate-400 text-xs mb-1">จากบัญชี</p>
              <p className="text-slate-900 font-medium">{account.account_name || '—'}</p>
              <p className="text-slate-500 text-sm font-mono">
                {formatAccountNumber(account.account_number)}
              </p>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0l-6-6m6 6l6-6" />
                </svg>
              </div>
            </div>

            {/* To */}
            <div>
              <p className="text-slate-400 text-xs mb-1">เข้าบัญชี</p>
              <p className="text-slate-900 font-medium">{counterpartyName}</p>
              <p className="text-slate-500 text-sm font-mono">
                {formatAccountNumber(counterpartyNumber)}
              </p>
            </div>

            {/* Memo */}
            {tx.memo && (
              <div className="pt-3 border-t border-slate-100">
                <p className="text-slate-400 text-xs mb-1">บันทึก</p>
                <p className="text-slate-700 text-sm">{tx.memo}</p>
              </div>
            )}

            {/* Slip code */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs mb-1">เลขอ้างอิง</p>
                <p className="text-slate-700 text-sm font-mono">{tx.slip_code}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-xs mb-1">สถานะ</p>
                <p className="text-emerald-600 text-sm font-semibold">สำเร็จ</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-3 text-center">
            <p className="text-slate-400 text-xs">
              ธุรกรรมนี้ดำเนินการผ่านระบบ P Bank
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="max-w-md mx-auto flex gap-3 mt-6 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-slate-900 border border-white/10 rounded-xl text-white font-medium flex items-center justify-center gap-2 hover:border-emerald-500/30 transition-all"
          >
            <Printer className="w-4 h-4" />
            บันทึกสลิป
          </button>
          <button
            onClick={handleShare}
            className="flex-1 py-3 bg-slate-900 border border-white/10 rounded-xl text-white font-medium flex items-center justify-center gap-2 hover:border-emerald-500/30 transition-all"
          >
            <Share2 className="w-4 h-4" />
            แชร์
          </button>
        </div>

        <button
          onClick={() => navigate('/')}
          className="max-w-md mx-auto mt-3 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all print:hidden"
        >
          กลับหน้าหลัก
        </button>
      </div>
    </div>
  );
}
