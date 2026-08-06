import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, type Account } from '@/lib/supabase';

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .maybeSingle();
    if (error) {
      console.error('fetchAccount error', error);
    }
    setAccount(data as Account | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  return { account, loading, refresh: fetchAccount, setAccount };
}

export function useRequireAccount() {
  const navigate = useNavigate();
  const { account, loading, refresh, setAccount } = useAccount();

  useEffect(() => {
    if (!loading && !account) {
      navigate('/');
    }
  }, [account, loading, navigate]);

  return { account, loading, refresh, setAccount };
}
