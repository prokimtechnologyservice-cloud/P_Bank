import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Store,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
  Code,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Merchant, type Charge } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';

export default function MerchantScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegForm, setShowRegForm] = useState(false);
  const [copied, setCopied] = useState(false);

  // Registration form state
  const [bizName, setBizName] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  useEffect(() => {
    loadMerchant();
  }, []);

  async function loadMerchant() {
    setLoading(true);
    const { data } = await supabase
      .from('merchants')
      .select('*')
      .maybeSingle();
    if (data) {
      setMerchant(data as Merchant);
      // Load charges
      const { data: chargeData } = await supabase
        .from('charges')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setCharges((chargeData ?? []) as Charge[]);
    }
    setLoading(false);
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!bizName.trim() || !bizEmail.trim()) {
      setRegError('กรุณากรอกชื่อร้านค้าและอีเมลให้ครบ');
      return;
    }
    setRegLoading(true);
    try {
      const apiKey = 'nb_live_' + generateApiKey();
      const { error } = await supabase.from('merchants').insert({
        user_id: user?.id,
        business_name: bizName.trim(),
        business_email: bizEmail.trim(),
        webhook_url: webhookUrl.trim(),
        api_key: apiKey,
        status: 'pending',
      });
      if (error) throw error;
      setShowRegForm(false);
      await loadMerchant();
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'สมัครไม่สำเร็จ');
    } finally {
      setRegLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (merchant?.api_key) {
      navigator.clipboard.writeText(merchant.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

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
          <h1 className="text-white font-semibold text-lg">ร้านค้า / Payment Gateway</h1>
        </div>
      </div>

      <div className="px-5 py-6">
        {!merchant && !showRegForm && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-600/20 flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-pink-400" />
            </div>
            <h2 className="text-white text-xl font-bold mb-2">สมัครเป็นร้านค้า</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
              เชื่อมเว็บไซต์ของคุณกับ P Bank รับเงินจากผู้ใช้ผ่าน API โดยตรง
            </p>
            <button
              onClick={() => setShowRegForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white font-semibold rounded-xl shadow-lg shadow-pink-500/30 transition-all"
            >
              เริ่มสมัครร้านค้า
            </button>
          </div>
        )}

        {/* Registration Form */}
        {!merchant && showRegForm && (
          <div className="max-w-md mx-auto">
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">ชื่อร้านค้า</label>
                <input
                  type="text"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  placeholder="ร้านอาหาร สมชาย"
                  required
                  className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">อีเมลร้านค้า</label>
                <input
                  type="email"
                  value={bizEmail}
                  onChange={(e) => setBizEmail(e.target.value)}
                  placeholder="shop@example.com"
                  required
                  className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Webhook URL (ไม่บังคับ)
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-site.com/webhook"
                  className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                />
                <p className="text-slate-500 text-xs mt-1">
                  ระบบจะส่งแจ้งเตือนไปยัง URL นี้เมื่อมีการชำระเงินสำเร็จ
                </p>
              </div>
              {regError && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {regError}
                </div>
              )}
              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white font-semibold rounded-xl shadow-lg shadow-pink-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {regLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                ส่งคำขอสมัคร
              </button>
            </form>
          </div>
        )}

        {/* Merchant Dashboard */}
        {merchant && (
          <div className="space-y-5">
            {/* Status Banner */}
            <div className={`rounded-2xl p-5 border ${
              merchant.status === 'active'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : merchant.status === 'pending'
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <div className="flex items-center gap-3">
                {merchant.status === 'active' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : merchant.status === 'pending' ? (
                  <Clock className="w-6 h-6 text-amber-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400" />
                )}
                <div>
                  <p className="text-white font-semibold">
                    {merchant.status === 'active' ? 'ร้านค้าพร้อมใช้งาน' : merchant.status === 'pending' ? 'รอผู้ดูแลอนุมัติ' : 'ร้านค้าถูกระงับ'}
                  </p>
                  <p className="text-slate-400 text-sm">{merchant.business_name}</p>
                </div>
              </div>
            </div>

            {/* API Key */}
            {merchant.status === 'active' && (
              <>
                <div className="bg-slate-900 rounded-2xl p-5 border border-white/5">
                  <p className="text-slate-400 text-xs mb-2">API Key</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-emerald-400 text-sm font-mono bg-slate-800 px-3 py-2 rounded-lg overflow-x-auto">
                      {merchant.api_key}
                    </code>
                    <button
                      onClick={handleCopyKey}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* API Integration Guide */}
                <div className="bg-slate-900 rounded-2xl p-5 border border-white/5">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Code className="w-4 h-4 text-pink-400" />
                    วิธีเชื่อมต่อ API
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-slate-400 text-xs mb-1">1. สร้างคำสั่งเรียกเก็บเงิน (POST)</p>
                      <pre className="bg-slate-800 rounded-lg p-3 overflow-x-auto text-slate-300 text-xs">
{`curl -X POST https://${window.location.hostname}/functions/v1/create-charge \\
  -H "X-Api-Key: ${merchant.api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 100, "reference": "ORDER-001"}'`}
                      </pre>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1">2. ตรวจสอบสถานะ (GET)</p>
                      <pre className="bg-slate-800 rounded-lg p-3 overflow-x-auto text-slate-300 text-xs">
{`curl https://${window.location.hostname}/functions/v1/get-charge?short_code=XXXX \\
  -H "X-Api-Key: ${merchant.api_key}"`}
                      </pre>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1">3. ผู้ใช้ชำระเงินผ่านแอป P Bank</p>
                      <p className="text-slate-500 text-xs">
                        ผู้ใช้กรอกรหัส 6 หลักในแอปเพื่อยืนยันการชำระ เงินจะโอนเข้าบัญชีร้านค้าทันที
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1">4. รับ Webhook แจ้งเตือนการชำระเงิน</p>
                      <pre className="bg-slate-800 rounded-lg p-3 overflow-x-auto text-slate-300 text-xs">
{`POST {webhook_url}
{
  "event": "charge.paid",
  "charge_id": "...",
  "short_code": "XXXX",
  "amount": 100,
  "reference": "ORDER-001"
}`}
                      </pre>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Recent Charges */}
            {merchant.status === 'active' && (
              <div>
                <h3 className="text-white font-semibold mb-3">คำสั่งเรียกเก็บล่าสุด</h3>
                {charges.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    ยังไม่มีคำสั่งเรียกเก็บ
                  </div>
                ) : (
                  <div className="space-y-2">
                    {charges.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 p-3.5 bg-slate-900 rounded-xl border border-white/5">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium font-mono">{c.short_code}</p>
                          <p className="text-slate-500 text-xs">{c.reference || '—'} · {formatDate(c.created_at)}</p>
                        </div>
                        <p className="text-white text-sm font-semibold">{formatCurrency(c.amount)}</p>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          c.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                          c.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-slate-500/10 text-slate-400'
                        }`}>
                          {c.status === 'paid' ? 'ชำระแล้ว' : c.status === 'pending' ? 'รอชำระ' : c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}
