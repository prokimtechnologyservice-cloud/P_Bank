import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, Wallet, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function SetPinScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<'set' | 'confirm'>('set');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetDigit = (digit: string) => {
    if (pin.length >= 6) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 6) {
      setStep('confirm');
    }
  };

  const handleConfirmDigit = (digit: string) => {
    if (confirmPin.length >= 6) return;
    const newConfirm = confirmPin + digit;
    setConfirmPin(newConfirm);
    if (newConfirm.length === 6) {
      if (newConfirm !== pin) {
        setError('รหัส PIN ไม่ตรงกัน กรุณาลองใหม่');
        setPin('');
        setConfirmPin('');
        setStep('set');
      } else {
        handleSave(pin);
      }
    }
  };

  const handleSave = async (pinValue: string) => {
    setLoading(true);
    setError('');
    const { error } = await supabase.rpc('set_pin', { p_pin: pinValue });
    if (error) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
      setPin('');
      setConfirmPin('');
      setStep('set');
      setLoading(false);
      return;
    }
    sessionStorage.setItem('pbank_pin_verified', 'true');
    navigate('/', { replace: true });
  };

  const handleDelete = () => {
    setError('');
    if (step === 'set') {
      setPin(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const currentPin = step === 'set' ? pin : confirmPin;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/30 mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {step === 'set' ? 'ตั้งรหัส PIN' : 'ยืนยันรหัส PIN'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {step === 'set'
              ? 'ตั้งรหัส PIN 6 หลักเพื่อความปลอดภัย'
              : 'กรอกรหัส PIN อีกครั้งเพื่อยืนยัน'}
          </p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < currentPin.length
                  ? 'bg-emerald-400 border-emerald-400'
                  : 'border-slate-600'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="text-center text-red-400 text-sm mb-4">{error}</div>
        )}

        {loading && (
          <div className="flex justify-center mb-4">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        )}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => (step === 'set' ? handleSetDigit(d) : handleConfirmDigit(d))}
              disabled={loading}
              className="aspect-square rounded-2xl bg-white/5 border border-white/10 text-white text-2xl font-semibold hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            onClick={() => (step === 'set' ? handleSetDigit('0') : handleConfirmDigit('0'))}
            disabled={loading}
            className="aspect-square rounded-2xl bg-white/5 border border-white/10 text-white text-2xl font-semibold hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || currentPin.length === 0}
            className="aspect-square rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
            </svg>
          </button>
        </div>

        <div className="mt-8 text-center space-y-2">
          <button
            onClick={() => navigate('/admin/login')}
            className="text-slate-500 hover:text-amber-400 text-sm transition-colors block"
          >
            เข้าสู่ระบบหลังบ้าน
          </button>
        </div>
      </div>
    </div>
  );
}
