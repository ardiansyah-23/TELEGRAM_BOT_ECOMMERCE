import { supabase } from './client';
import type { Broadcast } from './types';

export const createBroadcast = async (
  admin_telegram_id: number,
  message_type: string,
  target: string,
  total_target: number
): Promise<Broadcast | null> => {
  const { data, error } = await supabase
    .from('broadcasts')
    .insert([
      {
        admin_telegram_id,
        message_type,
        target,
        total_target
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating broadcast:', error);
    return null;
  }
  return data as Broadcast;
};

export const updateBroadcastStatus = async (
  id: string,
  updates: Partial<Pick<Broadcast, 'status' | 'total_sent' | 'total_failed' | 'completed_at'>>
): Promise<void> => {
  await supabase
    .from('broadcasts')
    .update(updates)
    .eq('id', id);
};
