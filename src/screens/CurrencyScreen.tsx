import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAccount } from '@/hooks/useAccount';
import { formatCurrency } from '@/lib/format';

type ExchangeRate = {
  currency_code: string;
  currency_name: string;
  rate: number;
};

export default function CurrencyScreen() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('THB');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('exchange_rates').select('currency_code, currency_name, rate').order('currency_code');
      if (!error && data) setRates(data as ExchangeRate[]);
      setLoading(false);
    }
    load();
  }, []);

  const balance = account?.balance || 0;

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <div className="bg-gradient-to-br from-slate-900 to-emerald-950 px-5 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white">สกุลเงิน</h1>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 shadow-xl">
          <p className="text-emerald-50 text-sm mb-1">ยอดเงินคงเหลือ</p>
          <p className="text-white text-3xl font-bold">{formatCurrency(balance)}</p>
          <p className="text-emerald-50/70 text-xs mt-2">THB บาทไทย</p>
        </div>
      </div>

      <div className="px-5 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-emerald-400" />
          <h2 className="text-white font-semibold">เลือกสกุลเงิน</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {rates.map((r) => (
              <button
                key={r.currency_code}
                onClick={() => setSelected(r.currency_code)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  selected === r.currency_code
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-slate-900 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white text-xs font-bold">
                    {r.currency_code.slice(0, 3)}
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-medium">{r.currency_name}</p>
                    <p className="text-slate-500 text-xs">1 THB = {r.rate} {r.currency_code}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm font-semibold">{(balance * r.rate).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  <p className="text-slate-500 text-xs">{r.currency_code}</p>
                </div>
                {selected === r.currency_code && <Check className="w-5 h-5 text-emerald-400 ml-2" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
