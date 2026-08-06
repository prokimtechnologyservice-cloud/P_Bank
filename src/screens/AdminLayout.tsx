import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  Store,
  Receipt,
  LogOut,
  Wallet,
  UserPlus,
  UserCog,
  Activity,
} from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import type { ReactNode } from 'react';

const navItems = [
  { path: '/admin', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { path: '/admin/users', label: 'ผู้ใช้งาน', icon: Users },
  { path: '/admin/create-account', label: 'สร้างบัญชี', icon: UserPlus },
  { path: '/admin/transactions', label: 'ธุรกรรม', icon: ArrowLeftRight },
  { path: '/admin/merchants', label: 'ร้านค้า', icon: Store },
  { path: '/admin/charges', label: 'คำสั่งเรียกเก็บ', icon: Receipt },
  { path: '/admin/employees', label: 'พนักงาน', icon: UserCog },
  { path: '/admin/activity-logs', label: 'บันทึกกิจกรรม', icon: Activity },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, logout } = useAdmin();

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-white/5 flex flex-col fixed h-full print:hidden">
        <div className="px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">P Bank</p>
              <p className="text-slate-500 text-xs">Admin Console</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/20 to-orange-600/20 text-amber-400 border border-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
              {admin?.username?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{admin?.username || 'Admin'}</p>
              <p className="text-slate-500 text-xs">ผู้ดูแลระบบ</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 p-6 overflow-auto">{children}</main>
    </div>
  );
}
