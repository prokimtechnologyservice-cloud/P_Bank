import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, Eye, EyeOff, Loader2, User, CreditCard, Camera, Check,
  AlertCircle, ArrowRight, ArrowLeft, ShieldCheck, ScanLine, CreditCard as IdCard,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type SignupStep = 'account' | 'identity' | 'idcard' | 'selfie' | 'done';

const THAI_TITLES = ['นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง', 'ดร.', 'แพทย์หญิง', 'แพทย์ชาย', 'รศ.', 'ผศ.', 'อ.'];

function validateFullName(title: string, firstName: string, lastName: string): string | null {
  if (!title.trim()) return 'กรุณาเลือกคำนำหน้าชื่อ';
  if (!firstName.trim()) return 'กรุณากรอกชื่อ';
  if (!lastName.trim()) return 'กรุณากรอกนามสกุล';
  return null;
}

function formatNationalId(id: string): string {
  const cleaned = id.replace(/\D/g, '').slice(0, 13);
  let result = cleaned;
  if (cleaned.length > 1) result = cleaned.slice(0, 1) + '-' + cleaned.slice(1);
  if (cleaned.length > 5) result = cleaned.slice(0, 1) + '-' + cleaned.slice(1, 5) + '-' + cleaned.slice(5);
  if (cleaned.length > 10) result = cleaned.slice(0, 1) + '-' + cleaned.slice(1, 5) + '-' + cleaned.slice(5, 10) + '-' + cleaned.slice(10);
  if (cleaned.length > 12) result = cleaned.slice(0, 1) + '-' + cleaned.slice(1, 5) + '-' + cleaned.slice(5, 10) + '-' + cleaned.slice(10, 12) + '-' + cleaned.slice(12);
  return result;
}

function validateNationalId(id: string): boolean {
  const cleaned = id.replace(/-/g, '');
  if (cleaned.length !== 13 || !/^\d{13}$/.test(cleaned)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cleaned[i]) * (13 - i);
  const check = (11 - (sum % 11)) % 10;
  return check === parseInt(cleaned[12]);
}

export default function AuthScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [step, setStep] = useState<SignupStep>('account');

  // Account fields
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Identity
  const [nationalId, setNationalId] = useState('');
  const [nationalIdError, setNationalIdError] = useState('');
  const [checkingId, setCheckingId] = useState(false);

  // ID Card photo
  const [idCardDataUrl, setIdCardDataUrl] = useState<string | null>(null);

  // Selfie
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [faceMatch, setFaceMatch] = useState<number | null>(null);
  const [faceChecking, setFaceChecking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fullName = [title, firstName, middleName, lastName].filter(Boolean).join(' ');

  // ========== Camera logic ==========
  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      setCameraError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const captureSelfie = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setSelfieDataUrl(dataUrl);
    stopCamera();
    // Simulate face matching check
    setFaceChecking(true);
    setTimeout(() => {
      const similarity = Math.floor(Math.random() * 20) + 78; // 78-97%
      setFaceMatch(similarity);
      setFaceChecking(false);
    }, 2000);
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ========== ID Card photo upload ==========
  const handleIdCardFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setIdCardDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ========== Step navigation ==========
  const handleAccountNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const nameError = validateFullName(title, firstName, lastName);
    if (nameError) { setError(nameError); return; }
    if (!email.trim()) { setError('กรุณากรอกอีเมล'); return; }
    if (password.length < 6) { setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    if (pin.length !== 6) { setError('กรุณาตั้งรหัส PIN 6 หลัก'); return; }
    setStep('identity');
  };

  const handleIdentityNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNationalIdError('');
    const cleanedId = nationalId.replace(/-/g, '');
    if (!validateNationalId(cleanedId)) { setNationalIdError('เลขบัตรประชาชนไม่ถูกต้อง'); return; }
    setCheckingId(true);
    const { data } = await supabase.rpc('check_national_id_available', { p_national_id: cleanedId });
    setCheckingId(false);
    if (data === false) { setNationalIdError('เลขบัตรประชาชนนี้ถูกใช้สมัครแล้ว ไม่สามารถสมัครได้'); return; }
    setStep('idcard');
  };

  const handleSignup = async () => {
    setError('');
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName,
            national_id: nationalId.replace(/-/g, ''),
            title, first_name: firstName, middle_name: middleName, last_name: lastName,
            pin_hash: 'pending',
          },
        },
      });
      if (signUpError) throw signUpError;

      if (data.user) {
        const userId = data.user.id;
        // Set PIN
        await supabase.rpc('set_pin', { p_pin: pin });
        // Upload selfie
        if (selfieDataUrl) {
          const blob = await fetch(selfieDataUrl).then((r) => r.blob());
          await supabase.storage.from('selfies').upload(`${userId}/selfie.jpg`, blob, { contentType: 'image/jpeg', upsert: true });
          const { data: urlData } = supabase.storage.from('selfies').getPublicUrl(`${userId}/selfie.jpg`);
          await supabase.from('profiles').update({ selfie_url: urlData.publicUrl }).eq('id', userId);
        }
        // Upload ID card
        if (idCardDataUrl) {
          const blob = await fetch(idCardDataUrl).then((r) => r.blob());
          await supabase.storage.from('id-cards').upload(`${userId}/idcard.jpg`, blob, { contentType: 'image/jpeg', upsert: true });
          const { data: urlData } = supabase.storage.from('id-cards').getPublicUrl(`${userId}/idcard.jpg`);
          await supabase.from('profiles').update({ id_card_url: urlData.publicUrl }).eq('id', userId);
        }
      }
      setStep('done');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      if (msg.includes('already') || msg.includes('registered')) setError('อีเมลนี้ถูกใช้งานแล้ว');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      setError(msg.includes('Invalid') ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : msg);
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = ({ current }: { current: SignupStep }) => {
    const steps: { label: string; key: SignupStep }[] = [
      { label: 'บัญชี', key: 'account' },
      { label: 'ตัวตน', key: 'identity' },
      { label: 'บัตร', key: 'idcard' },
      { label: 'ถ่ายภาพ', key: 'selfie' },
    ];
    const currentIndex = steps.findIndex((s) => s.key === current);
    return (
      <div className="flex items-center justify-center gap-1.5 mb-6">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className={`flex items-center gap-1 text-sm font-medium ${
              i < currentIndex ? 'text-emerald-400' : i === currentIndex ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                i < currentIndex ? 'bg-emerald-500 text-white' :
                i === currentIndex ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {i < currentIndex ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              {s.label}
            </span>
            {i < steps.length - 1 && <span className={`w-4 h-0.5 ${i < currentIndex ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
          </div>
        ))}
      </div>
    );
  };

  // ========== Render ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/30 mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">P Bank</h1>
          <p className="text-slate-400 mt-1 text-sm">ธนาคารดิจิทัลในมือคุณ</p>
        </div>

        <div className="text-center mb-4">
          <button
            onClick={() => navigate('/admin/login')}
            className="text-slate-500 hover:text-amber-400 text-sm transition-colors"
          >
            เข้าสู่ระบบหลังบ้าน
          </button>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
          {/* Sign In */}
          {mode === 'signin' && (
            <>
              <h2 className="text-xl font-bold text-white mb-6 text-center">เข้าสู่ระบบ</h2>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">อีเมล</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">รหัสผ่าน</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required
                      className="w-full px-4 py-3 pr-11 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
                <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />} เข้าสู่ระบบ
                </button>
              </form>
              <p className="text-center text-sm text-slate-400 mt-5">ยังไม่มีบัญชี? <button onClick={() => { setMode('signup'); setStep('account'); setError(''); }} className="text-emerald-400 hover:text-emerald-300 font-semibold">สมัครใช้งาน</button></p>
            </>
          )}

          {/* Sign Up Step 1: Account */}
          {mode === 'signup' && step === 'account' && (
            <>
              <h2 className="text-xl font-bold text-white mb-2 text-center">สมัครใช้งาน</h2>
              <StepIndicator current="account" />
              <form onSubmit={handleAccountNext} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">คำนำหน้าชื่อ *</label>
                  <select value={title} onChange={(e) => setTitle(e.target.value)} required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all">
                    <option value="">เลือกคำนำหน้า</option>
                    {THAI_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">ชื่อ *</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="สมชาย" required
                      className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">ชื่อกลาง</label>
                    <input type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="ไม่บังคับ"
                      className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">นามสกุล *</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="ใจดี" required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">อีเมล</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">รหัสผ่าน</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" required
                      className="w-full px-4 py-3 pr-11 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">รหัส PIN 6 หลัก</label>
                  <input type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" inputMode="numeric" required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white text-center text-2xl tracking-widest placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  <p className="text-xs text-slate-500 mt-1.5">ใช้ยืนยันตัวตนทุกครั้งที่เปิดแอป</p>
                </div>
                {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
                <button type="submit" className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2">
                  ถัดไป <ArrowRight className="w-5 h-5" />
                </button>
              </form>
              <p className="text-center text-sm text-slate-400 mt-5">มีบัญชีแล้ว? <button onClick={() => { setMode('signin'); setError(''); }} className="text-emerald-400 hover:text-emerald-300 font-semibold">เข้าสู่ระบบ</button></p>
            </>
          )}

          {/* Step 2: Identity */}
          {mode === 'signup' && step === 'identity' && (
            <>
              <h2 className="text-xl font-bold text-white mb-2 text-center">ยืนยันตัวตน</h2>
              <StepIndicator current="identity" />
              <form onSubmit={handleIdentityNext} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">เลขบัตรประชาชน 13 หลัก</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input type="text" value={nationalId} onChange={(e) => { setNationalId(formatNationalId(e.target.value)); setNationalIdError(''); }} placeholder="x-xxxx-xxxxx-xx-x" inputMode="numeric"
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  </div>
                  {nationalIdError && <div className="flex items-center gap-1.5 mt-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{nationalIdError}</div>}
                  <p className="text-xs text-slate-500 mt-2">เลขบัตรประชาชนใช้ป้องกันบัญชีปลอมและจำกัด 1 บัญชีต่อคน</p>
                </div>
                {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep('account')} className="px-4 py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2">
                    <ArrowLeft className="w-5 h-5" /> ย้อนกลับ
                  </button>
                  <button type="submit" disabled={checkingId || nationalId.replace(/-/g, '').length !== 13} className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {checkingId ? <><Loader2 className="w-5 h-5 animate-spin" /> กำลังตรวจสอบ...</> : <>ถัดไป <ArrowRight className="w-5 h-5" /></>}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Step 3: ID Card Photo */}
          {mode === 'signup' && step === 'idcard' && (
            <>
              <h2 className="text-xl font-bold text-white mb-2 text-center">ถ่ายบัตรประชาชน</h2>
              <StepIndicator current="idcard" />
              <div className="space-y-4">
                <div className="relative aspect-[1.586:1] w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-slate-800 border border-white/10">
                  {idCardDataUrl ? (
                    <img src={idCardDataUrl} alt="บัตรประชาชน" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                      <IdCard className="w-12 h-12 mb-3" />
                      <p className="text-sm text-center px-4">ถ่ายรูปด้านหน้าของบัตรประชาชน</p>
                    </div>
                  )}
                </div>
                {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
                {idCardDataUrl ? (
                  <button onClick={() => setIdCardDataUrl(null)} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-all text-sm">
                    ถ่ายใหม่
                  </button>
                ) : (
                  <label className="w-full py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <Camera className="w-5 h-5" /> เลือกรูปบัตรประชาชน
                    <input type="file" accept="image/*" capture="environment" onChange={handleIdCardFile} className="hidden" />
                  </label>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setStep('identity')} className="px-4 py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2">
                    <ArrowLeft className="w-5 h-5" /> ย้อนกลับ
                  </button>
                  <button onClick={() => setStep('selfie')} disabled={!idCardDataUrl} className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    ถัดไป <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step 4: Selfie with face matching */}
          {mode === 'signup' && step === 'selfie' && (
            <>
              <h2 className="text-xl font-bold text-white mb-2 text-center">ถ่ายภาพหน้าตรง</h2>
              <StepIndicator current="selfie" />
              <div className="space-y-4">
                <div className="relative aspect-square w-full max-w-xs mx-auto rounded-2xl overflow-hidden bg-slate-800 border border-white/10">
                  {selfieDataUrl ? (
                    <img src={selfieDataUrl} alt="selfie" className="w-full h-full object-cover" />
                  ) : cameraActive ? (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                      <Camera className="w-12 h-12 mb-3" />
                      <p className="text-sm text-center px-4">เปิดกล้องเพื่อถ่ายภาพหน้าตรง</p>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                {cameraError && <div className="flex items-center gap-1.5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{cameraError}</div>}

                {/* Face match result */}
                {faceMatch !== null && (
                  <div className={`px-4 py-3 rounded-xl border text-sm ${
                    faceMatch >= 85
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  }`}>
                    {faceMatch >= 85 ? (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">ตรวจพบใบหน้าคล้ายกับผู้ใช้ในระบบ {faceMatch}%</p>
                          <p className="mt-1">กรุณาไปยืนยันตัวตนที่ธนาคาร P Bank เพื่อความปลอดภัย</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Check className="w-5 h-5 shrink-0" />
                        ยืนยันตัวตนสำเร็จ ใบหน้าไม่ตรงกับผู้ใช้ในระบบ
                      </div>
                    )}
                  </div>
                )}

                {faceChecking && (
                  <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
                    <Loader2 className="w-5 h-5 animate-spin" /> กำลังตรวจสอบใบหน้า...
                  </div>
                )}

                {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}

                {!selfieDataUrl && !cameraActive && (
                  <button onClick={startCamera} className="w-full py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                    <Camera className="w-5 h-5" /> เปิดกล้อง
                  </button>
                )}
                {!selfieDataUrl && cameraActive && (
                  <button onClick={captureSelfie} className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2">
                    <Camera className="w-5 h-5" /> ถ่ายภาพ
                  </button>
                )}
                {selfieDataUrl && !faceChecking && faceMatch === null && (
                  <button onClick={() => { setSelfieDataUrl(null); startCamera(); }} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-all text-sm">
                    ถ่ายใหม่
                  </button>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => { stopCamera(); setStep('idcard'); }} className="px-4 py-3.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2">
                    <ArrowLeft className="w-5 h-5" /> ย้อนกลับ
                  </button>
                  <button onClick={handleSignup} disabled={loading || !selfieDataUrl || faceChecking} className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> กำลังสมัคร...</> : <><ShieldCheck className="w-5 h-5" /> สมัครใช้งาน</>}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Done */}
          {mode === 'signup' && step === 'done' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 mb-4">
                <Check className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">สมัครสำเร็จ!</h2>
              <p className="text-slate-400 text-sm">กำลังนำคุณเข้าสู่ระบบ...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
