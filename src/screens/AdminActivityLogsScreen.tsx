import { useState, useEffect } from 'react';
import { Activity, Loader2, Search, Filter, Calendar, TrendingUp, Users, Store, ArrowLeftRight, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';

type ActivityLog = {
  id: string;
  event_type: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  target_account_number: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const EVENT_LABELS: Record<string, string> = {
  user_signup: 'สมัครสมาชิก',
  transfer: 'โอนเงิน',
  merchant_signup: 'สมัครร้านค้า',
  charge_paid: 'ชำระคำสั่งเก็บเงิน',
  admin_create_account: 'แอดมินสร้างบัญชี',
  admin_topup: 'แอดมินเติมเงิน',
  admin_deduct: 'แอดมินหักเงิน',
  refund_and_block: 'คืนเงินและบล็อก',
  employee_added: 'เพิ่มพนักงาน',
  employee_removed: 'ลบพนักงาน',
};

const RANGES = [
  { label: '1 ชม.', value: '1h' },
  { label: '1 วัน', value: '1d' },
  { label: '1 เดือน', value: '30d' },
  { label: '1 ปี', value: '1y' },
  { label: '5 ปี', value: '5y' },
];

export default function AdminActivityLogsScreen() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('');
  const [range, setRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    load();
  }, [range, customStart, customEnd, eventFilter]);

  async function load() {
    setLoading(true);
    let startDate: string;
    let endDate: string = new Date().toISOString();

    if (customStart) {
      startDate = new Date(customStart).toISOString();
      if (customEnd) endDate = new Date(customEnd + 'T23:59:59').toISOString();
    } else {
      const now = new Date();
      const start = new Date(now);
      switch (range) {
        case '1h': start.setHours(now.getHours() - 1); break;
        case '1d': start.setDate(now.getDate() - 1); break;
        case '30d': start.setDate(now.getDate() - 30); break;
        case '1y': start.setFullYear(now.getFullYear() - 1); break;
        case '5y': start.setFullYear(now.getFullYear() - 5); break;
      }
      startDate = start.toISOString();
    }

    const { data, error } = await supabase.rpc('admin_list_activity_logs', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_event_type: eventFilter || null,
      limit_count: 500,
    });
    if (!error && data) {
      setLogs(data as unknown as ActivityLog[]);
    }
    setLoading(false);
  }

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (l.actor_name || '').toLowerCase().includes(s) ||
      (l.target_account_number || '').includes(s) ||
      (l.event_type || '').toLowerCase().includes(s) ||
      JSON.stringify(l.details || {}).toLowerCase().includes(s);
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">บันทึกกิจกรรม</h1>
      <p className="text-slate-400 text-sm mb-6">ตรวจสอบกิจกรรมทั้งหมดในระบบ ย้อนหลังสูงสุด 5 ปี</p>

      {/* Range selector */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {RANGES.map((r) => (
          <button key={r.value} onClick={() => { setRange(r.value); setCustomStart(''); setCustomEnd(''); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${range === r.value && !customStart ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-900 text-slate-400 border border-white/5 hover:text-white'}`}>
            {r.label}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-2">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-3 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
          <span className="text-slate-500 text-sm">ถึง</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-3 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา..." className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
        </div>
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="px-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all">
          <option value="">ทุกกิจกรรม</option>
          {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500"><Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />ไม่พบบันทึก</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const Icon = log.event_type === 'user_signup' ? Users :
              log.event_type === 'transfer' ? ArrowLeftRight :
              log.event_type === 'merchant_signup' ? Store :
              log.event_type === 'charge_paid' ? TrendingUp :
              log.event_type?.startsWith('admin') || log.event_type?.startsWith('employee') || log.event_type === 'refund_and_block' ? Shield : Activity;
            return (
              <div key={log.id} className="bg-slate-900 rounded-xl border border-white/5 p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-medium">{EVENT_LABELS[log.event_type] || log.event_type}</span>
                    {log.actor_role && <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400">{log.actor_role === 'head' ? 'หัวหน้า' : 'พนักงาน'}</span>}
                  </div>
                  <p className="text-slate-400 text-xs">
                    {log.actor_name || 'ระบบ'} {log.target_account_number ? `→ บัญชี ${log.target_account_number}` : ''}
                  </p>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-slate-500 text-xs mt-1 font-mono truncate">{JSON.stringify(log.details)}</p>
                  )}
                </div>
                <span className="text-slate-500 text-xs shrink-0">{formatDate(log.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
