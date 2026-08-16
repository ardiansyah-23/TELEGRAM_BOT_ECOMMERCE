import { supabase } from './client';
import type { SubscriptionPlan, User } from './types';

export const getSubscriptionPlans = async (onlyActive = true): Promise<SubscriptionPlan[]> => {
  let query = supabase.from('subscription_plans').select('*').order('price');
  if (onlyActive) query = query.eq('is_active', true);
  
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching subscription plans:', error);
    return [];
  }
  return data as SubscriptionPlan[];
};

export const getSubscriptionPlanById = async (id: string): Promise<SubscriptionPlan | null> => {
  const { data, error } = await supabase.from('subscription_plans').select('*').eq('id', id).single();
  if (error) return null;
  return data as SubscriptionPlan;
};

export const createSubscriptionPlan = async (
  name: string,
  duration_days: number,
  price: number,
  description: string | null = null
): Promise<SubscriptionPlan | null> => {
  const { data, error } = await supabase
    .from('subscription_plans')
    .insert([{ name, duration_days, price, description }])
    .select()
    .single();
    
  if (error) return null;
  return data as SubscriptionPlan;
};

export const isMembershipActive = (user: User): boolean => {
  if (user.membership_level !== 'premium') return false;
  if (!user.membership_expires_at) return false;
  return new Date(user.membership_expires_at) > new Date();
};
