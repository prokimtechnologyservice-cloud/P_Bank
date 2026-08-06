import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Share2, Wallet } from 'lucide-react';
import QRCode from 'qrcode';
import { useRequireAccount } from '@/hooks/useAccount';
import { formatAccountNumber } from '@/lib/format';

export default function MyQrScreen() {
  const navigate = useNavigate();
  const { account } = useRequireAccount();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!account || !canvasRef.current) return;
    const payload = account.account_number;
    QRCode.toCanvas(
      canvasRef.current,
      payload,
      {
        width: 240,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      },
      (err) => {
        if (err) console.error('QR generation error', err);
      }
    );
  }, [account]);

  if (!account) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(account.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'เลขบัญชี P Bank',
          text: `โอนเงินมาที่บัญชี ${account.account_name} เลขบัญชี ${account.account_number}`,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

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
          <h1 className="text-white font-semibold text-lg">คิวอาร์โค้ดของฉัน</h1>
        </div>
      </div>

      <div className="px-5 py-8 flex flex-col items-center">
        <p className="text-slate-400 text-sm text-center mb-6">
          ให้ผู้อื่นสแกนคิวอาร์เพื่อโอนเงินเข้าบัญชีของคุณ
        </p>

        {/* QR Card */}
        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          <canvas ref={canvasRef} className="rounded-xl" />
        </div>

        {/* Account info */}
        <div className="w-full max-w-sm mt-6 bg-slate-900 rounded-2xl p-5 border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-medium">{account.account_name || 'บัญชีของฉัน'}</p>
              <p className="text-slate-500 text-xs">P Bank</p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <p className="text-slate-400 text-xs mb-1">เลขบัญชี</p>
            <p className="text-white text-lg font-mono tracking-wider">
              {formatAccountNumber(account.account_number)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full max-w-sm flex gap-3 mt-4">
          <button
            onClick={handleCopy}
            className="flex-1 py-3 bg-slate-900 border border-white/10 rounded-xl text-white font-medium flex items-center justify-center gap-2 hover:border-emerald-500/30 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">คัดลอกแล้ว</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                คัดลอกเลขบัญชี
              </>
            )}
          </button>
          <button
            onClick={handleShare}
            className="flex-1 py-3 bg-slate-900 border border-white/10 rounded-xl text-white font-medium flex items-center justify-center gap-2 hover:border-emerald-500/30 transition-all"
          >
            <Share2 className="w-4 h-4" />
            แชร์
          </button>
        </div>
      </div>
    </div>
  );
}
