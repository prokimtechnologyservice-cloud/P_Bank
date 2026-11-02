import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Loader2, ArrowLeft, Eye, EyeOff, UserCog } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function EmployeeLoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fromPath = (location.state as { from?: string })?.from || '/admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('employee_sign_in', {
        p_employee_code: employeeCode.trim(),
        p_password: password,
      });
      if (rpcError || !data || (data as unknown[]).length === 0) {
        setError('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
        setLoading(false);
        return;
      }
      const emp = (data as { token: string; id: string; employee_code: string; full_name: string; role: string }[])[0];
      const empData = { token: emp.token, id: emp.id, username: emp.employee_code, full_name: emp.full_name, role: emp.role };
      localStorage.setItem('pbank_employee_session', JSON.stringify(empData));
      navigate(fromPath, { replace: true });
    } catch {
      setError('เกิดข้อผิดพลาด');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button onClick={() => navigate('/admin/login')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /><span className="text-sm">กลับ</span>
        </button>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 mb-4">
            <UserCog className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ยืนยันตัวตนพนักงาน</h1>
          <p className="text-slate-400 mt-1 text-sm">กรอกข้อมูลพนักงานเพื่อเข้าใช้งาน</p>
        </div>
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">รหัสพนักงาน</label>
              <input type="text" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="เช่น HAM-096" required autoFocus className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">รหัสผ่านพนักงาน</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required className="w-full pl-10 pr-11 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-5 h-5 animate-spin" />} เข้าสู่ระบบพนักงาน
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
