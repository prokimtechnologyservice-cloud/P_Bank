import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  QrCode,
} from 'lucide-react';
import { useRequireAccount } from '@/hooks/useAccount';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatAccountNumber } from '@/lib/format';

type LookupResult = {
  account_number: string;
  account_name: string;
} | null;

export default function TransferScreen() {
  const navigate = useNavigate();
  const { account } = useRequireAccount();
  const [accountNumber, setAccountNumber] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  // Debounced account lookup
  useEffect(() => {
    if (accountNumber.replace(/-/g, '').length !== 10) {
      setLookupResult(null);
      return;
    }
    let cancelled = false;
    setLookupLoading(true);
    const timeout = setTimeout(async () => {
      const { data, error } = await supabase
        .rpc('lookup_account', { p_account_number: accountNumber.replace(/-/g, '') });
      if (!cancelled) {
        if (error) {
          setLookupResult(null);
        } else {
          setLookupResult(data as LookupResult);
        }
        setLookupLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [accountNumber]);

  const handleTransfer = async () => {
    setError('');
    const num = accountNumber.replace(/-/g, '');
    const amt = parseFloat(amount);

    if (num.length !== 10) {
      setError('กรุณากรอกเลขบัญชี 10 หลัก');
      return;
    }
    if (!amt || amt <= 0) {
      setError('กรุณากรอกยอดเงินที่ถูกต้อง');
      return;
    }
    if (account && amt > account.balance) {
      setError('ยอดเงินคงเหลือไม่เพียงพอ');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('transfer', {
        p_to_account_number: num,
        p_amount: amt,
        p_memo: memo.trim(),
      });

      if (error) throw error;

      // data is the transaction id
      const txId = data as string;
      navigate(`/slip/${txId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'โอนเงินไม่สำเร็จ';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleScanResult = (scanned: string) => {
    // QR may contain just the account number, or a payload
    const num = scanned.replace(/\D/g, '').slice(0, 10);
    setAccountNumber(num);
    setShowScanner(false);
  };

  if (!account) return null;

  const num = accountNumber.replace(/-/g, '');
  const isValidAccount = num.length === 10 && lookupResult;
  const amt = parseFloat(amount) || 0;
  const canSubmit = isValidAccount && amt > 0 && amt <= account.balance && !loading;

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
          <h1 className="text-white font-semibold text-lg">โอนเงิน</h1>
        </div>
      </div>

      <div className="px-5 py-6 space-y-5">
        {/* My balance */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
          <span className="text-slate-400 text-sm">ยอดเงินคงเหลือ</span>
          <span className="text-white font-semibold">{formatCurrency(account.balance)}</span>
        </div>

        {/* Account number input */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            เลขบัญชีปลายทาง
          </label>
          <div className="relative">
            <input
              type="text"
              value={formatAccountNumber(num)}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="000-000-0-000"
              inputMode="numeric"
              className="w-full px-4 py-3.5 pr-12 bg-slate-900 border border-white/10 rounded-xl text-white text-lg tracking-wider placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
            <button
              onClick={() => setShowScanner(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>

          {/* Lookup result */}
          {num.length === 10 && (
            <div className="mt-2">
              {lookupLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังค้นหาบัญชี...
                </div>
              ) : lookupResult ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300 text-sm font-medium">
                    {lookupResult.account_name || 'พบบัญชี'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-red-300 text-sm">ไม่พบบัญชีปลายทาง</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            ยอดเงิน
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg font-medium">
              ฿
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="w-full pl-10 pr-4 py-3.5 bg-slate-900 border border-white/10 rounded-xl text-white text-2xl font-semibold placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
          </div>
          {/* Quick amounts */}
          <div className="flex gap-2 mt-3">
            {[100, 500, 1000, 5000].map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className="flex-1 py-2 bg-slate-900 border border-white/10 rounded-lg text-slate-300 text-sm font-medium hover:border-emerald-500/30 hover:text-emerald-400 transition-all"
              >
                {q.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Memo */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            บันทึก (ไม่บังคับ)
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="เช่น ค่าอาหาร"
            maxLength={50}
            className="w-full px-4 py-3.5 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleTransfer}
          disabled={!canSubmit}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              กำลังโอน...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              ยืนยันการโอนเงิน
            </>
          )}
        </button>
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <QrScannerModal
          onClose={() => setShowScanner(false)}
          onResult={handleScanResult}
        />
      )}
    </div>
  );
}

function QrScannerModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (text: string) => void;
}) {
  const [manualInput, setManualInput] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-white font-semibold">สแกนคิวอาร์โค้ด</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:text-white transition-all"
          >
            ✕
          </button>
        </div>
        <div className="p-5">
          <div className="aspect-square bg-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-8 mb-4">
            <QrCode className="w-16 h-16 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm">
              ใส่เลขบัญชีที่ต้องการโอนด้านล่าง
            </p>
          </div>
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="เลขบัญชี 10 หลัก"
            inputMode="numeric"
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-center text-lg tracking-wider placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
          />
          <button
            onClick={() => manualInput.length === 10 && onResult(manualInput)}
            disabled={manualInput.length !== 10}
            className="w-full mt-3 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl disabled:opacity-40 transition-all"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}
