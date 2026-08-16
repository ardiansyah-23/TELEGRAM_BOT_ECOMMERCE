import { supabase } from './client';
import type { Coupon } from './types';

export const getCoupons = async (onlyActive = true): Promise<Coupon[]> => {
  let query = supabase.from('coupons').select('*').order('created_at', { ascending: false });
  if (onlyActive) query = query.eq('is_active', true);
  
  const { data, error } = await query;
  if (error) return [];
  return data as Coupon[];
};

export const getCouponByCode = async (code: string): Promise<Coupon | null> => {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code)
    .single();
    
  if (error) return null;
  return data as Coupon;
};

export const createCoupon = async (
  code: string,
  type: 'percentage' | 'fixed',
  value: number,
  minimum_order: number = 0,
  usage_limit: number | null = null
): Promise<Coupon | null> => {
  const { data, error } = await supabase
    .from('coupons')
    .insert([{ code, type, value, minimum_order, usage_limit }])
    .select()
    .single();
    
  if (error) {
    console.error('Error creating coupon:', error);
    return null;
  }
  return data as Coupon;
};

// RPC for new checkout with voucher
export const checkoutCartWithVoucherAtomic = async (
  telegram_id: number,
  order_number: string,
  coupon_code: string | null = null
): Promise<string | null> => {
  const { data, error } = await supabase.rpc('checkout_cart_with_voucher', {
    p_telegram_id: telegram_id,
    p_order_number: order_number,
    p_coupon_code: coupon_code
  });
  
  if (error) {
    console.error('Checkout error:', error);
    throw new Error(error.message);
  }
  return data as string;
};
