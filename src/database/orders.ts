import { supabase } from './client';
import type { Order, OrderItem } from './types';

// The RPC method for atomic checkout
export const checkoutCartAtomic = async (telegram_id: number, order_number: string, order_note?: string): Promise<string | null> => {
  const { data, error } = await supabase.rpc('checkout_cart', {
    p_telegram_id: telegram_id,
    p_order_number: order_number,
    p_order_note: order_note || null
  });
  
  if (error) {
    console.error('Checkout error:', error);
    throw new Error(error.message);
  }
  
  return data as string; // returns order_id UUID
};

export const getUserOrders = async (telegram_id: number, limit = 5, offset = 0): Promise<{ data: Order[], count: number }> => {
  const { data, count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('telegram_id', telegram_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
    
  if (error) return { data: [], count: 0 };
  return { data: data as Order[], count: count || 0 };
};

export const getOrderById = async (id: string): Promise<{ order: Order, items: OrderItem[] } | null> => {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error || !order) return null;
  
  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', id);
    
  return { order: order as Order, items: (items || []) as OrderItem[] };
};

export const updateOrderStatus = async (id: string, status: string): Promise<boolean> => {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  return !error;
};
