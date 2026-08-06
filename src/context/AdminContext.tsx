import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

type AdminUser = {
  id: string;
  username: string;
};

type AdminContextType = {
  admin: AdminUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
};

const AdminContext = createContext<AdminContextType>({
  admin: null,
  loading: false,
  login: async () => false,
  logout: () => {},
});

const STORAGE_KEY = 'pbank_admin_session';

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load admin session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setAdmin(JSON.parse(stored));
    } catch {
      // localStorage not available
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_login', {
        p_username: username,
        p_password: password,
      });
      if (error || !data || (data as unknown[]).length === 0) {
        setLoading(false);
        return false;
      }
      const adminUser = (data as AdminUser[])[0];
      setAdmin(adminUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(adminUser));
      setLoading(false);
      return true;
    } catch {
      setLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setAdmin(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AdminContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
