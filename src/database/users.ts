import { supabase } from './client';
import type { User, Role } from './types';
import { config } from '../config/env';

export const getUserByTelegramId = async (telegram_id: number): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegram_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "No rows found" error
    console.error('Error fetching user by telegram_id:', error);
  }

  return data as User | null;
};

export const createUser = async (
  telegram_id: number,
  username?: string,
  first_name?: string,
  last_name?: string,
  language_code?: string
): Promise<User | null> => {
  
  // Determine role based on ADMIN_TELEGRAM_ID
  const role: Role = (config.ADMIN_TELEGRAM_ID && telegram_id.toString() === config.ADMIN_TELEGRAM_ID) 
    ? 'admin' 
    : 'user';

  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        telegram_id,
        username: username || null,
        first_name: first_name || null,
        last_name: last_name || null,
        language_code: language_code || null,
        role
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    return null;
  }

  return data as User;
};

export const updateUser = async (
  telegram_id: number,
  updates: Partial<Omit<User, 'id' | 'telegram_id' | 'created_at'>>
): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('telegram_id', telegram_id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user:', error);
    return null;
  }

  return data as User;
};

export const updateLastSeen = async (telegram_id: number): Promise<void> => {
  await supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('telegram_id', telegram_id);
};

export const countUsers = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error counting users:', error);
    return 0;
  }

  return count || 0;
};

export const countActiveUsers = async (): Promise<number> => {
  // Define "active" as seen within the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gte('last_seen_at', sevenDaysAgo.toISOString())
    .eq('is_active', true);

  if (error) {
    console.error('Error counting active users:', error);
    return 0;
  }

  return count || 0;
};
