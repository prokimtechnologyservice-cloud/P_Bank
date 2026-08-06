import { useState, useEffect } from 'react';
import { UserPlus, Loader2, X, Check, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const THAI_TITLES = ['นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง', 'ดร.', 'แพทย์หญิง', 'แพทย์ชาย', 'รศ.', 'ผศ.', 'อ.'];
const NATIONALITIES = ['ไทย', 'สหรัฐอเมริกา', 'จีน', 'ญี่ปุ่น', 'เกาหลีใต้', 'สิงคโปร์', 'มาเลเซีย', 'อังกฤษ', 'ออสเตรเลีย', 'เยอรมัน', 'ฝรั่งเศส'];
const GENDERS = ['ชาย', 'หญิง', 'ไม่ระบุ'];

export default function AdminCreateAccountScreen() {
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [nationality, setNationality] = useState('ไทย');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ name: string; number: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title || !firstName || !lastName) { setError('กรุณากรอกชื่อให้ครบ'); return; }
    if (!nationalId) { setError('กรุณากรอกเลขบัตรประชาชน'); return; }
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_create_account', {
        p_title: title,
        p_first_name: firstName,
        p_last_name: lastName,
        p_middle_name: middleName,
        p_date_of_birth: dob || null,
        p_gender: gender,
        p_national_id: nationalId.replace(/-/g, ''),
        p_nationality: nationality,
        p_email: email,
        p_password: password,
        p_pin: pin,
        p_initial_balance: parseFloat(initialBalance) || 0,
      });
      if (rpcError) throw rpcError;
      const result = (data as unknown as { account_id: string; account_number: string }[])[0];
      const fullName = [title, firstName, middleName, lastName].filter(Boolean).join(' ');
      setSuccess({ name: fullName, number: result.account_number });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างบัญชีไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">สร้างบัญชีใหม่</h1>
        <p className="text-slate-400 text-sm mb-6">สร้างบัญชีให้ผู้ใช้ผ่านระบบหลังบ้าน</p>
        <div className="max-w-md bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">สร้างบัญชีสำเร็จ</h2>
          <p className="text-slate-300 mb-1">ชื่อบัญชี: <span className="text-white font-medium">{success.name}</span></p>
          <p className="text-slate-300 mb-4">เลขบัญชี: <span className="text-white font-mono">{success.number}</span></p>
          <button onClick={() => { setSuccess(null); setTitle(''); setFirstName(''); setMiddleName(''); setLastName(''); setDob(''); setGender(''); setNationalId(''); setEmail(''); setPassword(''); setPin(''); setInitialBalance(''); }} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-all">
            สร้างบัญชีใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">สร้างบัญชีใหม่</h1>
      <p className="text-slate-400 text-sm mb-6">สร้างบัญชีให้ผู้ใช้ผ่านระบบหลังบ้าน</p>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">คำนำหน้า *</label>
            <select value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all">
              <option value="">เลือก</option>
              {THAI_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">ชื่อ *</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">ชื่อกลาง</label>
            <input type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">นามสกุล *</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">วันเดือนปีเกิด</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">เพศ</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all">
              <option value="">เลือก</option>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">สัญชาติ</label>
            <select value={nationality} onChange={(e) => setNationality(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all">
              {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">เลขบัตรประชาชน *</label>
          <input type="text" value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 13))} placeholder="x-xxxx-xxxxx-xx-x" inputMode="numeric" required className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">อีเมล (ไม่บังคับ)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="สำหรับล็อกอิน" className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">รหัสผ่าน (ไม่บังคับ)</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="สำหรับล็อกอิน" className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">PIN 6 หลัก</label>
            <input type="text" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" inputMode="numeric" className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white text-center text-xl tracking-widest placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">ยอดเงินเริ่มต้น</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">฿</span>
              <input type="number" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} placeholder="0.00" inputMode="decimal" className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
            </div>
          </div>
        </div>
        {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
        <button type="submit" disabled={loading} className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 transition-all disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />} สร้างบัญชี
        </button>
      </form>
    </div>
  );
}
