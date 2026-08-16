import { supabase } from './client';
import type { Payment, PaymentEvent } from './types';

export const getPaymentByOrderId = async (order_id: string): Promise<Payment | null> => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', order_id)
    .single();
    
  if (error || !data) return null;
  return data as Payment;
};

export const getPaymentById = async (id: string): Promise<Payment | null> => {
  const { data, error } = await supabase
    .from('payments')
    .select('*, orders(*)')
    .eq('id', id)
    .single();
    
  if (error || !data) return null;
  return data as Payment;
};

export const createPayment = async (
  order_id: string,
  provider: string,
  amount: number,
  currency: string = 'IDR'
): Promise<Payment | null> => {
  const { data, error } = await supabase
    .from('payments')
    .insert([{ order_id, provider, amount, currency }])
    .select()
    .single();
    
  if (error) {
    console.error('Error creating payment:', error);
    return null;
  }
  return data as Payment;
};

export const updatePayment = async (id: string, updates: Partial<Payment>): Promise<boolean> => {
  const { error } = await supabase.from('payments').update(updates).eq('id', id);
  return !error;
};

export const createPaymentEvent = async (
  payment_id: string,
  event_type: string,
  provider_event_id: string,
  payload_hash?: string
): Promise<boolean> => {
  const { error } = await supabase
    .from('payment_events')
    .insert([{ payment_id, event_type, provider_event_id, payload_hash }]);
    
  if (error) {
    // If it's a unique constraint violation, it means event was already processed
    if (error.code === '23505') return false; 
    console.error('Error creating payment event:', error);
    return false;
  }
  return true;
};
