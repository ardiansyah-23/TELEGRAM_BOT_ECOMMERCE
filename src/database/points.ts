import { supabase } from './client';
import type { Wallet, PointTransaction } from './types';

export const getWallet = async (telegram_id: number): Promise<Wallet | null> => {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('telegram_id', telegram_id)
    .single();
    
  if (error) return null;
  return data as Wallet;
};

export const getPointTransactions = async (telegram_id: number, limit = 5, offset = 0): Promise<{ data: PointTransaction[], count: number }> => {
  const { data, count, error } = await supabase
    .from('point_transactions')
    .select('*', { count: 'exact' })
    .eq('telegram_id', telegram_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
    
  if (error) return { data: [], count: 0 };
  return { data: data as PointTransaction[], count: count || 0 };
};

export const processPointTransactionAtomic = async (
  telegram_id: number,
  type: 'credit' | 'debit',
  amount: number,
  reference_type: string | null = null,
  reference_id: string | null = null,
  description: string | null = null
): Promise<boolean> => {
  const { error } = await supabase.rpc('process_point_transaction', {
    p_telegram_id: telegram_id,
    p_type: type,
    p_amount: amount,
    p_ref_type: reference_type,
    p_ref_id: reference_id,
    p_description: description
  });
  
  if (error) {
    console.error('Point transaction error:', error);
    return false;
  }
  return true;
};
