import { supabase } from './client';
import type { Category } from './types';

export const getCategories = async (onlyActive = true): Promise<Category[]> => {
  let query = supabase.from('categories').select('*').order('name');
  if (onlyActive) query = query.eq('is_active', true);
  
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
  return data as Category[];
};

export const getCategoryById = async (id: string): Promise<Category | null> => {
  const { data, error } = await supabase.from('categories').select('*').eq('id', id).single();
  if (error) return null;
  return data as Category;
};

export const createCategory = async (name: string, slug: string, description: string | null = null): Promise<Category | null> => {
  const { data, error } = await supabase
    .from('categories')
    .insert([{ name, slug, description }])
    .select()
    .single();
  if (error) {
    console.error('Error creating category:', error);
    return null;
  }
  return data as Category;
};

export const updateCategory = async (id: string, updates: Partial<Category>): Promise<void> => {
  await supabase.from('categories').update(updates).eq('id', id);
};
