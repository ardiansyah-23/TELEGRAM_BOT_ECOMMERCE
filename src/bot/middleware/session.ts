import { session, StorageAdapter } from 'grammy';
import { supabase } from '../../database/client';

class SupabaseAdapter implements StorageAdapter<any> {
  async read(key: string) {
    const { data } = await supabase
      .from('bot_sessions')
      .select('value')
      .eq('id', key)
      .single();
    
    return data ? data.value : undefined;
  }

  async write(key: string, value: any) {
    await supabase
      .from('bot_sessions')
      .upsert({ id: key, value }, { onConflict: 'id' });
  }

  async delete(key: string) {
    await supabase
      .from('bot_sessions')
      .delete()
      .eq('id', key);
  }
}

export const sessionMiddleware = () => {
  return session({
    initial: () => ({}),
    storage: new SupabaseAdapter(),
  });
};
