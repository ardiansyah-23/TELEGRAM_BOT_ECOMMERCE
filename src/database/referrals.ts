import { supabase } from './client';
import type { Referral } from './types';

export const createReferral = async (referrer_telegram_id: number, referred_telegram_id: number): Promise<boolean> => {
  // Check if self-referral
  if (referrer_telegram_id === referred_telegram_id) return false;
  
  // Try inserting. It will fail if referred user already has a referral due to unique constraint.
  const { error } = await supabase
    .from('referrals')
    .insert([{ referrer_telegram_id, referred_telegram_id }]);
    
  if (error) return false;
  return true;
};

export const getPendingReferral = async (referred_telegram_id: number): Promise<Referral | null> => {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referred_telegram_id', referred_telegram_id)
    .eq('status', 'pending')
    .single();
    
  if (error) return null;
  return data as Referral;
};

export const markReferralRewarded = async (referral_id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('referrals')
    .update({ 
      status: 'rewarded', 
      rewarded_at: new Date().toISOString() 
    })
    .eq('id', referral_id)
    .eq('status', 'pending');
    
  return !error;
};

export const getUserByReferralCode = async (code: string): Promise<number | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('telegram_id')
    .eq('referral_code', code)
    .single();
    
  if (error || !data) return null;
  return data.telegram_id;
};
