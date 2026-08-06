import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Store,
  CheckCircle2,
  AlertCircle,
  Lock,
  Clock,
} from 'lucide-react';
import { useRequireAccount } from '@/hooks/useAccount';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateFull } from '@/lib/format';

type ChargeLookup = {
  id: string;
  amount: number;
  currency: string;
  reference: string;
  status: string;
  short_code: string;
  merchant_name: string;
  expires_at: string;
};

export default function PayScreen() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { account } = useRequireAccount();
  const [charge, setCharge] = useState<ChargeLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    async function lookup() {
      if (!code) return;
      const { data, error } = await supabase.rpc('lookup_charge', {
        p_short_code: code.toUpperCase(),
      });
      if (!error && data && (data as unknown[]).length > 0) {
        setCharge((data as ChargeLookup[])[0]);
      }
      setLoading(false);
    }
    lookup();
  }, [code]);

  const handlePay = async () => {
    if (!charge || !account) return;
    setError('');
    setPaying(true);
    try {
      const { data, error } = await supabase.rpc('pay_charge', {
        p_short_code: charge.short_code,
      });
      if (error) throw error;
      setTxId(data as string);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ชำระเงินไม่สำเร็จ');
    } finally {
      setPaying(false);
    }
  };

  if (loading || !account) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (success && txId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-5">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-white text-2xl font-bold mb-2">ชำระเงินสำเร็จ</h1>
        <p className="text-slate-400 text-sm mb-6">
          ตรวจสอบสลิปได้ในประวัติธุรกรรม
        </p>
        <button
          onClick={() => navigate(`/slip/${txId}`)}
          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all"
        >
          ดูสลิป
        </button>
      </div>
    );
  }

  if (!charge) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="bg-slate-900 px-5 pt-12 pb-5 sticky top-0 z-10 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-semibold text-lg">ชำระเงิน</h1>
          </div>
        </div>
        <div className="text-center py-20 px-5">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">ไม่พบคำสั่งเรียกเก็บเงิน</p>
          <p className="text-slate-400 text-sm">รหัส {code} ไม่ถูกต้องหรือหมดอายุแล้ว</p>
        </div>
      </div>
    );
  }

  const isExpired = new Date(charge.expires_at) < new Date();
  const insufficient = account.balance < charge.amount;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 px-5 pt-12 pb-5 sticky top-0 z-10 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-white font-semibold text-lg">ชำระเงิน</h1>
        </div>
      </div>

      <div className="px-5 py-6 max-w-md mx-auto">
        {/* Charge Card */}
        <div className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden">
          {/* Merchant Header */}
          <div className="bg-gradient-to-r from-pink-500/10 to-rose-600/10 px-5 py-4 flex items-center gap-3 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{charge.merchant_name}</p>
              <p className="text-slate-400 text-xs">รหัส: {charge.short_code}</p>
            </div>
          </div>

          {/* Amount */}
          <div className="px-5 py-6 text-center border-b border-white/5">
            <p className="text-slate-400 text-sm mb-2">ยอดที่ต้องชำระ</p>
            <p className="text-white text-4xl font-bold">{formatCurrency(charge.amount)}</p>
            {charge.reference && (
              <p className="text-slate-400 text-sm mt-2">อ้างอิง: {charge.reference}</p>
            )}
          </div>

          {/* Details */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">บัญชีที่หัก</span>
              <span className="text-white text-sm font-medium">
                {account.account_name} · {account.account_number.slice(-4)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">ยอดเงินคงเหลือ</span>
              <span className="text-white text-sm font-medium">{formatCurrency(account.balance)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">หมดอายุภายใน</span>
              <span className={`text-sm ${isExpired ? 'text-red-400' : 'text-slate-300'}`}>
                {isExpired ? 'หมดอายุแล้ว' : formatDateFull(charge.expires_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 mt-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Warnings */}
        {(isExpired || insufficient) && !error && (
          <div className="flex items-center gap-2 px-4 py-3 mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {isExpired ? 'คำสั่งนี้หมดอายุแล้ว ไม่สามารถชำระได้' : 'ยอดเงินคงเหลือไม่เพียงพอ'}
          </div>
        )}

        {/* Pay Button */}
        <button
          onClick={handlePay}
          disabled={paying || isExpired || insufficient || charge.status !== 'pending'}
          className="w-full mt-5 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {paying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              กำลังชำระ...
            </>
          ) : (
            <>
              <Lock className="w-5 h-5" />
              ยืนยันการชำระ {formatCurrency(charge.amount)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
