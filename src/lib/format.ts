import type { Transaction, Account } from '@/lib/supabase';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

export function getTransactionDirection(
  tx: Transaction,
  myAccountId: string
): 'in' | 'out' {
  return tx.from_account_id === myAccountId ? 'out' : 'in';
}

export function formatAccountNumber(num: string): string {
  return num.replace(/(\d{3})(\d{3})(\d{1})(\d{3})/, '$1-$2-$3-$4');
}
