import { supabase } from './client';
import type { Product } from './types';

export const getProducts = async (onlyActive = true): Promise<Product[]> => {
  let query = supabase.from('products').select('*, categories(name)').order('created_at', { ascending: false });
  if (onlyActive) query = query.eq('is_active', true);
  
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }
  return data as Product[];
};

export const getProductsByCategory = async (category_id: string, onlyActive = true): Promise<Product[]> => {
  let query = supabase.from('products').select('*, categories(name)').eq('category_id', category_id).order('name');
  if (onlyActive) query = query.eq('is_active', true);
  
  const { data, error } = await query;
  if (error) return [];
  return data as Product[];
};

export const getProductById = async (id: string): Promise<Product | null> => {
  const { data, error } = await supabase.from('products').select('*, categories(name)').eq('id', id).single();
  if (error) return null;
  return data as Product;
};

export const createProduct = async (
  category_id: string, name: string, slug: string, price: number, stock: number, description: string | null = null
): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .insert([{ category_id, name, slug, price, stock, description }])
    .select()
    .single();
  if (error) {
    console.error('Error creating product:', error);
    return null;
  }
  return data as Product;
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<void> => {
  await supabase.from('products').update(updates).eq('id', id);
};

export const updateStock = async (id: string, newStock: number): Promise<void> => {
  await supabase.from('products').update({ stock: newStock }).eq('id', id);
};
