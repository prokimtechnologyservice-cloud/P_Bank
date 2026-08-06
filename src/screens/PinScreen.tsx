import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Delete, Loader2, Wallet, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function PinScreen() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkPin() {
      const { data } = await supabase
        .from('profiles')
        .select('pin_hash')
        .eq('id', user?.id)
        .maybeSingle();
      setHasPin(!!data?.pin_hash);
    }
    if (user) checkPin();
  }, [user]);

  const handleSubmit = async (pinValue: string) => {
    if (pinValue.length !== 6) return;
    setLoading(true);
    setError('');
    const { data, error } = await supabase.rpc('verify_pin', { p_pin: pinValue });
    if (error || !data) {
      setError('รหัส PIN ไม่ถูกต้อง');
      setPin('');
      setLoading(false);
      return;
    }
    sessionStorage.setItem('pbank_pin_verified', 'true');
    navigate('/', { replace: true });
  };

  const handleDigit = (digit: string) => {
    if (pin.length >= 6 || loading) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 6) {
      setTimeout(() => handleSubmit(newPin), 200);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('pbank_pin_verified');
    await signOut();
    navigate('/auth', { replace: true });
  };

  if (hasPin === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Wallet className="w-10 h-10 text-emerald-500 animate-pulse" />
      </div>
    );
  }

  if (hasPin === false) {
    // No PIN set — redirect to set-pin screen
    navigate('/set-pin', { replace: true });
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Wallet className="w-10 h-10 text-emerald-500 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/30 mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ป้อนรหัส PIN</h1>
          <p className="text-slate-400 text-sm mt-1">กรอกรหัส PIN 6 หลักเพื่อเข้าใช้งาน</p>
        </div>

        <div className="flex justify-center gap-3 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < pin.length ? 'bg-emerald-400 border-emerald-400' : 'border-slate-600'
              }`}
            />
          ))}
        </div>

        {error && <div className="text-center text-red-400 text-sm mb-4">{error}</div>}

        {loading && (
          <div className="flex justify-center mb-4">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              disabled={loading}
              className="aspect-square rounded-2xl bg-white/5 border border-white/10 text-white text-2xl font-semibold hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleDigit('0')}
            disabled={loading}
            className="aspect-square rounded-2xl bg-white/5 border border-white/10 text-white text-2xl font-semibold hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || pin.length === 0}
            className="aspect-square rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={() => navigate('/admin/login')}
            className="text-slate-500 hover:text-amber-400 text-sm transition-colors"
          >
            เข้าสู่ระบบหลังบ้าน
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-slate-500 hover:text-red-400 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" /> ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
