import { supabase } from './client';
import type { CartItem } from './types';

export const getCart = async (telegram_id: number): Promise<CartItem[]> => {
  const { data, error } = await supabase
    .from('cart_items')
    .select('*, products(*)')
    .eq('telegram_id', telegram_id)
    .order('created_at', { ascending: true });
    
  if (error) {
    console.error('Error fetching cart:', error);
    return [];
  }
  return data as CartItem[];
};

export const addToCart = async (telegram_id: number, product_id: string, quantity = 1): Promise<boolean> => {
  // Check if exists
  const { data: existing } = await supabase
    .from('cart_items')
    .select('*')
    .eq('telegram_id', telegram_id)
    .eq('product_id', product_id)
    .single();
    
  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id);
    return !error;
  } else {
    const { error } = await supabase
      .from('cart_items')
      .insert([{ telegram_id, product_id, quantity }]);
    return !error;
  }
};

export const updateCartQuantity = async (telegram_id: number, product_id: string, quantity: number): Promise<boolean> => {
  if (quantity <= 0) {
    return removeFromCart(telegram_id, product_id);
  }
  
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('telegram_id', telegram_id)
    .eq('product_id', product_id);
    
  return !error;
};

export const removeFromCart = async (telegram_id: number, product_id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('telegram_id', telegram_id)
    .eq('product_id', product_id);
    
  return !error;
};

export const clearCart = async (telegram_id: number): Promise<void> => {
  await supabase.from('cart_items').delete().eq('telegram_id', telegram_id);
};
