import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, X, Camera, Loader2 } from 'lucide-react';

export default function QrScanScreen() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setScanning(true);
        scanLoop();
      } catch {
        setError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง');
      }
    }
    startCamera();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const scanLoop = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Try to detect QR code using a simple barcode detector if available
      if ('BarcodeDetector' in window) {
        const bd = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ['qr_code'] });
        bd.detect(canvas).then((codes) => {
          if (codes.length > 0 && codes[0].rawValue) {
            const code = codes[0].rawValue.trim();
            // Check if it's a 6-character charge code
            if (/^[A-Z0-9]{6}$/.test(code)) {
              if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
              navigate(`/pay/${code}`);
              return;
            }
          }
          requestAnimationFrame(() => scanLoop());
        }).catch(() => {
          requestAnimationFrame(() => scanLoop());
        });
      } else {
        // Fallback: just keep scanning
        requestAnimationFrame(() => scanLoop());
      }
    } else {
      requestAnimationFrame(() => scanLoop);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4">
        <h1 className="text-white font-semibold">สแกน QR Code</h1>
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center relative">
        {error ? (
          <div className="text-center px-8">
            <Camera className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {/* QR frame overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-emerald-400/80 rounded-2xl relative">
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                {scanning && (
                  <div className="absolute left-0 right-0 h-0.5 bg-emerald-400/60 shadow-lg shadow-emerald-400/50" style={{ animation: 'qrscan 2s linear infinite' }} />
                )}
              </div>
            </div>
            <p className="absolute bottom-20 text-center text-slate-400 text-sm px-8">
              นำกล้องไปชี้ที่ QR Code เพื่อสแกน
            </p>
          </>
        )}
      </div>
      <style>{`@keyframes qrscan { 0% { top: 0 } 50% { top: 100% } 100% { top: 0 } }`}</style>
    </div>
  );
}
