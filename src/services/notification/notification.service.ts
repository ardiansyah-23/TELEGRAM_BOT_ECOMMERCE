import { supabase } from '../../database/client';
import type { NotificationPreference } from '../../database/types';
import { bot } from '../../bot';

export class NotificationService {
  async getPreferences(telegram_id: number): Promise<NotificationPreference> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('telegram_id', telegram_id)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching preferences', error);
    }
    
    if (data) return data as NotificationPreference;
    
    // Create default if not exists
    const defaultPrefs = {
      telegram_id,
      order_notifications: true,
      payment_notifications: true,
      membership_notifications: true,
      reward_notifications: true,
      campaign_notifications: true,
      system_notifications: true
    };
    
    await supabase.from('notification_preferences').insert([defaultPrefs]);
    
    return defaultPrefs as NotificationPreference;
  }
  
  async updatePreferences(telegram_id: number, updates: Partial<NotificationPreference>): Promise<boolean> {
    const { error } = await supabase
      .from('notification_preferences')
      .update(updates)
      .eq('telegram_id', telegram_id);
      
    return !error;
  }
  
  async sendNotification(
    telegram_id: number, 
    type: keyof Omit<NotificationPreference, 'telegram_id' | 'created_at' | 'updated_at'>, 
    message: string, 
    parse_mode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML'
  ): Promise<boolean> {
    // 1. Check preference
    const prefs = await this.getPreferences(telegram_id);
    if (!prefs[type]) {
      console.log(`Skipped notification to ${telegram_id} because preference ${type} is OFF`);
      return false; // Opted out
    }
    
    // 2. Send message
    try {
      await bot.api.sendMessage(telegram_id, message, { parse_mode });
      return true;
    } catch (e) {
      console.error(`Failed to send notification to ${telegram_id}`, e);
      return false;
    }
  }
}

export const notificationService = new NotificationService();
