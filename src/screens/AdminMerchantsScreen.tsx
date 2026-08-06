import { useEffect, useState } from 'react';
import { Loader2, Store, CheckCircle2, XCircle, Pause, Play, Search, Copy, Check } from 'lucide-react';
import { supabase, type AdminMerchant } from '@/lib/supabase';
import { formatDate } from '@/lib/format';

export default function AdminMerchantsScreen() {
  const [merchants, setMerchants] = useState<AdminMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_merchants');
    if (!error && data) {
      setMerchants(data as unknown as AdminMerchant[]);
    }
    setLoading(false);
  }

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    await supabase.rpc('settle_merchant', { p_merchant_id: id });
    await load();
    setActionLoading(null);
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    await supabase.rpc('reject_merchant', { p_merchant_id: id });
    await load();
    setActionLoading(null);
  };

  const handleSuspend = async (id: string) => {
    setActionLoading(id);
    await supabase.rpc('suspend_merchant', { p_merchant_id: id });
    await load();
    setActionLoading(null);
  };

  const handleActivate = async (id: string) => {
    setActionLoading(id);
    await supabase.rpc('settle_merchant', { p_merchant_id: id });
    await load();
    setActionLoading(null);
  };

  const handleCopyKey = (id: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = merchants.filter(
    (m) =>
      m.business_name.toLowerCase().includes(search.toLowerCase()) ||
      m.business_email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
      rejected: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    };
    const labels: Record<string, string> = {
      pending: 'รออนุมัติ',
      active: 'ใช้งาน',
      suspended: 'ระงับ',
      rejected: 'ปฏิเสธ',
    };
    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">จัดการร้านค้า</h1>
      <p className="text-slate-400 text-sm mb-6">ร้านค้าที่สมัครใช้ระบบชำระเงิน</p>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อร้านค้าหรืออีเมล..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Store className="w-8 h-8 mx-auto mb-2 opacity-40" />
            ไม่พบร้านค้า
          </div>
        ) : (
          filtered.map((m) => (
            <div key={m.id} className="bg-slate-900 rounded-2xl border border-white/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-600/20 flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5 text-pink-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold truncate">{m.business_name}</h3>
                      {statusBadge(m.status)}
                    </div>
                    <p className="text-slate-400 text-sm">{m.business_email}</p>
                    {m.webhook_url && (
                      <p className="text-slate-500 text-xs mt-1 truncate">Webhook: {m.webhook_url}</p>
                    )}
                    {m.api_key && (
                      <div className="flex items-center gap-2 mt-2">
                        <code className="text-slate-400 text-xs font-mono bg-slate-800 px-2 py-1 rounded">
                          {m.api_key.slice(0, 12)}••••
                        </code>
                        <button
                          onClick={() => handleCopyKey(m.id, m.api_key)}
                          className="text-slate-400 hover:text-white transition-colors"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                    <p className="text-slate-500 text-xs mt-1">สมัครเมื่อ {formatDate(m.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {m.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(m.id)}
                        disabled={actionLoading === m.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        {actionLoading === m.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        อนุมัติ
                      </button>
                      <button
                        onClick={() => handleReject(m.id)}
                        disabled={actionLoading === m.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        ปฏิเสธ
                      </button>
                    </>
                  )}
                  {m.status === 'active' && (
                    <button
                      onClick={() => handleSuspend(m.id)}
                      disabled={actionLoading === m.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      {actionLoading === m.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Pause className="w-4 h-4" />
                      )}
                      ระงับ
                    </button>
                  )}
                  {(m.status === 'suspended' || m.status === 'rejected') && (
                    <button
                      onClick={() => handleActivate(m.id)}
                      disabled={actionLoading === m.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                    >
                      {actionLoading === m.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      เปิดใช้งาน
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
