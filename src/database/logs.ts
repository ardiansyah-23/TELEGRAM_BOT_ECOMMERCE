import { supabase } from './client';
import type { ActivityLog } from './types';

export const logActivity = async (
  telegram_id: number,
  action: string,
  metadata?: any
): Promise<ActivityLog | null> => {
  // Determine if it's a bot event (command or callback)
  if (action.startsWith('/') || action.startsWith('callback:')) {
    const eventType = action.startsWith('/') ? 'command' : 'button_click';
    await supabase.from('bot_events').insert([{
      telegram_id,
      event_type: eventType,
      event_name: action,
      metadata: metadata || {}
    }]);
  }

  const { data, error } = await supabase
    .from('activity_logs')
    .insert([
      {
        actor_id: telegram_id,
        action,
        metadata: metadata || null,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error logging activity:', error);
    return null;
  }

  return data as ActivityLog;
};
