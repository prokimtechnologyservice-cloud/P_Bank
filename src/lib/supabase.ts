import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Account = {
  id: string;
  user_id: string;
  account_number: string;
  account_name: string;
  balance: number;
  created_at: string;
};

export type Transaction = {
  id: string;
  from_account_id: string | null;
  to_account_id: string | null;
  amount: number;
  memo: string;
  slip_code: string;
  created_at: string;
};

export type TransactionWithParties = Transaction & {
  from_account?: { account_number: string; account_name: string } | null;
  to_account?: { account_number: string; account_name: string } | null;
};

export type Merchant = {
  id: string;
  user_id: string;
  business_name: string;
  business_email: string;
  api_key: string;
  webhook_url: string;
  settlement_account_id: string | null;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  created_at: string;
};

export type Charge = {
  id: string;
  merchant_id: string;
  amount: number;
  currency: string;
  reference: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  short_code: string;
  payer_account_id: string | null;
  transaction_id: string | null;
  expires_at: string;
  created_at: string;
  paid_at: string | null;
};

export type ChargeWithMerchant = Charge & {
  merchant_name?: string;
};

export type AdminStats = {
  total_accounts: number;
  total_balance: number;
  total_transactions: number;
  total_volume: number;
  total_merchants: number;
  pending_merchants: number;
  active_merchants: number;
  total_charges: number;
  paid_charges: number;
  pending_charges: number;
};

export type AdminAccount = {
  id: string;
  user_id: string;
  account_number: string;
  account_name: string;
  balance: number;
  created_at: string;
};

export type AdminTransaction = {
  id: string;
  from_account_id: string | null;
  to_account_id: string | null;
  amount: number;
  memo: string;
  slip_code: string;
  created_at: string;
  from_name: string | null;
  to_name: string | null;
  from_number: string | null;
  to_number: string | null;
};

export type AdminMerchant = {
  id: string;
  user_id: string;
  business_name: string;
  business_email: string;
  webhook_url: string;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  settlement_account_id: string | null;
  created_at: string;
  api_key: string;
};
