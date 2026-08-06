import { useState, useEffect } from 'react';
import { UserCog, Loader2, UserPlus, Trash2, Shield, Crown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function AdminEmployeesScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('employee');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('admin_list_employees');
    if (data) setEmployees(data as unknown as Employee[]);
    setLoading(false);
  }

  const handleAdd = async () => {
    if (!newCode || !newName || !newPassword) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
    setActionLoading(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('admin_add_employee', {
      p_employee_code: newCode,
      p_full_name: newName,
      p_password: newPassword,
      p_role: newRole,
    });
    if (rpcError) { setError(rpcError.message); setActionLoading(false); return; }
    setNewCode(''); setNewName(''); setNewPassword(''); setNewRole('employee');
    setShowAdd(false);
    await load();
    setActionLoading(false);
  };

  const handleRemove = async (id: string) => {
    setActionLoading(true);
    await supabase.rpc('admin_remove_employee', { p_employee_id: id });
    await load();
    setActionLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">จัดการพนักงาน</h1>
          <p className="text-slate-400 text-sm">เพิ่มหรือลบพนักงานในระบบ</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold rounded-xl transition-all">
          <UserPlus className="w-4 h-4" /> เพิ่มพนักงาน
        </button>
      </div>

      {showAdd && (
        <div className="bg-slate-900 rounded-2xl border border-white/5 p-5 mb-4 space-y-3">
          <h3 className="text-white font-semibold text-sm">เพิ่มพนักงานใหม่</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="รหัสพนักงาน (เช่น EMP-001)" className="px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ชื่อพนักงาน" className="px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="รหัสผ่าน" className="px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50">
              <option value="employee">พนักงาน</option>
              <option value="head">หัวหน้า</option>
            </select>
          </div>
          {error && <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700 transition-all">ยกเลิก</button>
            <button onClick={handleAdd} disabled={actionLoading} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-all disabled:opacity-50">{actionLoading ? 'กำลังเพิ่ม...' : 'เพิ่ม'}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {employees.map((emp) => (
          <div key={emp.id} className="bg-slate-900 rounded-2xl border border-white/5 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${emp.role === 'head' ? 'bg-gradient-to-br from-amber-500/20 to-orange-600/20' : 'bg-slate-800'}`}>
              {emp.role === 'head' ? <Crown className="w-5 h-5 text-amber-400" /> : <UserCog className="w-5 h-5 text-slate-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white text-sm font-medium truncate">{emp.full_name}</p>
                <span className={`px-2 py-0.5 rounded text-xs ${emp.role === 'head' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                  {emp.role === 'head' ? 'หัวหน้า' : 'พนักงาน'}
                </span>
                {!emp.is_active && <span className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400">ปิดใช้งาน</span>}
              </div>
              <p className="text-slate-500 text-xs font-mono">{emp.employee_code}</p>
            </div>
            {emp.is_active && emp.role !== 'head' && (
              <button onClick={() => handleRemove(emp.id)} disabled={actionLoading} className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
